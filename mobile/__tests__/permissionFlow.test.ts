import { ensureNotificationPermission, readPermissionLine } from '@/notifications/permissionFlow';

import { createFakeScheduler } from '../testing/fakeScheduler';

const channel = { name: 'Puja reminders', description: 'Reminders' };

describe('permission flow', () => {
  it('already granted: no explanation, no system dialog', async () => {
    const os = createFakeScheduler({ status: 'granted', canAskAgain: true });
    const explain = jest.fn(async () => true);
    expect(await ensureNotificationPermission(os, channel, explain)).toBe('granted');
    expect(explain).not.toHaveBeenCalled();
    expect(os.calls).not.toContain('requestPermission');
  });

  it('creates the Android channel first (Android 13 shows no prompt before a channel exists)', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    await ensureNotificationPermission(os, channel, async () => true);
    expect(os.calls.indexOf('ensureChannel')).toBeLessThan(os.calls.indexOf('requestPermission'));
    expect(os.channels[0]).toEqual(channel);
  });

  it('not asked yet: shows the explanation, then the system dialog; granted', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    const order: string[] = [];
    const outcome = await ensureNotificationPermission(os, channel, async () => {
      order.push('explain');
      return true;
    });
    expect(outcome).toBe('granted');
    expect(order).toEqual(['explain']);
    expect(os.calls).toContain('requestPermission');
  });

  it('declined at the explanation: the system dialog is never shown', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    expect(await ensureNotificationPermission(os, channel, async () => false)).toBe('cancelled');
    expect(os.calls).not.toContain('requestPermission');
  });

  it('denied in the system dialog, can ask again: denied', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    os.nextRequestResult = { status: 'denied', canAskAgain: true };
    expect(await ensureNotificationPermission(os, channel, async () => true)).toBe('denied');
  });

  it('denied for good in the system dialog: blocked', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    os.nextRequestResult = { status: 'denied', canAskAgain: false };
    expect(await ensureNotificationPermission(os, channel, async () => true)).toBe('blocked');
  });

  it('already denied permanently: blocked at once, no explanation that leads nowhere', async () => {
    const os = createFakeScheduler({ status: 'denied', canAskAgain: false });
    const explain = jest.fn(async () => true);
    expect(await ensureNotificationPermission(os, channel, explain)).toBe('blocked');
    expect(explain).not.toHaveBeenCalled();
    expect(os.calls).not.toContain('requestPermission');
  });

  it('denied earlier but can still ask: explains and asks again', async () => {
    const os = createFakeScheduler({ status: 'denied', canAskAgain: true });
    expect(await ensureNotificationPermission(os, channel, async () => true)).toBe('granted');
  });

  it('granted later in the system settings: the next check sees granted without asking', async () => {
    const os = createFakeScheduler({ status: 'denied', canAskAgain: false });
    expect(await readPermissionLine(os)).toBe('blocked');
    os.permission = { status: 'granted', canAskAgain: true };
    expect(await readPermissionLine(os)).toBe('granted');
    expect(os.calls).not.toContain('requestPermission');
  });

  it('a failing channel call does not stop the flow', async () => {
    const os = createFakeScheduler({ status: 'granted', canAskAgain: true });
    os.ensureChannel = async () => {
      throw new Error('no channel');
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await ensureNotificationPermission(os, channel, async () => true)).toBe('granted');
  });

  it('the Settings status line never asks and reports every state', async () => {
    const os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
    expect(await readPermissionLine(os)).toBe('notAsked');
    os.permission = { status: 'denied', canAskAgain: true };
    expect(await readPermissionLine(os)).toBe('denied');
    os.getPermission = async () => {
      throw new Error('x');
    };
    expect(await readPermissionLine(os)).toBe('unknown');
    expect(os.calls).not.toContain('requestPermission');
  });
});
