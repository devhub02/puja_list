import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';

import { iconSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  badge?: string;
  /** Optional recovery action, e.g. "Clear filters". */
  action?: { label: string; onPress: () => void };
};

/** Centered message card for "nothing here" states, with an optional recovery action. */
export function EmptyState({ icon, title, body, badge, action }: Props) {
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
      {action ? <Button variant="outline" label={action.label} onPress={action.onPress} /> : null}
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
