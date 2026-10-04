import {
  RECENT_SEARCH_LIMIT,
  RECENT_VIEW_LIMIT,
  clearRecentSearches,
  isPujaSaved,
  listRecentSearches,
  listRecentViews,
  listSavedPujas,
  recordSearch,
  recordView,
  savePuja,
  unsavePuja,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';

import { makeFixtureBundle } from '../testing/contentFixture';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { applyMigrations, createMigratedDb, createNodeSqlDb } from '../testing/nodeSqlDb';

describe('saved_puja repository', () => {
  it('saves, lists newest first, and unsaves', async () => {
    const db = createMigratedDb();
    await savePuja(db, 'puja_a', 1000);
    await savePuja(db, 'puja_b', 2000);
    expect(await isPujaSaved(db, 'puja_a')).toBe(true);
    expect((await listSavedPujas(db)).map((s) => s.pujaId)).toEqual(['puja_b', 'puja_a']);
    await unsavePuja(db, 'puja_a');
    expect(await isPujaSaved(db, 'puja_a')).toBe(false);
    expect((await listSavedPujas(db)).map((s) => s.pujaId)).toEqual(['puja_b']);
  });

  it('saving twice keeps one row and the first saved time; unsaving an unknown id is a no-op', async () => {
    const db = createMigratedDb();
    await savePuja(db, 'puja_a', 1000);
    await savePuja(db, 'puja_a', 5000);
    expect(await listSavedPujas(db)).toEqual([{ pujaId: 'puja_a', savedAt: 1000 }]);
    await unsavePuja(db, 'does_not_exist');
    expect(await listSavedPujas(db)).toHaveLength(1);
  });
});

describe('recent_view repository', () => {
  it('moves a re-viewed puja to the top without duplicating it', async () => {
    const db = createMigratedDb();
    await recordView(db, 'puja_a', 1);
    await recordView(db, 'puja_b', 2);
    await recordView(db, 'puja_a', 3);
    expect((await listRecentViews(db)).map((v) => v.pujaId)).toEqual(['puja_a', 'puja_b']);
  });

  it(`keeps only the last ${RECENT_VIEW_LIMIT} views`, async () => {
    const db = createMigratedDb();
    for (let i = 1; i <= RECENT_VIEW_LIMIT + 5; i += 1) await recordView(db, `puja_${i}`, i);
    const list = await listRecentViews(db);
    expect(list).toHaveLength(RECENT_VIEW_LIMIT);
    expect(list[0].pujaId).toBe(`puja_${RECENT_VIEW_LIMIT + 5}`);
    expect(list.map((v) => v.pujaId)).not.toContain('puja_1');
    expect(list.map((v) => v.pujaId)).toContain('puja_6');
  });
});

describe('recent_search repository', () => {
  it('records, lists newest first, ignores empty text and clears', async () => {
    const db = createMigratedDb();
    await recordSearch(db, 'ganesh', 1);
    await recordSearch(db, '   ', 2);
    await recordSearch(db, 'दीपक', 3);
    expect(await listRecentSearches(db)).toEqual(['दीपक', 'ganesh']);
    await clearRecentSearches(db);
    expect(await listRecentSearches(db)).toEqual([]);
  });

  it('stores one entry per search, ignoring case and extra spaces, moved to the top', async () => {
    const db = createMigratedDb();
    await recordSearch(db, 'Diya', 1);
    await recordSearch(db, 'ganesh', 2);
    await recordSearch(db, '  diya  ', 3);
    expect(await listRecentSearches(db)).toEqual(['diya', 'ganesh']);
  });

  it(`keeps only the last ${RECENT_SEARCH_LIMIT} searches`, async () => {
    const db = createMigratedDb();
    for (let i = 1; i <= RECENT_SEARCH_LIMIT + 3; i += 1) await recordSearch(db, `word${i}`, i);
    const list = await listRecentSearches(db);
    expect(list).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(list[0]).toBe(`word${RECENT_SEARCH_LIMIT + 3}`);
    expect(list).not.toContain('word1');
  });
});

describe('user state vs content seeding', () => {
  it('survives a real restart: the database file is closed and reopened', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'puja-saathi-'));
    const file = path.join(dir, 'puja_saathi.db');
    try {
      const first = createNodeSqlDb(file);
      applyMigrations(first);
      await seedContentIfNeeded(first, makeFixtureBundle());
      await savePuja(first, 'puja_test_lakshmi', 10);
      await recordView(first, 'puja_test_vrat', 11);
      await recordSearch(first, 'laxmi', 12);
      first.raw.close();

      const second = createNodeSqlDb(file); // fresh connection, nothing kept in memory
      expect(await seedContentIfNeeded(second, makeFixtureBundle())).toBe('unchanged');
      expect((await listSavedPujas(second)).map((s) => s.pujaId)).toEqual(['puja_test_lakshmi']);
      expect((await listRecentViews(second)).map((v) => v.pujaId)).toEqual(['puja_test_vrat']);
      expect(await listRecentSearches(second)).toEqual(['laxmi']);
      second.raw.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a content re-seed (new version, a puja removed) does not erase saved, viewed or searched rows', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    await savePuja(db, 'puja_test_lakshmi', 10);
    await savePuja(db, 'puja_test_vrat', 11);
    await recordView(db, 'puja_test_lakshmi', 12);
    await recordSearch(db, 'lakshmi', 13);

    const base = makeFixtureBundle();
    const reseeded = makeFixtureBundle({
      contentVersion: 2,
      checksum: 'sha256:fixture-2',
      pujas: base.pujas.filter((p) => p.id !== 'puja_test_vrat'),
    });
    expect(await seedContentIfNeeded(db, reseeded)).toBe('seeded');

    const saved = (await listSavedPujas(db)).map((s) => s.pujaId).sort();
    expect(saved).toEqual(['puja_test_lakshmi', 'puja_test_vrat']); // orphan id kept, hidden at read time
    expect((await listRecentViews(db)).map((v) => v.pujaId)).toEqual(['puja_test_lakshmi']);
    expect(await listRecentSearches(db)).toEqual(['lakshmi']);
  });
});
