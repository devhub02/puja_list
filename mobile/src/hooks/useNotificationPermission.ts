import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { readPermissionLine } from '@/notifications/permissionFlow';
import type { PermissionLine } from '@/notifications/permissionFlow';
import { getNotificationScheduler, hasNotificationScheduler } from '@/notifications/scheduler';
import { useReminderStore } from '@/store/reminderStore';

/**
 * The current notification permission for the Settings status line. Read-only: it never shows the system
 * dialog. Re-read when the app returns to the foreground (the user may have changed it in system settings)
 * and after every reminder change.
 */
export function useNotificationPermission(): { line: PermissionLine; refresh: () => void } {
  const revision = useReminderStore((s) => s.revision);
  const [line, setLine] = useState<PermissionLine>('unknown');

  const refresh = useCallback(() => {
    if (!hasNotificationScheduler()) return;
    void readPermissionLine(getNotificationScheduler()).then(setLine);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, revision]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { line, refresh };
}
