import { useCallback, useEffect, useRef, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import {
  getChecklistState,
  getPuja,
  getSamagriNames,
  getVidhiProgress,
  listPreparationSummaries,
  listPreparationsForPuja,
  touchPreparation,
} from '@/db/repositories';
import type { ChecklistState, PreparationSummary, VidhiProgress } from '@/db/repositories';
import type { PujaDetail } from '@/db/types';
import type { LocaleMap } from '@/i18n/localeMap';
import { usePreparationStore, writeAndRefresh } from '@/store/preparationStore';
import { findRemovedIds } from '@/utils/preparationProgress';

export type RemovedItem = { id: string; name?: LocaleMap };

export type PujaPreparationData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | {
      status: 'ready';
      puja: PujaDetail;
      /** null until the user has a preparation for this puja (it is created on their first action). */
      state: ChecklistState | null;
      vidhi: VidhiProgress | null;
      /** Ticked ids the puja's list no longer contains. */
      removed: RemovedItem[];
    };

/**
 * A puja plus the preparation the user is working on. `preparationId` picks one; without it the most
 * recently opened preparation of the puja is used (or none). The puja is read once; the preparation is
 * re-read after every write anywhere in the app. Never creates anything.
 */
export function usePujaPreparation(
  pujaId: string | undefined,
  preparationId: string | null | undefined,
): PujaPreparationData & { reload: () => void } {
  const db = useDatabase();
  const revision = usePreparationStore((s) => s.revision);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<{ key: string; value: PujaPreparationData } | null>(null);
  const latest = useRef(0);
  const key = `${pujaId ?? ''}:${attempt}`;

  useEffect(() => {
    if (!pujaId) return;
    const request = ++latest.current;
    let cancelled = false;
    (async () => {
      try {
        const puja = await getPuja(db, pujaId);
        if (puja === null || puja.status !== 'active') return { status: 'notFound' as const };
        const id = preparationId ?? (await listPreparationsForPuja(db, pujaId))[0]?.id;
        let state = id ? await getChecklistState(db, id) : null;
        if (state && state.preparation.pujaId !== pujaId) state = null;
        const vidhi = state ? await getVidhiProgress(db, state.preparation.id) : null;
        const removedIds = state ? findRemovedIds(puja.samagri, state.checkedSamagriIds) : [];
        const names = await getSamagriNames(db, removedIds);
        const removed = removedIds.map((rid) => ({ id: rid, name: names.get(rid) }));
        return { status: 'ready' as const, puja, state, vidhi, removed };
      } catch (error) {
        console.error('Could not load the preparation', error);
        return { status: 'error' as const };
      }
    })().then((value) => {
      // A newer request (or an unmounted screen) wins; older answers are dropped.
      if (!cancelled && request === latest.current) setData({ key, value });
    });
    return () => {
      cancelled = true;
    };
  }, [db, pujaId, preparationId, revision, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const current: PujaPreparationData = !pujaId
    ? { status: 'notFound' }
    : data && data.key === key
      ? data.value
      : // Re-reading after a write keeps showing the last answer instead of flashing a spinner.
        data && data.key.startsWith(`${pujaId}:`) && data.value.status === 'ready'
        ? data.value
        : { status: 'loading' };
  return { ...current, reload };
}

export type PreparationSummaries =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; summaries: PreparationSummary[] };

/** Every preparation with progress, most recently opened first. Re-read after every write. */
export function usePreparationSummaries(): PreparationSummaries & { reload: () => void } {
  const db = useDatabase();
  const revision = usePreparationStore((s) => s.revision);
  const [attempt, setAttempt] = useState(0);
  const [value, setValue] = useState<PreparationSummaries>({ status: 'loading' });
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    let cancelled = false;
    listPreparationSummaries(db).then(
      (summaries) => {
        if (!cancelled && request === latest.current) setValue({ status: 'ready', summaries });
      },
      (error: unknown) => {
        console.error('Could not load preparations', error);
        if (!cancelled && request === latest.current) setValue({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, revision, attempt]);

  const reload = useCallback(() => {
    setValue((v) => (v.status === 'error' ? { status: 'loading' } : v));
    setAttempt((n) => n + 1);
  }, []);
  return { ...value, reload };
}

/**
 * Marks an existing preparation as just opened (once per screen visit) so it sorts first in
 * "recently used". Does nothing while there is no preparation: opening a screen never creates one.
 */
export function useTouchOnOpen(preparationId: string | null): void {
  const db = useDatabase();
  const touched = useRef<string | null>(null);
  useEffect(() => {
    if (!preparationId || touched.current === preparationId) return;
    touched.current = preparationId;
    void writeAndRefresh(() => touchPreparation(db, preparationId));
  }, [db, preparationId]);
}
