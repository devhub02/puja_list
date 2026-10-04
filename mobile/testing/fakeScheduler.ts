/** Test-only in-memory notification scheduler (stands in for expo-notifications behind the interface). */
import type {
  ChannelDefinition,
  NotificationScheduler,
  PermissionState,
  ScheduledNotification,
  ScheduleInput,
} from '@/notifications/scheduler';

export type FakeScheduler = NotificationScheduler & {
  /** What the OS currently has scheduled, by id. */
  scheduled: Map<string, ScheduleInput>;
  permission: PermissionState;
  /** What the system dialog answers when requestPermission() is called. */
  nextRequestResult: PermissionState;
  calls: string[];
  channels: ChannelDefinition[];
  failNextSchedule: boolean;
  failList: boolean;
  failCancelAll: boolean;
  settingsOpened: number;
};

export function createFakeScheduler(
  permission: PermissionState = { status: 'granted', canAskAgain: true },
): FakeScheduler {
  let counter = 0;
  const fake: FakeScheduler = {
    scheduled: new Map(),
    permission,
    nextRequestResult: { status: 'granted', canAskAgain: true },
    calls: [],
    channels: [],
    failNextSchedule: false,
    failList: false,
    failCancelAll: false,
    settingsOpened: 0,
    async ensureChannel(channel) {
      fake.calls.push('ensureChannel');
      fake.channels.push(channel);
    },
    async getPermission() {
      return fake.permission;
    },
    async requestPermission() {
      fake.calls.push('requestPermission');
      fake.permission = fake.nextRequestResult;
      return fake.permission;
    },
    async schedule(input) {
      fake.calls.push('schedule');
      if (fake.failNextSchedule) {
        fake.failNextSchedule = false;
        throw new Error('OS refused');
      }
      counter += 1;
      const id = `os-${counter}`;
      fake.scheduled.set(id, input);
      return id;
    },
    async cancel(id) {
      fake.calls.push(`cancel:${id}`);
      fake.scheduled.delete(id);
    },
    async cancelAll() {
      fake.calls.push('cancelAll');
      if (fake.failCancelAll) throw new Error('OS refused');
      fake.scheduled.clear();
    },
    async listScheduled(): Promise<ScheduledNotification[]> {
      if (fake.failList) throw new Error('OS unavailable');
      return [...fake.scheduled].map(([id, input]) => ({ id, triggerAt: input.at.getTime() }));
    },
    async openSystemSettings() {
      fake.settingsOpened += 1;
    },
  };
  return fake;
}
