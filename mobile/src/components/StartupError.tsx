import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { iconSize, minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Card } from './Card';
import { ScreenContainer } from './ScreenContainer';

type Props = {
  onRetry: () => void;
  /** True while a retry is running: the button is disabled and says so. */
  busy?: boolean;
};

/** Shown when the content database could not be prepared. Offers Retry; never blocks on the network. */
export function StartupError({ onRetry, busy = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <View
          style={[styles.halo, { backgroundColor: colors.primaryTint, borderColor: colors.gold }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={iconSize.hero}
            color={colors.primary}
          />
        </View>
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.message}>
          <AppText variant="heading" style={styles.centered} testID="startup-error-title">
            {t('startup.errorTitle')}
          </AppText>
          <AppText color="textSecondary" style={styles.centered}>
            {t('startup.errorBody')}
          </AppText>
        </View>
        <Pressable
          testID="startup-retry"
          accessibilityRole="button"
          accessibilityLabel={t('startup.retry')}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: busy ? 0.7 : pressed ? 0.85 : 1 },
          ]}
        >
          <AppText variant="subheading" style={{ color: colors.onPrimary }}>
            {busy ? t('startup.retrying') : t('startup.retry')}
          </AppText>
        </Pressable>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  halo: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { gap: spacing.xs, alignSelf: 'stretch' },
  centered: { textAlign: 'center' },
  button: {
    minHeight: minTouchTarget,
    minWidth: 160,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
