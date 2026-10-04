/**
 * Reminder logic: create, update, enable/disable, delete and RECONCILE. Pure with respect to the OS: it talks
 * only to the `NotificationScheduler` interface and a `SqlDb`, so it is unit-tested with fakes.
 *
 * Rules (docs/DB_SCHEMA.md section 3.2):
 * - A time that is not in the future is rejected (`ReminderError('past')`).
 * - At most MAX_REMINDERS_PER_PREPARATION per preparation; the same preparation + time cannot exist twice.
 * - Before (re)scheduling, the stored OS id is cancelled, so a reminder never has two OS notifications.
 * - A reminder that cannot be scheduled right now (global switch off, no permission, OS error) stays saved
 *   and is marked paused; `reconcileReminders` schedules it as soon as that changes.
 * - Operations are serialised by one lock so a reconcile can never cancel a notification that a concurrent
 *   create has just scheduled.
 */
import {
  countRemindersForPreparation,
  deleteReminder,
  findReminderAt,
  getPreparation,
  getReminder,
  insertReminder,
  listReminders,
  updateReminder,
} from '@/db/repositories';
import type { PausedReason, Reminder, ReminderPatch } from '@/db/repositories';
import type { SqlDb } from '@/db/sqlDb';
import { isPastReminder, parseReminderTime, toLocalDate } from '@/utils/reminderTime';

import type { NotificationScheduler, ScheduledNotification } from './scheduler';

export const MAX_REMINDERS_PER_PREPARATION = 5;

export type ReminderErrorCode = 'invalidTime' | 'past' | 'limit' | 'duplicate' | 'noPreparation';

export class ReminderError extends Error {
  readonly code: ReminderErrorCode;
  constructor(code: ReminderErrorCode) {
    super(`Reminder rejected: ${code}`);
    this.name = 'ReminderError';
    this.code = code;
  }
}

export type NotificationContent = { title: string; body: string };

export type ReminderDeps = {
  db: SqlDb;
  scheduler: NotificationScheduler;
  /** The current time (injected so tests control it). */
  now: () => Date;
  /** The global "notifications enabled" setting. */
  isEnabled: () => boolean;
  /** Translated title and body for a preparation, in the language selected right now (fallback English). */
  content: (preparationId: string) => Promise<NotificationContent>;
};

// ------------------------------------------------------------------------------------------- the lock

let queue: Promise<unknown> = Promise.resolve();

/** Runs `fn` after every earlier reminder operation has finished. */
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.catch(() => undefined);
  return result;
}

// ------------------------------------------------------------------------------------ one reminder

type OsView = { byId: Map<string, ScheduledNotification> } | null;

/** The paused reason to store for an enabled, future reminder that cannot be scheduled now. */
function reasonToPause(deps: ReminderDeps, permissionGranted: boolean): PausedReason | null {
  if (!deps.isEnabled()) return 'global_off';
  if (!permissionGranted) return 'no_permission';
  return null;
}

async function safeCancel(scheduler: NotificationScheduler, id: string | null): Promise<void> {
  if (id === null) return;
  try {
    await scheduler.cancel(id);
  } catch (error) {
    console.error('Could not cancel a scheduled reminder', error);
  }
}

async function permissionGranted(deps: ReminderDeps): Promise<boolean> {
  try {
    return (await deps.scheduler.getPermission()).status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Brings one reminder in line with the world: marks it done when its time has passed, otherwise schedules
 * it when allowed and cancels it when not. `os` is the current OS list (reconcile) or null (the caller just
 * changed the reminder and wants it rescheduled from scratch). Writes only when something changed.
 */
async function syncReminder(
  deps: ReminderDeps,
  reminder: Reminder,
  granted: boolean,
  os: OsView,
): Promise<Reminder> {
  const patch: ReminderPatch = {};
  const nowMs = deps.now().getTime();

  if (reminder.completedAt === null && isPastReminder(reminder.scheduledAt, deps.now())) {
    // A past one-time reminder never fires: it is marked done and anything scheduled is removed.
    await safeCancel(deps.scheduler, reminder.notificationId);
    patch.completedAt = nowMs;
    patch.notificationId = null;
    patch.pausedReason = null;
  } else if (reminder.completedAt !== null) {
    await safeCancel(deps.scheduler, reminder.notificationId);
    patch.notificationId = null;
    patch.pausedReason = null;
  } else if (!reminder.enabled) {
    await safeCancel(deps.scheduler, reminder.notificationId);
    patch.notificationId = null;
    patch.pausedReason = null;
  } else {
    const pause = reasonToPause(deps, granted);
    if (pause !== null) {
      await safeCancel(deps.scheduler, reminder.notificationId);
      patch.notificationId = null;
      patch.pausedReason = pause;
    } else {
      const target = toLocalDate(reminder.scheduledAt);
      if (target === null) throw new ReminderError('invalidTime');
      const existing =
        os !== null && reminder.notificationId !== null
          ? os.byId.get(reminder.notificationId)
          : undefined;
      const stillGood =
        existing !== undefined &&
        (existing.triggerAt === null || existing.triggerAt === target.getTime());
      if (stillGood) {
        patch.pausedReason = null;
      } else {
        await safeCancel(deps.scheduler, reminder.notificationId);
        try {
          const text = await deps.content(reminder.preparationId);
          patch.notificationId = await deps.scheduler.schedule({
            title: text.title,
            body: text.body,
            at: target,
            data: { reminderId: reminder.id, preparationId: reminder.preparationId },
          });
          patch.pausedReason = null;
        } catch (error) {
          console.error('Could not schedule a reminder', error);
          patch.notificationId = null;
          patch.pausedReason = 'schedule_failed';
        }
      }
    }
  }

  const changed = (Object.keys(patch) as (keyof ReminderPatch)[]).filter(
    (key) => patch[key] !== undefined && patch[key] !== reminder[key],
  );
  if (changed.length === 0) return reminder;
  await updateReminder(deps.db, reminder.id, patch, nowMs);
  return { ...reminder, ...patch, updatedAt: nowMs };
}

// ------------------------------------------------------------------------------------------ validation

async function validateSlot(
  deps: ReminderDeps,
  input: { preparationId: string; scheduledAt: string; excludeId?: string; isNew: boolean },
): Promise<void> {
  if (parseReminderTime(input.scheduledAt) === null) throw new ReminderError('invalidTime');
  if (isPastReminder(input.scheduledAt, deps.now())) throw new ReminderError('past');
  const duplicate = await findReminderAt(deps.db, input.preparationId, input.scheduledAt);
  if (duplicate && duplicate.id !== input.excludeId) throw new ReminderError('duplicate');
  if (input.isNew) {
    const count = await countRemindersForPreparation(deps.db, input.preparationId);
    if (count >= MAX_REMINDERS_PER_PREPARATION) throw new ReminderError('limit');
  }
}

/** Checks a new reminder would be accepted, without saving it (so the UI can ask for permission only for a valid one). */
export function checkNewReminder(
  deps: ReminderDeps,
  input: { preparationId: string; scheduledAt: string },
): Promise<void> {
  return locked(async () => {
    if (!(await getPreparation(deps.db, input.preparationId))) {
      throw new ReminderError('noPreparation');
    }
    await validateSlot(deps, { ...input, isNew: true });
  });
}

/** Checks an edit would be accepted, without saving it. */
export function checkEditedReminder(
  deps: ReminderDeps,
  id: string,
  scheduledAt: string,
): Promise<void> {
  return locked(async () => {
    const existing = await getReminder(deps.db, id);
    if (!existing) throw new ReminderError('noPreparation');
    await validateSlot(deps, {
      preparationId: existing.preparationId,
      scheduledAt,
      excludeId: id,
      isNew: false,
    });
  });
}

// --------------------------------------------------------------------------------------------- actions

export function createReminder(
  deps: ReminderDeps,
  input: { preparationId: string; scheduledAt: string; label?: string | null },
): Promise<Reminder> {
  return locked(async () => {
    if (!(await getPreparation(deps.db, input.preparationId))) {
      throw new ReminderError('noPreparation');
    }
    await validateSlot(deps, { ...input, isNew: true });
    const created = await insertReminder(deps.db, input, deps.now().getTime());
    return syncReminder(deps, created, await permissionGranted(deps), null);
  });
}

export function updateReminderDetails(
  deps: ReminderDeps,
  id: string,
  input: { scheduledAt: string; label?: string | null },
): Promise<Reminder> {
  return locked(async () => {
    const existing = await getReminder(deps.db, id);
    if (!existing) throw new ReminderError('noPreparation');
    await validateSlot(deps, {
      preparationId: existing.preparationId,
      scheduledAt: input.scheduledAt,
      excludeId: id,
      isNew: false,
    });
    // The old OS notification is cancelled inside syncReminder (its stored id) before the new one is made.
    await updateReminder(
      deps.db,
      id,
      { scheduledAt: input.scheduledAt, label: input.label ?? null, completedAt: null },
      deps.now().getTime(),
    );
    const updated = (await getReminder(deps.db, id)) as Reminder;
    return syncReminder(deps, updated, await permissionGranted(deps), null);
  });
}

export function setReminderEnabled(
  deps: ReminderDeps,
  id: string,
  enabled: boolean,
): Promise<Reminder> {
  return locked(async () => {
    const existing = await getReminder(deps.db, id);
    if (!existing) throw new ReminderError('noPreparation');
    if (enabled && isPastReminder(existing.scheduledAt, deps.now())) {
      throw new ReminderError('past');
    }
    await updateReminder(deps.db, id, { enabled }, deps.now().getTime());
    return syncReminder(deps, { ...existing, enabled }, await permissionGranted(deps), null);
  });
}

export function removeReminder(deps: ReminderDeps, id: string): Promise<void> {
  return locked(async () => {
    const existing = await getReminder(deps.db, id);
    if (!existing) return;
    await safeCancel(deps.scheduler, existing.notificationId);
    await deleteReminder(deps.db, id);
  });
}

// ------------------------------------------------------------------------------------------- reconcile

export type ReconcileResult = {
  ok: boolean;
  /** Reminders (re)scheduled with the OS in this run. */
  scheduled: number;
  /** OS notifications cancelled because no reminder owns them. */
  cancelledExtra: number;
  /** Past reminders newly marked done. */
  markedDone: number;
};

/**
 * Makes the OS and the database agree, in this order of authority: the database says what SHOULD be
 * scheduled, the OS list says what IS. Idempotent (a second run changes nothing) and safe to run often:
 * at app start (not blocking the first frame) and when the app returns from the system settings screen.
 *
 * - enabled future reminder, allowed, missing in the OS (or at another time) -> scheduled, id stored
 * - OS notification that no reminder points to -> cancelled
 * - one-time reminder whose time has passed -> marked done, never fired
 * - global switch off or permission missing -> everything cancelled, reminders kept and marked paused
 */
export function reconcileReminders(deps: ReminderDeps): Promise<ReconcileResult> {
  return locked(async () => {
    const empty: ReconcileResult = { ok: false, scheduled: 0, cancelledExtra: 0, markedDone: 0 };
    let scheduledList: ScheduledNotification[];
    try {
      scheduledList = await deps.scheduler.listScheduled();
    } catch (error) {
      // Without the OS list nothing can be compared safely: do not cancel or schedule anything.
      console.error('Could not read the scheduled notifications', error);
      return empty;
    }
    const os: OsView = { byId: new Map(scheduledList.map((item) => [item.id, item])) };
    const granted = await permissionGranted(deps);
    const reminders = await listReminders(deps.db);

    let scheduled = 0;
    let markedDone = 0;
    const keep = new Set<string>();
    // Ids a reminder pointed to before this run were already handled (kept or cancelled) by syncReminder.
    const owned = new Set(reminders.flatMap((r) => (r.notificationId ? [r.notificationId] : [])));
    for (const reminder of reminders) {
      const next = await syncReminder(deps, reminder, granted, os);
      if (next.notificationId !== null) keep.add(next.notificationId);
      if (next.notificationId !== null && next.notificationId !== reminder.notificationId) {
        scheduled += 1;
      }
      if (reminder.completedAt === null && next.completedAt !== null) markedDone += 1;
    }

    let cancelledExtra = 0;
    for (const item of scheduledList) {
      if (keep.has(item.id) || owned.has(item.id)) continue;
      await safeCancel(deps.scheduler, item.id);
      cancelledExtra += 1;
    }
    return { ok: true, scheduled, cancelledExtra, markedDone };
  });
}
