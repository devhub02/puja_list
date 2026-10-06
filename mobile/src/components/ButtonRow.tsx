import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { spacing } from '@/theme/tokens';

/**
 * A row of buttons and icon buttons. A label must never break inside a word: when the items do not fit on
 * one line the row wraps onto the next line instead of squeezing them. Buttons inside the row use
 * `buttonRowItem` so each keeps its natural width. See docs/DESIGN_SYSTEM.md ("Button rows").
 */
export function ButtonRow({
  children,
  testID,
  style,
}: {
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View testID={testID} style={[styles.row, style]}>
      {children}
    </View>
  );
}

/** Style for a `Button` inside a ButtonRow: it may grow to share a line, and never shrinks below its label. */
export const buttonRowItem: ViewStyle = { flexGrow: 1, flexShrink: 0 };

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
