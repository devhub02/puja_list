import type { LocaleMap } from '@/i18n/localeMap';

import { buildMatchQuery } from '../search/normalize';
import type { SqlDb } from '../sqlDb';
import type { SearchEntityType, SearchResult } from '../types';
import { parseJson } from './json';

export type SearchOptions = {
  limit?: number;
  types?: SearchEntityType[];
};

type Row = { entity_type: SearchEntityType; entity_id: string; name_json: string | null };

/**
 * Full-text search over names, alternate spellings and (for pujas) samagri names.
 * Every typed word is a prefix term and all words must match. Ranked by bm25 with names weighted
 * above alternate spellings above samagri names. Entities no longer in the content tables are dropped.
 */
export async function searchContent(
  db: SqlDb,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const match = buildMatchQuery(query);
  if (match === null) return [];
  const limit = options.limit ?? 30;
  const types = options.types?.length ? options.types : null;

  const rows = await db.all<Row>(
    `SELECT search_index.entity_type AS entity_type, search_index.entity_id AS entity_id,
            COALESCE(p.name_json, f.name_json, s.name_json) AS name_json
       FROM search_index
       LEFT JOIN puja p ON search_index.entity_type = 'puja' AND p.id = search_index.entity_id
       LEFT JOIN festival f ON search_index.entity_type = 'festival' AND f.id = search_index.entity_id
       LEFT JOIN samagri s ON search_index.entity_type = 'samagri' AND s.id = search_index.entity_id
      WHERE search_index MATCH ?
        ${types ? `AND search_index.entity_type IN (${types.map(() => '?').join(', ')})` : ''}
      ORDER BY bm25(search_index, 0.0, 0.0, 10.0, 5.0, 1.0),
               CASE search_index.entity_type WHEN 'puja' THEN 0 WHEN 'festival' THEN 1 ELSE 2 END,
               search_index.entity_id
      LIMIT ?`,
    [match, ...(types ?? []), limit],
  );

  const results: SearchResult[] = [];
  for (const row of rows) {
    if (row.name_json === null) continue;
    results.push({
      entityType: row.entity_type,
      entityId: row.entity_id,
      name: parseJson<LocaleMap>(row.name_json),
      rank: results.length + 1,
    });
  }
  return results;
}
