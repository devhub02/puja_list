import { applyMigrations, createNodeSqlDb } from '../testing/nodeSqlDb';

/** The database as Phase 4 shipped it (migrations 0000 and 0001), filled with user data. */
async function phase4Database(options: { withOldChecklistRows?: boolean } = {}) {
  const db = createNodeSqlDb();
  applyMigrations(db, { to: 2 });
  await db.run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_a', 111]);
  await db.run('INSERT INTO saved_puja (puja_id, saved_at) VALUES (?, ?)', ['puja_b', 222]);
  await db.run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', ['puja_a', 333]);
  await db.run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['diya', 444]);
  await db.run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['ganesh', 555]);
  if (options.withOldChecklistRows) {
    // These tables had no repository in Phase 4, so they are empty in practice; this proves that even
    // hand-made rows are carried over rather than lost or rejected.
    const sql = [
      `INSERT INTO checklist_progress VALUES ('puja_a', 'sm_one', 'samagri', 1, 1000)`,
      `INSERT INTO checklist_progress VALUES ('puja_a', 'sm_two', 'samagri', 0, 1100)`,
      `INSERT INTO checklist_progress VALUES ('puja_a', 'usr_x', 'custom', 1, 1200)`,
      `INSERT INTO checklist_progress VALUES ('puja_b', 'sm_three', 'samagri', 1, 2000)`,
      `INSERT INTO custom_samagri VALUES ('usr_x', 'puja_a', 'Cloth', 'red', 900)`,
      `INSERT INTO custom_samagri VALUES ('usr_y', 'puja_c', 'Ghee', NULL, 800)`,
    ];
    for (const statement of sql) db.raw.exec(statement);
  }
  return db;
}

describe('migration 0002 (preparations) on a Phase 4 database', () => {
  it('keeps saved pujas, recent views and recent searches', async () => {
    const db = await phase4Database();
    applyMigrations(db, { from: 2 });
    expect(await db.all('SELECT * FROM saved_puja ORDER BY puja_id')).toEqual([
      { puja_id: 'puja_a', saved_at: 111 },
      { puja_id: 'puja_b', saved_at: 222 },
    ]);
    expect(await db.all('SELECT * FROM recent_view')).toEqual([
      { puja_id: 'puja_a', viewed_at: 333 },
    ]);
    expect(await db.all('SELECT * FROM recent_search ORDER BY query')).toEqual([
      { query: 'diya', searched_at: 444 },
      { query: 'ganesh', searched_at: 555 },
    ]);
  });

  it('creates preparation and vidhi_progress and rebuilds the two owned tables', async () => {
    const db = await phase4Database();
    applyMigrations(db, { from: 2 });
    const columns = async (table: string) =>
      (await db.all<{ name: string }>(`SELECT name FROM pragma_table_info('${table}')`))
        .map((c) => c.name)
        .sort();
    expect(await columns('preparation')).toEqual(
      ['created_at', 'id', 'last_opened_at', 'puja_id', 'title', 'updated_at'].sort(),
    );
    expect(await columns('vidhi_progress')).toEqual(
      ['completed_at', 'last_step_number', 'preparation_id', 'updated_at'].sort(),
    );
    expect(await columns('checklist_progress')).toEqual(
      ['checked', 'item_kind', 'item_ref', 'preparation_id', 'updated_at'].sort(),
    );
    expect(await columns('custom_samagri')).toEqual(
      ['created_at', 'id', 'name', 'note', 'preparation_id'].sort(),
    );
    // the old puja-based tables and their leftovers are gone
    const names = (
      await db.all<{ name: string }>(`SELECT name FROM sqlite_master WHERE name LIKE '%_old'`)
    ).map((r) => r.name);
    expect(names).toEqual([]);
  });

  it('moves any existing checklist rows into one default preparation per puja', async () => {
    const db = await phase4Database({ withOldChecklistRows: true });
    applyMigrations(db, { from: 2 });

    const preparations = await db.all<Record<string, unknown>>(
      'SELECT * FROM preparation ORDER BY puja_id',
    );
    expect(preparations).toEqual([
      {
        id: 'prep_migrated_puja_a',
        puja_id: 'puja_a',
        title: null,
        created_at: 900,
        updated_at: 1200,
        last_opened_at: 1200,
      },
      {
        id: 'prep_migrated_puja_b',
        puja_id: 'puja_b',
        title: null,
        created_at: 2000,
        updated_at: 2000,
        last_opened_at: 2000,
      },
      {
        id: 'prep_migrated_puja_c',
        puja_id: 'puja_c',
        title: null,
        created_at: 800,
        updated_at: 800,
        last_opened_at: 800,
      },
    ]);
    expect(
      await db.all('SELECT * FROM checklist_progress ORDER BY preparation_id, item_ref'),
    ).toEqual([
      {
        preparation_id: 'prep_migrated_puja_a',
        item_kind: 'samagri',
        item_ref: 'sm_one',
        checked: 1,
        updated_at: 1000,
      },
      {
        preparation_id: 'prep_migrated_puja_a',
        item_kind: 'samagri',
        item_ref: 'sm_two',
        checked: 0,
        updated_at: 1100,
      },
      {
        preparation_id: 'prep_migrated_puja_a',
        item_kind: 'custom',
        item_ref: 'usr_x',
        checked: 1,
        updated_at: 1200,
      },
      {
        preparation_id: 'prep_migrated_puja_b',
        item_kind: 'samagri',
        item_ref: 'sm_three',
        checked: 1,
        updated_at: 2000,
      },
    ]);
    expect(await db.all('SELECT * FROM custom_samagri ORDER BY id')).toEqual([
      {
        id: 'usr_x',
        preparation_id: 'prep_migrated_puja_a',
        name: 'Cloth',
        note: 'red',
        created_at: 900,
      },
      {
        id: 'usr_y',
        preparation_id: 'prep_migrated_puja_c',
        name: 'Ghee',
        note: null,
        created_at: 800,
      },
    ]);
    // and the rest of user data is still there
    expect(await db.all('SELECT * FROM saved_puja')).toHaveLength(2);
  });

  it('leaves the content tables alone (no foreign key from user data to content)', async () => {
    const db = await phase4Database();
    await db.run(
      `INSERT INTO samagri (id, name_json, status) VALUES ('sm_keep', '{"en":"Keep"}', 'active')`,
    );
    applyMigrations(db, { from: 2 });
    expect(await db.all('SELECT id FROM samagri')).toEqual([{ id: 'sm_keep' }]);
  });
});
