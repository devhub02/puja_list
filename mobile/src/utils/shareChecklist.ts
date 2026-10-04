/**
 * Plain-text version of a preparation's checklist for the system Share sheet. Pure: no database, no React.
 *
 * Layout:
 *   <puja name>
 *   <preparation label, if any>
 *   (blank line)
 *   <Required>            sections in this order: Required, Commonly used, Optional, My items
 *   [ ] Item (quantity)   "[x]" when checked; the quantity guidance only when the guide has one
 *   (blank line between sections; a section with no lines is omitted)
 *   <app name> - <standard disclaimer>
 *
 * The text is in the selected language (names fall back to English). No purpose, regional or preparation
 * notes are included: only names and the short quantity guidance.
 */
import type { LanguageCode } from '@/i18n/registry';
import { localize } from '@/i18n/localeMap';
import type { LocaleMap } from '@/i18n/localeMap';

import type { Entry } from './checklistEntries';
import { SECTION_ORDER } from './preparationProgress';
import type { SectionKey } from './preparationProgress';

export type ShareMode = 'all' | 'needed';

export type ShareLabels = {
  sections: Record<SectionKey, string>;
  /** App name plus the standard disclaimer sentence, already translated, on one line. */
  footer: string;
};

export type ShareInput = {
  pujaName: LocaleMap;
  /** Optional label of the preparation (user text, as typed). */
  label?: string | null;
  entries: readonly Entry[];
  mode: ShareMode;
  language: LanguageCode;
  labels: ShareLabels;
};

function lineFor(entry: Entry, language: LanguageCode): string {
  const mark = entry.checked ? '[x]' : '[ ]';
  if (entry.kind === 'custom') return `${mark} ${entry.custom.name}`;
  const name = localize(entry.item.name, language);
  const quantity = entry.item.quantityGuidance
    ? localize(entry.item.quantityGuidance, language)
    : '';
  return quantity ? `${mark} ${name} (${quantity})` : `${mark} ${name}`;
}

/** The items a share would list, after the "only items I still need" filter. */
export function selectShareEntries(entries: readonly Entry[], mode: ShareMode): Entry[] {
  return mode === 'needed' ? entries.filter((entry) => !entry.checked) : [...entries];
}

export function formatChecklistText(input: ShareInput): string {
  const { language, labels } = input;
  const lines: string[] = [localize(input.pujaName, language)];
  const label = input.label?.trim();
  if (label) lines.push(label);

  const chosen = selectShareEntries(input.entries, input.mode);
  for (const section of SECTION_ORDER) {
    const inSection = chosen.filter((entry) => entry.section === section);
    if (inSection.length === 0) continue;
    lines.push('', labels.sections[section], ...inSection.map((entry) => lineFor(entry, language)));
  }
  lines.push('', labels.footer);
  return lines.join('\n');
}
