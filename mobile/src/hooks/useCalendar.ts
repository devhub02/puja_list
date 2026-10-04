import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  getNextDate,
  listDatesForMonth,
  listFestivals,
  listFestivalsWithoutDate,
  listNextDates,
} from '@/db/repositories';
import { localIsoDate } from '@/utils/dateUtils';
import type { CalendarItem } from '@/utils/calendarLogic';

import { useDbQuery } from './useDbQuery';

/** The device's local date (YYYY-MM-DD). Refreshed when the app returns to the foreground, so it never goes stale. */
export function useTodayIso(): string {
  const [today, setToday] = useState(() => localIsoDate());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(localIsoDate());
    });
    return () => subscription.remove();
  }, []);
  return today;
}

export function useMonthOccurrences(year: number, month: number) {
  return useDbQuery((db) => listDatesForMonth(db, year, month), `month:${year}-${month}`);
}

/** Every festival with its dates of one year (festivals with none have an empty list), plus those without. */
export function useYearFestivals(year: number) {
  return useDbQuery(async (db) => {
    const [festivals, without] = await Promise.all([
      listFestivals(db, { year }),
      listFestivalsWithoutDate(db, year),
    ]);
    const dated: CalendarItem[] = festivals.flatMap(({ dates, ...festival }) =>
      dates.map((date) => ({ festival, date })),
    );
    const undated: CalendarItem[] = without.map((festival) => ({ festival }));
    return { dated, undated };
  }, `year:${year}`);
}

/** All active festivals (for the filter chips): a plain read of the catalog. */
export function useFestivalCatalog() {
  return useDbQuery((db) => listFestivals(db), 'festival-catalog');
}

/** One entry per festival (its next or ongoing date from today), soonest first. */
export function useUpcomingFestivals() {
  const today = useTodayIso();
  return useDbQuery((db) => listNextDates(db, today), `upcoming:${today}`);
}

/** Next (or ongoing) date of every festival that has one; keyed by festival id. */
export function useNextDates() {
  const today = useTodayIso();
  return useDbQuery(async (db) => {
    const next = await listNextDates(db, today);
    return new Map(next.map((o) => [o.festival.id, o.date]));
  }, `next-dates:${today}`);
}

export function useNextDate(festivalId: string | undefined) {
  const today = useTodayIso();
  return useDbQuery(
    async (db) => (festivalId ? getNextDate(db, festivalId, today) : null),
    `next:${festivalId ?? ''}:${today}`,
  );
}
