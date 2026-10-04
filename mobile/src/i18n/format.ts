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
