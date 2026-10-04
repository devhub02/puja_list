import type { LocaleMap } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import type { PujaSearchHit } from '@/db/repositories';
import type { PujaCategory, PujaSummary } from '@/db/types';

import { kindOf, sortByName } from './pujaDisplay';
import type { PujaKind } from './pujaDisplay';

export type LibraryScope = 'all' | 'favorites' | 'recent';

/**
 * There is deliberately no month filter: the content has no festival month field and the calendar has no
 * dates yet (see docs/PROGRESS.md). Dates are never computed or guessed.
 */
export type LibraryFilters = {
  category: PujaCategory | null;
  kind: PujaKind | null;
  scope: LibraryScope;
};

export const emptyFilters: LibraryFilters = { category: null, kind: null, scope: 'all' };

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return filters.category !== null || filters.kind !== null || filters.scope !== 'all';
}

export type LibraryItem = {
  puja: PujaSummary;
  /** Samagri names that matched the search text and are used by this puja. */
  matchedSamagri: LocaleMap[];
};

type Context = {
  language: LanguageCode;
  savedIds: readonly string[];
  recentIds: readonly string[];
  /** null = no search text; otherwise the hits of the current search (possibly empty). */
  searchHits: readonly PujaSearchHit[] | null;
};

/**
 * Library list = all pujas, narrowed by the active filters AND the search text.
 * Order: alphabetical in the selected language; with search text, best match first; "recently viewed" is
 * newest first. Saved/recent ids with no matching puja (content removed) are simply not shown.
 */
export function buildLibraryItems(
  pujas: readonly PujaSummary[],
  filters: LibraryFilters,
  ctx: Context,
): LibraryItem[] {
  const hitById = new Map(ctx.searchHits?.map((h) => [h.pujaId, h]));
  const saved = new Set(ctx.savedIds);

  const matches = pujas.filter((p) => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.kind && kindOf(p.category) !== filters.kind) return false;
    if (filters.scope === 'favorites' && !saved.has(p.id)) return false;
    if (filters.scope === 'recent' && !ctx.recentIds.includes(p.id)) return false;
    if (ctx.searchHits !== null && !hitById.has(p.id)) return false;
    return true;
  });

  let ordered: PujaSummary[];
  if (ctx.searchHits !== null) {
    const rank = new Map(ctx.searchHits.map((h, i) => [h.pujaId, i]));
    ordered = [...matches].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  } else if (filters.scope === 'recent') {
    ordered = [...matches].sort(
      (a, b) => ctx.recentIds.indexOf(a.id) - ctx.recentIds.indexOf(b.id),
    );
  } else {
    ordered = sortByName(matches, ctx.language);
  }
  return ordered.map((puja) => ({
    puja,
    matchedSamagri: hitById.get(puja.id)?.samagri.map((s) => s.name) ?? [],
  }));
}
