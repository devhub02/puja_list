import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { maxSystemFontMultiplier } from '@/theme/tokens';
import type { TextVariant, ThemeColors } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TextVariant;
  color?: keyof ThemeColors;
};

const headingVariants: readonly TextVariant[] = ['display', 'title', 'heading'];

/** The only text primitive: applies theme font, scaled size, Devanagari-safe line height. */
export function AppText({ variant = 'body', color, style, accessibilityRole, ...rest }: Props) {
  const { colors, textStyle } = useTheme();
  const isHeading = headingVariants.includes(variant);
  return (
    <Text
      accessibilityRole={accessibilityRole ?? (isHeading ? 'header' : undefined)}
      maxFontSizeMultiplier={maxSystemFontMultiplier}
      {...rest}
      style={[
        textStyle(variant),
        { color: colors[color ?? (isHeading ? 'heading' : 'text')] },
        style,
      ]}
    />
  );
}
