import type { AltNames, ContentBundle } from '../types';
import { normalizeSearchText } from './normalize';

type Row = [entityType: string, entityId: string, names: string, altNames: string, extra: string];

const join = (parts: string[]): string => normalizeSearchText(parts.filter(Boolean).join(' '));
const valuesOf = (map: Record<string, string> | undefined): string[] => Object.values(map ?? {});
const altOf = (alt: AltNames | undefined): string[] => Object.values(alt ?? {}).flat();

/**
 * One FTS row per active puja, festival and samagri item (docs/DB_SCHEMA.md section 5):
 * - names: the name in every language; alt_names: all alternate spellings
 * - puja `extra`: names and alternate spellings of its samagri, so searching an item finds pujas using it
 * Deprecated entities are kept in the content tables but not offered in search.
 */
export function buildSearchRows(bundle: ContentBundle): Row[] {
  const samagriById = new Map(bundle.samagri.map((s) => [s.id, s]));
  const rows: Row[] = [];

  for (const p of bundle.pujas) {
    if (p.status !== 'active') continue;
    const used = p.samagri.map((u) => samagriById.get(u.samagriId));
    const extra = used.flatMap((s) => (s ? [...valuesOf(s.name), ...altOf(s.alternateNames)] : []));
    rows.push(['puja', p.id, join(valuesOf(p.name)), join(altOf(p.alternateNames)), join(extra)]);
  }
  for (const f of bundle.festivals) {
    if (f.status !== 'active') continue;
    rows.push(['festival', f.id, join(valuesOf(f.name)), join(altOf(f.alternateNames)), '']);
  }
  for (const s of bundle.samagri) {
    if (s.status !== 'active') continue;
    rows.push(['samagri', s.id, join(valuesOf(s.name)), join(altOf(s.alternateNames)), '']);
  }
  return rows;
}
