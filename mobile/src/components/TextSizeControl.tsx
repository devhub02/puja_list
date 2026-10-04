import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';
import { minTouchTarget, radius, spacing, textSizeOrder } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';

/**
 * A- / A+ for reading screens. It changes the SAME global text-size setting as Settings (no separate
 * value), so the whole app follows. Both buttons are 48dp; the one at its limit is disabled.
 */
export function TextSizeControl() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const textSize = useSettingsStore((s) => s.textSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const index = textSizeOrder.indexOf(textSize);
  const sizeName = t(`settings.textSize.${textSize}`);

  const button = (
    label: string,
    glyph: string,
    fontSize: number,
    disabled: boolean,
    next: number,
    testID: string,
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setTextSize(textSizeOrder[next])}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: colors.borderStrong,
          backgroundColor: pressed ? colors.pressed : colors.surface,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <AppText variant="label" color="text" style={{ fontSize }} maxFontSizeMultiplier={1}>
        {glyph}
      </AppText>
    </Pressable>
  );

  return (
    <View style={styles.row} accessibilityLabel={t('vidhi.textSize')}>
      {button(t('vidhi.smaller'), 'A−', 15, index <= 0, index - 1, 'text-smaller')}
      <AppText
        variant="caption"
        color="textSecondary"
        style={styles.value}
        accessibilityLiveRegion="polite"
        accessibilityLabel={t('vidhi.sizeValue', { size: sizeName })}
        testID="text-size-value"
      >
        {sizeName}
      </AppText>
      {button(
        t('vidhi.larger'),
        'A+',
        21,
        index >= textSizeOrder.length - 1,
        index + 1,
        'text-larger',
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  button: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 56, textAlign: 'center' },
});
