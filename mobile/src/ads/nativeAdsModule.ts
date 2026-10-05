/**
 * The ONLY file that imports `react-native-google-mobile-ads` directly. Every other file in
 * `src/ads` goes through this thin re-export so tests can mock one module instead of the native
 * package (same pattern as `src/notifications/expoScheduler.ts` for `expo-notifications`).
 */
export {
  default as mobileAds,
  BannerAd,
  BannerAdSize,
  TestIds,
  MaxAdContentRating,
  AdsConsent,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';
export type { AdsConsentInfo } from 'react-native-google-mobile-ads';
