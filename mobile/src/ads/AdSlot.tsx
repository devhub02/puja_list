import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { isAdsInitialized, subscribeAdsReady } from './AdsManager';
import { getAdUnitId } from './adsConfig';
import type { AdPlacement } from './adsConfig';
import { getConsentState, subscribeConsent } from './consent';
import { BannerAd, BannerAdSize } from './nativeAdsModule';

type Props = {
  placement: AdPlacement;
};

/**
 * Renders a single adaptive banner for one placement, or nothing at all. Zero height and no
 * placeholder until an ad has actually loaded; collapses back to nothing on any load error or
 * while offline (a load failure covers both); never remounts on re-render because `unitId` is
 * stable for the lifetime of the component. Lifecycle-safe: no state is set after unmount.
 */
export function AdSlot({ placement }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(() => isAdsInitialized() && getConsentState().canRequestAds);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = () => {
      if (!mountedRef.current) return;
      setReady(isAdsInitialized() && getConsentState().canRequestAds);
    };
    const unsubConsent = subscribeConsent(refresh);
    const unsubAds = subscribeAdsReady(refresh);
    refresh();
    return () => {
      mountedRef.current = false;
      unsubConsent();
      unsubAds();
    };
  }, []);

  const unitId = getAdUnitId(placement);

  if (!unitId || !ready || failed) {
    return null;
  }

  return (
    <View
      style={loaded ? [styles.container, { borderColor: colors.border }] : styles.collapsed}
      testID={`ad-slot-${placement}`}
    >
      {loaded ? (
        <AppText variant="caption" color="textSecondary" style={styles.label}>
          {t('ads.label')}
        </AppText>
      ) : null}
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => {
          if (mountedRef.current) setLoaded(true);
        }}
        onAdFailedToLoad={() => {
          if (mountedRef.current) setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  collapsed: { height: 0, overflow: 'hidden' },
  container: {
    alignItems: 'center',
    marginVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  label: { textTransform: 'uppercase', letterSpacing: 0.5 },
});
