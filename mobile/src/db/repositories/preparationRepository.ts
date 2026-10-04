/**
 * Preparations: a user's checklist for one puja and occasion, with its checked items and custom items.
 *
 * - `puja_id` / `item_ref` are plain content ids with no foreign key, so content re-seeding never touches
 *   these rows. Rows owned by a preparation (progress, custom items, vidhi position) are deleted with it.
 * - Every write that touches more than one row runs in one transaction.
 * - Nothing here reads the content tables except `listPreparationSummaries`, which needs each puja's
 *   samagri classification to count progress; a puja that no longer exists simply has no samagri rows.
 */
import { computeProgress, type ChecklistProgress } from '@/utils/preparationProgress';

import type { SqlDb } from '../sqlDb';
import { withTransaction } from '../sqlDb';
import type { Classification } from '../types';
import { newId } from './ids';
import type { VidhiProgress } from './vidhiProgressRepository';
import { listVidhiProgress } from './vidhiProgressRepository';

export const MAX_TITLE_LENGTH = 60;
export const MAX_ITEM_NAME_LENGTH = 80;
export const MAX_ITEM_NOTE_LENGTH = 200;

export type Preparation = {
  id: string;
  pujaId: string;
  /** Optional user label. */
  title: string | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
};

export type CustomItem = {
  id: string;
  name: string;
  note: string | null;
  createdAt: number;
};

export type ChecklistState = {
  preparation: Preparation;
  checkedSamagriIds: string[];
  customItems: CustomItem[];
  checkedCustomIds: string[];
};

export type PreparationSummary = Preparation & {
  progress: ChecklistProgress;
  vidhi: VidhiProgress | null;
};

type Options = { now?: number };

type PreparationRow = {
  id: string;
  puja_id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
  last_opened_at: number;
};

const toPreparation = (row: PreparationRow): Preparation => ({
  id: row.id,
  pujaId: row.puja_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at,
});

const ORDER = 'ORDER BY last_opened_at DESC, created_at DESC, rowid DESC';

/** Trimmed text; empty becomes null. */
function cleanText(value: string | null | undefined, max: number): string | null {
  const text = (value ?? '').trim().slice(0, max);
  return text === '' ? null : text;
}

export async function createPreparation(
  db: SqlDb,
  input: { pujaId: string; title?: string | null },
  { now = Date.now() }: Options = {},
): Promise<Preparation> {
  const preparation: Preparation = {
    id: newId('prep_'),
    pujaId: input.pujaId,
    title: cleanText(input.title, MAX_TITLE_LENGTH),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
  await withTransaction(db, () => insertPreparation(db, preparation));
  return preparation;
}

async function insertPreparation(db: SqlDb, p: Preparation): Promise<void> {
  await db.run(
    `INSERT INTO preparation (id, puja_id, title, created_at, updated_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.id, p.pujaId, p.title, p.createdAt, p.updatedAt, p.lastOpenedAt],
  );
}

/**
 * The preparation to use for a puja when the user acts without choosing one: the most recently opened
 * one, or a new default created on the spot. Called lazily (first checked item, first step advanced),
 * never just because a screen was viewed.
 */
export async function ensureDefaultPreparation(
  db: SqlDb,
  pujaId: string,
  { now = Date.now() }: Options = {},
): Promise<Preparation> {
  return withTransaction(db, async () => {
    const [existing] = await db.all<PreparationRow>(
      `SELECT * FROM preparation WHERE puja_id = ? ${ORDER} LIMIT 1`,
      [pujaId],
    );
    if (existing) return toPreparation(existing);
    const created: Preparation = {
      id: newId('prep_'),
      pujaId,
      title: null,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    await insertPreparation(db, created);
    return created;
  });
}

export async function getPreparation(db: SqlDb, id: string): Promise<Preparation | null> {
  const [row] = await db.all<PreparationRow>('SELECT * FROM preparation WHERE id = ?', [id]);
  return row ? toPreparation(row) : null;
}

/** All preparations, most recently opened first. */
export async function listPreparations(db: SqlDb): Promise<Preparation[]> {
  const rows = await db.all<PreparationRow>(`SELECT * FROM preparation ${ORDER}`);
  return rows.map(toPreparation);
}

export async function listPreparationsForPuja(db: SqlDb, pujaId: string): Promise<Preparation[]> {
  const rows = await db.all<PreparationRow>(
    `SELECT * FROM preparation WHERE puja_id = ? ${ORDER}`,
    [pujaId],
  );
  return rows.map(toPreparation);
}

/** Marks a preparation as just opened (drives "most recent" ordering). */
export async function touchPreparation(
  db: SqlDb,
  id: string,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await db.run('UPDATE preparation SET last_opened_at = ? WHERE id = ?', [now, id]);
}

export async function renamePreparation(
  db: SqlDb,
  id: string,
  title: string | null,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await db.run('UPDATE preparation SET title = ?, updated_at = ? WHERE id = ?', [
    cleanText(title, MAX_TITLE_LENGTH),
    now,
    id,
  ]);
}

/**
 * A new preparation for the same puja with the same title (or `options.title` when given: an empty
 * string means "no label") and a copy of the custom items. Every check starts unchecked and the vidhi
 * position starts over.
 */
export async function duplicatePreparation(
  db: SqlDb,
  sourceId: string,
  options: { title?: string | null; now?: number } = {},
): Promise<Preparation> {
  const now = options.now ?? Date.now();
  return withTransaction(db, async () => {
    const [source] = await db.all<PreparationRow>('SELECT * FROM preparation WHERE id = ?', [
      sourceId,
    ]);
    if (!source) throw new Error(`Preparation ${sourceId} does not exist`);
    const copy: Preparation = {
      id: newId('prep_'),
      pujaId: source.puja_id,
      title: 'title' in options ? cleanText(options.title, MAX_TITLE_LENGTH) : source.title,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    await insertPreparation(db, copy);
    const items = await db.all<{ name: string; note: string | null; created_at: number }>(
      'SELECT name, note, created_at FROM custom_samagri WHERE preparation_id = ? ORDER BY created_at, rowid',
      [sourceId],
    );
    for (const item of items) {
      await db.run(
        'INSERT INTO custom_samagri (id, preparation_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
        [newId('usr_'), copy.id, item.name, item.note, item.created_at],
      );
    }
    return copy;
  });
}

/** Deletes a preparation and everything it owns. Other preparations (even of the same puja) are untouched. */
export async function deletePreparation(db: SqlDb, id: string): Promise<void> {
  await withTransaction(db, async () => {
    // Explicit deletes as well as ON DELETE CASCADE, so this stays correct if foreign keys are off.
    await db.run('DELETE FROM reminder WHERE preparation_id = ?', [id]);
    await db.run('DELETE FROM vidhi_progress WHERE preparation_id = ?', [id]);
    await db.run('DELETE FROM checklist_progress WHERE preparation_id = ?', [id]);
    await db.run('DELETE FROM custom_samagri WHERE preparation_id = ?', [id]);
    await db.run('DELETE FROM preparation WHERE id = ?', [id]);
  });
}

async function bumpUpdated(db: SqlDb, id: string, now: number): Promise<void> {
  await db.run('UPDATE preparation SET updated_at = ? WHERE id = ?', [now, id]);
}

/** Checks or unchecks one item. Saved immediately; there is no save button. */
export async function setItemChecked(
  db: SqlDb,
  preparationId: string,
  kind: 'samagri' | 'custom',
  ref: string,
  checked: boolean,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await withTransaction(db, async () => {
    await db.run(
      `INSERT INTO checklist_progress (preparation_id, item_kind, item_ref, checked, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(preparation_id, item_kind, item_ref)
       DO UPDATE SET checked = excluded.checked, updated_at = excluded.updated_at`,
      [preparationId, kind, ref, checked ? 1 : 0, now],
    );
    await bumpUpdated(db, preparationId, now);
  });
}

/** Removes the "no longer in the guide" leftovers of one item (its saved check) from a preparation. */
export async function forgetItem(
  db: SqlDb,
  preparationId: string,
  ref: string,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await withTransaction(db, async () => {
    await db.run(
      `DELETE FROM checklist_progress
        WHERE preparation_id = ? AND item_kind = 'samagri' AND item_ref = ?`,
      [preparationId, ref],
    );
    await bumpUpdated(db, preparationId, now);
  });
}

/** Unchecks everything. Custom items are kept. */
export async function resetChecklist(
  db: SqlDb,
  preparationId: string,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await withTransaction(db, async () => {
    await db.run('DELETE FROM checklist_progress WHERE preparation_id = ?', [preparationId]);
    await bumpUpdated(db, preparationId, now);
  });
}

function requireName(name: string): string {
  const clean = cleanText(name, MAX_ITEM_NAME_LENGTH);
  if (clean === null) throw new Error('A custom item needs a name');
  return clean;
}

export async function addCustomItem(
  db: SqlDb,
  preparationId: string,
  input: { name: string; note?: string | null },
  { now = Date.now() }: Options = {},
): Promise<CustomItem> {
  const item: CustomItem = {
    id: newId('usr_'),
    name: requireName(input.name),
    note: cleanText(input.note, MAX_ITEM_NOTE_LENGTH),
    createdAt: now,
  };
  await withTransaction(db, async () => {
    await db.run(
      'INSERT INTO custom_samagri (id, preparation_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
      [item.id, preparationId, item.name, item.note, item.createdAt],
    );
    await bumpUpdated(db, preparationId, now);
  });
  return item;
}

export async function updateCustomItem(
  db: SqlDb,
  itemId: string,
  input: { name: string; note?: string | null },
  { now = Date.now() }: Options = {},
): Promise<void> {
  const name = requireName(input.name);
  const note = cleanText(input.note, MAX_ITEM_NOTE_LENGTH);
  await withTransaction(db, async () => {
    const [row] = await db.all<{ preparation_id: string }>(
      'SELECT preparation_id FROM custom_samagri WHERE id = ?',
      [itemId],
    );
    if (!row) return;
    await db.run('UPDATE custom_samagri SET name = ?, note = ? WHERE id = ?', [name, note, itemId]);
    await bumpUpdated(db, row.preparation_id, now);
  });
}

async function removeCustomItems(db: SqlDb, ids: string[]): Promise<void> {
  for (const id of ids) {
    await db.run(`DELETE FROM checklist_progress WHERE item_kind = 'custom' AND item_ref = ?`, [
      id,
    ]);
    await db.run('DELETE FROM custom_samagri WHERE id = ?', [id]);
  }
}

export async function deleteCustomItem(
  db: SqlDb,
  itemId: string,
  { now = Date.now() }: Options = {},
): Promise<void> {
  await withTransaction(db, async () => {
    const [row] = await db.all<{ preparation_id: string }>(
      'SELECT preparation_id FROM custom_samagri WHERE id = ?',
      [itemId],
    );
    if (!row) return;
    await removeCustomItems(db, [itemId]);
    await bumpUpdated(db, row.preparation_id, now);
  });
}

/**
 * "Clear completed": removes the CUSTOM items that are checked. Items from the puja's own list are never
 * removed (they can only be unchecked, via Reset). Returns how many custom items were removed.
 */
export async function clearCompletedCustomItems(
  db: SqlDb,
  preparationId: string,
  { now = Date.now() }: Options = {},
): Promise<number> {
  return withTransaction(db, async () => {
    const done = await db.all<{ id: string }>(
      `SELECT c.id FROM custom_samagri c
         JOIN checklist_progress p
           ON p.preparation_id = c.preparation_id AND p.item_kind = 'custom'
          AND p.item_ref = c.id AND p.checked = 1
        WHERE c.preparation_id = ?`,
      [preparationId],
    );
    if (done.length === 0) return 0;
    await removeCustomItems(
      db,
      done.map((r) => r.id),
    );
    await bumpUpdated(db, preparationId, now);
    return done.length;
  });
}

/** Everything the checklist screens need to know about one preparation (not the puja's own samagri). */
export async function getChecklistState(
  db: SqlDb,
  preparationId: string,
): Promise<ChecklistState | null> {
  const preparation = await getPreparation(db, preparationId);
  if (!preparation) return null;
  const progressRows = await db.all<{ item_kind: 'samagri' | 'custom'; item_ref: string }>(
    'SELECT item_kind, item_ref FROM checklist_progress WHERE preparation_id = ? AND checked = 1',
    [preparationId],
  );
  const customRows = await db.all<{
    id: string;
    name: string;
    note: string | null;
    created_at: number;
  }>(
    'SELECT id, name, note, created_at FROM custom_samagri WHERE preparation_id = ? ORDER BY created_at, rowid',
    [preparationId],
  );
  return {
    preparation,
    checkedSamagriIds: progressRows.filter((r) => r.item_kind === 'samagri').map((r) => r.item_ref),
    checkedCustomIds: progressRows.filter((r) => r.item_kind === 'custom').map((r) => r.item_ref),
    customItems: customRows.map((r) => ({
      id: r.id,
      name: r.name,
      note: r.note,
      createdAt: r.created_at,
    })),
  };
}

/** Every preparation (most recently opened first) with its progress and vidhi position. */
export async function listPreparationSummaries(db: SqlDb): Promise<PreparationSummary[]> {
  const preparations = await listPreparations(db);
  if (preparations.length === 0) return [];
  const [samagriRows, checkedRows, customRows, vidhi] = await Promise.all([
    db.all<{ puja_id: string; samagri_id: string; classification: Classification }>(
      `SELECT puja_id, samagri_id, classification FROM puja_samagri
        WHERE puja_id IN (SELECT puja_id FROM preparation)`,
    ),
    db.all<{ preparation_id: string; item_kind: string; item_ref: string }>(
      'SELECT preparation_id, item_kind, item_ref FROM checklist_progress WHERE checked = 1',
    ),
    db.all<{ id: string; preparation_id: string }>('SELECT id, preparation_id FROM custom_samagri'),
    listVidhiProgress(db),
  ]);
  const samagriByPuja = group(samagriRows, (r) => r.puja_id);
  const checkedByPrep = group(checkedRows, (r) => r.preparation_id);
  const customByPrep = group(customRows, (r) => r.preparation_id);
  return preparations.map((p) => {
    const checked = checkedByPrep.get(p.id) ?? [];
    return {
      ...p,
      progress: computeProgress({
        samagri: (samagriByPuja.get(p.pujaId) ?? []).map((r) => ({
          samagriId: r.samagri_id,
          classification: r.classification,
        })),
        customIds: (customByPrep.get(p.id) ?? []).map((r) => r.id),
        checkedSamagriIds: checked.filter((r) => r.item_kind === 'samagri').map((r) => r.item_ref),
        checkedCustomIds: checked.filter((r) => r.item_kind === 'custom').map((r) => r.item_ref),
      }),
      vidhi: vidhi.get(p.id) ?? null,
    };
  });
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
