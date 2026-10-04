import { languageCodes, languages } from '@/i18n/registry';

import { normalizeSearchText } from '@/db/search/normalize';
import { categoryOrder } from './pujaDisplay';

const SPLIT = /[\s\-_/()]+/;

const words = (text: string): string[] =>
  normalizeSearchText(text).toLocaleLowerCase().split(SPLIT).filter(Boolean);

/**
 * Category ids whose name (in ANY registered language) starts with every word the user typed, so "vrat",
 * "household" or "व्रत" find their category. Names come from the locale files, so a new language needs no code.
 */
export function matchCategoryIds(query: string): string[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  return categoryOrder.filter((id) =>
    languageCodes.some((code) => {
      const label = (languages[code].translation.categories as Record<string, string>)[id];
      const labelWords = words(label ?? '');
      return typed.every((word) => labelWords.some((w) => w.startsWith(word)));
    }),
  );
}
