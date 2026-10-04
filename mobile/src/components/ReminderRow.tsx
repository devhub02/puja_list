import { memo } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Reminder } from '@/db/repositories';
import type { LanguageCode } from '@/i18n/registry';
import { useTheme } from '@/theme/ThemeProvider';
import { minTouchTarget, spacing } from '@/theme/tokens';
import { describeReminderTime, reminderGroup, reminderStatusKey } from '@/utils/reminderDisplay';

import { AppText } from './AppText';
import { Card } from './Card';
import { IconButton } from './IconButton';

type Props = {
  reminder: Reminder;
  language: LanguageCode;
  now: Date;
  /** Shown above the time, e.g. the puja name (Manage reminders screen). */
  heading?: string;
  onToggle: (reminder: Reminder, enabled: boolean) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
};

/**
 * One reminder: time, optional note, a status line (never colour only) and an on/off switch, edit and delete.
 * A reminder whose time has passed cannot be switched on; it can still be edited (to a new time) or deleted.
 */
function ReminderRowBase({ reminder, language, now, heading, onToggle, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const when = describeReminderTime(reminder.scheduledAt, language);
  const past = reminderGroup(reminder, now) === 'past';
  const status = t(`reminders.status.${reminderStatusKey(reminder, now)}`);
  return (
    <Card testID={`reminder-${reminder.id}`} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.text}>
          {heading ? (
            <AppText variant="bodySmall" color="goldText" numberOfLines={2}>
              {heading}
            </AppText>
          ) : null}
          <AppText variant="subheading" testID={`reminder-when-${reminder.id}`}>
            {when}
          </AppText>
          {reminder.label ? (
            <AppText
              variant="bodySmall"
              color="textSecondary"
              testID={`reminder-label-${reminder.id}`}
            >
              {reminder.label}
            </AppText>
          ) : null}
          <AppText
            variant="bodySmall"
            color="textSecondary"
            testID={`reminder-status-${reminder.id}`}
          >
            {status}
          </AppText>
        </View>
        <View style={styles.switchBox}>
          <Switch
            testID={`reminder-switch-${reminder.id}`}
            accessibilityRole="switch"
            accessibilityLabel={t('reminders.toggleLabel', { when })}
            accessibilityState={{ checked: reminder.enabled && !past, disabled: past }}
            value={reminder.enabled && !past}
            disabled={past}
            onValueChange={(next) => onToggle(reminder, next)}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <IconButton
          testID={`reminder-edit-${reminder.id}`}
          icon="pencil-outline"
          color="text"
          accessibilityLabel={t('reminders.editFor', { when })}
          onPress={() => onEdit(reminder)}
        />
        <IconButton
          testID={`reminder-delete-${reminder.id}`}
          icon="trash-can-outline"
          color="text"
          accessibilityLabel={t('reminders.deleteFor', { when })}
          onPress={() => onDelete(reminder)}
        />
      </View>
    </Card>
  );
}

export const ReminderRow = memo(ReminderRowBase);

const styles = StyleSheet.create({
  card: { gap: spacing.xxs },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  text: { flex: 1, gap: spacing.xxs },
  switchBox: { minWidth: minTouchTarget, minHeight: minTouchTarget, justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
});
