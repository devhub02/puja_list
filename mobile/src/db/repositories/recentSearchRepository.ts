import { normalizeSearchText } from '../search/normalize';
import type { SqlDb } from '../sqlDb';

export const RECENT_SEARCH_LIMIT = 10;

/** Collapses whitespace and normalises Unicode, so "Ganesh  " and "ganesh" are the same search. */
export function cleanSearchQuery(query: string): string {
  return normalizeSearchText(query).replace(/\s+/g, ' ').trim();
}

/**
 * Remembers a search the user submitted or opened a result for (never every keystroke).
 * The same text (ignoring case) is stored once, moved to the top; only the newest 10 are kept.
 */
export async function recordSearch(
  db: SqlDb,
  query: string,
  now: number = Date.now(),
): Promise<void> {
  const clean = cleanSearchQuery(query);
  if (clean === '') return;
  await db.run('DELETE FROM recent_search WHERE lower(query) = lower(?)', [clean]);
  await db.run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', [clean, now]);
  await db.run(
    `DELETE FROM recent_search WHERE query NOT IN
       (SELECT query FROM recent_search ORDER BY searched_at DESC, rowid DESC LIMIT ?)`,
    [RECENT_SEARCH_LIMIT],
  );
}

/** Newest first. */
export async function listRecentSearches(
  db: SqlDb,
  limit: number = RECENT_SEARCH_LIMIT,
): Promise<string[]> {
  const rows = await db.all<{ query: string }>(
    'SELECT query FROM recent_search ORDER BY searched_at DESC, rowid DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => r.query);
}

export async function clearRecentSearches(db: SqlDb): Promise<void> {
  await db.run('DELETE FROM recent_search');
}
