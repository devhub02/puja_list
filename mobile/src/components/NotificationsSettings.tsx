import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useNotificationPermission } from '@/hooks/useNotificationPermission';
import { useReminderController } from '@/hooks/useReminderController';
import { getNotificationScheduler, hasNotificationScheduler } from '@/notifications/scheduler';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { notify } from '@/utils/notify';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { ReminderDialogs } from './ReminderDialogs';
import { SectionHeader } from './SectionHeader';

/**
 * The Notifications section of Settings: the global switch, the permission status line, and links to
 * Manage reminders and the system notification settings. Needs the database (it pauses/reschedules reminders).
 */
export function NotificationsSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const permission = useNotificationPermission();
  const reminders = useReminderController({
    preparationId: null,
    getPreparationId: () => Promise.reject(new Error('Not used here')),
  });

  const openSystemSettings = async () => {
    try {
      await getNotificationScheduler().openSystemSettings();
    } catch {
      notify(t('settings.notifications.openSystemFailed'));
    }
  };

  return (
    <>
      <View style={styles.section}>
        <SectionHeader
          title={t('settings.notifications.title')}
          description={t('settings.notifications.description')}
        />
        <Card>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <AppText variant="subheading">{t('settings.notifications.switchLabel')}</AppText>
              <AppText variant="bodySmall" color="textSecondary" testID="notifications-state">
                {t(
                  notificationsEnabled
                    ? 'settings.notifications.switchOn'
                    : 'settings.notifications.switchOff',
                )}
              </AppText>
            </View>
            <View style={styles.switchBox}>
              <Switch
                testID="notifications-switch"
                accessibilityRole="switch"
                accessibilityLabel={t('settings.notifications.switchLabel')}
                accessibilityState={{ checked: notificationsEnabled }}
                value={notificationsEnabled}
                onValueChange={(next) => void reminders.setGlobal(next)}
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
          {!notificationsEnabled ? (
            <AppText variant="bodySmall" testID="notifications-off-note">
              {t('settings.notifications.offNote')}
            </AppText>
          ) : null}
          <AppText variant="bodySmall" color="textSecondary" testID="permission-line">
            {`${t('settings.notifications.permissionLabel')}: ${t(`settings.notifications.permission.${permission.line}`)}`}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t('reminders.batteryNote')}
          </AppText>
        </Card>
        <Button
          testID="settings-manage-reminders"
          variant="outline"
          icon="bell-outline"
          label={t('settings.notifications.manage')}
          onPress={() => router.push('/reminders')}
        />
        <Button
          testID="settings-open-system"
          variant="outline"
          icon="cog-outline"
          label={t('settings.notifications.openSystem')}
          disabled={!hasNotificationScheduler()}
          onPress={() => void openSystemSettings()}
        />
      </View>

      <ReminderDialogs
        dialog={reminders.dialog}
        onClose={reminders.closeDialog}
        onConfirmDelete={(reminder) => void reminders.confirmDelete(reminder)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchText: { flex: 1 },
  switchBox: { minWidth: 48, minHeight: 48, justifyContent: 'center' },
});
