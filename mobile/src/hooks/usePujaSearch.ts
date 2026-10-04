import { useEffect, useState } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { searchPujas } from '@/db/repositories';
import type { PujaSearchHit } from '@/db/repositories';
import { buildMatchQuery } from '@/db/search/normalize';
import { matchCategoryIds } from '@/utils/categorySearch';

import { useDebouncedValue } from './useDebouncedValue';

export const SEARCH_DEBOUNCE_MS = 200;

export type PujaSearchState = {
  /** The text the current `hits` belong to ("" when there is nothing to search). */
  query: string;
  /** null = no search text. Otherwise the hits for `query` (possibly empty). */
  hits: PujaSearchHit[] | null;
  /** True between a keystroke and its results (debounce wait + database read). */
  pending: boolean;
  error: boolean;
};

/**
 * Live search with a ~200 ms debounce. Clearing the text resets immediately (no stale results);
 * out-of-order responses are discarded.
 */
export function usePujaSearch(text: string, limit?: number): PujaSearchState {
  const db = useDatabase();
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const searchable = buildMatchQuery(text) !== null;
  const [result, setResult] = useState<{ query: string; hits: PujaSearchHit[]; error: boolean }>({
    query: '',
    hits: [],
    error: false,
  });

  useEffect(() => {
    if (buildMatchQuery(debounced) === null) return;
    let cancelled = false;
    searchPujas(db, debounced, { categories: matchCategoryIds(debounced), limit }).then(
      (hits) => {
        if (!cancelled) setResult({ query: debounced, hits, error: false });
      },
      (error: unknown) => {
        console.error('Search failed', error);
        if (!cancelled) setResult({ query: debounced, hits: [], error: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, debounced, limit]);

  if (!searchable) return { query: '', hits: null, pending: false, error: false };
  const current = result.query === text.trim();
  return {
    query: text.trim(),
    hits: current ? result.hits : null,
    pending: !current,
    error: current && result.error,
  };
}
