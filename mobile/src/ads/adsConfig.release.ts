import type { AdPlacement } from './adsConfig';

/**
 * Real AdMob ad unit ids for a RELEASE build, one per placement. Fill before release.
 *
 * Leave a placement empty ('') to disable it: a release build with no id configured shows NO ad
 * for that placement (never a test ad, never a placeholder). See docs/ADS_SETUP.md for where to
 * get these ids and how to fill them in safely.
 *
 * NEVER commit a real AdMob ad unit id here. This file must only ever contain empty strings in
 * git history; `__tests__/adsConfig.test.ts` fails if it finds one.
 */
export const RELEASE_AD_UNIT_IDS: Record<AdPlacement, string> = {
  home_banner: 'ca-app-pub-5617515296566823/6818693740', // LOCAL BUILD ONLY - revert before commit
  library_banner: 'ca-app-pub-5617515296566823/2648434315', // LOCAL BUILD ONLY - revert before commit
};
