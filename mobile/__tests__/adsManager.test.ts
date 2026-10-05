import {
  initAdsIfAllowed,
  isAdsInitialized,
  startAdsFlow,
  __resetAdsManagerForTests,
} from '@/ads/AdsManager';
import { __resetConsentForTests, gatherConsent } from '@/ads/consent';
import { AdsConsentPrivacyOptionsRequirementStatus } from '@/ads/nativeAdsModule';

const mockGatherConsent = jest.fn();
const mockSetRequestConfiguration = jest.fn();
const mockInitialize = jest.fn();

jest.mock('@/ads/nativeAdsModule', () => ({
  AdsConsent: {
    gatherConsent: (...args: unknown[]) => mockGatherConsent(...args),
    showPrivacyOptionsForm: jest.fn(),
  },
  AdsConsentPrivacyOptionsRequirementStatus: {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
  },
  mobileAds: () => ({
    setRequestConfiguration: (...args: unknown[]) => mockSetRequestConfiguration(...args),
    initialize: (...args: unknown[]) => mockInitialize(...args),
  }),
  MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
}));

function allowConsent() {
  mockGatherConsent.mockResolvedValue({
    canRequestAds: true,
    privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
  });
}

function denyConsent() {
  mockGatherConsent.mockResolvedValue({
    canRequestAds: false,
    privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  });
}

describe('AdsManager', () => {
  beforeEach(() => {
    __resetConsentForTests();
    __resetAdsManagerForTests();
    mockGatherConsent.mockReset();
    mockSetRequestConfiguration.mockReset().mockResolvedValue(undefined);
    mockInitialize.mockReset().mockResolvedValue([]);
  });

  it('never initializes the SDK before consent allows it', async () => {
    denyConsent();
    await startAdsFlow();
    expect(mockSetRequestConfiguration).not.toHaveBeenCalled();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(isAdsInitialized()).toBe(false);
  });

  it('initializes the SDK once consent allows ads', async () => {
    allowConsent();
    await startAdsFlow();
    expect(mockSetRequestConfiguration).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(isAdsInitialized()).toBe(true);
  });

  it('never initializes twice', async () => {
    allowConsent();
    await startAdsFlow();
    await initAdsIfAllowed();
    await initAdsIfAllowed();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it('a failed initialize() never crashes and leaves the app usable', async () => {
    allowConsent();
    mockInitialize.mockRejectedValue(new Error('Play Services missing'));
    await expect(startAdsFlow()).resolves.toBeUndefined();
    expect(isAdsInitialized()).toBe(false);
  });

  it('a failed gatherConsent() never crashes and never initializes ads', async () => {
    mockGatherConsent.mockRejectedValue(new Error('offline'));
    await expect(startAdsFlow()).resolves.toBeUndefined();
    expect(mockInitialize).not.toHaveBeenCalled();
    expect(isAdsInitialized()).toBe(false);
  });

  it('re-gathering consent after a denial can still initialize ads later', async () => {
    denyConsent();
    await startAdsFlow();
    expect(isAdsInitialized()).toBe(false);

    allowConsent();
    await gatherConsent();
    // gatherConsent's state-change notification kicks off initAdsIfAllowed() without awaiting it
    // (see the `subscribeConsent` call at the bottom of AdsManager.ts); call it directly here so
    // the test does not depend on that fire-and-forget microtask having settled already.
    await initAdsIfAllowed();
    expect(isAdsInitialized()).toBe(true);
  });
});
