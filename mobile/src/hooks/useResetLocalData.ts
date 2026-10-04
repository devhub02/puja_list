import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useOptionalDatabase } from '@/db/DatabaseProvider';
import { getNotificationScheduler } from '@/notifications/scheduler';
import { resetLocalData } from '@/services/resetLocalData';
import { usePreparationStore } from '@/store/preparationStore';
import { useReminderStore } from '@/store/reminderStore';
import { resetUserStateStore, useUserStateStore } from '@/store/userStateStore';
import { notify } from '@/utils/notify';

/**
 * State and action behind "Reset local data". After a successful reset every in-memory mirror is cleared
 * and re-read, so Home, My Preparation, the checklists and the reminder screens show their empty states
 * straight away, with no app restart.
 */
export function useResetLocalData() {
  const { t } = useTranslation();
  const db = useOptionalDatabase();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!db) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resetLocalData(db, getNotificationScheduler());
      resetUserStateStore();
      void useUserStateStore.getState().load(db);
      usePreparationStore.getState().bump();
      useReminderStore.getState().bump();
      setOpen(false);
      notify(
        result.notificationsCancelled ? t('settings.reset.done') : t('settings.reset.cancelFailed'),
      );
    } catch (cause) {
      // The transaction rolled back: nothing was deleted.
      console.error('Reset local data failed', cause);
      setError(t('settings.reset.failed'));
    } finally {
      setBusy(false);
    }
  }, [db, t]);

  return {
    open,
    openDialog: () => setOpen(true),
    close,
    confirm,
    busy,
    error,
    canReset: db !== null,
  };
}
