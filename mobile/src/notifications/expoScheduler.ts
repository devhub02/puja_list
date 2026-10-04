/**
 * The real scheduler, on `expo-notifications`. This is the ONLY file that imports it for scheduling.
 *
 * What the platform does (verified in the installed package, expo-notifications 57.0.21):
 * - A DATE trigger is stored natively and set with `AlarmManager.setAndAllowWhileIdle` (INEXACT). The exact
 *   variant is used only if the app holds SCHEDULE_EXACT_ALARM, which this app never declares.
 * - Scheduled notifications are re-created after a reboot or an app update by the library's boot receiver.
 * - Local scheduled notifications work in Expo Go; only remote push was removed from it.
 */
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import {
  REMINDER_CHANNEL_ID,
  type ChannelDefinition,
  type NotificationScheduler,
  type NotificationTap,
  type NotificationTapSource,
  type PermissionState,
  type ScheduledNotification,
  type ScheduleInput,
} from './scheduler';

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.granted) return { status: 'granted', canAskAgain: response.canAskAgain };
  return {
    status:
      response.status === Notifications.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied',
    canAskAgain: response.canAskAgain,
  };
}

/** Trigger time (epoch ms) of a scheduled request when the OS reports one. */
function triggerTime(trigger: unknown): number | null {
  if (typeof trigger !== 'object' || trigger === null) return null;
  const t = trigger as { type?: unknown; value?: unknown; date?: unknown };
  if (t.type !== 'date') return null;
  const raw = t.value ?? t.date;
  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return raw.getTime();
  return null;
}

export function createExpoScheduler(): NotificationScheduler {
  return {
    async ensureChannel({ name, description }: ChannelDefinition) {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name,
        description,
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    },
    async getPermission() {
      return toPermissionState(await Notifications.getPermissionsAsync());
    },
    async requestPermission() {
      return toPermissionState(await Notifications.requestPermissionsAsync());
    },
    async schedule({ title, body, at, data }: ScheduleInput) {
      return Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    },
    async cancel(id: string) {
      await Notifications.cancelScheduledNotificationAsync(id);
    },
    async cancelAll() {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },
    async listScheduled(): Promise<ScheduledNotification[]> {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      return requests.map((request) => ({
        id: request.identifier,
        triggerAt: triggerTime(request.trigger),
      }));
    },
    async openSystemSettings() {
      await Linking.openSettings();
    },
  };
}

// ------------------------------------------------------------------------------------- taps and display

function toTap(response: Notifications.NotificationResponse): NotificationTap {
  const data = response.notification.request.content.data as { preparationId?: unknown } | null;
  return {
    preparationId: typeof data?.preparationId === 'string' ? data.preparationId : null,
    key: `${response.notification.request.identifier}:${response.notification.date}`,
  };
}

export function createExpoTapSource(): NotificationTapSource {
  return {
    initialTap() {
      try {
        const last = Notifications.getLastNotificationResponse();
        return last ? toTap(last) : null;
      } catch {
        return null;
      }
    },
    subscribe(listener) {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
        listener(toTap(response)),
      );
      return () => subscription.remove();
    },
  };
}

/**
 * How a reminder that arrives while the app is open is shown. `quiet()` is true while the vidhi reader is on
 * screen: then the notification goes silently to the notification shade only, so nothing interrupts reading.
 */
export function installForegroundHandler(quiet: () => boolean): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const hush = quiet();
      return {
        shouldShowBanner: !hush,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}
