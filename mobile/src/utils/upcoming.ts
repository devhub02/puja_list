import type { FestivalOccurrence } from '@/db/repositories/calendarRepository';
import type { Festival } from '@/db/types';

import { addDays, daysBetween, lastDay } from './dateUtils';

/** Window of the "N more" count on Home. */
export const MORE_WINDOW_DAYS = 30;

/**
 * Picks the one festival to feature on Home: among festivals whose last day is today or later (so one that is
 * on right now counts), the earliest start date wins. A tie on the start date is broken by
 * (a) having a linked puja guide, then (b) `pan_india` in the festival's regions, then (c) English name.
 * Pure: it only compares bundled dates and catalog fields. Null when nothing is upcoming.
 */
export function pickNextFestival(
  occurrences: readonly FestivalOccurrence[],
  today: string,
  hasPujaGuide: (festival: Festival) => boolean,
): FestivalOccurrence | null {
  const candidates = occurrences.filter(({ date }) => lastDay(date.date, date.endDate) >= today);
  const rank = (o: FestivalOccurrence) => [
    o.date.date,
    hasPujaGuide(o.festival) ? 0 : 1,
    o.festival.regions.includes('pan_india') ? 0 : 1,
    o.festival.name.en,
  ];
  const sorted = [...candidates].sort((a, b) => {
    const x = rank(a);
    const y = rank(b);
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] < y[i]) return -1;
      if (x[i] > y[i]) return 1;
    }
    return a.date.id < b.date.id ? -1 : a.date.id > b.date.id ? 1 : 0;
  });
  return sorted[0] ?? null;
}

export type Countdown =
  | { kind: 'today' } // a festival that starts today
  | { kind: 'ongoing' } // started before today and not over
  | { kind: 'in'; days: number }; // starts in `days` (>= 1) days

/** Countdown from plain calendar dates (no time zones). Null for a festival that is over or an invalid date. */
export function countdownFor(
  date: string,
  endDate: string | undefined,
  today: string,
): Countdown | null {
  const untilStart = daysBetween(today, date);
  const untilEnd = daysBetween(today, lastDay(date, endDate));
  if (untilStart === null || untilEnd === null || untilEnd < 0) return null;
  if (untilStart === 0) return { kind: 'today' };
  if (untilStart < 0) return { kind: 'ongoing' };
  return { kind: 'in', days: untilStart };
}

/**
 * How many festivals other than `featured` have a date in the next `MORE_WINDOW_DAYS` days: they start on or before
 * today + 30 and are not over yet (an ongoing one counts). Every festival is counted once, however many dates it
 * has; only bundled dates are used.
 */
export function countMoreSoon(
  occurrences: readonly FestivalOccurrence[],
  featuredFestivalId: string,
  today: string,
): number {
  const horizon = addDays(today, MORE_WINDOW_DAYS);
  if (!horizon) return 0;
  const ids = new Set<string>();
  for (const { festival, date } of occurrences) {
    if (festival.id === featuredFestivalId) continue;
    if (lastDay(date.date, date.endDate) < today || date.date > horizon) continue;
    ids.add(festival.id);
  }
  return ids.size;
}
