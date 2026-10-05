import { TestIds } from './nativeAdsModule';
import { RELEASE_AD_UNIT_IDS } from './adsConfig.release';

/** The only two ad placements this app ever shows (see CLAUDE.md "Ads rules"). */
export type AdPlacement = 'home_banner' | 'library_banner';

const DEV_AD_UNIT_IDS: Record<AdPlacement, string> = {
  home_banner: TestIds.ADAPTIVE_BANNER,
  library_banner: TestIds.ADAPTIVE_BANNER,
};

/**
 * The ad unit id to request for a placement, or `null` when the placement must show no ad at all.
 * Development/debug builds (`__DEV__`) always use Google's test ids. A release build reads the real
 * id from `adsConfig.release.ts`; an empty placeholder there disables that placement (no ads, and
 * never a silent fallback to test ads).
 */
export function getAdUnitId(placement: AdPlacement): string | null {
  if (__DEV__) {
    return DEV_AD_UNIT_IDS[placement];
  }
  const realId = RELEASE_AD_UNIT_IDS[placement];
  return realId ? realId : null;
}
