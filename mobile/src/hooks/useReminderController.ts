import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDatabase } from '@/db/DatabaseProvider';
import type { Reminder } from '@/db/repositories';
import { ensureNotificationPermission } from '@/notifications/permissionFlow';
import type { PermissionOutcome } from '@/notifications/permissionFlow';
import {
  MAX_REMINDERS_PER_PREPARATION,
  ReminderError,
  checkEditedReminder,
  checkNewReminder,
  createReminder,
  removeReminder,
  setReminderEnabled,
  updateReminderDetails,
} from '@/notifications/reminderService';
import {
  channelDefinition,
  createReminderDeps,
  reconcileAndRefresh,
} from '@/notifications/runtime';
import { useReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { notify } from '@/utils/notify';
import { isPastReminder, joinDateTime } from '@/utils/reminderTime';

/** What the permission step ended with: a real outcome, or `off` when the global switch is off. */
export type PermissionStep = PermissionOutcome | 'off';

/** A dialog the sheet or screen must show on behalf of the controller. */
export type ReminderDialog =
  | null
  | { kind: 'why'; answer: (proceed: boolean) => void }
  | { kind: 'paused'; reason: Exclude<PermissionStep, 'granted'> }
  | { kind: 'delete'; reminder: Reminder };

export type SaveInput = {
  /** Set when editing an existing reminder. */
  editingId: string | null;
  date: string;
  time: string;
  label: string;
};

/**
 * The reminder actions the UI needs (save, enable/disable, delete) with the permission flow in front:
 * validate first, ask for permission only for a valid reminder, then save. A reminder that cannot be
 * scheduled (notifications off, permission refused) is still saved, paused.
 */
export function useReminderController(options: {
  /** The preparation, or null until the first save creates the default one. */
  preparationId: string | null;
  getPreparationId: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const db = useDatabase();
  const bump = useReminderStore((s) => s.bump);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ReminderDialog>(null);
  const { preparationId, getPreparationId } = options;

  const errorText = useCallback(
    (cause: unknown): string =>
      cause instanceof ReminderError
        ? t(`reminders.errors.${cause.code}`, { max: MAX_REMINDERS_PER_PREPARATION })
        : t('reminders.errors.generic'),
    [t],
  );

  /** Never asks at start-up: only called from a save or an enable. */
  const permissionStep = useCallback(async (): Promise<PermissionStep> => {
    if (!useSettingsStore.getState().notificationsEnabled) return 'off';
    const deps = createReminderDeps(db);
    return ensureNotificationPermission(
      deps.scheduler,
      channelDefinition(),
      () =>
        new Promise<boolean>((resolve) => {
          setDialog({
            kind: 'why',
            answer: (proceed) => {
              setDialog(null);
              resolve(proceed);
            },
          });
        }),
    );
  }, [db]);

  const afterStep = useCallback((step: PermissionStep) => {
    if (step !== 'granted') setDialog({ kind: 'paused', reason: step });
  }, []);

  const save = useCallback(
    async (input: SaveInput): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const deps = createReminderDeps(db);
        const scheduledAt = joinDateTime(input.date, input.time);
        // A time that can never fire is refused BEFORE the default preparation is created for it.
        if (isPastReminder(scheduledAt, deps.now())) throw new ReminderError('past');
        const prepId = input.editingId ? null : (preparationId ?? (await getPreparationId()));
        if (input.editingId) await checkEditedReminder(deps, input.editingId, scheduledAt);
        else await checkNewReminder(deps, { preparationId: prepId as string, scheduledAt });
        const step = await permissionStep();
        const saved = input.editingId
          ? await updateReminderDetails(deps, input.editingId, {
              scheduledAt,
              label: input.label,
            })
          : await createReminder(deps, {
              preparationId: prepId as string,
              scheduledAt,
              label: input.label,
            });
        bump();
        notify(
          saved.notificationId
            ? t(input.editingId ? 'reminders.updated' : 'reminders.saved')
            : t('reminders.savedPaused'),
        );
        afterStep(step);
        return true;
      } catch (cause) {
        if (!(cause instanceof ReminderError)) console.error('Could not save the reminder', cause);
        setError(errorText(cause));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [db, preparationId, getPreparationId, permissionStep, afterStep, bump, t, errorText],
  );

  const toggle = useCallback(
    async (reminder: Reminder, enabled: boolean): Promise<void> => {
      setError(null);
      try {
        const step = enabled ? await permissionStep() : 'granted';
        const updated = await setReminderEnabled(createReminderDeps(db), reminder.id, enabled);
        bump();
        notify(t(updated.enabled ? 'reminders.enabledToast' : 'reminders.disabledToast'));
        if (enabled) afterStep(step);
      } catch (cause) {
        if (!(cause instanceof ReminderError))
          console.error('Could not change the reminder', cause);
        notify(errorText(cause));
        bump();
      }
    },
    [db, permissionStep, afterStep, bump, t, errorText],
  );

  /**
   * The global "notifications" switch. Off: everything scheduled is cancelled and the reminders are kept,
   * paused. On: ask for permission if needed, then reschedule every enabled future reminder.
   */
  const setGlobal = useCallback(
    async (enabled: boolean): Promise<void> => {
      useSettingsStore.getState().setNotificationsEnabled(enabled);
      try {
        const step = enabled ? await permissionStep() : 'granted';
        await reconcileAndRefresh(db);
        notify(t(enabled ? 'reminders.enabledToast' : 'reminders.disabledToast'));
        if (enabled) afterStep(step);
      } catch (cause) {
        console.error('Could not change the notification setting', cause);
        notify(t('settings.notifications.askFailed'));
        bump();
      }
    },
    [db, permissionStep, afterStep, bump, t],
  );

  const askDelete = useCallback(
    (reminder: Reminder) => setDialog({ kind: 'delete', reminder }),
    [],
  );

  const confirmDelete = useCallback(
    async (reminder: Reminder): Promise<void> => {
      setDialog(null);
      try {
        await removeReminder(createReminderDeps(db), reminder.id);
        notify(t('reminders.deleted'));
      } catch (cause) {
        console.error('Could not delete the reminder', cause);
        notify(t('reminders.errors.generic'));
      } finally {
        bump();
      }
    },
    [db, bump, t],
  );

  return {
    busy,
    error,
    clearError: () => setError(null),
    dialog,
    closeDialog: () => setDialog(null),
    save,
    toggle,
    setGlobal,
    askDelete,
    confirmDelete,
  };
}
