/**
 * Opens the phone database, applies migrations, then seeds the bundled content if needed.
 * Order (docs/DB_SCHEMA.md section 7): migrations -> check contentVersion -> seed.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import contentJson from '../../assets/puja_data/content.json';
import { createExpoSqlDb } from './expoAdapter';
import { seedContentIfNeeded } from './seed';
import type { SqlDb } from './sqlDb';
import type { ContentBundle } from './types';

export const DATABASE_NAME = 'puja_saathi.db';

const bundledContent = contentJson as unknown as ContentBundle;

let connection: SQLiteDatabase | null = null;

export async function initializeDatabase(): Promise<SqlDb> {
  if (connection === null) {
    connection = await openDatabaseAsync(DATABASE_NAME);
  }
  try {
    // Content tables use real foreign keys among themselves; user-data tables have none.
    await connection.execAsync('PRAGMA foreign_keys = ON;');
    await migrate(drizzle(connection), migrations);
    const db = createExpoSqlDb(connection);
    await seedContentIfNeeded(db, bundledContent);
    return db;
  } catch (error) {
    // Drop the handle so "Try again" starts from a fresh connection.
    const failed = connection;
    connection = null;
    await failed.closeAsync().catch(() => undefined);
    throw error;
  }
}
