import {
  __resetConsentForTests,
  gatherConsent,
  getConsentState,
  showPrivacyOptions,
  subscribeConsent,
} from '@/ads/consent';
import { AdsConsentPrivacyOptionsRequirementStatus } from '@/ads/nativeAdsModule';

const mockGatherConsent = jest.fn();
const mockShowPrivacyOptionsForm = jest.fn();

jest.mock('@/ads/nativeAdsModule', () => ({
  AdsConsent: {
    gatherConsent: (...args: unknown[]) => mockGatherConsent(...args),
    showPrivacyOptionsForm: (...args: unknown[]) => mockShowPrivacyOptionsForm(...args),
  },
  AdsConsentPrivacyOptionsRequirementStatus: {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
  },
}));

describe('ads consent', () => {
  beforeEach(() => {
    __resetConsentForTests();
    mockGatherConsent.mockReset();
    mockShowPrivacyOptionsForm.mockReset();
  });

  it('starts fail-closed before anything is requested', () => {
    expect(getConsentState()).toEqual({ canRequestAds: false, privacyOptionsRequired: false });
  });

  it('allows ads once consent is obtained and not required', async () => {
    mockGatherConsent.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
    });
    const state = await gatherConsent();
    expect(state).toEqual({ canRequestAds: true, privacyOptionsRequired: false });
    expect(getConsentState()).toEqual(state);
  });

  it('exposes privacyOptionsRequired when the SDK requires it (granted)', async () => {
    mockGatherConsent.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    });
    const state = await gatherConsent();
    expect(state).toEqual({ canRequestAds: true, privacyOptionsRequired: true });
  });

  it('is fail-closed when consent is required but denied', async () => {
    mockGatherConsent.mockResolvedValue({
      canRequestAds: false,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
    });
    const state = await gatherConsent();
    expect(state).toEqual({ canRequestAds: false, privacyOptionsRequired: true });
  });

  it('fails closed on error or timeout and never throws', async () => {
    mockGatherConsent.mockRejectedValue(new Error('network timeout'));
    const state = await gatherConsent();
    expect(state).toEqual({ canRequestAds: false, privacyOptionsRequired: false });
  });

  it('notifies subscribers on every state change', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConsent(listener);
    mockGatherConsent.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
    });
    await gatherConsent();
    expect(listener).toHaveBeenCalledWith({ canRequestAds: true, privacyOptionsRequired: false });
    unsubscribe();
    await gatherConsent();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('showPrivacyOptions updates state and never throws on failure', async () => {
    mockShowPrivacyOptionsForm.mockRejectedValue(new Error('no form configured'));
    await expect(showPrivacyOptions()).resolves.toBeUndefined();

    mockShowPrivacyOptionsForm.mockResolvedValue({
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
    });
    await showPrivacyOptions();
    expect(getConsentState()).toEqual({ canRequestAds: true, privacyOptionsRequired: false });
  });
});
