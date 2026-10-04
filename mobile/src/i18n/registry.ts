import en from './locales/en';
import hi from './locales/hi';
import type { Translations } from './locales/en';

export type Script = 'latin' | 'devanagari';

export type LanguageEntry = {
  /** Name of the language in its own script (shown in the language selector). */
  nativeName: string;
  /** BCP-47 tag used for Intl date formatting. */
  intlLocale: string;
  /** Drives the font family and line height. */
  script: Script;
  translation: Translations;
};

/**
 * Language registry. To add a language: create `locales/<code>.ts` (typed as `Translations`)
 * and add one entry here. If its script is new, add the script to `Script` and bundle a font
 * for it in `src/theme/fonts.ts`.
 */
export const languages = {
  en: { nativeName: 'English', intlLocale: 'en-IN', script: 'latin', translation: en },
  hi: { nativeName: 'हिन्दी', intlLocale: 'hi-IN', script: 'devanagari', translation: hi },
} as const satisfies Record<string, LanguageEntry>;

export type LanguageCode = keyof typeof languages;

export const FALLBACK_LANGUAGE: LanguageCode = 'en';

export const languageCodes = Object.keys(languages) as LanguageCode[];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(languages, value);
}

/** First supported language in the device's preference order, else English. */
export function pickSupportedLanguage(
  deviceCodes: readonly (string | null | undefined)[],
): LanguageCode {
  for (const code of deviceCodes) {
    const base = code?.toLowerCase().split(/[-_]/)[0];
    if (isLanguageCode(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}
