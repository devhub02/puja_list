import fs from 'node:fs';
import path from 'node:path';

import { createMigratedDb, createNodeSqlDb, applyMigrations } from '../testing/nodeSqlDb';

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

async function names(db: ReturnType<typeof createMigratedDb>, type: string) {
  const rows = await db.all<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'`,
    [type],
  );
  return rows.map((r) => r.name);
}

describe('migrations on a fresh install', () => {
  it('creates every content, user-data and search table', async () => {
    const db = createMigratedDb();
    const tables = await names(db, 'table');
    for (const table of [...CONTENT_TABLES, ...USER_TABLES, 'search_index']) {
      expect(tables).toContain(table);
    }
  });

  it('creates the indexes from docs/DB_SCHEMA.md', async () => {
    const db = createMigratedDb();
    const indexes = await names(db, 'index');
    expect(indexes).toEqual(
      expect.arrayContaining([
        'puja_festival_id_idx',
        'puja_category_idx',
        'puja_status_idx',
        'puja_samagri_puja_sort_idx',
        'puja_samagri_samagri_id_idx',
        'vidhi_step_puja_step_uq',
        'regional_variation_puja_id_idx',
        'calendar_date_festival_year_idx',
        'calendar_date_year_date_idx',
        'checklist_template_puja_id_idx',
        'saved_puja_saved_at_idx',
        'checklist_progress_preparation_id_idx',
        'preparation_puja_id_idx',
        'preparation_last_opened_at_idx',
        'custom_samagri_preparation_id_idx',
        'reminder_fire_at_idx',
        'reminder_puja_id_idx',
        'recent_view_viewed_at_idx',
        'recent_search_searched_at_idx',
      ]),
    );
  });

  it('makes vidhi_step(puja_id, step_number) unique', async () => {
    const db = createMigratedDb();
    const row = await db.all<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE name = 'vidhi_step_puja_step_uq'`,
    );
    expect(row[0].sql).toMatch(/UNIQUE INDEX/);
  });

  it('gives user-data tables no foreign keys to content tables (only to their own preparation, with cascade)', async () => {
    const db = createMigratedDb();
    for (const table of USER_TABLES) {
      const fks = await db.all<{ table: string; on_delete: string }>(
        `SELECT * FROM pragma_foreign_key_list('${table}')`,
      );
      if (['checklist_progress', 'custom_samagri', 'vidhi_progress'].includes(table)) {
        expect(fks.map((fk) => [fk.table, fk.on_delete])).toEqual([['preparation', 'CASCADE']]);
      } else {
        expect(fks).toEqual([]);
      }
    }
  });

  it('keeps content tables free of cascading deletes', async () => {
    const db = createMigratedDb();
    for (const table of CONTENT_TABLES) {
      const fks = await db.all<{ on_delete: string }>(
        `SELECT * FROM pragma_foreign_key_list('${table}')`,
      );
      for (const fk of fks) expect(fk.on_delete).toBe('NO ACTION');
    }
  });

  it('creates search_index as an FTS5 table that keeps Devanagari words whole', async () => {
    const db = createMigratedDb();
    const [row] = await db.all<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE name = 'search_index'`,
    );
    expect(row.sql).toMatch(/USING fts5/);
    expect(row.sql).toMatch(/categories 'L\* N\* Co Mn Mc'/);
  });

  it('cannot be applied twice to one database (the migrator tracks applied ones)', () => {
    const db = createMigratedDb();
    expect(() => applyMigrations(db)).toThrow(/already exists/);
  });

  it('starts empty: no content, no meta, no user data', async () => {
    const db = createNodeSqlDb();
    applyMigrations(db);
    for (const table of [...CONTENT_TABLES, ...USER_TABLES]) {
      const [{ n }] = await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect(n).toBe(0);
    }
  });
});

describe('migration files', () => {
  const dir = path.resolve(__dirname, '..', 'drizzle');
  const journal = JSON.parse(fs.readFileSync(path.join(dir, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  const migrationsJs = fs.readFileSync(path.join(dir, 'migrations.js'), 'utf8');

  it('registers every journal entry in migrations.js', () => {
    expect(journal.entries.length).toBeGreaterThanOrEqual(2);
    for (const { tag } of journal.entries) {
      expect(migrationsJs).toContain(`./${tag}.sql`);
      expect(fs.existsSync(path.join(dir, `${tag}.sql`))).toBe(true);
    }
  });
});
