import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';

import { iconSize, minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Toggle state (e.g. "saved"), exposed to screen readers. */
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Full-width-capable button, at least 48dp tall. Colour-only pressed feedback (no layout shift). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  selected,
  accessibilityLabel,
  testID,
}: Props) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const textColor = primary ? 'onPrimary' : 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }
          : {
              backgroundColor: pressed ? colors.pressed : 'transparent',
              borderColor: colors.primary,
              borderWidth: 1.5,
            },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={iconSize.md}
          color={colors[textColor]}
          importantForAccessibility="no"
        />
      ) : null}
      <AppText variant="subheading" color={textColor} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: { textAlign: 'center', flexShrink: 1 },
});
