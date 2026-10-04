import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';

import { iconSize, minTouchTarget, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  testID?: string;
  color?: 'primary' | 'text' | 'textSecondary';
};

/** Icon-only button: 48x48dp touch target, always has an accessible label. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  selected,
  testID,
  color = 'primary',
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      android_ripple={{ color: colors.pressed, borderless: true, radius: 24 }}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.pressed }]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={iconSize.md}
        color={colors[color]}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
