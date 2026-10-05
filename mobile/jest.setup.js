jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
}));

// Safe default for the whole suite: the real native ads SDK is never loaded in Jest. Individual
// ads tests mock `@/ads/nativeAdsModule` (our own thin wrapper) for finer control; everything else
// just needs this raw package to not crash on import, with ads disabled and consent not required.
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const notRequired = { canRequestAds: false, privacyOptionsRequirementStatus: 'NOT_REQUIRED' };
  return {
    __esModule: true,
    default: () => ({
      initialize: jest.fn().mockResolvedValue([]),
      setRequestConfiguration: jest.fn().mockResolvedValue(undefined),
    }),
    BannerAd: (props) => React.createElement('BannerAd', props),
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test-adaptive-banner-id', BANNER: 'test-banner-id' },
    MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
    AdsConsent: {
      gatherConsent: jest.fn().mockResolvedValue(notRequired),
      showPrivacyOptionsForm: jest.fn().mockResolvedValue(notRequired),
    },
    AdsConsentStatus: {
      UNKNOWN: 'UNKNOWN',
      REQUIRED: 'REQUIRED',
      NOT_REQUIRED: 'NOT_REQUIRED',
      OBTAINED: 'OBTAINED',
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      UNKNOWN: 'UNKNOWN',
      REQUIRED: 'REQUIRED',
      NOT_REQUIRED: 'NOT_REQUIRED',
    },
  };
});
