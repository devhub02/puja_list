import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { listPujas } from '@/db/repositories';
import type { SqlDb } from '@/db/sqlDb';
import type { PujaSummary } from '@/db/types';

// One read of the puja list per database connection; Home and Library share it.
const cache = new WeakMap<SqlDb, Promise<PujaSummary[]>>();

export type Catalog =
  | { status: 'loading'; pujas: PujaSummary[]; retry: () => void }
  | { status: 'ready'; pujas: PujaSummary[]; retry: () => void }
  | { status: 'error'; pujas: PujaSummary[]; retry: () => void };

/** All active pujas (summaries only). Content never changes while the app runs, so this is read once. */
export function useCatalog(): Catalog {
  const db = useDatabase();
  const [state, setState] = useState<{ status: Catalog['status']; pujas: PujaSummary[] }>({
    status: 'loading',
    pujas: [],
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let promise = cache.get(db);
    if (!promise) {
      promise = listPujas(db);
      cache.set(db, promise);
    }
    promise.then(
      (pujas) => {
        if (!cancelled) setState({ status: 'ready', pujas });
      },
      (error: unknown) => {
        console.error('Could not load the puja list', error);
        cache.delete(db);
        if (!cancelled) setState({ status: 'error', pujas: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, attempt]);

  const retry = useCallback(() => {
    cache.delete(db);
    setState({ status: 'loading', pujas: [] });
    setAttempt((n) => n + 1);
  }, [db]);

  return { ...state, retry };
}
