import type { LocaleMap } from '@/i18n/localeMap';
import { localize } from '@/i18n/localeMap';
import { FALLBACK_LANGUAGE, languageCodes, languages } from '@/i18n/registry';
import type { LanguageCode } from '@/i18n/registry';
import type { Classification, PujaCategory, PujaSummary, VidhiStep } from '@/db/types';

/** All content categories, in the order they are shown. Mirrors CONTENT_SCHEMA.md PujaCategory. */
export const categoryOrder: readonly PujaCategory[] = [
  'festival',
  'vrat',
  'household',
  'life_cycle',
  'regional',
  'tribal',
];

export const categoryIcon: Record<PujaCategory, string> = {
  festival: 'party-popper',
  vrat: 'food-apple-outline',
  household: 'home-heart',
  life_cycle: 'baby-face-outline',
  regional: 'map-marker-radius-outline',
  tribal: 'tree-outline',
};

/** "Festival" vs "household" kind, derived from the category (the content has no separate field). */
export type PujaKind = 'festival' | 'household';

export function kindOf(category: PujaCategory): PujaKind {
  return category === 'household' || category === 'life_cycle' ? 'household' : 'festival';
}

/**
 * The name in the other language, shown as a secondary line: English when the app is not in English,
 * otherwise the first other language that has a name. Undefined when there is nothing different to show.
 */
export function secondaryName(name: LocaleMap, language: LanguageCode): string | undefined {
  const primary = localize(name, language);
  const candidates = [FALLBACK_LANGUAGE, ...languageCodes].filter((code) => code !== language);
  for (const code of candidates) {
    const value = name[code];
    if (value && value !== primary) return value;
  }
  return undefined;
}

const collators = new Map<string, Intl.Collator>();
function collatorFor(language: LanguageCode): Intl.Collator {
  let collator = collators.get(language);
  if (!collator) {
    collator = new Intl.Collator(languages[language].intlLocale, { sensitivity: 'base' });
    collators.set(language, collator);
  }
  return collator;
}

/** Alphabetical in the selected language (Devanagari sorts by its own collation); ties broken by id. */
export function sortByName<T extends { id: string; name: LocaleMap }>(
  items: readonly T[],
  language: LanguageCode,
): T[] {
  const collator = collatorFor(language);
  return [...items].sort(
    (a, b) =>
      collator.compare(localize(a.name, language), localize(b.name, language)) ||
      a.id.localeCompare(b.id),
  );
}

export const FEATURED_COUNT = 6;

/**
 * Featured pujas for Home. The content has no `isFeatured` flag yet, so the rule is: the first six active
 * pujas by id. It is stable (does not change per day or per language) and never invents popularity.
 */
export function pickFeatured(
  pujas: readonly PujaSummary[],
  count: number = FEATURED_COUNT,
): PujaSummary[] {
  return [...pujas]
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, count);
}

export function countByClassification(
  samagri: readonly { classification: Classification }[],
): Record<Classification, number> {
  const counts: Record<Classification, number> = { REQUIRED: 0, COMMON: 0, OPTIONAL: 0 };
  for (const item of samagri) counts[item.classification] += 1;
  return counts;
}

/**
 * Safety/health notes are authored as vidhi steps titled "Safety Note: ...", "Health Note: ..." or
 * "Health and Safety Note..." (English title). The content has no separate safety field yet, so this title
 * rule is the stop-gap. Replace it when the schema gets a structured field.
 */
const SAFETY_TITLE = /^(safety|health)( and safety)?\s+note\b/i;

export function extractSafetyNotes(steps: readonly VidhiStep[]): VidhiStep[] {
  return steps.filter((step) => SAFETY_TITLE.test(step.title.en.trim()));
}
