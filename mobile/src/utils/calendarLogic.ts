import type { FestivalOccurrence } from '@/db/repositories/calendarRepository';
import type { CalendarDate, Festival, FestivalCategory, FestivalRegion } from '@/db/types';

import { isInRange, lastDay, parseIso } from './dateUtils';

/** A festival row in the calendar: with its bundled date, or without one ("Date not available"). */
export type CalendarItem = { festival: Festival; date?: CalendarDate };

export type CalendarFilters = {
  /** null = All India (no region filter). */
  region: FestivalRegion | null;
  category: FestivalCategory | null;
};

export const emptyCalendarFilters: CalendarFilters = { region: null, category: null };

export function hasCalendarFilters(filters: CalendarFilters): boolean {
  return filters.region !== null || filters.category !== null;
}

/** Fixed display order of region chips (pan_india is the default "All India" chip, never a chip of its own). */
export const festivalRegionOrder: readonly FestivalRegion[] = [
  'north',
  'south',
  'east',
  'west',
  'central',
  'north_east',
  'himalayan',
  'tribal',
];

export const festivalCategoryOrder: readonly FestivalCategory[] = [
  'deity_festival',
  'harvest_seasonal',
  'new_year',
  'vrat_fasting',
  'family_bond',
  'nature_ritual',
  'yatra_mela',
];

/** Region chips worth showing: only regions that some festival in the catalog is tied to. */
export function regionOptions(festivals: readonly Festival[]): FestivalRegion[] {
  const present = new Set(festivals.flatMap((f) => f.regions));
  return festivalRegionOrder.filter((r) => present.has(r));
}

export function categoryOptions(festivals: readonly Festival[]): FestivalCategory[] {
  const present = new Set(festivals.map((f) => f.category));
  return festivalCategoryOrder.filter((c) => present.has(c));
}

/**
 * A festival with several regions matches any of them; a pan_india festival matches every region filter. Regional
 * scope comes only from the festival catalog, because dates carry no region of their own.
 */
export function festivalMatchesFilters(festival: Festival, filters: CalendarFilters): boolean {
  if (filters.category !== null && festival.category !== filters.category) return false;
  if (filters.region === null) return true;
  return festival.regions.includes('pan_india') || festival.regions.includes(filters.region);
}

function normalize(text: string): string {
  return text.normalize('NFC').replace(/[‌‍]/g, '').toLowerCase().trim();
}

/** Case-insensitive substring match on the English and Hindi names and the alternate spellings. */
export function festivalMatchesQuery(festival: Festival, query: string): boolean {
  const needle = normalize(query).replace(/\s+/g, ' ');
  if (needle === '') return true;
  const names = [
    ...Object.values(festival.name),
    ...Object.values(festival.alternateNames ?? {}).flat(),
  ];
  return names.some((name) => normalize(name).replace(/\s+/g, ' ').includes(needle));
}

export function filterItems<T extends { festival: Festival }>(
  items: readonly T[],
  filters: CalendarFilters,
  query: string,
): T[] {
  return items.filter(
    (item) =>
      festivalMatchesFilters(item.festival, filters) && festivalMatchesQuery(item.festival, query),
  );
}

export type DayInfo = {
  /** Festivals that have a date on this day (single-day or part of a range). */
  count: number;
  /** Single-day festivals on this day (drawn as dots). */
  singles: number;
  /** Multi-day festivals covering this day (drawn as a bar through the days). */
  ranges: { start: string; end: string }[];
};

/** Per-day marker data for the month grid. Days without a festival have no entry. */
export function buildDayInfo(occurrences: readonly FestivalOccurrence[]): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>();
  for (const { date } of occurrences) {
    const end = lastDay(date.date, date.endDate);
    const start = parseIso(date.date);
    if (!start) continue;
    // Walk the days of the observance (at most a few weeks); stops at the bundled end date.
    let cursor = date.date;
    let guard = 0;
    while (cursor <= end && guard < 62) {
      const info = map.get(cursor) ?? { count: 0, singles: 0, ranges: [] };
      info.count += 1;
      if (end > date.date) info.ranges.push({ start: date.date, end });
      else info.singles += 1;
      map.set(cursor, info);
      cursor = nextDay(cursor);
      guard += 1;
    }
  }
  return map;
}

/** The next calendar day. Gregorian arithmetic on a date that is already in the bundle's range. */
function nextDay(iso: string): string {
  const ymd = parseIso(iso);
  if (!ymd) return '9999-12-31';
  const probe = new Date(Date.UTC(2000, 0, 1));
  probe.setUTCFullYear(ymd.year, ymd.month - 1, ymd.day + 1);
  const y = String(probe.getUTCFullYear()).padStart(4, '0');
  const m = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const d = String(probe.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function occurrencesOnDay(
  occurrences: readonly FestivalOccurrence[],
  iso: string,
): FestivalOccurrence[] {
  return occurrences.filter(({ date }) => isInRange(iso, date.date, date.endDate));
}

export type MonthSection = { month: number; data: CalendarItem[] };

/** Groups the festivals that have a date in `year` by the month of that date (a range belongs to its start month). */
export function groupByMonth(items: readonly CalendarItem[]): MonthSection[] {
  const byMonth = new Map<number, CalendarItem[]>();
  for (const item of items) {
    if (!item.date) continue;
    const month = parseIso(item.date.date)?.month;
    if (month === undefined) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), item]);
  }
  return [...byMonth.keys()]
    .sort((a, b) => a - b)
    .map((month) => ({
      month,
      data: (byMonth.get(month) ?? []).sort(
        (a, b) =>
          (a.date?.date ?? '').localeCompare(b.date?.date ?? '') ||
          a.festival.name.en.localeCompare(b.festival.name.en),
      ),
    }));
}
