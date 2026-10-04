import { languages } from './registry';
import type { LanguageCode } from './registry';

/** e.g. "Sunday, 4 October 2026" / "रविवार, 4 अक्तूबर 2026" (Gregorian date; no lunar logic). */
export function formatToday(date: Date, language: LanguageCode): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** e.g. "4 Oct 2026" / "4 अक्तू॰ 2026" (Gregorian date of an epoch-millisecond timestamp). */
export function formatShortDate(timestamp: number, language: LanguageCode): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/** A calendar date (YYYY-MM-DD) as a UTC instant, so formatting never shifts the day with the device zone. */
function utcInstant(year: number, month: number, day: number): Date {
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** e.g. "November 2026" / "नवंबर 2026" (month and year names in the selected language). */
export function formatMonthYear(year: number, month: number, language: LanguageCode): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcInstant(year, month, 1));
}

/** Abbreviated weekday name for a weekday number (0 = Sunday), e.g. "Sun" / "रवि". */
export function formatWeekdayShort(weekday: number, language: LanguageCode): string {
  // 2023-01-01 was a Sunday; only used to get the name of a weekday.
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(utcInstant(2023, 1, 1 + weekday));
}

/** Full weekday name (0 = Sunday); used in accessibility labels. */
export function formatWeekdayLong(weekday: number, language: LanguageCode): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(utcInstant(2023, 1, 1 + weekday));
}

type DateParts = { year: number; month: number; day: number };

/** e.g. "8 Nov 2026" / "8 नव॰ 2026"; `withYear: false` gives "8 Nov". */
export function formatCalendarDate(
  { year, month, day }: DateParts,
  language: LanguageCode,
  withYear = true,
): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(utcInstant(year, month, day));
}

/** e.g. "Sunday, 8 November 2026"; the accessibility label of a day cell. */
export function formatCalendarDateLong(
  { year, month, day }: DateParts,
  language: LanguageCode,
): string {
  return new Intl.DateTimeFormat(languages[language].intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcInstant(year, month, day));
}
