import { seedContentIfNeeded } from '@/db/seed';
import { getContentInfo, getPuja, listPujas, searchContent } from '@/db/repositories';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import type { TestSqlDb } from '../testing/nodeSqlDb';

const count = async (db: TestSqlDb, table: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0].n;

/** User rows covering every user-data table. They reference content ids but have no FK to content. */
async function insertUserData(db: TestSqlDb) {
  await db.run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', [
    'puja_test_lakshmi',
    100,
  ]);
  await db.run(
    'INSERT INTO checklist_progress (puja_id, item_ref, item_kind, checked, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['puja_test_lakshmi', 'sm_test_lamp', 'samagri', 1, 101],
  );
  await db.run(
    'INSERT INTO custom_samagri (id, puja_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
    ['usr_1', 'puja_test_lakshmi', 'My own item', null, 102],
  );
  await db.run(
    'INSERT INTO reminder (id, puja_id, festival_id, title, fire_at, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['usr_r1', 'puja_test_lakshmi', null, 'Remind me', 5000, 'n1', 103],
  );
  await db.run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', [
    'puja_test_lakshmi',
    104,
  ]);
  await db.run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['lakshmi', 105]);
}

const USER_TABLES = [
  'saved_puja',
  'checklist_progress',
  'custom_samagri',
  'reminder',
  'recent_view',
  'recent_search',
];

async function snapshotUserData(db: TestSqlDb) {
  const out: Record<string, unknown[]> = {};
  for (const table of USER_TABLES)
    out[table] = await db.all(`SELECT * FROM ${table} ORDER BY 1, 2`);
  return out;
}

describe('seed loader', () => {
  it('seeds an empty database from the bundle', async () => {
    const db = createMigratedDb();
    const outcome = await seedContentIfNeeded(db, makeFixtureBundle(), () => 777);
    expect(outcome).toBe('seeded');
    expect(await count(db, 'festival')).toBe(2);
    expect(await count(db, 'samagri')).toBe(3);
    expect(await count(db, 'puja')).toBe(3);
    expect(await count(db, 'puja_samagri')).toBe(3);
    expect(await count(db, 'vidhi_step')).toBe(2);
    expect(await count(db, 'regional_variation')).toBe(1);
    expect(await count(db, 'checklist_template')).toBe(2);
    expect(await count(db, 'calendar_date')).toBe(1);
    // active entities only: 1 festival + 2 pujas + 3 samagri
    expect(await count(db, 'search_index')).toBe(6);
    expect(await getContentInfo(db)).toEqual({
      contentVersion: 1,
      schemaVersion: 1,
      pujaCount: 3,
      seededAt: 777,
    });
  });

  it('seeds an empty bundle (Phase 2 ships no puja content) and records its version', async () => {
    const db = createMigratedDb();
    const empty = makeFixtureBundle({
      festivals: [],
      pujas: [],
      samagri: [],
      calendar: [],
      contentVersion: 1,
    });
    expect(await seedContentIfNeeded(db, empty)).toBe('seeded');
    expect(await getContentInfo(db)).toMatchObject({ contentVersion: 1, pujaCount: 0 });
    expect(await seedContentIfNeeded(db, empty)).toBe('unchanged');
  });

  it('is a no-op when the bundle is unchanged', async () => {
    const db = createMigratedDb();
    const bundle = makeFixtureBundle();
    await seedContentIfNeeded(db, bundle, () => 1);
    const writes: string[] = [];
    db.failOnStatement = (sql) => {
      writes.push(sql);
      return false;
    };
    expect(await seedContentIfNeeded(db, bundle, () => 2)).toBe('unchanged');
    expect(writes.filter((s) => /^\s*(INSERT|DELETE|BEGIN)/i.test(s))).toEqual([]);
    expect((await getContentInfo(db)).seededAt).toBe(1);
  });

  it('re-seeds when contentVersion changes and replaces content', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const next = makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:fixture-2' });
    next.pujas = next.pujas.filter((p) => p.id !== 'puja_test_vrat');
    next.pujas[0].name = { en: 'Renamed Test Puja' };
    expect(await seedContentIfNeeded(db, next, () => 9)).toBe('seeded');
    expect((await getContentInfo(db)).contentVersion).toBe(2);
    expect((await listPujas(db)).map((p) => p.name.en)).toEqual(['Renamed Test Puja']);
    expect(await count(db, 'puja')).toBe(2); // + deprecated one
    // the search index was rebuilt: old name gone, new name found
    expect(await searchContent(db, 'renamed')).toHaveLength(1);
    expect(await searchContent(db, 'weekly')).toEqual([]);
  });

  it('re-seeds when only the checksum differs (rebuilt bundle, version not bumped)', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const same = makeFixtureBundle({ checksum: 'sha256:other' });
    expect(await seedContentIfNeeded(db, same)).toBe('seeded');
  });

  it('re-seeds when the schemaVersion differs', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    // schemaVersion 1 -> would need app support for newer ones, so test the stored-vs-bundled comparison
    await db.run(`UPDATE content_meta SET value = '0' WHERE key = 'schema_version'`);
    expect(await seedContentIfNeeded(db, makeFixtureBundle())).toBe('seeded');
  });

  it('refuses a bundle with a newer schemaVersion than the app supports, keeping old content', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const future = makeFixtureBundle({ schemaVersion: 2, contentVersion: 5 });
    await expect(seedContentIfNeeded(db, future)).rejects.toThrow(/schemaVersion 2 is newer/);
    expect((await getContentInfo(db)).contentVersion).toBe(1);
    expect(await count(db, 'puja')).toBe(3);
  });

  it('rolls back everything and keeps the previous content when a write fails', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const before = {
      puja: await db.all('SELECT * FROM puja ORDER BY id'),
      search: await db.all('SELECT rowid, * FROM search_index ORDER BY rowid'),
      meta: await db.all('SELECT * FROM content_meta ORDER BY key'),
    };

    const next = makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:fixture-2' });
    // Fail on the 3rd INSERT into vidhi_step: after the old rows were deleted and many new ones written.
    let steps = 0;
    db.failOnStatement = (sql) => /^\s*INSERT INTO vidhi_step/i.test(sql) && ++steps === 2;
    await expect(seedContentIfNeeded(db, next)).rejects.toThrow(/injected failure/);
    db.failOnStatement = undefined;

    expect(await db.all('SELECT * FROM puja ORDER BY id')).toEqual(before.puja);
    expect(await db.all('SELECT rowid, * FROM search_index ORDER BY rowid')).toEqual(before.search);
    expect(await db.all('SELECT * FROM content_meta ORDER BY key')).toEqual(before.meta);
    expect((await getContentInfo(db)).contentVersion).toBe(1);
    expect((await searchContent(db, 'lakshmi')).length).toBeGreaterThan(0);
  });

  it('rolls back on a genuine constraint violation (duplicate ids in the bundle)', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    const bad = makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:bad' });
    bad.pujas = [...bad.pujas, { ...bad.pujas[1] }];
    await expect(seedContentIfNeeded(db, bad)).rejects.toThrow();
    expect((await getContentInfo(db)).contentVersion).toBe(1);
    expect(await count(db, 'puja')).toBe(3);
  });

  it('rolls back a failed FIRST seed to a clean empty state and allows a later retry', async () => {
    const db = createMigratedDb();
    db.failOnStatement = (sql) => /^\s*INSERT INTO calendar_date/i.test(sql);
    await expect(seedContentIfNeeded(db, makeFixtureBundle())).rejects.toThrow();
    db.failOnStatement = undefined;
    expect(await count(db, 'puja')).toBe(0);
    expect(await count(db, 'content_meta')).toBe(0);
    expect(await seedContentIfNeeded(db, makeFixtureBundle())).toBe('seeded');
    expect(await count(db, 'puja')).toBe(3);
  });

  it('preserves ALL user data across a re-seed, even when the referenced content disappears', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    await insertUserData(db);
    const before = await snapshotUserData(db);
    expect(Object.values(before).every((rows) => rows.length === 1)).toBe(true);

    // v2 removes the referenced puja entirely (not what the export tool allows, but seeding must cope).
    const v2 = makeFixtureBundle({
      contentVersion: 2,
      checksum: 'sha256:v2',
      pujas: [],
      festivals: [],
      calendar: [],
    });
    expect(await seedContentIfNeeded(db, v2)).toBe('seeded');
    expect(await getPuja(db, 'puja_test_lakshmi')).toBeNull();
    expect(await snapshotUserData(db)).toEqual(before);

    // v3 brings it back: the same user rows are still there and still point at it.
    expect(
      await seedContentIfNeeded(
        db,
        makeFixtureBundle({ contentVersion: 3, checksum: 'sha256:v3' }),
      ),
    ).toBe('seeded');
    expect(await snapshotUserData(db)).toEqual(before);
    expect(await getPuja(db, 'puja_test_lakshmi')).not.toBeNull();
  });

  it('preserves user data when a seed fails and rolls back', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    await insertUserData(db);
    const before = await snapshotUserData(db);
    db.failOnStatement = (sql) => /^\s*INSERT INTO puja_samagri/i.test(sql);
    await expect(
      seedContentIfNeeded(db, makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:v2' })),
    ).rejects.toThrow();
    db.failOnStatement = undefined;
    expect(await snapshotUserData(db)).toEqual(before);
  });

  it('never writes to user-data tables while seeding', async () => {
    const db = createMigratedDb();
    const statements: string[] = [];
    db.failOnStatement = (sql) => {
      statements.push(sql);
      return false;
    };
    await seedContentIfNeeded(db, makeFixtureBundle());
    const userTouching = statements.filter((s) =>
      new RegExp(`(INTO|FROM|UPDATE)\\s+(${USER_TABLES.join('|')})\\b`, 'i').test(s),
    );
    expect(userTouching).toEqual([]);
  });

  it('allows deleting content rows without cascading into user tables (no FK)', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle());
    await insertUserData(db);
    await db.run('DELETE FROM puja_samagri');
    await db.run('DELETE FROM vidhi_step');
    await db.run('DELETE FROM regional_variation');
    await db.run('DELETE FROM checklist_template');
    await db.run('DELETE FROM puja');
    expect(await count(db, 'saved_puja')).toBe(1);
    expect(await count(db, 'checklist_progress')).toBe(1);
  });
});
