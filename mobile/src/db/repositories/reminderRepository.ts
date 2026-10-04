/**
 * Reminders: local notifications for one preparation (docs/DB_SCHEMA.md section 3.2).
 *
 * - A reminder belongs to its preparation (`ON DELETE CASCADE`; `deletePreparation` also removes them
 *   explicitly). It has no foreign key to a content table, so content re-seeding never touches it.
 * - `scheduled_at` is a local wall-clock `YYYY-MM-DDTHH:mm` string (see `utils/reminderTime`).
 * - This file only stores rows. Talking to the OS (scheduling, cancelling) is `notifications/reminderService`.
 */
import type { SqlDb } from '../sqlDb';
import { newId } from './ids';

export const MAX_REMINDER_LABEL_LENGTH = 60;

/** Why an enabled, future reminder is not scheduled with the OS right now. */
export type PausedReason = 'global_off' | 'no_permission' | 'schedule_failed';

export type Reminder = {
  id: string;
  preparationId: string;
  /** Local `YYYY-MM-DDTHH:mm`. */
  scheduledAt: string;
  /** The user's own on/off switch for this reminder. */
  enabled: boolean;
  /** The id the OS returned when it was scheduled; null when nothing is scheduled. */
  notificationId: string | null;
  label: string | null;
  pausedReason: PausedReason | null;
  /** Set when a one-time reminder's time has passed (it will never fire). */
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type ReminderRow = {
  id: string;
  preparation_id: string;
  scheduled_at: string;
  enabled: number;
  notification_id: string | null;
  label: string | null;
  paused_reason: PausedReason | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
};

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  preparationId: row.preparation_id,
  scheduledAt: row.scheduled_at,
  enabled: row.enabled === 1,
  notificationId: row.notification_id,
  label: row.label,
  pausedReason: row.paused_reason,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Trimmed label; empty becomes null. */
export function cleanReminderLabel(value: string | null | undefined): string | null {
  const text = (value ?? '').trim().slice(0, MAX_REMINDER_LABEL_LENGTH);
  return text === '' ? null : text;
}

const ORDER = 'ORDER BY scheduled_at, created_at, rowid';

export async function insertReminder(
  db: SqlDb,
  input: { preparationId: string; scheduledAt: string; label?: string | null },
  now: number = Date.now(),
): Promise<Reminder> {
  const reminder: Reminder = {
    id: newId('rem_'),
    preparationId: input.preparationId,
    scheduledAt: input.scheduledAt,
    enabled: true,
    notificationId: null,
    label: cleanReminderLabel(input.label),
    pausedReason: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.run(
    `INSERT INTO reminder (id, preparation_id, scheduled_at, enabled, notification_id, label,
       paused_reason, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, 1, NULL, ?, NULL, NULL, ?, ?)`,
    [
      reminder.id,
      reminder.preparationId,
      reminder.scheduledAt,
      reminder.label,
      reminder.createdAt,
      reminder.updatedAt,
    ],
  );
  return reminder;
}

export async function getReminder(db: SqlDb, id: string): Promise<Reminder | null> {
  const [row] = await db.all<ReminderRow>('SELECT * FROM reminder WHERE id = ?', [id]);
  return row ? toReminder(row) : null;
}

/** Every reminder, earliest time first. */
export async function listReminders(db: SqlDb): Promise<Reminder[]> {
  return (await db.all<ReminderRow>(`SELECT * FROM reminder ${ORDER}`)).map(toReminder);
}

export async function listRemindersForPreparation(
  db: SqlDb,
  preparationId: string,
): Promise<Reminder[]> {
  const rows = await db.all<ReminderRow>(
    `SELECT * FROM reminder WHERE preparation_id = ? ${ORDER}`,
    [preparationId],
  );
  return rows.map(toReminder);
}

export async function countRemindersForPreparation(
  db: SqlDb,
  preparationId: string,
): Promise<number> {
  const [row] = await db.all<{ n: number }>(
    'SELECT COUNT(*) AS n FROM reminder WHERE preparation_id = ?',
    [preparationId],
  );
  return row?.n ?? 0;
}

/** The reminder of this preparation at exactly this time, if any (the unique key). */
export async function findReminderAt(
  db: SqlDb,
  preparationId: string,
  scheduledAt: string,
): Promise<Reminder | null> {
  const [row] = await db.all<ReminderRow>(
    'SELECT * FROM reminder WHERE preparation_id = ? AND scheduled_at = ?',
    [preparationId, scheduledAt],
  );
  return row ? toReminder(row) : null;
}

export type ReminderPatch = Partial<
  Pick<Reminder, 'scheduledAt' | 'enabled' | 'notificationId' | 'label' | 'pausedReason'>
> & { completedAt?: number | null };

const COLUMNS: Record<keyof ReminderPatch, string> = {
  scheduledAt: 'scheduled_at',
  enabled: 'enabled',
  notificationId: 'notification_id',
  label: 'label',
  pausedReason: 'paused_reason',
  completedAt: 'completed_at',
};

/** Updates the given fields and `updated_at`. */
export async function updateReminder(
  db: SqlDb,
  id: string,
  patch: ReminderPatch,
  now: number = Date.now(),
): Promise<void> {
  const keys = (Object.keys(patch) as (keyof ReminderPatch)[]).filter(
    (key) => patch[key] !== undefined,
  );
  const sets = keys.map((key) => `${COLUMNS[key]} = ?`);
  const values = keys.map((key) => {
    const value = patch[key];
    if (key === 'enabled') return value ? 1 : 0;
    if (key === 'label') return cleanReminderLabel(value as string | null);
    return value as string | number | null;
  });
  await db.run(`UPDATE reminder SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE id = ?`, [
    ...values,
    now,
    id,
  ]);
}

export async function deleteReminder(db: SqlDb, id: string): Promise<void> {
  await db.run('DELETE FROM reminder WHERE id = ?', [id]);
}
