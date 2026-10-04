import type { LocaleMap } from '@/i18n/localeMap';

import type { SqlDb } from '../sqlDb';
import type {
  AltNames,
  CalendarDate,
  DateCertainty,
  DateType,
  EntityStatus,
  Festival,
  FestivalCategory,
  FestivalRegion,
  FestivalWithDates,
  ReviewStatus,
} from '../types';
import { parseJson, parseOptionalJson } from './json';

type FestivalRow = {
  id: string;
  name_json: string;
  alt_names_json: string | null;
  short_description_json: string;
  significance_json: string | null;
  regions_json: string;
  states_json: string | null;
  category: FestivalCategory;
  date_type: DateType;
  observance_json: string | null;
  linked_puja_ids_json: string;
  review_status: ReviewStatus;
  source_note_json: string;
  status: EntityStatus;
};

type CalendarRow = {
  id: string;
  festival_id: string;
  year: number;
  date: string;
  end_date: string | null;
  region: string;
  certainty: DateCertainty;
  region_note_json: string | null;
  source: string;
};

function toFestival(row: FestivalRow): Festival {
  return {
    id: row.id,
    name: parseJson<LocaleMap>(row.name_json),
    alternateNames: parseOptionalJson<AltNames>(row.alt_names_json),
    shortDescription: parseJson<LocaleMap>(row.short_description_json),
    significance: parseOptionalJson<LocaleMap>(row.significance_json),
    regions: parseJson<FestivalRegion[]>(row.regions_json),
    states: parseOptionalJson<LocaleMap[]>(row.states_json) ?? [],
    category: row.category,
    dateType: row.date_type,
    observanceDescription: parseOptionalJson<LocaleMap>(row.observance_json),
    linkedPujaIds: parseJson<string[]>(row.linked_puja_ids_json),
    reviewStatus: row.review_status,
    sourceNote: parseJson<LocaleMap>(row.source_note_json),
    status: row.status,
  };
}

function toCalendarDate(row: CalendarRow): CalendarDate {
  return {
    id: row.id,
    festivalId: row.festival_id,
    year: row.year,
    date: row.date,
    endDate: row.end_date ?? undefined,
    region: row.region,
    certainty: row.certainty,
    regionNote: parseOptionalJson<LocaleMap>(row.region_note_json),
    source: row.source || undefined,
  };
}

export type FestivalFilter = {
  /** Only attach dates of this year. A festival without a date for the year is still listed (empty `dates`). */
  year?: number;
  includeDeprecated?: boolean;
};

/** Lists festivals (ordered by English name) with their bundled calendar dates, earliest first. */
export async function listFestivals(
  db: SqlDb,
  filter: FestivalFilter = {},
): Promise<FestivalWithDates[]> {
  const festivals = await db.all<FestivalRow>(
    `SELECT * FROM festival ${filter.includeDeprecated ? '' : `WHERE status = 'active'`}
     ORDER BY json_extract(name_json, '$.en') COLLATE NOCASE, id`,
  );
  const dates = await db.all<CalendarRow>(
    `SELECT * FROM calendar_date ${filter.year === undefined ? '' : 'WHERE year = ?'} ORDER BY date, id`,
    filter.year === undefined ? [] : [filter.year],
  );
  const byFestival = new Map<string, CalendarDate[]>();
  for (const row of dates) {
    const list = byFestival.get(row.festival_id) ?? [];
    list.push(toCalendarDate(row));
    byFestival.set(row.festival_id, list);
  }
  return festivals.map((row) => ({ ...toFestival(row), dates: byFestival.get(row.id) ?? [] }));
}

export async function getFestival(db: SqlDb, id: string): Promise<FestivalWithDates | null> {
  const [row] = await db.all<FestivalRow>('SELECT * FROM festival WHERE id = ?', [id]);
  if (!row) return null;
  const dates = await db.all<CalendarRow>(
    'SELECT * FROM calendar_date WHERE festival_id = ? ORDER BY date, id',
    [id],
  );
  return { ...toFestival(row), dates: dates.map(toCalendarDate) };
}
