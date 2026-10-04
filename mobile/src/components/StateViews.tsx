import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

/** Spinner with a spoken/visible label. Used while the (offline, fast) database read is running. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const text = label ?? t('common.loading');
  return (
    <View
      testID="loading-state"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      style={styles.loading}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText color="textSecondary">{text}</AppText>
    </View>
  );
}

type ErrorProps = { title?: string; body?: string; onRetry?: () => void; actionLabel?: string };

/** Translated error card with an optional action (default: Try again). */
export function ErrorState({ title, body, onRetry, actionLabel }: ErrorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
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
        <AppText variant="heading" style={styles.centered} testID="error-title">
          {title ?? t('common.errorTitle')}
        </AppText>
        <AppText color="textSecondary" style={styles.centered}>
          {body ?? t('common.errorBody')}
        </AppText>
      </View>
      {onRetry ? (
        <Button
          testID="error-action"
          label={actionLabel ?? t('common.retry')}
          onPress={onRetry}
          icon="refresh"
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
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
});
