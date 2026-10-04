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
