import type { ChecklistState, CustomItem } from '@/db/repositories';
import type { PujaSamagriItem } from '@/db/types';

import type { ChecklistEntry } from './preparationProgress';

export type SamagriEntry = ChecklistEntry & { kind: 'samagri'; item: PujaSamagriItem };
export type CustomEntry = ChecklistEntry & { kind: 'custom'; custom: CustomItem };
export type Entry = SamagriEntry | CustomEntry;

export const entryKey = (entry: { kind: string; ref: string }): string =>
  `${entry.kind}:${entry.ref}`;

/**
 * Every checkable item of a preparation: the puja's own samagri (in the content's order, each in the
 * ONE group the puja assigns it) followed by the user's custom items. Checked state comes only from the
 * preparation's saved ticks; with no preparation yet, nothing is checked.
 */
export function buildEntries(
  samagri: readonly PujaSamagriItem[],
  state: Pick<ChecklistState, 'checkedSamagriIds' | 'checkedCustomIds' | 'customItems'> | null,
): Entry[] {
  const checkedSamagri = new Set(state?.checkedSamagriIds ?? []);
  const checkedCustom = new Set(state?.checkedCustomIds ?? []);
  const entries: Entry[] = samagri.map((item) => ({
    kind: 'samagri',
    ref: item.samagriId,
    section: item.classification,
    checked: checkedSamagri.has(item.samagriId),
    item,
  }));
  for (const custom of state?.customItems ?? []) {
    entries.push({
      kind: 'custom',
      ref: custom.id,
      section: 'CUSTOM',
      checked: checkedCustom.has(custom.id),
      custom,
    });
  }
  return entries;
}
