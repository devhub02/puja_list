import type { TFunction } from 'i18next';

import type { CalendarDate, Festival, FestivalRegion } from '@/db/types';
import { formatCalendarDate } from '@/i18n/format';
import type { LanguageCode } from '@/i18n/registry';

import { isInRange, isMultiDay, lastDay, parseIso } from './dateUtils';

/** "8 Nov 2026" for one day, "13 Nov – 16 Nov 2026" for a range (translated joiner, localised month names). */
export function formatDateRange(
  date: string,
  endDate: string | undefined,
  language: LanguageCode,
  t: TFunction,
): string {
  const start = parseIso(date);
  if (!start) return date;
  if (!isMultiDay(date, endDate)) return formatCalendarDate(start, language);
  const end = parseIso(lastDay(date, endDate));
  if (!end) return formatCalendarDate(start, language);
  const sameYear = start.year === end.year;
  return t('calendar.range', {
    start: formatCalendarDate(start, language, !sameYear),
    end: formatCalendarDate(end, language, true),
  });
}

export function formatCalendarEntry(entry: CalendarDate, language: LanguageCode, t: TFunction) {
  return formatDateRange(entry.date, entry.endDate, language, t);
}

/** A multi-day observance that includes `today` ("Ongoing"). */
export function isOngoing(entry: CalendarDate, today: string): boolean {
  return isMultiDay(entry.date, entry.endDate) && isInRange(today, entry.date, entry.endDate);
}

/** "North India, West India" from the catalog's festival regions, in the selected language. */
export function festivalRegionsText(regions: readonly FestivalRegion[], t: TFunction): string {
  return regions.map((r) => t(`festivalRegions.${r}`)).join(', ');
}

/** The puja ids of a festival that exist as active pujas (a linked puja may have been retired). */
export function activeLinkedPujaIds(festival: Festival, activeIds: ReadonlySet<string>): string[] {
  return festival.linkedPujaIds.filter((id) => activeIds.has(id));
}
