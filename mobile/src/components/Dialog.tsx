import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';

export type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: ComponentProps<typeof Button>['variant'];
  icon?: ComponentProps<typeof Button>['icon'];
  testID?: string;
};

type Props = {
  visible: boolean;
  title: string;
  /** Closes the dialog: Android back, tapping outside, and the Cancel action all end up here. */
  onClose: () => void;
  /** Plain explanatory text. */
  message?: string;
  /** Extra content (fields, lists) shown under the message. */
  children?: ReactNode;
  /** Stacked full-width buttons, first = main action. A Cancel is NOT added automatically. */
  actions: DialogAction[];
  testID?: string;
};

/**
 * Accessible modal dialog. Android back and a tap outside close it. The title is a heading, buttons are
 * stacked full width (48dp+) so they stay usable at the largest text size, and long content scrolls.
 */
export function Dialog({ visible, title, onClose, message, children, actions, testID }: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              maxHeight: height * 0.86,
            },
            shadow(2),
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <AppText variant="heading" accessibilityRole="header">
              {title}
            </AppText>
            {message ? <AppText>{message}</AppText> : null}
            {children}
            <View style={styles.actions}>
              {actions.map((action) => (
                <Button
                  key={action.label}
                  label={action.label}
                  variant={action.variant ?? 'outline'}
                  icon={action.icon}
                  testID={action.testID}
                  onPress={action.onPress}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  backdrop: { backgroundColor: 'rgba(28, 20, 17, 0.6)' },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
});
