import { seedContentIfNeeded } from '@/db/seed';
import { getFestival, listFestivals } from '@/db/repositories';

import { makeFixtureBundle } from '../testing/contentFixture';
import { applyMigrations, createNodeSqlDb } from '../testing/nodeSqlDb';
import type { TestSqlDb } from '../testing/nodeSqlDb';

const USER_TABLES = [
  'saved_puja',
  'preparation',
  'vidhi_progress',
  'checklist_progress',
  'custom_samagri',
  'reminder',
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

/**
 * The database exactly as Phase 5 shipped it (migrations 0000 to 0002), with Phase 5 content seeded the old
 * way (old festival columns) and a row in EVERY user-data table.
 * TEST FIXTURE rows, not real content.
 */
async function phase5Database() {
  const db = createNodeSqlDb();
  applyMigrations(db, { to: 3 });
  const run = (sql: string, params: (string | number | null)[] = []) => db.run(sql, params);

  // old-shape content, as the Phase 5 seed wrote it
  await run(
    `INSERT INTO festival (id, name_json, alt_names_json, description_json, significance_json, regions_json, status)
     VALUES ('fest_test_lamps', '{"en":"Old"}', NULL, '{"en":"d"}', '{"en":"s"}', '["pan_india"]', 'active')`,
  );
  await run(
    `INSERT INTO puja (id, festival_id, name_json, category, regions_json, summary_json, significance_json,
       review_status, source_note_json, content_version, status)
     VALUES ('puja_test_lakshmi', 'fest_test_lamps', '{"en":"P"}', 'festival', '["pan_india"]', '{"en":"x"}',
       '{"en":"x"}', 'ai_drafted', '{"en":"x"}', 1, 'active')`,
  );
  await run(
    `INSERT INTO samagri (id, name_json, status) VALUES ('sm_test_lamp', '{"en":"Lamp"}', 'active')`,
  );
  await run(
    `INSERT INTO puja_samagri (puja_id, samagri_id, classification, purpose_json, sort_order)
     VALUES ('puja_test_lakshmi', 'sm_test_lamp', 'REQUIRED', '{"en":"p"}', 1)`,
  );
  await run(
    `INSERT INTO calendar_date (id, festival_id, year, date, certainty, source)
     VALUES ('cal_old', 'fest_test_lamps', 2031, '2031-10-30', 'provisional', 'TEST FIXTURE')`,
  );
  await run(
    `INSERT INTO search_index (entity_type, entity_id, names, alt_names, extra) VALUES ('festival', 'fest_test_lamps', 'old', '', '')`,
  );
  for (const [key, value] of [
    ['content_version', '4'],
    ['schema_version', '1'],
    ['checksum', 'sha256:old'],
    ['seeded_at', '1'],
  ])
    await run('INSERT INTO content_meta (key, value) VALUES (?, ?)', [key, value]);

  // user data in every user table
  await run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_test_lakshmi', 100]);
  await run(
    'INSERT INTO preparation (id, puja_id, title, created_at, updated_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['prep_1', 'puja_test_lakshmi', 'For home', 100, 110, 120],
  );
  await run(
    'INSERT INTO preparation (id, puja_id, title, created_at, updated_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['prep_2', 'puja_gone', null, 101, 111, 121],
  );
  await run(
    'INSERT INTO checklist_progress (preparation_id, item_ref, item_kind, checked, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['prep_1', 'sm_test_lamp', 'samagri', 1, 130],
  );
  await run(
    'INSERT INTO checklist_progress (preparation_id, item_ref, item_kind, checked, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['prep_1', 'usr_1', 'custom', 1, 131],
  );
  await run(
    'INSERT INTO custom_samagri (id, preparation_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)',
    ['usr_1', 'prep_1', 'My own item', 'red', 140],
  );
  await run(
    'INSERT INTO vidhi_progress (preparation_id, last_step_number, completed_at, updated_at) VALUES (?, ?, ?, ?)',
    ['prep_1', 3, null, 150],
  );
  // The Phase 2 reminder shape (no code ever wrote this table; migration 0004 replaces it).
  await run(
    'INSERT INTO reminder (id, puja_id, festival_id, title, fire_at, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['usr_r1', 'puja_test_lakshmi', 'fest_test_lamps', 'Remind me', 5000, 'n1', 160],
  );
  await run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', [
    'puja_test_lakshmi',
    170,
  ]);
  await run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['laxmi', 180]);
  return db;
}

async function snapshotUserData(db: TestSqlDb) {
  const out: Record<string, unknown[]> = {};
  for (const table of USER_TABLES)
    out[table] = await db.all(`SELECT * FROM ${table} ORDER BY 1, 2`);
  return out;
}

describe('migration 0003 (festival catalog) on a Phase 5 database', () => {
  it('keeps every row of every user-data table, byte for byte', async () => {
    const db = await phase5Database();
    const before = await snapshotUserData(db);
    for (const table of USER_TABLES) expect(before[table].length).toBeGreaterThan(0);
    applyMigrations(db, { from: 3, to: 4 });
    expect(await snapshotUserData(db)).toEqual(before);
  });

  it('empties the content tables and content_meta so the seed refills them', async () => {
    const db = await phase5Database();
    applyMigrations(db, { from: 3, to: 4 });
    for (const table of [...CONTENT_TABLES, 'search_index']) expect(await count(db, table)).toBe(0);
  });

  it('gives festival its new columns and calendar_date a region that defaults to "all"', async () => {
    const db = await phase5Database();
    applyMigrations(db, { from: 3, to: 4 });
    const columns = async (table: string) =>
      (await db.all<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`))
        .map((c) => c.name)
        .sort();
    expect(await columns('festival')).toEqual(
      [
        'alt_names_json',
        'category',
        'date_type',
        'id',
        'linked_puja_ids_json',
        'name_json',
        'observance_json',
        'regions_json',
        'review_status',
        'short_description_json',
        'significance_json',
        'source_note_json',
        'states_json',
        'status',
      ].sort(),
    );
    expect(await columns('calendar_date')).toContain('region');
    await db.run(
      `INSERT INTO festival (id, name_json, short_description_json, regions_json, category, date_type,
         review_status, source_note_json, status) VALUES ('f', '{"en":"F"}', '{"en":"d"}', '["north"]',
         'new_year', 'solar', 'ai_drafted', '{"en":"s"}', 'active')`,
    );
    await db.run(
      `INSERT INTO calendar_date (id, festival_id, year, date, certainty, source)
       VALUES ('c', 'f', 2031, '2031-01-01', 'provisional', 'TEST FIXTURE')`,
    );
    expect(await db.all('SELECT region FROM calendar_date')).toEqual([{ region: 'all' }]);
    const [f] = await db.all<{ linked_puja_ids_json: string; significance_json: string | null }>(
      'SELECT * FROM festival',
    );
    expect(f.linked_puja_ids_json).toBe('[]');
    expect(f.significance_json).toBeNull();
  });

  it('re-seeds with the new content on the next start and user data still resolves', async () => {
    const db = await phase5Database();
    applyMigrations(db, { from: 3, to: 4 });
    const before = await snapshotUserData(db);
    expect(await seedContentIfNeeded(db, makeFixtureBundle({ contentVersion: 5 }))).toBe('seeded');
    expect(await snapshotUserData(db)).toEqual(before);
    const festival = await getFestival(db, 'fest_test_lamps');
    expect(festival).toMatchObject({
      category: 'deity_festival',
      dateType: 'lunar',
      linkedPujaIds: ['puja_test_lakshmi'],
      reviewStatus: 'ai_drafted',
    });
    expect(festival?.dates[0].region).toBe('all');
  });

  it('seeds a calendar-only festival (no linked puja) and keeps optional fields optional', async () => {
    const db = createNodeSqlDb();
    applyMigrations(db);
    const base = makeFixtureBundle({ contentVersion: 5 });
    await seedContentIfNeeded(
      db,
      makeFixtureBundle({
        contentVersion: 5,
        festivals: [
          ...base.festivals,
          {
            id: 'fest_test_calendar_only',
            name: { en: 'Test Calendar Only Festival', hi: 'परीक्षण केवल-कैलेंडर पर्व' },
            shortDescription: { en: 'TEST FIXTURE', hi: 'परीक्षण' },
            regions: ['south', 'tribal'],
            category: 'nature_ritual',
            dateType: 'variable',
            reviewStatus: 'ai_drafted',
            sourceNote: { en: 'TEST FIXTURE', hi: 'परीक्षण' },
            status: 'active',
          },
        ],
      }),
    );
    const only = (await listFestivals(db)).find((f) => f.id === 'fest_test_calendar_only');
    expect(only).toMatchObject({
      linkedPujaIds: [],
      states: [],
      regions: ['south', 'tribal'],
      dateType: 'variable',
    });
    expect(only?.significance).toBeUndefined();
    expect(only?.observanceDescription).toBeUndefined();
  });
});
