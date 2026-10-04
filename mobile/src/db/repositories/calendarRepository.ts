import { monthEnd, monthStart } from '@/utils/dateUtils';

import type { SqlDb } from '../sqlDb';
import type { CalendarDate, Festival } from '../types';
import { toCalendarDate, toFestival } from './festivalRepository';
import type { CalendarRow, FestivalRow } from './festivalRepository';

/** One dated observance of a festival: the bundled date entry plus the festival it belongs to. */
export type FestivalOccurrence = { date: CalendarDate; festival: Festival };

const ACTIVE_FESTIVAL = `EXISTS (SELECT 1 FROM festival f WHERE f.id = c.festival_id AND f.status = 'active')`;

/** Pairs date rows with their (active) festivals. Rows whose festival is missing or deprecated are dropped. */
async function withFestivals(db: SqlDb, rows: CalendarRow[]): Promise<FestivalOccurrence[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.festival_id))];
  const festivals = await db.all<FestivalRow>(
    `SELECT * FROM festival WHERE status = 'active' AND id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  const byId = new Map(festivals.map((row) => [row.id, toFestival(row)]));
  return rows.flatMap((row) => {
    const festival = byId.get(row.festival_id);
    return festival ? [{ date: toCalendarDate(row), festival }] : [];
  });
}

/**
 * Every dated observance that touches the month (a festival that starts in the previous month and runs into
 * this one is included). Sorted by start date, then English name. Empty means "no bundled data".
 */
export async function listDatesForMonth(
  db: SqlDb,
  year: number,
  month: number,
): Promise<FestivalOccurrence[]> {
  const rows = await db.all<CalendarRow>(
    `SELECT c.* FROM calendar_date c
     WHERE c.date <= ? AND COALESCE(c.end_date, c.date) >= ? AND ${ACTIVE_FESTIVAL}
     ORDER BY c.date, c.id`,
    [monthEnd(year, month), monthStart(year, month)],
  );
  return sortOccurrences(await withFestivals(db, rows));
}

function sortOccurrences(list: FestivalOccurrence[]): FestivalOccurrence[] {
  return [...list].sort(
    (a, b) =>
      a.date.date.localeCompare(b.date.date) ||
      a.festival.name.en.localeCompare(b.festival.name.en) ||
      a.date.id.localeCompare(b.date.id),
  );
}

/** Rows that are still upcoming or ongoing on `today`: the last day (end date, else date) is today or later. */
const NOT_OVER = `COALESCE(c.end_date, c.date) >= ?`;

/**
 * The next observance of each festival from `today`, soonest first. A festival that is on right now (it
 * started on or before today and ends today or later) is included. One entry per festival: its next date.
 */
export async function listNextDates(db: SqlDb, today: string): Promise<FestivalOccurrence[]> {
  const rows = await db.all<CalendarRow>(
    `SELECT c.* FROM calendar_date c WHERE ${NOT_OVER} AND ${ACTIVE_FESTIVAL} ORDER BY c.date, c.id`,
    [today],
  );
  const seen = new Set<string>();
  const first = rows.filter((row) => {
    if (seen.has(row.festival_id)) return false;
    seen.add(row.festival_id);
    return true;
  });
  return sortOccurrences(await withFestivals(db, first));
}

/** Upcoming festivals from today (ongoing ones included), at most `limit`. Empty when no date is bundled. */
export async function listUpcomingFestivals(
  db: SqlDb,
  today: string,
  limit: number,
): Promise<FestivalOccurrence[]> {
  return (await listNextDates(db, today)).slice(0, Math.max(0, limit));
}

/** The festival's next or ongoing date from `today`, or null (never a guess). */
export async function getNextDate(
  db: SqlDb,
  festivalId: string,
  today: string,
): Promise<CalendarDate | null> {
  const [row] = await db.all<CalendarRow>(
    `SELECT c.* FROM calendar_date c WHERE c.festival_id = ? AND ${NOT_OVER} ORDER BY c.date, c.id LIMIT 1`,
    [festivalId, today],
  );
  return row ? toCalendarDate(row) : null;
}

/** Active festivals that have no bundled date in `year` ("Date not available"), by English name. */
export async function listFestivalsWithoutDate(db: SqlDb, year: number): Promise<Festival[]> {
  const rows = await db.all<FestivalRow>(
    `SELECT f.* FROM festival f
     WHERE f.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM calendar_date c WHERE c.festival_id = f.id AND c.year = ?)
     ORDER BY json_extract(f.name_json, '$.en') COLLATE NOCASE, f.id`,
    [year],
  );
  return rows.map(toFestival);
}
