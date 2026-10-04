import { useTranslation } from 'react-i18next';

import type { Reminder } from '@/db/repositories';
import type { ReminderDialog } from '@/hooks/useReminderController';
import { getNotificationScheduler } from '@/notifications/scheduler';
import { notify } from '@/utils/notify';

import { Dialog } from './Dialog';
import type { DialogAction } from './Dialog';

type Props = {
  dialog: ReminderDialog;
  onClose: () => void;
  onConfirmDelete: (reminder: Reminder) => void;
};

/** The three dialogs of the reminder flow: why we ask, "saved but paused", and delete confirmation. */
export function ReminderDialogs({ dialog, onClose, onConfirmDelete }: Props) {
  const { t } = useTranslation();

  const openSettings = async () => {
    onClose();
    try {
      await getNotificationScheduler().openSystemSettings();
    } catch {
      notify(t('reminders.permission.openSettingsFailed'));
    }
  };

  if (dialog?.kind === 'why') {
    const { answer } = dialog;
    return (
      <Dialog
        testID="permission-why-dialog"
        visible
        title={t('reminders.permission.whyTitle')}
        message={t('reminders.permission.whyBody')}
        onClose={() => answer(false)}
        actions={[
          {
            label: t('reminders.permission.continue'),
            variant: 'primary',
            testID: 'permission-why-continue',
            onPress: () => answer(true),
          },
          {
            label: t('reminders.permission.notNow'),
            testID: 'permission-why-later',
            onPress: () => answer(false),
          },
        ]}
      />
    );
  }

  if (dialog?.kind === 'paused') {
    const body =
      dialog.reason === 'off'
        ? t('reminders.permission.offBody')
        : dialog.reason === 'blocked'
          ? t('reminders.permission.blockedBody')
          : t('reminders.permission.deniedBody');
    const actions: DialogAction[] = [];
    if (dialog.reason !== 'off') {
      actions.push({
        label: t('reminders.permission.openSettings'),
        variant: 'primary',
        icon: 'cog-outline',
        testID: 'permission-open-settings',
        onPress: () => void openSettings(),
      });
    }
    actions.push({ label: t('common.close'), testID: 'permission-paused-close', onPress: onClose });
    return (
      <Dialog
        testID="permission-paused-dialog"
        visible
        title={t('reminders.permission.deniedTitle')}
        message={body}
        onClose={onClose}
        actions={actions}
      />
    );
  }

  if (dialog?.kind === 'delete') {
    const { reminder } = dialog;
    return (
      <Dialog
        testID="reminder-delete-dialog"
        visible
        title={t('reminders.deleteTitle')}
        message={t('reminders.deleteBody')}
        onClose={onClose}
        actions={[
          {
            label: t('reminders.deleteConfirm'),
            variant: 'primary',
            testID: 'reminder-delete-confirm',
            onPress: () => onConfirmDelete(reminder),
          },
          { label: t('common.cancel'), testID: 'reminder-delete-cancel', onPress: onClose },
        ]}
      />
    );
  }

  return null;
}
