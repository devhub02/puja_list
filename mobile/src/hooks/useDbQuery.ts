import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import type { SqlDb } from '@/db/sqlDb';

export type Query<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

/**
 * Runs one database read and re-runs it when `key` changes (the key must describe every input of `load`).
 * A result belongs to one key; anything else is "loading", so a stale result is never shown for a new input
 * and no state is set synchronously inside the effect.
 */
export function useDbQuery<T>(load: (db: SqlDb) => Promise<T>, key: string): Query<T> {
  const db = useDatabase();
  const [attempt, setAttempt] = useState(0);
  const fullKey = `${key}#${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: T; failed: boolean } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let cancelled = false;
    loadRef.current(db).then(
      (data) => {
        if (!cancelled) setResult({ key: fullKey, data, failed: false });
      },
      (error: unknown) => {
        console.error('Database read failed', error);
        if (!cancelled) setResult({ key: fullKey, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, fullKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (result?.key !== fullKey) return { status: 'loading', retry };
  if (result.failed) return { status: 'error', retry };
  return { status: 'ready', data: result.data as T, retry };
}
