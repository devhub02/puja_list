/**
 * The notification permission flow as plain logic (the UI supplies the "why we ask" step).
 * Nothing here runs at app start: it is called only when the user saves their first reminder or turns the
 * global switch on.
 */
import type { ChannelDefinition, NotificationScheduler, PermissionState } from './scheduler';

/**
 * - `granted`: notifications can be scheduled.
 * - `denied`: the user refused the system dialog; asking again is still possible later.
 * - `blocked`: refused for good (or disabled in system settings); only the system settings can change it.
 * - `cancelled`: the user declined at the explanation step; the system dialog was not shown.
 */
export type PermissionOutcome = 'granted' | 'denied' | 'blocked' | 'cancelled';

function outcomeOf(state: PermissionState): PermissionOutcome {
  if (state.status === 'granted') return 'granted';
  return state.canAskAgain ? 'denied' : 'blocked';
}

/**
 * Makes sure reminders may be shown. `explain` shows the short "why" screen and resolves true to continue.
 * The Android channel is created first because Android 13+ shows no permission prompt before a channel exists.
 */
export async function ensureNotificationPermission(
  scheduler: NotificationScheduler,
  channel: ChannelDefinition,
  explain: () => Promise<boolean>,
): Promise<PermissionOutcome> {
  try {
    await scheduler.ensureChannel(channel);
  } catch (error) {
    console.error('Could not create the notification channel', error);
  }
  const current = await scheduler.getPermission();
  if (current.status === 'granted') return 'granted';
  // Refused for good: do not show an explanation that leads to a dialog that will not appear.
  if (current.status === 'denied' && !current.canAskAgain) return 'blocked';
  if (!(await explain())) return 'cancelled';
  return outcomeOf(await scheduler.requestPermission());
}

/** Read-only status for the Settings line: never asks. */
export type PermissionLine = 'granted' | 'notAsked' | 'denied' | 'blocked' | 'unknown';

export async function readPermissionLine(
  scheduler: NotificationScheduler,
): Promise<PermissionLine> {
  try {
    const state = await scheduler.getPermission();
    if (state.status === 'granted') return 'granted';
    if (state.status === 'undetermined') return 'notAsked';
    return state.canAskAgain ? 'denied' : 'blocked';
  } catch {
    return 'unknown';
  }
}
