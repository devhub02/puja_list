import type { SQLiteDatabase } from 'expo-sqlite';

import type { SqlDb, SqlValue } from './sqlDb';

/** Adapts an expo-sqlite connection to the small SqlDb interface. */
export function createExpoSqlDb(database: SQLiteDatabase): SqlDb {
  return {
    async run(sql: string, params: SqlValue[] = []) {
      if (params.length === 0) {
        await database.execAsync(sql);
      } else {
        await database.runAsync(sql, params);
      }
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return database.getAllAsync<T>(sql, params);
    },
  };
}
