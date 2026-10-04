import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the whole group. */
  accessibilityLabel: string;
  testIDPrefix?: string;
};

/** Single-choice selector. Stacks vertically when the OS font scale is very large. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testIDPrefix,
}: Props<T>) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.group,
        stacked && styles.stacked,
        { borderColor: colors.borderStrong, backgroundColor: colors.surface },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: colors.pressed }}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: selected
                  ? colors.primary
                  : pressed
                    ? colors.pressed
                    : 'transparent',
              },
            ]}
          >
            <AppText
              variant="label"
              color={selected ? 'onPrimary' : 'text'}
              style={styles.label}
              maxFontSizeMultiplier={1.3}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
    overflow: 'hidden',
  },
  stacked: { flexDirection: 'column' },
  segment: {
    flex: 1,
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
