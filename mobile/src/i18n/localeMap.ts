import { FALLBACK_LANGUAGE, languageCodes } from './registry';
import type { LanguageCode } from './registry';

/**
 * A user-visible string coming from content, e.g. {"en": "...", "hi": "..."}.
 * English is required; every other registered language is optional.
 */
export type LocaleMap = { en: string } & Partial<Record<LanguageCode, string>>;

/** Selected language -> English. Empty strings count as missing. */
export function localize(map: LocaleMap, language: LanguageCode): string {
  const selected = map[language];
  if (selected) return selected;
  return map[FALLBACK_LANGUAGE] ?? '';
}

/** Runtime check for untyped JSON: English must be a non-empty string. */
export function isLocaleMap(value: unknown): value is LocaleMap {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.en !== 'string' || record.en === '') return false;
  return languageCodes.every(
    (code) => record[code] === undefined || typeof record[code] === 'string',
  );
}
