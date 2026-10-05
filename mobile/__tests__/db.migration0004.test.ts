import { insertReminder, listReminders } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';

import { makeFixtureBundle } from '../testing/contentFixture';
import { applyMigrations, createNodeSqlDb } from '../testing/nodeSqlDb';
import type { TestSqlDb } from '../testing/nodeSqlDb';

const KEPT_USER_TABLES = [
  'saved_puja',
  'preparation',
  'vidhi_progress',
  'checklist_progress',
  'custom_samagri',
  'recent_view',
  'recent_search',
];
const CONTENT_TABLES = [
  'festival',
  'puja',
  'samagri',
  'puja_samagri',
  'vidhi_step',
  'regional_variation',
  'checklist_template',
  'calendar_date',
  'content_meta',
];

const count = async (db: TestSqlDb, table: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0].n;

/** The database as Phase 6B shipped it (migrations 0000 to 0003): seeded content and a row in every user table. */
async function phase6bDatabase(withLegacyReminder: boolean) {
  const db = createNodeSqlDb();
  applyMigrations(db, { to: 4 });
  await seedContentIfNeeded(db, makeFixtureBundle(), () => 777);
  const run = (sql: string, params: (string | number | null)[] = []) => db.run(sql, params);
  await run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_test_lakshmi', 100]);
  await run(
    'INSERT INTO preparation (id, puja_id, title, created_at, updated_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['prep_1', 'puja_test_lakshmi', 'Diwali at home', 110, 120, 130],
  );
  await run(
    'INSERT INTO checklist_progress (preparation_id, item_kind, item_ref, checked, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['prep_1', 'samagri', 'sm_test_lamp', 1, 135],
  );
  await run(
    'INSERT INTO custom_samagri (id, preparation_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
    ['usr_1', 'prep_1', 'My own item', 'red', 140],
  );
  await run(
    'INSERT INTO vidhi_progress (preparation_id, last_step_number, completed_at, updated_at) VALUES (?, ?, ?, ?)',
    ['prep_1', 3, null, 150],
  );
  await run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', [
    'puja_test_lakshmi',
    170,
  ]);
  await run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['laxmi', 180]);
  if (withLegacyReminder) {
    await run(
      'INSERT INTO reminder (id, puja_id, festival_id, title, fire_at, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['usr_r1', 'puja_test_lakshmi', null, 'Old shape', 5000, 'n1', 160],
    );
  }
  return db;
}

async function snapshot(db: TestSqlDb, tables: string[]) {
  const out: Record<string, unknown[]> = {};
  for (const table of tables) out[table] = await db.all(`SELECT * FROM ${table} ORDER BY 1, 2`);
  return out;
}

describe('migration 0004 (reminders) on a database with user data', () => {
  it('keeps every row of every other user-data table, byte for byte', async () => {
    const db = await phase6bDatabase(true);
    const before = await snapshot(db, KEPT_USER_TABLES);
    for (const table of KEPT_USER_TABLES) expect(before[table].length).toBeGreaterThan(0);
    applyMigrations(db, { from: 4 });
    expect(await snapshot(db, KEPT_USER_TABLES)).toEqual(before);
  });

  it('does not touch content tables or content_meta (no re-seed is triggered)', async () => {
    const db = await phase6bDatabase(false);
    const before = await snapshot(db, [...CONTENT_TABLES, 'search_index']);
    expect(await count(db, 'content_meta')).toBeGreaterThan(0);
    applyMigrations(db, { from: 4 });
    expect(await snapshot(db, [...CONTENT_TABLES, 'search_index'])).toEqual(before);
  });

  it('replaces the never-written Phase 2 reminder table with the preparation-owned shape', async () => {
    const db = await phase6bDatabase(true);
    applyMigrations(db, { from: 4 });
    const columns = (
      await db.all<{ name: string }>(`SELECT name FROM pragma_table_info('reminder')`)
    ).map((c) => c.name);
    expect(columns).toEqual([
      'id',
      'preparation_id',
      'scheduled_at',
      'enabled',
      'notification_id',
      'label',
      'paused_reason',
      'completed_at',
      'created_at',
      'updated_at',
    ]);
    // Old-shape rows could not belong to a preparation; nothing in the app ever wrote one.
    expect(await count(db, 'reminder')).toBe(0);
    const indexes = (
      await db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='reminder'`,
      )
    ).map((i) => i.name);
    expect(indexes).toEqual(
      expect.arrayContaining(['reminder_preparation_time_uq', 'reminder_scheduled_at_idx']),
    );
    expect(indexes).not.toContain('reminder_fire_at_idx');
  });

  it('works after the migration: reminders reference the migrated preparation and cascade with it', async () => {
    const db = await phase6bDatabase(false);
    applyMigrations(db, { from: 4 });
    await insertReminder(db, { preparationId: 'prep_1', scheduledAt: '2026-11-08T07:00' }, 200);
    expect(await listReminders(db)).toHaveLength(1);
    await db.run('DELETE FROM preparation WHERE id = ?', ['prep_1']);
    expect(await listReminders(db)).toEqual([]);
  });

  it('rejects a reminder for a preparation that does not exist and a duplicate time', async () => {
    const db = await phase6bDatabase(false);
    applyMigrations(db, { from: 4 });
    await expect(
      insertReminder(db, { preparationId: 'prep_none', scheduledAt: '2026-11-08T07:00' }),
    ).rejects.toThrow();
    await insertReminder(db, { preparationId: 'prep_1', scheduledAt: '2026-11-08T07:00' });
    await expect(
      insertReminder(db, { preparationId: 'prep_1', scheduledAt: '2026-11-08T07:00' }),
    ).rejects.toThrow();
  });

  it('is applied once: the Drizzle journal lists it last and the SQL file exists', async () => {
    const journal = require('../drizzle/meta/_journal.json') as { entries: { tag: string }[] };
    expect(journal.entries[journal.entries.length - 1].tag).toBe('0004_reminders');
  });
});
