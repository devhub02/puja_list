import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'maxLength'
  | 'multiline'
  | 'autoFocus'
  | 'onSubmitEditing'
> & {
  /** Visible label above the field (never placeholder-only). */
  label: string;
  /** Error shown under the field and announced. */
  error?: string;
  testID?: string;
};

/** Labelled text input with a visible focus ring and an error line. Min height 48dp. */
export function TextField({ label, error, testID, multiline, ...rest }: Props) {
  const { colors, textStyle } = useTheme();
  const [focused, setFocused] = useState(false);
  const font = textStyle('body');
  return (
    <View style={styles.wrap}>
      <AppText variant="bodySmall" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        maxFontSizeMultiplier={1.6}
        textAlignVertical={multiline ? 'top' : 'center'}
        // No lineHeight: an explicit one clips Devanagari matras inside Android text fields.
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.text,
            fontFamily: font.fontFamily,
            fontSize: font.fontSize,
            backgroundColor: colors.surface,
            borderColor: error || focused ? colors.focusRing : colors.borderStrong,
          },
        ]}
        {...rest}
      />
      {error ? (
        <AppText
          variant="bodySmall"
          color="heading"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  multiline: { minHeight: 96 },
});
