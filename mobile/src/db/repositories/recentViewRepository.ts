import type { SqlDb } from '../sqlDb';

export const RECENT_VIEW_LIMIT = 20;

export type RecentView = { pujaId: string; viewedAt: number };

/** Records that a puja was opened (again): one row per puja, then only the newest 20 rows are kept. */
export async function recordView(
  db: SqlDb,
  pujaId: string,
  now: number = Date.now(),
): Promise<void> {
  await db.run(
    `INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)
     ON CONFLICT(puja_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
    [pujaId, now],
  );
  await db.run(
    `DELETE FROM recent_view WHERE puja_id NOT IN
       (SELECT puja_id FROM recent_view ORDER BY viewed_at DESC, rowid DESC LIMIT ?)`,
    [RECENT_VIEW_LIMIT],
  );
}

/** Most recently viewed first. */
export async function listRecentViews(
  db: SqlDb,
  limit: number = RECENT_VIEW_LIMIT,
): Promise<RecentView[]> {
  const rows = await db.all<{ puja_id: string; viewed_at: number }>(
    'SELECT puja_id, viewed_at FROM recent_view ORDER BY viewed_at DESC, rowid DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({ pujaId: r.puja_id, viewedAt: r.viewed_at }));
}
