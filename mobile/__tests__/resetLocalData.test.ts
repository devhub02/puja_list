import { createPreparation, insertReminder, listReminders } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { USER_DATA_TABLES, resetLocalData } from '@/services/resetLocalData';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createFakeScheduler } from '../testing/fakeScheduler';
import { createMigratedDb } from '../testing/nodeSqlDb';
import type { TestSqlDb } from '../testing/nodeSqlDb';

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
  'search_index',
];

const count = async (db: TestSqlDb, table: string) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))[0].n;

async function filledDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makeFixtureBundle(), () => 1);
  const prep = await createPreparation(db, { pujaId: 'puja_test_lakshmi', title: 'Home' });
  const run = (sql: string, params: (string | number | null)[] = []) => db.run(sql, params);
  await run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_test_lakshmi', 1]);
  await run(
    'INSERT INTO checklist_progress (preparation_id, item_kind, item_ref, checked, updated_at) VALUES (?, ?, ?, ?, ?)',
    [prep.id, 'samagri', 'sm_test_lamp', 1, 2],
  );
  await run(
    'INSERT INTO custom_samagri (id, preparation_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
    ['usr_1', prep.id, 'Item', null, 3],
  );
  await run(
    'INSERT INTO vidhi_progress (preparation_id, last_step_number, completed_at, updated_at) VALUES (?, ?, ?, ?)',
    [prep.id, 2, null, 4],
  );
  await run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', ['puja_test_lakshmi', 5]);
  await run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['laxmi', 6]);
  await insertReminder(db, { preparationId: prep.id, scheduledAt: '2031-11-08T07:00' });
  return db;
}

async function snapshot(db: TestSqlDb, tables: readonly string[]) {
  const out: Record<string, unknown[]> = {};
  for (const table of tables) out[table] = await db.all(`SELECT * FROM ${table} ORDER BY 1, 2`);
  return out;
}

describe('reset local data', () => {
  it('lists exactly the user-data tables (and none of the content tables)', () => {
    expect([...USER_DATA_TABLES].sort()).toEqual(
      [
        'saved_puja',
        'preparation',
        'checklist_progress',
        'custom_samagri',
        'vidhi_progress',
        'reminder',
        'recent_view',
        'recent_search',
      ].sort(),
    );
    for (const table of CONTENT_TABLES) expect(USER_DATA_TABLES).not.toContain(table);
  });

  it('deletes every user row, leaves content and content_meta byte for byte, and cancels all notifications', async () => {
    const db = await filledDb();
    const os = createFakeScheduler();
    os.scheduled.set('os-1', {
      title: 't',
      body: 'b',
      at: new Date(2031, 10, 8),
      data: { reminderId: 'r', preparationId: 'p' },
    });
    for (const table of USER_DATA_TABLES) expect(await count(db, table)).toBeGreaterThan(0);
    const contentBefore = await snapshot(db, CONTENT_TABLES);
    expect(contentBefore.content_meta.length).toBeGreaterThan(0);

    const result = await resetLocalData(db, os);

    expect(result.notificationsCancelled).toBe(true);
    for (const table of USER_DATA_TABLES) expect(await count(db, table)).toBe(0);
    expect(await snapshot(db, CONTENT_TABLES)).toEqual(contentBefore);
    expect(os.calls).toContain('cancelAll');
    expect(os.scheduled.size).toBe(0);
  });

  it('is one transaction: a failure part-way deletes nothing, shows as an error, and cancels nothing', async () => {
    const db = await filledDb();
    const os = createFakeScheduler();
    os.scheduled.set('os-1', {
      title: 't',
      body: 'b',
      at: new Date(2031, 10, 8),
      data: { reminderId: 'r', preparationId: 'p' },
    });
    const before = await snapshot(db, USER_DATA_TABLES);
    let deletes = 0;
    db.failOnStatement = (sql) => {
      if (sql.startsWith('DELETE FROM') && (deletes += 1) === 4) return true;
      return false;
    };
    await expect(resetLocalData(db, os)).rejects.toThrow(/injected failure/);
    db.failOnStatement = undefined;
    expect(await snapshot(db, USER_DATA_TABLES)).toEqual(before);
    expect(os.calls).not.toContain('cancelAll');
    expect(os.scheduled.size).toBe(1);
    expect(await listReminders(db)).toHaveLength(1);
  });

  it('reports (not throws) when the OS cannot cancel after the data was deleted', async () => {
    const db = await filledDb();
    const os = createFakeScheduler();
    os.failCancelAll = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await resetLocalData(db, os);
    expect(result.notificationsCancelled).toBe(false);
    expect(await count(db, 'preparation')).toBe(0);
  });
});
