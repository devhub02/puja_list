import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';

import { iconSize, minTouchTarget, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  value: string;
  onChangeText?: (text: string) => void;
  /** Keyboard "search" action. */
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Launcher mode (Home): the bar looks the same but is a button that opens the Search screen, so no
   * keyboard pops up on Home. `value` and the typing callbacks are ignored.
   */
  onPress?: () => void;
  ref?: Ref<TextInput>;
  testID?: string;
};

/**
 * The one search field used on Home (launcher), Library (filters in place) and Search (live results).
 * Clear (X) empties the text and keeps focus; the typed text is never lost when the keyboard closes.
 */
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
  placeholder,
  autoFocus,
  onPress,
  ref,
  testID = 'search-bar',
}: Props) {
  const { t } = useTranslation();
  const { colors, textStyle } = useTheme();
  const [focused, setFocused] = useState(false);
  const hint = placeholder ?? t('search.placeholder');

  const frame = [
    styles.frame,
    {
      backgroundColor: colors.surface,
      borderColor: focused ? colors.focusRing : colors.borderStrong,
    },
  ];
  const icon = (
    <MaterialCommunityIcons
      name="magnify"
      size={iconSize.md}
      color={colors.textSecondary}
      importantForAccessibility="no"
    />
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={hint}
        accessibilityHint={t('a11y.openSearch')}
        onPress={onPress}
        android_ripple={{ color: colors.pressed }}
        style={frame}
      >
        {icon}
        <AppText color="textSecondary" style={styles.placeholder} numberOfLines={1}>
          {hint}
        </AppText>
      </Pressable>
    );
  }

  const font = textStyle('body');
  return (
    <View style={frame} accessibilityRole="search">
      {icon}
      <TextInput
        testID={`${testID}-input`}
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={() => onSubmit?.(value)}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        autoFocus={autoFocus}
        placeholder={hint}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={t('search.label')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        selectionColor={colors.primary}
        maxFontSizeMultiplier={1.6}
        // No lineHeight here: an explicit line height clips Devanagari matras inside Android text fields.
        style={[
          styles.input,
          { color: colors.text, fontFamily: font.fontFamily, fontSize: font.fontSize },
        ]}
      />
      {value.length > 0 ? (
        <IconButton
          testID={`${testID}-clear`}
          icon="close-circle"
          color="textSecondary"
          accessibilityLabel={t('search.clear')}
          onPress={() => onChangeText?.('')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget + 4,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  input: { flex: 1, minHeight: minTouchTarget, paddingVertical: spacing.xs },
  placeholder: { flex: 1 },
});
