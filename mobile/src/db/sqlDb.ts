/**
 * The only database surface the seed loader and repositories depend on.
 * The app implements it on expo-sqlite; unit tests implement it on Node's SQLite.
 */
export type SqlValue = string | number | null;

export interface SqlDb {
  /** Execute a statement that returns no rows. */
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Execute a query and return all rows. */
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

/**
 * Run `fn` in one transaction: COMMIT if it resolves, ROLLBACK (and rethrow) if it throws.
 * Callers must not run other queries on the same connection while it is in progress.
 */
export async function withTransaction<T>(db: SqlDb, fn: () => Promise<T>): Promise<T> {
  await db.run('BEGIN IMMEDIATE');
  try {
    const result = await fn();
    await db.run('COMMIT');
    return result;
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch {
      // The original error is the useful one.
    }
    throw error;
  }
}
