import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children: ReactNode;
  tone?: 'surface' | 'alt';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, tone = 'surface', style }: Props) {
  const { colors, shadow } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone === 'alt' ? colors.surfaceAlt : colors.surface,
          borderColor: colors.border,
        },
        shadow(1),
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
