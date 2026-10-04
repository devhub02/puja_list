import { StyleSheet, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  /** 0..1 */
  value: number;
  /** Accessible name, e.g. "Checklist progress". */
  label: string;
  /** Spoken value, e.g. "7 of 20 items checked". */
  valueText: string;
  height?: number;
  testID?: string;
};

/** Determinate progress bar. Filled part is saffron on a tinted track with a strong outline (3:1). */
export function ProgressBar({ value, label, valueText, height = 10, testID }: Props) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const now = Math.round(clamped * 100);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now, text: valueText }}
      style={[
        styles.track,
        { height, backgroundColor: colors.surfaceAlt, borderColor: colors.borderStrong },
      ]}
    >
      <View style={[styles.fill, { width: `${now}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
