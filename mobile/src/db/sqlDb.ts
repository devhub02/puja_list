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

// One queue per connection: two transactions can never interleave on the same connection (a second
// BEGIN would fail, and statements from one caller would land inside the other's transaction).
const queues = new WeakMap<SqlDb, Promise<unknown>>();

/**
 * Run `fn` in one transaction: COMMIT if it resolves, ROLLBACK (and rethrow) if it throws.
 * Transactions on one connection run one after another, in call order. `fn` must not start another
 * transaction on the same connection (it would wait for itself).
 */
export function withTransaction<T>(db: SqlDb, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(db) ?? Promise.resolve();
  const result = previous.then(() => runTransaction(db, fn));
  queues.set(
    db,
    result.catch(() => undefined),
  );
  return result;
}

async function runTransaction<T>(db: SqlDb, fn: () => Promise<T>): Promise<T> {
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
