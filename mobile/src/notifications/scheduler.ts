/**
 * The small interface between the reminder logic and the operating system's notification scheduler.
 * Everything in `reminderService` talks to THIS, never to `expo-notifications`, so the logic is unit-tested
 * with a fake and the Expo implementation (`expoScheduler.ts`) stays a thin, separate file.
 *
 * Only LOCAL scheduled notifications exist here: no push, no tokens, no remote service.
 */

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type PermissionState = {
  status: PermissionStatus;
  /** False after the user has denied the system dialog for good: only the system settings can change it. */
  canAskAgain: boolean;
};

export type ScheduleInput = {
  title: string;
  body: string;
  /** The moment to fire (a local wall-clock time on this phone). */
  at: Date;
  /** Carried in the notification so a tap can open the right preparation. */
  data: { reminderId: string; preparationId: string };
};

export type ScheduledNotification = {
  id: string;
  /** Epoch ms of the trigger when the OS reports it, else null. */
  triggerAt: number | null;
};

export type ChannelDefinition = { name: string; description: string };

export interface NotificationScheduler {
  /** Creates (or updates) the Android channel. Must exist before the Android 13 permission prompt can appear. */
  ensureChannel(channel: ChannelDefinition): Promise<void>;
  getPermission(): Promise<PermissionState>;
  /** Shows the system permission dialog (Android 13+) and returns the new state. */
  requestPermission(): Promise<PermissionState>;
  /** Schedules one notification and returns the OS id. Throws when the OS refuses. */
  schedule(input: ScheduleInput): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  listScheduled(): Promise<ScheduledNotification[]>;
  /** Opens the system settings page of this app. */
  openSystemSettings(): Promise<void>;
}

let current: NotificationScheduler | null = null;

/** Installs the scheduler the app uses (the Expo one at start-up, a fake in tests). */
export function setNotificationScheduler(scheduler: NotificationScheduler | null): void {
  current = scheduler;
}

export function getNotificationScheduler(): NotificationScheduler {
  if (current === null) throw new Error('No notification scheduler is installed');
  return current;
}

/** True once a scheduler is installed (screens render without one in tests that do not need it). */
export function hasNotificationScheduler(): boolean {
  return current !== null;
}

/** The Android notification channel used by every reminder. */
export const REMINDER_CHANNEL_ID = 'reminders';

/** A tap on a reminder notification. `key` identifies the tap so it is handled only once. */
export type NotificationTap = { preparationId: string | null; key: string };

export type NotificationTapSource = {
  /** The tap that launched the app from a closed state, if any. */
  initialTap(): NotificationTap | null;
  subscribe(listener: (tap: NotificationTap) => void): () => void;
};

let currentTaps: NotificationTapSource | null = null;

export function setNotificationTapSource(source: NotificationTapSource | null): void {
  currentTaps = source;
}

export function getNotificationTapSource(): NotificationTapSource | null {
  return currentTaps;
}
