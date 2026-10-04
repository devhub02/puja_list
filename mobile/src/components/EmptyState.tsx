import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';

import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Card } from './Card';

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  badge?: string;
};

/** Honest placeholder for a section whose feature arrives in a later phase. */
export function EmptyState({ icon, title, body, badge }: Props) {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <View
        style={[styles.halo, { backgroundColor: colors.primaryTint, borderColor: colors.gold }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <MaterialCommunityIcons name={icon} size={iconSize.hero} color={colors.primary} />
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
          <AppText variant="label" color="goldText">
            {badge}
          </AppText>
        </View>
      ) : null}
      <AppText variant="heading" style={styles.centered}>
        {title}
      </AppText>
      <AppText color="textSecondary" style={styles.centered}>
        {body}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  halo: {
    width: 112,
    height: 112,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  centered: { textAlign: 'center' },
});
