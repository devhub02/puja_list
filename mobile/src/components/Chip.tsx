import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** radio = one of a group (category, type); checkbox = an on/off shortcut. */
  role?: 'radio' | 'checkbox';
  testID?: string;
};

/** Filter chip. 48dp tall; selected = filled saffron (state is also exposed to screen readers). */
export function Chip({ label, selected, onPress, role = 'radio', testID }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={
        role === 'radio' ? { selected, checked: selected } : { checked: selected }
      }
      onPress={onPress}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: selected ? colors.primary : pressed ? colors.pressed : colors.surface,
        },
      ]}
    >
      <AppText variant="bodySmall" color={selected ? 'onPrimary' : 'text'} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
