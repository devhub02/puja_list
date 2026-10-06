import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { SqlDb } from './sqlDb';

const DatabaseContext = createContext<SqlDb | null>(null);

export function DatabaseProvider({ db, children }: { db: SqlDb; children: ReactNode }) {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

/** The ready database. Throws outside a ready DatabaseProvider (screens are only rendered once ready). */
export function useDatabase(): SqlDb {
  const db = useContext(DatabaseContext);
  if (db === null) throw new Error('useDatabase must be used inside a ready DatabaseProvider');
  return db;
}

/** For optional readers (e.g. About): null when there is no database. */
export function useOptionalDatabase(): SqlDb | null {
  return useContext(DatabaseContext);
}

export type DatabaseState =
  | { status: 'loading'; db: null; settledOnce: boolean }
  | { status: 'ready'; db: SqlDb; settledOnce: true }
  | { status: 'error'; db: null; settledOnce: true; error: unknown };

/**
 * Starts the async database setup after the first render (it never blocks the first frame) and
 * exposes `retry`. `settledOnce` becomes true after the first success or failure, so the splash
 * screen can be held until then and not come back on retries.
 */
/** A stalled database open must not hold the splash screen forever: after this, the Retry screen shows. */
export const DB_SETUP_TIMEOUT_MS = 20_000;

/** Rejects if `promise` does not settle within `ms`. The original promise is not cancelled. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Database setup did not finish within ${ms} ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function useDatabaseInit(
  init: () => Promise<SqlDb>,
  timeoutMs: number = DB_SETUP_TIMEOUT_MS,
) {
  const [state, setState] = useState<DatabaseState>({
    status: 'loading',
    db: null,
    settledOnce: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    withTimeout(init(), timeoutMs).then(
      (db) => {
        if (!cancelled) setState({ status: 'ready', db, settledOnce: true });
      },
      (error: unknown) => {
        console.error('Database setup failed', error);
        if (!cancelled) setState({ status: 'error', db: null, settledOnce: true, error });
      },
    );
    return () => {
      cancelled = true;
    };
    // `init` is intentionally not a dependency: it is a fixed function for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, timeoutMs]);

  const retry = useCallback(() => {
    setState({ status: 'loading', db: null, settledOnce: true });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}
