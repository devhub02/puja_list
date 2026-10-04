import type { PujaSearchHit } from '@/db/repositories';
import { localize } from '@/i18n/localeMap';
import type { LanguageCode } from '@/i18n/registry';
import { secondaryName } from '@/utils/pujaDisplay';

export type SearchRowData = {
  pujaId: string;
  title: string;
  subtitle?: string;
  kind: 'puja' | 'samagri';
};

/**
 * One row per matching puja. A puja that matched only through a samagri item is shown as that item
 * ("Diya/lamp") with "Found in: <puja name>", so the user sees why it matched; tapping it opens the puja.
 */
export function toSearchRows(
  hits: readonly PujaSearchHit[],
  language: LanguageCode,
  foundIn: (pujaName: string) => string,
): SearchRowData[] {
  return hits.map((hit) => {
    const pujaName = localize(hit.name, language);
    const byOwnName = hit.matchedBy.some((kind) => kind !== 'samagri');
    if (!byOwnName && hit.samagri.length > 0) {
      return {
        pujaId: hit.pujaId,
        kind: 'samagri',
        title: hit.samagri.map((s) => localize(s.name, language)).join(', '),
        subtitle: foundIn(pujaName),
      };
    }
    return {
      pujaId: hit.pujaId,
      kind: 'puja',
      title: pujaName,
      subtitle: secondaryName(hit.name, language),
    };
  });
}
