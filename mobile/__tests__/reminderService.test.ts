import {
  createPreparation,
  deletePreparation,
  getReminder,
  listReminders,
} from '@/db/repositories';
import {
  MAX_REMINDERS_PER_PREPARATION,
  ReminderError,
  checkNewReminder,
  createReminder,
  reconcileReminders,
  removeReminder,
  setReminderEnabled,
  updateReminderDetails,
} from '@/notifications/reminderService';
import type { ReminderDeps } from '@/notifications/reminderService';

import { createFakeScheduler } from '../testing/fakeScheduler';
import type { FakeScheduler } from '../testing/fakeScheduler';
import { createMigratedDb } from '../testing/nodeSqlDb';
import type { TestSqlDb } from '../testing/nodeSqlDb';

// "Now" is 2026-10-04 10:00 local. Everything is relative to it.
const NOW = new Date(2026, 9, 4, 10, 0, 0);
const FUTURE = '2026-11-08T07:00';
const FUTURE_2 = '2026-11-08T18:00';

let db: TestSqlDb;
let os: FakeScheduler;
let enabled: boolean;
let now: Date;
let prepId: string;

function deps(): ReminderDeps {
  return {
    db,
    scheduler: os,
    now: () => now,
    isEnabled: () => enabled,
    content: async () => ({ title: 'Puja name', body: 'Check your samagri checklist' }),
  };
}

beforeEach(async () => {
  db = createMigratedDb();
  os = createFakeScheduler();
  enabled = true;
  now = new Date(NOW);
  prepId = (await createPreparation(db, { pujaId: 'puja_x' })).id;
});

describe('create', () => {
  it('stores the reminder and the OS notification id, with a translated title/body from the content hook', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    expect(reminder.notificationId).toBe('os-1');
    expect(reminder.enabled).toBe(true);
    expect(reminder.pausedReason).toBeNull();
    const [item] = [...os.scheduled.values()];
    expect(item.title).toBe('Puja name');
    expect(item.body).toBe('Check your samagri checklist');
    expect(item.data).toEqual({ reminderId: reminder.id, preparationId: prepId });
    expect(item.at.getTime()).toBe(new Date(2026, 10, 8, 7, 0).getTime());
    expect((await getReminder(db, reminder.id))?.notificationId).toBe('os-1');
  });

  it('rejects a time in the past with a coded error and schedules nothing', async () => {
    await expect(
      createReminder(deps(), { preparationId: prepId, scheduledAt: '2026-10-04T09:59' }),
    ).rejects.toMatchObject({ code: 'past' });
    await expect(
      createReminder(deps(), { preparationId: prepId, scheduledAt: '2026-10-04T10:00' }),
    ).rejects.toMatchObject({ code: 'past' });
    expect(os.scheduled.size).toBe(0);
    expect(await listReminders(db)).toEqual([]);
  });

  it('rejects an invalid time string and a missing preparation', async () => {
    await expect(
      createReminder(deps(), { preparationId: prepId, scheduledAt: 'soon' }),
    ).rejects.toMatchObject({ code: 'invalidTime' });
    await expect(
      createReminder(deps(), { preparationId: 'prep_missing', scheduledAt: FUTURE }),
    ).rejects.toMatchObject({ code: 'noPreparation' });
  });

  it('limits reminders per preparation', async () => {
    for (let i = 0; i < MAX_REMINDERS_PER_PREPARATION; i += 1) {
      await createReminder(deps(), {
        preparationId: prepId,
        scheduledAt: `2026-11-0${i + 1}T07:00`,
      });
    }
    await expect(
      createReminder(deps(), { preparationId: prepId, scheduledAt: '2026-11-20T07:00' }),
    ).rejects.toMatchObject({ code: 'limit' });
    expect(os.scheduled.size).toBe(MAX_REMINDERS_PER_PREPARATION);
    // another preparation has its own allowance
    const other = await createPreparation(db, { pujaId: 'puja_y' });
    await expect(
      createReminder(deps(), { preparationId: other.id, scheduledAt: '2026-11-20T07:00' }),
    ).resolves.toMatchObject({ preparationId: other.id });
  });

  it('refuses the same preparation and time twice (no duplicate OS notification either)', async () => {
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await expect(
      createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE }),
    ).rejects.toMatchObject({ code: 'duplicate' });
    expect(os.scheduled.size).toBe(1);
    // the same time on another preparation is fine
    const other = await createPreparation(db, { pujaId: 'puja_y' });
    await createReminder(deps(), { preparationId: other.id, scheduledAt: FUTURE });
    expect(os.scheduled.size).toBe(2);
  });

  it('checkNewReminder validates without saving', async () => {
    await expect(
      checkNewReminder(deps(), { preparationId: prepId, scheduledAt: '2020-01-01T07:00' }),
    ).rejects.toBeInstanceOf(ReminderError);
    await expect(
      checkNewReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE }),
    ).resolves.toBeUndefined();
    expect(await listReminders(db)).toEqual([]);
  });

  it('trims the label and stores an empty one as null', async () => {
    const a = await createReminder(deps(), {
      preparationId: prepId,
      scheduledAt: FUTURE,
      label: '  buy flowers  ',
    });
    const b = await createReminder(deps(), {
      preparationId: prepId,
      scheduledAt: FUTURE_2,
      label: '   ',
    });
    expect(a.label).toBe('buy flowers');
    expect(b.label).toBeNull();
  });
});

describe('update, disable, enable, delete', () => {
  it('update cancels the stored notification before scheduling the new time (never two)', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    const updated = await updateReminderDetails(deps(), reminder.id, {
      scheduledAt: FUTURE_2,
      label: 'evening',
    });
    expect(os.calls).toContain('cancel:os-1');
    expect(os.scheduled.size).toBe(1);
    expect(updated.notificationId).toBe('os-2');
    expect(updated.scheduledAt).toBe(FUTURE_2);
    expect(updated.label).toBe('evening');
    expect([...os.scheduled.values()][0].at.getHours()).toBe(18);
  });

  it('update rejects a past time and keeps the old reminder untouched', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await expect(
      updateReminderDetails(deps(), reminder.id, { scheduledAt: '2026-10-01T07:00' }),
    ).rejects.toMatchObject({ code: 'past' });
    expect((await getReminder(db, reminder.id))?.scheduledAt).toBe(FUTURE);
    expect(os.scheduled.size).toBe(1);
  });

  it("update may keep its own time but not take another reminder's time", async () => {
    const a = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE_2 });
    await expect(
      updateReminderDetails(deps(), a.id, { scheduledAt: FUTURE, label: 'only the note changed' }),
    ).resolves.toMatchObject({ label: 'only the note changed' });
    await expect(
      updateReminderDetails(deps(), a.id, { scheduledAt: FUTURE_2 }),
    ).rejects.toMatchObject({ code: 'duplicate' });
    expect(os.scheduled.size).toBe(2);
  });

  it('disable cancels the OS notification and keeps the row; enable schedules it again', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    const off = await setReminderEnabled(deps(), reminder.id, false);
    expect(off).toMatchObject({ enabled: false, notificationId: null, pausedReason: null });
    expect(os.scheduled.size).toBe(0);
    const on = await setReminderEnabled(deps(), reminder.id, true);
    expect(on).toMatchObject({ enabled: true, notificationId: 'os-2' });
    expect(os.scheduled.size).toBe(1);
  });

  it('cannot enable a reminder whose time has passed', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await setReminderEnabled(deps(), reminder.id, false);
    now = new Date(2026, 11, 1, 9, 0);
    await expect(setReminderEnabled(deps(), reminder.id, true)).rejects.toMatchObject({
      code: 'past',
    });
  });

  it('delete cancels the OS notification and removes the row', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await removeReminder(deps(), reminder.id);
    expect(os.scheduled.size).toBe(0);
    expect(await getReminder(db, reminder.id)).toBeNull();
    await expect(removeReminder(deps(), reminder.id)).resolves.toBeUndefined();
  });

  it('still deletes the row when the OS refuses to cancel', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    os.cancel = async () => {
      throw new Error('OS refused');
    };
    await removeReminder(deps(), reminder.id);
    expect(await getReminder(db, reminder.id)).toBeNull();
  });
});

describe('when scheduling is not possible', () => {
  it('saves the reminder paused when permission is missing, then reconcile schedules it once granted', async () => {
    os.permission = { status: 'denied', canAskAgain: false };
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    expect(reminder).toMatchObject({ notificationId: null, pausedReason: 'no_permission' });
    expect(os.scheduled.size).toBe(0);

    // permission is later granted in the system settings; the app returns to the foreground
    os.permission = { status: 'granted', canAskAgain: true };
    const result = await reconcileReminders(deps());
    expect(result).toMatchObject({ ok: true, scheduled: 1 });
    expect(await getReminder(db, reminder.id)).toMatchObject({
      notificationId: 'os-1',
      pausedReason: null,
    });
  });

  it('saves the reminder paused when the OS refuses, and reconcile retries', async () => {
    os.failNextSchedule = true;
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    expect(reminder).toMatchObject({ notificationId: null, pausedReason: 'schedule_failed' });
    await reconcileReminders(deps());
    expect(await getReminder(db, reminder.id)).toMatchObject({
      notificationId: 'os-1',
      pausedReason: null,
    });
  });

  it('with the global switch off a new reminder is saved paused and nothing is scheduled', async () => {
    enabled = false;
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    expect(reminder).toMatchObject({
      notificationId: null,
      pausedReason: 'global_off',
      enabled: true,
    });
    expect(os.scheduled.size).toBe(0);
  });
});

describe('global switch off and on (through reconcile)', () => {
  it('off cancels everything but keeps the reminders, marked paused; on schedules enabled future ones again', async () => {
    const a = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    const b = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE_2 });
    await setReminderEnabled(deps(), b.id, false);
    expect(os.scheduled.size).toBe(1);

    enabled = false;
    await reconcileReminders(deps());
    expect(os.scheduled.size).toBe(0);
    expect(await getReminder(db, a.id)).toMatchObject({
      enabled: true,
      notificationId: null,
      pausedReason: 'global_off',
    });
    expect(await listReminders(db)).toHaveLength(2);

    enabled = true;
    await reconcileReminders(deps());
    expect(os.scheduled.size).toBe(1); // b stays off: the user switched it off themselves
    expect(await getReminder(db, a.id)).toMatchObject({ pausedReason: null });
    expect((await getReminder(db, a.id))?.notificationId).not.toBeNull();
    expect(await getReminder(db, b.id)).toMatchObject({ enabled: false, notificationId: null });
  });
});

describe('reconcile', () => {
  it('schedules an enabled future reminder that is missing in the OS', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    os.scheduled.clear(); // e.g. the OS lost it (reboot on a device that does not restore, app data cleared)
    const result = await reconcileReminders(deps());
    expect(result.scheduled).toBe(1);
    const after = await getReminder(db, reminder.id);
    expect(after?.notificationId).toBe('os-2');
    expect(os.scheduled.has('os-2')).toBe(true);
  });

  it('cancels OS notifications that no reminder owns', async () => {
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    os.scheduled.set('stray', {
      title: 't',
      body: 'b',
      at: new Date(2027, 0, 1),
      data: { reminderId: 'rem_gone', preparationId: 'prep_gone' },
    });
    const result = await reconcileReminders(deps());
    expect(result.cancelledExtra).toBe(1);
    expect(os.scheduled.has('stray')).toBe(false);
    expect(os.scheduled.size).toBe(1);
  });

  it('marks past one-time reminders done and never schedules them', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    now = new Date(2026, 10, 9, 9, 0); // the day after
    os.scheduled.clear();
    const result = await reconcileReminders(deps());
    expect(result).toMatchObject({ markedDone: 1, scheduled: 0 });
    const after = await getReminder(db, reminder.id);
    expect(after?.completedAt).toBe(now.getTime());
    expect(after?.notificationId).toBeNull();
    expect(os.calls.filter((c) => c === 'schedule')).toHaveLength(1); // only the original one
    // a later reconcile leaves it alone
    await reconcileReminders(deps());
    expect((await getReminder(db, reminder.id))?.completedAt).toBe(now.getTime());
  });

  it('cancels a stale OS notification of a past reminder', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    now = new Date(2026, 10, 9, 9, 0);
    await reconcileReminders(deps());
    expect(os.scheduled.size).toBe(0);
    expect((await getReminder(db, reminder.id))?.notificationId).toBeNull();
  });

  it('is idempotent: a second run changes nothing and makes no OS write', async () => {
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE_2 });
    os.scheduled.set('stray', {
      title: 't',
      body: 'b',
      at: new Date(2027, 0, 1),
      data: { reminderId: 'x', preparationId: 'y' },
    });
    await reconcileReminders(deps());
    const rows = await listReminders(db);
    const calls = os.calls.length;
    const second = await reconcileReminders(deps());
    expect(second).toEqual({ ok: true, scheduled: 0, cancelledExtra: 0, markedDone: 0 });
    expect(os.calls.length).toBe(calls);
    expect(await listReminders(db)).toEqual(rows);
  });

  it('reschedules a notification whose OS time no longer matches the reminder', async () => {
    const reminder = await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    const entry = os.scheduled.get('os-1');
    if (entry) entry.at = new Date(2027, 5, 1, 12, 0);
    await reconcileReminders(deps());
    const after = await getReminder(db, reminder.id);
    expect(after?.notificationId).toBe('os-2');
    expect(os.scheduled.size).toBe(1);
    expect(os.scheduled.get('os-2')?.at.getTime()).toBe(new Date(2026, 10, 8, 7, 0).getTime());
  });

  it('does nothing (and cancels nothing) when the OS list cannot be read', async () => {
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    os.failList = true;
    const result = await reconcileReminders(deps());
    expect(result.ok).toBe(false);
    expect(os.scheduled.size).toBe(1);
  });

  it('removes the OS notifications of a deleted preparation (its reminders cascade away)', async () => {
    await createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    await deletePreparation(db, prepId);
    expect(await listReminders(db)).toEqual([]);
    expect(os.scheduled.size).toBe(1); // still in the OS until reconcile
    const result = await reconcileReminders(deps());
    expect(result.cancelledExtra).toBe(1);
    expect(os.scheduled.size).toBe(0);
  });

  it('a reconcile racing a create never cancels the new notification (operations are serialised)', async () => {
    const create = createReminder(deps(), { preparationId: prepId, scheduledAt: FUTURE });
    const reconcile = reconcileReminders(deps());
    const [reminder] = await Promise.all([create, reconcile]);
    expect(os.scheduled.has(reminder.notificationId as string)).toBe(true);
    expect(os.scheduled.size).toBe(1);
  });
});
