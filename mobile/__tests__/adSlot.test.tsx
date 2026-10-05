import { act, screen } from '@testing-library/react-native';

import { AdSlot } from '@/ads/AdSlot';
import { isAdsInitialized } from '@/ads/AdsManager';
import { getConsentState } from '@/ads/consent';

import { renderThemed } from '../testing/utils';

type BannerProps = {
  unitId: string;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: Error) => void;
};

let lastBannerProps: BannerProps | null = null;

jest.mock('@/ads/nativeAdsModule', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    BannerAd: (props: BannerProps) => {
      lastBannerProps = props;
      return React.createElement('BannerAd', { testID: 'native-banner-ad' });
    },
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test-adaptive-banner-id' },
  };
});

jest.mock('@/ads/AdsManager', () => ({
  isAdsInitialized: jest.fn(() => false),
  subscribeAdsReady: jest.fn(() => () => {}),
}));

jest.mock('@/ads/consent', () => ({
  getConsentState: jest.fn(() => ({ canRequestAds: false, privacyOptionsRequired: false })),
  subscribeConsent: jest.fn(() => () => {}),
}));

function markReady() {
  (isAdsInitialized as jest.Mock).mockReturnValue(true);
  (getConsentState as jest.Mock).mockReturnValue({
    canRequestAds: true,
    privacyOptionsRequired: false,
  });
}

describe('AdSlot', () => {
  beforeEach(() => {
    lastBannerProps = null;
    (isAdsInitialized as jest.Mock).mockReturnValue(false);
    (getConsentState as jest.Mock).mockReturnValue({
      canRequestAds: false,
      privacyOptionsRequired: false,
    });
  });

  it('renders nothing while ads are not ready (consent not granted / not initialized)', async () => {
    await renderThemed(<AdSlot placement="home_banner" />);
    expect(screen.queryByTestId('ad-slot-home_banner')).toBeNull();
    expect(screen.queryByTestId('native-banner-ad')).toBeNull();
  });

  it('renders nothing (zero height, no label) until the ad has actually loaded', async () => {
    markReady();
    await renderThemed(<AdSlot placement="home_banner" />);
    // The banner is mounted (so it can load) but the visible, labelled slot has not appeared yet.
    expect(screen.queryByText('Advertisement')).toBeNull();
  });

  it('shows the labelled slot once the ad loads', async () => {
    markReady();
    await renderThemed(<AdSlot placement="home_banner" />);
    await act(async () => {
      lastBannerProps?.onAdLoaded?.();
    });
    expect(screen.getByText('Advertisement')).toBeTruthy();
    expect(screen.getByTestId('ad-slot-home_banner')).toBeTruthy();
  });

  it('collapses back to nothing on a load error (covers offline too)', async () => {
    markReady();
    await renderThemed(<AdSlot placement="home_banner" />);
    await act(async () => {
      lastBannerProps?.onAdLoaded?.();
    });
    expect(screen.getByText('Advertisement')).toBeTruthy();
    await act(async () => {
      lastBannerProps?.onAdFailedToLoad?.(new Error('network-error'));
    });
    expect(screen.queryByText('Advertisement')).toBeNull();
    expect(screen.queryByTestId('ad-slot-home_banner')).toBeNull();
  });

  it('does not update state after unmount', async () => {
    markReady();
    const { unmount } = await renderThemed(<AdSlot placement="home_banner" />);
    const onAdLoaded = lastBannerProps?.onAdLoaded;
    await unmount();
    expect(() => act(() => onAdLoaded?.())).not.toThrow();
  });
});
