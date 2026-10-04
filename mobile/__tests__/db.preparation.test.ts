import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  addCustomItem,
  clearCompletedCustomItems,
  createPreparation,
  deleteCustomItem,
  deletePreparation,
  duplicatePreparation,
  ensureDefaultPreparation,
  forgetItem,
  getChecklistState,
  getPreparation,
  getVidhiProgress,
  listPreparationSummaries,
  listPreparations,
  listPreparationsForPuja,
  markVidhiCompleted,
  renamePreparation,
  resetChecklist,
  restartVidhi,
  saveVidhiPosition,
  setItemChecked,
  touchPreparation,
  updateCustomItem,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { withTransaction } from '@/db/sqlDb';

import { makeFixtureBundle } from '../testing/contentFixture';
import { applyMigrations, createMigratedDb, createNodeSqlDb } from '../testing/nodeSqlDb';

async function count(db: ReturnType<typeof createMigratedDb>, table: string) {
  const [{ n }] = await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return n;
}

describe('creating preparations', () => {
  it('creates a preparation with a trimmed optional label', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(
      db,
      { pujaId: 'puja_a', title: '  Diwali 2026  ' },
      { now: 10 },
    );
    const b = await createPreparation(db, { pujaId: 'puja_a', title: '   ' }, { now: 20 });
    expect(a).toMatchObject({
      pujaId: 'puja_a',
      title: 'Diwali 2026',
      createdAt: 10,
      lastOpenedAt: 10,
    });
    expect(b.title).toBeNull();
    expect(a.id).toMatch(/^prep_/);
    expect(a.id).not.toBe(b.id);
    expect((await listPreparationsForPuja(db, 'puja_a')).map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it('allows several preparations for the same puja', async () => {
    const db = createMigratedDb();
    await createPreparation(db, { pujaId: 'puja_a', title: 'Home' });
    await createPreparation(db, { pujaId: 'puja_a', title: 'Sister' });
    expect(await listPreparationsForPuja(db, 'puja_a')).toHaveLength(2);
  });

  it('lazily creates ONE default and then reuses the most recently opened one', async () => {
    const db = createMigratedDb();
    expect(await listPreparations(db)).toEqual([]); // nothing is created by merely looking
    const [first, second] = await Promise.all([
      ensureDefaultPreparation(db, 'puja_a', { now: 5 }),
      ensureDefaultPreparation(db, 'puja_a', { now: 6 }),
    ]);
    expect(first.id).toBe(second.id);
    expect(await count(db, 'preparation')).toBe(1);

    const other = await createPreparation(db, { pujaId: 'puja_a', title: 'Other' }, { now: 100 });
    expect((await ensureDefaultPreparation(db, 'puja_a')).id).toBe(other.id);
    await touchPreparation(db, first.id, { now: 200 });
    expect((await ensureDefaultPreparation(db, 'puja_a')).id).toBe(first.id);
    expect(await count(db, 'preparation')).toBe(2);
  });

  it('keeps preparations of different pujas apart', async () => {
    const db = createMigratedDb();
    const a = await ensureDefaultPreparation(db, 'puja_a');
    const b = await ensureDefaultPreparation(db, 'puja_b');
    expect(a.id).not.toBe(b.id);
  });
});

describe('opening, renaming', () => {
  it('touch changes lastOpenedAt only and orders the list most recent first', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' }, { now: 1 });
    const b = await createPreparation(db, { pujaId: 'puja_b' }, { now: 2 });
    expect((await listPreparations(db)).map((p) => p.id)).toEqual([b.id, a.id]);
    await touchPreparation(db, a.id, { now: 50 });
    const reread = await getPreparation(db, a.id);
    expect(reread).toMatchObject({ lastOpenedAt: 50, updatedAt: 1, createdAt: 1 });
    expect((await listPreparations(db)).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('renames, trims, and clears the label with an empty string', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a', title: 'Old' }, { now: 1 });
    await renamePreparation(db, a.id, '  New label ', { now: 9 });
    expect(await getPreparation(db, a.id)).toMatchObject({ title: 'New label', updatedAt: 9 });
    await renamePreparation(db, a.id, '');
    expect((await getPreparation(db, a.id))?.title).toBeNull();
  });
});

describe('checking items', () => {
  it('toggles an item on and off and survives other items', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' }, { now: 1 });
    await setItemChecked(db, p.id, 'samagri', 'sm_a', true, { now: 2 });
    await setItemChecked(db, p.id, 'samagri', 'sm_b', true, { now: 3 });
    expect((await getChecklistState(db, p.id))?.checkedSamagriIds.sort()).toEqual(['sm_a', 'sm_b']);
    await setItemChecked(db, p.id, 'samagri', 'sm_a', false, { now: 4 });
    const state = await getChecklistState(db, p.id);
    expect(state?.checkedSamagriIds).toEqual(['sm_b']);
    expect(state?.preparation.updatedAt).toBe(4);
    expect(await count(db, 'checklist_progress')).toBe(2); // the unchecked row is kept with checked = 0
  });

  it('returns null for an unknown preparation', async () => {
    const db = createMigratedDb();
    expect(await getChecklistState(db, 'prep_nope')).toBeNull();
    expect(await getPreparation(db, 'prep_nope')).toBeNull();
  });

  it('refuses progress for a preparation that does not exist', async () => {
    const db = createMigratedDb();
    await expect(setItemChecked(db, 'prep_nope', 'samagri', 'sm_a', true)).rejects.toThrow();
    expect(await count(db, 'checklist_progress')).toBe(0);
  });

  it('forgetItem removes the saved check of one item only', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    await setItemChecked(db, p.id, 'samagri', 'sm_a', true);
    await setItemChecked(db, p.id, 'samagri', 'sm_b', true);
    await forgetItem(db, p.id, 'sm_a');
    expect((await getChecklistState(db, p.id))?.checkedSamagriIds).toEqual(['sm_b']);
  });
});

describe('custom items', () => {
  it('adds, edits, checks and deletes custom items', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    const item = await addCustomItem(
      db,
      p.id,
      { name: '  Red cloth ', note: ' for the seat ' },
      { now: 5 },
    );
    expect(item).toMatchObject({ name: 'Red cloth', note: 'for the seat', createdAt: 5 });
    expect(item.id).toMatch(/^usr_/);

    await updateCustomItem(db, item.id, { name: 'Yellow cloth', note: '' });
    await setItemChecked(db, p.id, 'custom', item.id, true);
    let state = await getChecklistState(db, p.id);
    expect(state?.customItems).toEqual([
      { id: item.id, name: 'Yellow cloth', note: null, createdAt: 5 },
    ]);
    expect(state?.checkedCustomIds).toEqual([item.id]);

    await deleteCustomItem(db, item.id);
    state = await getChecklistState(db, p.id);
    expect(state?.customItems).toEqual([]);
    expect(state?.checkedCustomIds).toEqual([]);
    expect(await count(db, 'checklist_progress')).toBe(0); // its progress row went with it
  });

  it('rejects an empty name and keeps the order of creation', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    await expect(addCustomItem(db, p.id, { name: '   ' })).rejects.toThrow(/name/);
    await addCustomItem(db, p.id, { name: 'One' }, { now: 1 });
    await addCustomItem(db, p.id, { name: 'Two' }, { now: 1 });
    await addCustomItem(db, p.id, { name: 'Three' }, { now: 1 });
    expect((await getChecklistState(db, p.id))?.customItems.map((i) => i.name)).toEqual([
      'One',
      'Two',
      'Three',
    ]);
    await expect(updateCustomItem(db, 'usr_x', { name: '' })).rejects.toThrow(/name/);
  });

  it('editing or deleting an unknown item does nothing', async () => {
    const db = createMigratedDb();
    await updateCustomItem(db, 'usr_nope', { name: 'x' });
    await deleteCustomItem(db, 'usr_nope');
    expect(await count(db, 'custom_samagri')).toBe(0);
  });

  it('"clear completed" removes only checked CUSTOM items and never puja items', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    const done = await addCustomItem(db, p.id, { name: 'Done' });
    const open = await addCustomItem(db, p.id, { name: 'Open' });
    const done2 = await addCustomItem(db, p.id, { name: 'Done 2' });
    await setItemChecked(db, p.id, 'custom', done.id, true);
    await setItemChecked(db, p.id, 'custom', done2.id, true);
    await setItemChecked(db, p.id, 'samagri', 'sm_a', true);

    expect(await clearCompletedCustomItems(db, p.id)).toBe(2);
    const state = await getChecklistState(db, p.id);
    expect(state?.customItems.map((i) => i.id)).toEqual([open.id]);
    expect(state?.checkedSamagriIds).toEqual(['sm_a']); // the puja's own item stays checked
    expect(state?.checkedCustomIds).toEqual([]);
    expect(await clearCompletedCustomItems(db, p.id)).toBe(0);
  });

  it('"clear completed" in one preparation does not touch another', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' });
    const b = await createPreparation(db, { pujaId: 'puja_a' });
    const ia = await addCustomItem(db, a.id, { name: 'A' });
    const ib = await addCustomItem(db, b.id, { name: 'B' });
    await setItemChecked(db, a.id, 'custom', ia.id, true);
    await setItemChecked(db, b.id, 'custom', ib.id, true);
    await clearCompletedCustomItems(db, a.id);
    expect((await getChecklistState(db, b.id))?.customItems).toHaveLength(1);
    expect((await getChecklistState(db, b.id))?.checkedCustomIds).toEqual([ib.id]);
  });
});

describe('reset', () => {
  it('unchecks everything and keeps custom items', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    const item = await addCustomItem(db, p.id, { name: 'Mine' });
    await setItemChecked(db, p.id, 'samagri', 'sm_a', true);
    await setItemChecked(db, p.id, 'custom', item.id, true);
    await resetChecklist(db, p.id);
    const state = await getChecklistState(db, p.id);
    expect(state?.checkedSamagriIds).toEqual([]);
    expect(state?.checkedCustomIds).toEqual([]);
    expect(state?.customItems).toHaveLength(1);
  });

  it('does not touch another preparation of the same puja', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' });
    const b = await createPreparation(db, { pujaId: 'puja_a' });
    await setItemChecked(db, a.id, 'samagri', 'sm_a', true);
    await setItemChecked(db, b.id, 'samagri', 'sm_a', true);
    await resetChecklist(db, a.id);
    expect((await getChecklistState(db, b.id))?.checkedSamagriIds).toEqual(['sm_a']);
  });
});

describe('duplicate', () => {
  it('copies the title and custom items, resets all checks and the vidhi position', async () => {
    const db = createMigratedDb();
    const src = await createPreparation(db, { pujaId: 'puja_a', title: 'Home' }, { now: 1 });
    const c1 = await addCustomItem(db, src.id, { name: 'Cloth', note: 'red' }, { now: 2 });
    await addCustomItem(db, src.id, { name: 'Ghee' }, { now: 3 });
    await setItemChecked(db, src.id, 'samagri', 'sm_a', true);
    await setItemChecked(db, src.id, 'custom', c1.id, true);
    await saveVidhiPosition(db, src.id, 4);

    const copy = await duplicatePreparation(db, src.id, { now: 99 });
    expect(copy.id).not.toBe(src.id);
    expect(copy).toMatchObject({
      pujaId: 'puja_a',
      title: 'Home',
      createdAt: 99,
      lastOpenedAt: 99,
    });
    const state = await getChecklistState(db, copy.id);
    expect(state?.customItems.map((i) => [i.name, i.note])).toEqual([
      ['Cloth', 'red'],
      ['Ghee', null],
    ]);
    expect(state?.customItems.map((i) => i.id)).not.toContain(c1.id);
    expect(state?.checkedSamagriIds).toEqual([]);
    expect(state?.checkedCustomIds).toEqual([]);
    expect(await getVidhiProgress(db, copy.id)).toBeNull();

    // the original is unchanged
    const original = await getChecklistState(db, src.id);
    expect(original?.checkedSamagriIds).toEqual(['sm_a']);
    expect(original?.customItems).toHaveLength(2);
    expect((await getVidhiProgress(db, src.id))?.lastStepNumber).toBe(4);
  });

  it('uses a new label when given (an empty one means no label)', async () => {
    const db = createMigratedDb();
    const src = await createPreparation(db, { pujaId: 'puja_a', title: 'Home' });
    expect((await duplicatePreparation(db, src.id, { title: ' Navratri ' })).title).toBe(
      'Navratri',
    );
    expect((await duplicatePreparation(db, src.id, { title: '' })).title).toBeNull();
  });

  it('fails for an unknown source and leaves nothing behind', async () => {
    const db = createMigratedDb();
    await expect(duplicatePreparation(db, 'prep_nope')).rejects.toThrow(/does not exist/);
    expect(await count(db, 'preparation')).toBe(0);
  });

  it('rolls back completely when a write fails halfway', async () => {
    const db = createMigratedDb();
    const src = await createPreparation(db, { pujaId: 'puja_a' });
    await addCustomItem(db, src.id, { name: 'A' });
    await addCustomItem(db, src.id, { name: 'B' });
    const before = await count(db, 'custom_samagri');
    db.failOnStatement = (sql) => /INSERT INTO custom_samagri/.test(sql) && failures++ === 1;
    let failures = 0;
    await expect(duplicatePreparation(db, src.id)).rejects.toThrow(/injected/);
    db.failOnStatement = undefined;
    expect(await count(db, 'preparation')).toBe(1);
    expect(await count(db, 'custom_samagri')).toBe(before);
  });
});

describe('delete', () => {
  it('deletes the preparation with its progress, custom items and vidhi position only', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' });
    const b = await createPreparation(db, { pujaId: 'puja_a' });
    for (const p of [a, b]) {
      const item = await addCustomItem(db, p.id, { name: `custom ${p.id}` });
      await setItemChecked(db, p.id, 'samagri', 'sm_a', true);
      await setItemChecked(db, p.id, 'custom', item.id, true);
      await saveVidhiPosition(db, p.id, 3);
    }
    await db.run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_a', 1]);
    await db.run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', ['puja_a', 1]);

    await deletePreparation(db, a.id);

    expect(await getPreparation(db, a.id)).toBeNull();
    expect(
      await db.all('SELECT * FROM checklist_progress WHERE preparation_id = ?', [a.id]),
    ).toEqual([]);
    expect(await db.all('SELECT * FROM custom_samagri WHERE preparation_id = ?', [a.id])).toEqual(
      [],
    );
    expect(await getVidhiProgress(db, a.id)).toBeNull();
    // the other one is intact
    expect(await count(db, 'preparation')).toBe(1);
    expect(await count(db, 'checklist_progress')).toBe(2);
    expect(await count(db, 'custom_samagri')).toBe(1);
    expect((await getVidhiProgress(db, b.id))?.lastStepNumber).toBe(3);
    // and unrelated user data is intact
    expect(await count(db, 'saved_puja')).toBe(1);
    expect(await count(db, 'recent_view')).toBe(1);
  });

  it('the database itself cascades (not only the repository code)', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    await addCustomItem(db, p.id, { name: 'X' });
    await setItemChecked(db, p.id, 'samagri', 'sm_a', true);
    await saveVidhiPosition(db, p.id, 2);
    await db.run('DELETE FROM preparation WHERE id = ?', [p.id]);
    expect(await count(db, 'checklist_progress')).toBe(0);
    expect(await count(db, 'custom_samagri')).toBe(0);
    expect(await count(db, 'vidhi_progress')).toBe(0);
  });

  it('deleting an unknown preparation is a no-op', async () => {
    const db = createMigratedDb();
    await deletePreparation(db, 'prep_nope');
  });
});

describe('vidhi position', () => {
  it('saves the step, completes, restarts and resumes', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    expect(await getVidhiProgress(db, p.id)).toBeNull();

    await saveVidhiPosition(db, p.id, 2, 10);
    await saveVidhiPosition(db, p.id, 5, 20);
    expect(await getVidhiProgress(db, p.id)).toEqual({
      preparationId: p.id,
      lastStepNumber: 5,
      completedAt: null,
      updatedAt: 20,
    });

    await markVidhiCompleted(db, p.id, 8, 30);
    expect(await getVidhiProgress(db, p.id)).toMatchObject({ lastStepNumber: 8, completedAt: 30 });

    // reading a step again after finishing makes it "in progress" again
    await saveVidhiPosition(db, p.id, 7, 40);
    expect((await getVidhiProgress(db, p.id))?.completedAt).toBeNull();

    await markVidhiCompleted(db, p.id, 8, 50);
    await restartVidhi(db, p.id, 60);
    expect(await getVidhiProgress(db, p.id)).toMatchObject({
      lastStepNumber: 1,
      completedAt: null,
    });
    expect(await count(db, 'vidhi_progress')).toBe(1);
  });

  it('can complete without an earlier saved position', async () => {
    const db = createMigratedDb();
    const p = await createPreparation(db, { pujaId: 'puja_a' });
    await markVidhiCompleted(db, p.id, 1, 5);
    expect(await getVidhiProgress(db, p.id)).toMatchObject({ lastStepNumber: 1, completedAt: 5 });
  });
});

describe('summaries', () => {
  it('counts progress per classification from the seeded puja list', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const p = await createPreparation(
      db,
      { pujaId: 'puja_test_lakshmi', title: 'Home' },
      { now: 1 },
    );
    const item = await addCustomItem(db, p.id, { name: 'Mine' });
    await setItemChecked(db, p.id, 'samagri', 'sm_test_lamp', true); // REQUIRED
    await setItemChecked(db, p.id, 'custom', item.id, true);
    await setItemChecked(db, p.id, 'samagri', 'sm_removed_long_ago', true); // not in the puja list
    await saveVidhiPosition(db, p.id, 2);
    await createPreparation(db, { pujaId: 'puja_gone' }, { now: 5 });

    const [gone, summary] = await listPreparationSummaries(db);
    expect(gone.pujaId).toBe('puja_gone');
    expect(gone.progress.overall).toEqual({ checked: 0, total: 0 });
    expect(summary.progress.required).toEqual({ checked: 1, total: 1 });
    expect(summary.progress.common).toEqual({ checked: 0, total: 1 });
    expect(summary.progress.custom).toEqual({ checked: 1, total: 1 });
    expect(summary.progress.overall).toEqual({ checked: 2, total: 3 });
    expect(summary.vidhi?.lastStepNumber).toBe(2);
  });

  it('is empty when there are no preparations', async () => {
    expect(await listPreparationSummaries(createMigratedDb())).toEqual([]);
  });
});

describe('transactions', () => {
  it('run one after another on one connection, even when started together', async () => {
    const db = createMigratedDb();
    const order: string[] = [];
    await Promise.all([
      withTransaction(db, async () => {
        order.push('a start');
        await db.run(`INSERT INTO saved_puja VALUES ('x', 1)`);
        order.push('a end');
      }),
      withTransaction(db, async () => {
        order.push('b start');
        await db.run(`INSERT INTO saved_puja VALUES ('y', 1)`);
        order.push('b end');
      }),
    ]);
    expect(order).toEqual(['a start', 'a end', 'b start', 'b end']);
  });

  it('a failed transaction rolls back and does not block the next one', async () => {
    const db = createMigratedDb();
    await expect(
      withTransaction(db, async () => {
        await db.run(`INSERT INTO saved_puja VALUES ('x', 1)`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await withTransaction(db, () => db.run(`INSERT INTO saved_puja VALUES ('y', 1)`));
    expect(await db.all('SELECT puja_id FROM saved_puja')).toEqual([{ puja_id: 'y' }]);
  });
});

describe('persistence', () => {
  it('survives closing and reopening the database file (app restart)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'puja-prep-'));
    const file = path.join(dir, 'app.db');
    try {
      const first = createNodeSqlDb(file);
      applyMigrations(first);
      const p = await createPreparation(first, { pujaId: 'puja_a', title: 'Home' }, { now: 1 });
      const item = await addCustomItem(first, p.id, { name: 'Cloth' });
      await setItemChecked(first, p.id, 'samagri', 'sm_a', true);
      await setItemChecked(first, p.id, 'custom', item.id, true);
      await saveVidhiPosition(first, p.id, 3);
      first.raw.close();

      const second = createNodeSqlDb(file);
      const state = await getChecklistState(second, p.id);
      expect(state?.preparation.title).toBe('Home');
      expect(state?.checkedSamagriIds).toEqual(['sm_a']);
      expect(state?.checkedCustomIds).toEqual([item.id]);
      expect(state?.customItems[0].name).toBe('Cloth');
      expect((await getVidhiProgress(second, p.id))?.lastStepNumber).toBe(3);
      second.raw.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('content re-seed', () => {
  async function seededWithPreparation() {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const p = await createPreparation(
      db,
      { pujaId: 'puja_test_lakshmi', title: 'Home' },
      { now: 1 },
    );
    const item = await addCustomItem(db, p.id, { name: 'Mine' });
    await setItemChecked(db, p.id, 'samagri', 'sm_test_lamp', true);
    await setItemChecked(db, p.id, 'samagri', 'sm_test_flower', true);
    await setItemChecked(db, p.id, 'custom', item.id, true);
    await saveVidhiPosition(db, p.id, 2);
    return { db, p, item };
  }

  it('keeps every preparation, check, custom item and position when contentVersion is bumped', async () => {
    const { db, p, item } = await seededWithPreparation();
    const next = makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:fixture-2' });
    expect(await seedContentIfNeeded(db, next)).toBe('seeded');

    const state = await getChecklistState(db, p.id);
    expect(state?.preparation).toMatchObject({
      id: p.id,
      title: 'Home',
      pujaId: 'puja_test_lakshmi',
    });
    expect(state?.checkedSamagriIds.sort()).toEqual(['sm_test_flower', 'sm_test_lamp']);
    expect(state?.checkedCustomIds).toEqual([item.id]);
    expect(state?.customItems).toHaveLength(1);
    expect((await getVidhiProgress(db, p.id))?.lastStepNumber).toBe(2);
  });

  it('keeps preparations when the puja and a samagri item disappear from the content', async () => {
    const { db, p } = await seededWithPreparation();
    const next = makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:fixture-2' });
    next.pujas = next.pujas.filter((x) => x.id !== 'puja_test_lakshmi');
    next.samagri = next.samagri.filter((x) => x.id !== 'sm_test_lamp');
    next.pujas.forEach((x) => {
      x.samagri = x.samagri.filter((s) => s.samagriId !== 'sm_test_lamp');
    });
    await seedContentIfNeeded(db, next);

    expect(await db.all('SELECT id FROM puja WHERE id = ?', ['puja_test_lakshmi'])).toEqual([]);
    const state = await getChecklistState(db, p.id);
    expect(state?.checkedSamagriIds.sort()).toEqual(['sm_test_flower', 'sm_test_lamp']);
    const [summary] = await listPreparationSummaries(db);
    // no puja list any more: the dangling checks count for nothing, the custom item still counts
    expect(summary.progress.overall).toEqual({ checked: 1, total: 1 });
  });

  it('a failed re-seed leaves preparations untouched', async () => {
    const { db, p } = await seededWithPreparation();
    db.failOnStatement = (sql) => /INSERT INTO puja_samagri/.test(sql);
    await expect(
      seedContentIfNeeded(db, makeFixtureBundle({ contentVersion: 3, checksum: 'sha256:x' })),
    ).rejects.toThrow(/injected/);
    db.failOnStatement = undefined;
    expect((await getChecklistState(db, p.id))?.checkedSamagriIds).toHaveLength(2);
  });
});
