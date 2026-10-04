import { ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = { children: ReactNode; scroll?: boolean };

/** Themed screen background with safe-area top inset; tab bar handles the bottom. */
export function ScreenContainer({ children, scroll = true }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  };
  if (!scroll) {
    return (
      <View style={[styles.fill, padding, { backgroundColor: colors.background }]}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, padding]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Keeps lines readable on wide screens/tablets.
  content: { gap: spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
