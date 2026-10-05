import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Reminder } from '@/db/repositories';
import { useReminderController } from '@/hooks/useReminderController';
import { useQuickPicks, useReminders } from '@/hooks/useReminders';
import { MAX_REMINDERS_PER_PREPARATION } from '@/notifications/reminderService';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { pickDate, pickTime } from '@/utils/dateTimePicker';
import { parseReminderTime } from '@/utils/reminderTime';

import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { ReminderDialogs } from './ReminderDialogs';
import { ReminderRow } from './ReminderRow';
import { ErrorState, LoadingState } from './StateViews';
import { TextField } from './TextField';
import { formatCalendarDate, formatClockTime } from '@/i18n/format';
import { parseIso } from '@/utils/dateUtils';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Display name of the puja (and label) the reminders are for. */
  title: string;
  pujaId: string | null;
  /** The preparation, or null before the first reminder creates the default one (see `getPreparationId`). */
  preparationId: string | null;
  /** Creates the default preparation lazily, on the first save only. */
  getPreparationId: () => Promise<string>;
  /** Open straight into the edit form of this reminder. */
  editReminderId?: string | null;
};

type Form = {
  editingId: string | null;
  date: string | null;
  time: string | null;
  label: string;
};

const emptyForm: Form = { editingId: null, date: null, time: null, label: '' };

/**
 * Bottom sheet for the reminders of ONE preparation: the list (switch, edit, delete), and a form with a date
 * picker, a time picker, quick picks (only with a real bundled festival date) and an optional note.
 */
export function ReminderSheet(props: Props) {
  // Mounted only while open, so a hidden sheet never reads reminders or festival dates.
  return props.visible ? <ReminderSheetBody {...props} /> : null;
}

function ReminderSheetBody({
  visible,
  onClose,
  title,
  pujaId,
  preparationId,
  getPreparationId,
  editReminderId = null,
}: Props) {
  const { t } = useTranslation();
  const { colors, shadow } = useTheme();
  const { height } = useWindowDimensions();
  const language = useSettingsStore((s) => s.language);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const all = useReminders();
  const picks = useQuickPicks(pujaId);
  const controller = useReminderController({ preparationId, getPreparationId });
  const [draft, setDraft] = useState<Form | null>(null);
  const now = new Date();

  const mine = useMemo<Reminder[]>(
    () =>
      all.status === 'ready' && preparationId
        ? all.data.filter((r) => r.preparationId === preparationId)
        : [],
    [all, preparationId],
  );

  // Opening for one reminder (from Manage reminders) goes straight to its form.
  const editTarget =
    visible && editReminderId ? mine.find((r) => r.id === editReminderId) : undefined;
  const form: Form | null = draft ?? (editTarget ? formFor(editTarget) : null);
  const update = (patch: Partial<Form>) => {
    if (form) setDraft({ ...form, ...patch });
  };
  const close = () => {
    setDraft(null);
    controller.clearError();
    onClose();
  };

  /** Leaves the form: back to the list, or closes the sheet when it was opened just to edit one reminder. */
  const leaveForm = () => {
    if (editReminderId) {
      close();
      return;
    }
    setDraft(null);
    controller.clearError();
  };

  const startEdit = (reminder: Reminder) => {
    controller.clearError();
    setDraft(formFor(reminder));
  };

  const choosePick = (date: string) => update({ date });

  const chooseDate = async () => {
    if (!form) return;
    const minimum = new Date();
    minimum.setHours(0, 0, 0, 0);
    const date = await pickDate(form.date, minimum);
    if (date) update({ date });
  };
  const chooseTime = async () => {
    if (!form) return;
    const time = await pickTime(form.time);
    if (time) update({ time });
  };

  const save = async () => {
    if (!form || !form.date || !form.time) return;
    const ok = await controller.save({
      editingId: form.editingId,
      date: form.date,
      time: form.time,
      label: form.label,
    });
    if (ok) leaveForm();
  };

  const atLimit = mine.length >= MAX_REMINDERS_PER_PREPARATION;
  const dateText = form?.date ? describeDate(form.date, language) : null;
  const timeText = form?.time ? describeTime(form.time, language) : null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={form ? leaveForm : close}
      >
        <View style={styles.root}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={close}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
          <View
            testID="reminder-sheet"
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                maxHeight: height * 0.92,
              },
              shadow(2),
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              {form ? (
                <>
                  <AppText variant="heading" accessibilityRole="header">
                    {t(form.editingId ? 'reminders.editTitle' : 'reminders.newTitle')}
                  </AppText>
                  <AppText variant="bodySmall" color="textSecondary">
                    {title}
                  </AppText>

                  {picks.status === 'ready' && picks.data.length > 0 ? (
                    <View style={styles.group} testID="quick-picks">
                      <AppText variant="subheading" accessibilityRole="header">
                        {t('reminders.quickTitle')}
                      </AppText>
                      <View style={styles.chips}>
                        {picks.data.map((pick) => (
                          <Chip
                            key={pick.kind}
                            testID={`quick-${pick.kind}`}
                            role="button"
                            label={t(
                              pick.kind === 'dayBefore'
                                ? 'reminders.quickDayBefore'
                                : 'reminders.quickMorningOf',
                            )}
                            selected={form.date === pick.date}
                            onPress={() => choosePick(pick.date)}
                          />
                        ))}
                      </View>
                      <AppText variant="caption" color="textSecondary">
                        {t('reminders.quickHint')}
                      </AppText>
                    </View>
                  ) : null}

                  <View style={styles.group}>
                    <Button
                      testID="pick-date"
                      variant="outline"
                      icon="calendar-month-outline"
                      label={
                        dateText
                          ? t('reminders.dateValue', { value: dateText })
                          : t('reminders.chooseDate')
                      }
                      accessibilityLabel={`${t('reminders.date')}: ${dateText ?? t('reminders.chooseDate')}`}
                      onPress={() => void chooseDate()}
                    />
                    <Button
                      testID="pick-time"
                      variant="outline"
                      icon="clock-outline"
                      label={
                        timeText
                          ? t('reminders.timeValue', { value: timeText })
                          : t('reminders.chooseTime')
                      }
                      accessibilityLabel={`${t('reminders.time')}: ${timeText ?? t('reminders.chooseTime')}`}
                      onPress={() => void chooseTime()}
                    />
                  </View>

                  <TextField
                    testID="reminder-label-input"
                    label={t('reminders.labelField')}
                    value={form.label}
                    maxLength={60}
                    onChangeText={(label) => update({ label })}
                  />

                  {controller.error ? (
                    <AppText
                      color="heading"
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      testID="reminder-error"
                    >
                      {controller.error}
                    </AppText>
                  ) : !form.date || !form.time ? (
                    <AppText variant="bodySmall" color="textSecondary" testID="reminder-need">
                      {t('reminders.needDateTime')}
                    </AppText>
                  ) : null}

                  <AppText variant="caption" color="textSecondary">
                    {t('reminders.batteryNote')}
                  </AppText>

                  <View style={styles.group}>
                    <Button
                      testID="reminder-save"
                      label={t(form.editingId ? 'reminders.saveChanges' : 'reminders.save')}
                      disabled={!form.date || !form.time || controller.busy}
                      onPress={() => void save()}
                    />
                    <Button
                      testID="reminder-form-cancel"
                      variant="outline"
                      label={t('reminders.cancel')}
                      onPress={leaveForm}
                    />
                  </View>
                </>
              ) : (
                <>
                  <AppText variant="heading" accessibilityRole="header">
                    {t('reminders.title')}
                  </AppText>
                  <AppText variant="bodySmall" color="textSecondary" testID="reminder-sheet-title">
                    {title}
                  </AppText>
                  <Card tone="alt" testID="battery-note">
                    <AppText variant="bodySmall">{t('reminders.batteryNote')}</AppText>
                  </Card>
                  {!notificationsEnabled ? (
                    <Card tone="alt" testID="notifications-off-note">
                      <AppText variant="bodySmall">{t('reminders.permission.offBody')}</AppText>
                    </Card>
                  ) : null}

                  {all.status === 'loading' ? <LoadingState /> : null}
                  {all.status === 'error' ? <ErrorState onRetry={all.retry} /> : null}
                  {all.status === 'ready' && mine.length === 0 ? (
                    <AppText color="textSecondary" testID="reminder-empty">
                      {t('reminders.emptyList')}
                    </AppText>
                  ) : null}
                  {mine.map((reminder) => (
                    <ReminderRow
                      key={reminder.id}
                      reminder={reminder}
                      language={language}
                      now={now}
                      onToggle={(r, enabled) => void controller.toggle(r, enabled)}
                      onEdit={startEdit}
                      onDelete={controller.askDelete}
                    />
                  ))}

                  <AppText variant="caption" color="textSecondary">
                    {t('reminders.sheetHint', { max: MAX_REMINDERS_PER_PREPARATION })}
                  </AppText>
                  <View style={styles.group}>
                    <Button
                      testID="reminder-add"
                      icon="bell-plus-outline"
                      label={t(mine.length > 0 ? 'reminders.addAnother' : 'reminders.add')}
                      disabled={atLimit}
                      onPress={() => {
                        controller.clearError();
                        setDraft({ ...emptyForm });
                      }}
                    />
                    <Button
                      testID="reminder-sheet-close"
                      variant="outline"
                      label={t('reminders.close')}
                      onPress={close}
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ReminderDialogs
        dialog={controller.dialog}
        onClose={controller.closeDialog}
        onConfirmDelete={(reminder) => void controller.confirmDelete(reminder)}
      />
    </>
  );
}

function formFor(reminder: Reminder): Form {
  const parsed = parseReminderTime(reminder.scheduledAt);
  return {
    editingId: reminder.id,
    date: parsed?.date ?? null,
    time: parsed
      ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`
      : null,
    label: reminder.label ?? '',
  };
}

function describeDate(iso: string, language: Parameters<typeof formatCalendarDate>[1]): string {
  const ymd = parseIso(iso);
  return ymd ? formatCalendarDate(ymd, language) : iso;
}

function describeTime(time: string, language: Parameters<typeof formatClockTime>[2]): string {
  return formatClockTime(Number(time.slice(0, 2)), Number(time.slice(3, 5)), language);
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(28, 20, 17, 0.6)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
