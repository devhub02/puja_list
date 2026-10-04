/**
 * Test-only SqlDb on Node's built-in SQLite (node:sqlite), so seed/repository/search logic runs against a
 * real SQLite engine (with FTS5) without a device. It is NOT the Android SQLite build: see docs/PROGRESS.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import type { SqlDb, SqlValue } from '@/db/sqlDb';

// `node:sqlite` is loaded with require so Jest's module resolver is not involved.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

export type TestSqlDb = SqlDb & {
  raw: InstanceType<typeof DatabaseSync>;
  /** Statements executed so far (lets tests inject a failure at the Nth write). */
  failOnStatement?: (sql: string, count: number) => boolean;
};

export function createNodeSqlDb(file: string = ':memory:'): TestSqlDb {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON;');
  let count = 0;
  const db: TestSqlDb = {
    raw,
    async run(sql, params = []) {
      count += 1;
      if (db.failOnStatement?.(sql, count))
        throw new Error(`injected failure at statement ${count}`);
      if (params.length === 0) raw.exec(sql);
      else raw.prepare(sql).run(...(params as SqlValue[]));
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
  };
  return db;
}

const DRIZZLE_DIR = path.resolve(__dirname, '..', 'drizzle');

/** Applies the committed Drizzle migrations in journal order, the way the app's migrator does. */
export function applyMigrations(db: TestSqlDb): void {
  const journal = JSON.parse(
    fs.readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'),
  ) as {
    entries: { tag: string }[];
  };
  for (const entry of journal.entries) {
    const sql = fs.readFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) db.raw.exec(statement);
    }
  }
}

export function createMigratedDb(): TestSqlDb {
  const db = createNodeSqlDb();
  applyMigrations(db);
  return db;
}
