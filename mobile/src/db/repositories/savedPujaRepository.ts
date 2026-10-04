import type { SqlDb } from '../sqlDb';

export type SavedPuja = { pujaId: string; savedAt: number };

/** Bookmarks a puja. Saving twice keeps the original saved time. No foreign key: content may change later. */
export async function savePuja(db: SqlDb, pujaId: string, now: number = Date.now()): Promise<void> {
  await db.run('INSERT OR IGNORE INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', [pujaId, now]);
}

export async function unsavePuja(db: SqlDb, pujaId: string): Promise<void> {
  await db.run('DELETE FROM saved_puja WHERE puja_id = ?', [pujaId]);
}

export async function isPujaSaved(db: SqlDb, pujaId: string): Promise<boolean> {
  const rows = await db.all('SELECT 1 AS one FROM saved_puja WHERE puja_id = ?', [pujaId]);
  return rows.length > 0;
}

/** Saved pujas, most recently saved first. Ids whose content no longer exists are still returned. */
export async function listSavedPujas(db: SqlDb): Promise<SavedPuja[]> {
  const rows = await db.all<{ puja_id: string; saved_at: number }>(
    'SELECT puja_id, saved_at FROM saved_puja ORDER BY saved_at DESC, puja_id',
  );
  return rows.map((r) => ({ pujaId: r.puja_id, savedAt: r.saved_at }));
}
