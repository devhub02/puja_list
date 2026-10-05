/**
 * "Reset local data": deletes everything the user created on this phone and nothing else.
 *
 * Deleted: saved pujas, preparations (with their checklist progress, custom items and vidhi position),
 * reminders, recent views and recent searches. NOT touched: every content table, `content_meta` (so the
 * bundled content is not re-seeded), the FTS index, and the settings (language, theme, text size,
 * notification switch), which live outside the database.
 */
import { withTransaction } from '@/db/sqlDb';
import type { SqlDb } from '@/db/sqlDb';
import type { NotificationScheduler } from '@/notifications/scheduler';

/** Children before parents, so the deletes are valid even if foreign keys are enforced. */
export const USER_DATA_TABLES = [
  'reminder',
  'vidhi_progress',
  'checklist_progress',
  'custom_samagri',
  'preparation',
  'saved_puja',
  'recent_view',
  'recent_search',
] as const;

export type ResetResult = {
  /** False when the OS refused to cancel (the data is gone; the next reconcile removes leftovers). */
  notificationsCancelled: boolean;
};

/**
 * One transaction deletes only the user-data tables. If it fails, nothing is deleted and the error is thrown.
 * Only after it committed are ALL scheduled notifications cancelled.
 */
export async function resetLocalData(
  db: SqlDb,
  scheduler: NotificationScheduler,
): Promise<ResetResult> {
  await withTransaction(db, async () => {
    for (const table of USER_DATA_TABLES) {
      await db.run(`DELETE FROM ${table}`);
    }
  });
  try {
    await scheduler.cancelAll();
    return { notificationsCancelled: true };
  } catch (error) {
    console.error('Could not cancel scheduled notifications after the reset', error);
    return { notificationsCancelled: false };
  }
}
