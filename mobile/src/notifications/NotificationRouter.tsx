import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/db/DatabaseProvider';
import { getPreparation } from '@/db/repositories';
import type { SqlDb } from '@/db/sqlDb';

import { setQuietRoute } from './quietRoute';
import { reconcileAndRefresh } from './runtime';
import { getNotificationTapSource, hasNotificationScheduler } from './scheduler';
import type { NotificationTap } from './scheduler';

type Router = ReturnType<typeof useRouter>;

/**
 * Opens what a tapped reminder points to: the preparation's checklist, or My Preparation when that
 * preparation no longer exists (never a crash).
 */
export async function openTappedReminder(
  db: SqlDb,
  router: Router,
  tap: NotificationTap,
): Promise<void> {
  try {
    const preparation = tap.preparationId ? await getPreparation(db, tap.preparationId) : null;
    if (preparation) {
      router.push({
        pathname: '/puja/[id]/samagri',
        params: { id: preparation.pujaId, prep: preparation.id },
      });
      return;
    }
  } catch (error) {
    console.error('Could not open the reminder target', error);
  }
  router.navigate('/preparation');
}

/**
 * Renders nothing. While the app is open it (1) reconciles reminders after the first frame and whenever the
 * app returns to the foreground (for example from the system settings screen), (2) opens the checklist when a
 * reminder notification is tapped, and (3) tells the notification handler when the vidhi reader is open.
 */
export function NotificationRouter(): null {
  const db = useDatabase();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    setQuietRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!hasNotificationScheduler()) return;
    // Start-up reconcile runs after the first frame has been drawn: it never blocks it.
    const timer = setTimeout(() => void reconcileAndRefresh(db), 0);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcileAndRefresh(db);
    });
    return () => {
      clearTimeout(timer);
      appState.remove();
    };
  }, [db]);

  useEffect(() => {
    const source = getNotificationTapSource();
    if (!source) return;
    const open = (tap: NotificationTap) => {
      if (handled.current.has(tap.key)) return;
      handled.current.add(tap.key);
      void openTappedReminder(db, router, tap);
    };
    const initial = source.initialTap();
    if (initial) open(initial);
    return source.subscribe(open);
    // The router object is stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  return null;
}
