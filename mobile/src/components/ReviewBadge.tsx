import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ComponentProps } from 'react';

import type { ReviewStatus } from '@/db/types';
import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const icons: Record<ReviewStatus, IconName> = {
  ai_drafted: 'robot-outline',
  cross_checked: 'check-all',
  expert_verified: 'check-decagram',
};

type Props = { status: ReviewStatus; testID?: string };

/** The visible review label required for every puja that is not expert verified. */
export function ReviewBadge({ status, testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t(`review.${status}`)}
      style={[styles.badge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
    >
      <MaterialCommunityIcons
        name={icons[status]}
        size={iconSize.sm - 4}
        color={colors.primary}
        importantForAccessibility="no"
      />
      <AppText variant="caption" style={styles.text}>
        {t(`review.${status}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  text: { flexShrink: 1 },
});
