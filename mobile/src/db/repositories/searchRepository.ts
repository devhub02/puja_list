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

export type PujaMatchKind = 'name' | 'category' | 'festival' | 'samagri';

export type PujaSearchHit = {
  pujaId: string;
  name: LocaleMap;
  /** Why this puja matched (a puja can match for several reasons). */
  matchedBy: PujaMatchKind[];
  /** Samagri items matching the query that this puja uses (empty unless matchedBy has 'samagri'). */
  samagri: { id: string; name: LocaleMap }[];
};

export type PujaSearchOptions = {
  limit?: number;
  /** Categories whose (translated) name matched the query; the UI resolves these from its locale files. */
  categories?: string[];
};

const MATCH_RANK = 'bm25(search_index, 0.0, 0.0, 10.0, 5.0, 1.0)';

/**
 * Puja-centred search for the search bar and the Library filter. A puja is returned when the query matches
 * its name or alternate spellings, its festival's name, its category (ids given by the caller), or the name of
 * a samagri item it uses. Order: name matches, category, festival, then samagri-only matches.
 */
export async function searchPujas(
  db: SqlDb,
  query: string,
  options: PujaSearchOptions = {},
): Promise<PujaSearchHit[]> {
  const match = buildMatchQuery(query);
  if (match === null) return [];
  const limit = options.limit ?? 60;

  const ids = async (sql: string, params: (string | number)[]): Promise<string[]> =>
    (await db.all<{ id: string }>(sql, params)).map((r) => r.id);

  const byName = await ids(
    `SELECT entity_id AS id FROM search_index
      WHERE entity_type = 'puja' AND search_index MATCH ? ORDER BY ${MATCH_RANK}, entity_id`,
    [`{names alt_names} : (${match})`],
  );
  const anyColumn = await ids(
    `SELECT entity_id AS id FROM search_index
      WHERE entity_type = 'puja' AND search_index MATCH ? ORDER BY ${MATCH_RANK}, entity_id`,
    [match],
  );
  const byFestival = await ids(
    `SELECT p.id AS id FROM search_index
       JOIN puja p ON p.festival_id = search_index.entity_id
      WHERE search_index.entity_type = 'festival' AND search_index MATCH ?
      ORDER BY ${MATCH_RANK}, p.id`,
    [match],
  );
  const categories = options.categories ?? [];
  const byCategory = categories.length
    ? await ids(
        `SELECT id FROM puja WHERE category IN (${categories.map(() => '?').join(', ')}) ORDER BY id`,
        categories,
      )
    : [];
  const samagriRows = await db.all<{ puja_id: string; samagri_id: string; name_json: string }>(
    `SELECT ps.puja_id AS puja_id, s.id AS samagri_id, s.name_json AS name_json
       FROM search_index
       JOIN samagri s ON s.id = search_index.entity_id
       JOIN puja_samagri ps ON ps.samagri_id = s.id
      WHERE search_index.entity_type = 'samagri' AND search_index MATCH ?
      ORDER BY ${MATCH_RANK}, ps.sort_order, s.id`,
    [match],
  );

  const kinds = new Map<string, Set<PujaMatchKind>>();
  const order: string[] = [];
  const add = (id: string, kind: PujaMatchKind) => {
    const set = kinds.get(id);
    if (set) set.add(kind);
    else {
      kinds.set(id, new Set([kind]));
      order.push(id);
    }
  };
  byName.forEach((id) => add(id, 'name'));
  byCategory.forEach((id) => add(id, 'category'));
  byFestival.forEach((id) => add(id, 'festival'));
  // Matched only through the samagri text stored on the puja row (not by its own name).
  const named = new Set(byName);
  anyColumn.filter((id) => !named.has(id)).forEach((id) => add(id, 'samagri'));
  const samagriByPuja = new Map<string, { id: string; name: LocaleMap }[]>();
  for (const row of samagriRows) {
    add(row.puja_id, 'samagri');
    const list = samagriByPuja.get(row.puja_id) ?? [];
    list.push({ id: row.samagri_id, name: parseJson<LocaleMap>(row.name_json) });
    samagriByPuja.set(row.puja_id, list);
  }
  if (order.length === 0) return [];

  const nameRows = await db.all<{ id: string; name_json: string }>(
    `SELECT id, name_json FROM puja WHERE status = 'active' AND id IN (${order.map(() => '?').join(', ')})`,
    order,
  );
  const names = new Map(nameRows.map((r) => [r.id, parseJson<LocaleMap>(r.name_json)]));

  const hits: PujaSearchHit[] = [];
  for (const id of order) {
    const name = names.get(id);
    if (!name) continue; // deprecated or removed
    hits.push({
      pujaId: id,
      name,
      matchedBy: [...(kinds.get(id) ?? [])],
      samagri: samagriByPuja.get(id) ?? [],
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
