/** Where the user is in the vidhi of one preparation, and whether they finished it. */
import type { SqlDb } from '../sqlDb';

export type VidhiProgress = {
  preparationId: string;
  /** 1-based step the reader should resume at. */
  lastStepNumber: number;
  /** Epoch ms when the user finished the last step; null while still reading. */
  completedAt: number | null;
  updatedAt: number;
};

type Row = {
  preparation_id: string;
  last_step_number: number;
  completed_at: number | null;
  updated_at: number;
};

const toProgress = (row: Row): VidhiProgress => ({
  preparationId: row.preparation_id,
  lastStepNumber: row.last_step_number,
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
});

export async function getVidhiProgress(
  db: SqlDb,
  preparationId: string,
): Promise<VidhiProgress | null> {
  const [row] = await db.all<Row>('SELECT * FROM vidhi_progress WHERE preparation_id = ?', [
    preparationId,
  ]);
  return row ? toProgress(row) : null;
}

/** Positions of every preparation, keyed by preparation id. */
export async function listVidhiProgress(db: SqlDb): Promise<Map<string, VidhiProgress>> {
  const rows = await db.all<Row>('SELECT * FROM vidhi_progress');
  return new Map(rows.map((row) => [row.preparation_id, toProgress(row)]));
}

/** Saves the step being read. Leaving a finished vidhi (going back a step) makes it "in progress" again. */
export async function saveVidhiPosition(
  db: SqlDb,
  preparationId: string,
  stepNumber: number,
  now: number = Date.now(),
): Promise<void> {
  await db.run(
    `INSERT INTO vidhi_progress (preparation_id, last_step_number, completed_at, updated_at)
     VALUES (?, ?, NULL, ?)
     ON CONFLICT(preparation_id)
     DO UPDATE SET last_step_number = excluded.last_step_number, completed_at = NULL,
                   updated_at = excluded.updated_at`,
    [preparationId, stepNumber, now],
  );
}

/** Marks the vidhi finished; the resume position stays on the last step. */
export async function markVidhiCompleted(
  db: SqlDb,
  preparationId: string,
  lastStepNumber: number,
  now: number = Date.now(),
): Promise<void> {
  await db.run(
    `INSERT INTO vidhi_progress (preparation_id, last_step_number, completed_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(preparation_id)
     DO UPDATE SET last_step_number = excluded.last_step_number, completed_at = excluded.completed_at,
                   updated_at = excluded.updated_at`,
    [preparationId, lastStepNumber, now, now],
  );
}

/** Starts the vidhi over from step 1 (clears completion). */
export async function restartVidhi(
  db: SqlDb,
  preparationId: string,
  now: number = Date.now(),
): Promise<void> {
  await saveVidhiPosition(db, preparationId, 1, now);
}
