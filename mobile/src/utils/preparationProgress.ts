/**
 * Pure checklist maths. No database, no React.
 *
 * Rules (CLAUDE.md content rules, kept here so they are unit tested):
 * - Every samagri item counts in exactly ONE group: REQUIRED, COMMON or OPTIONAL, as the puja's own list
 *   says. Custom items are a fourth group. Nothing is ever promoted, merged or auto-checked.
 * - Overall progress = checked / total over all four groups.
 * - "Required items done" is reported separately (REQUIRED only) and never includes optional items.
 * - A checked id that is not in the puja's current list (the guide changed) counts for nothing: it is
 *   neither a checked item nor part of the total. See `findRemovedIds`.
 */
import type { Classification } from '@/db/types';

export type SectionKey = Classification | 'CUSTOM';

/** Display order of the groups. */
export const SECTION_ORDER: readonly SectionKey[] = ['REQUIRED', 'COMMON', 'OPTIONAL', 'CUSTOM'];

export type Count = { checked: number; total: number };

export type ChecklistProgress = {
  required: Count;
  common: Count;
  optional: Count;
  custom: Count;
  overall: Count;
  /** Whole percent of overall progress, rounded DOWN so "100" always means everything is checked. */
  percent: number;
};

export type ProgressInput = {
  /** The puja's own samagri list (content). */
  samagri: readonly { samagriId: string; classification: Classification }[];
  /** The user's custom item ids for this preparation. */
  customIds: readonly string[];
  checkedSamagriIds: Iterable<string>;
  checkedCustomIds: Iterable<string>;
};

export function emptyCount(): Count {
  return { checked: 0, total: 0 };
}

export function computeProgress(input: ProgressInput): ChecklistProgress {
  const checkedSamagri = new Set(input.checkedSamagriIds);
  const checkedCustom = new Set(input.checkedCustomIds);
  const counts: Record<SectionKey, Count> = {
    REQUIRED: emptyCount(),
    COMMON: emptyCount(),
    OPTIONAL: emptyCount(),
    CUSTOM: emptyCount(),
  };
  const seen = new Set<string>();
  for (const item of input.samagri) {
    if (seen.has(item.samagriId)) continue;
    seen.add(item.samagriId);
    const count = counts[item.classification];
    count.total += 1;
    if (checkedSamagri.has(item.samagriId)) count.checked += 1;
  }
  for (const id of new Set(input.customIds)) {
    counts.CUSTOM.total += 1;
    if (checkedCustom.has(id)) counts.CUSTOM.checked += 1;
  }
  const overall = {
    checked: SECTION_ORDER.reduce((sum, key) => sum + counts[key].checked, 0),
    total: SECTION_ORDER.reduce((sum, key) => sum + counts[key].total, 0),
  };
  return {
    required: counts.REQUIRED,
    common: counts.COMMON,
    optional: counts.OPTIONAL,
    custom: counts.CUSTOM,
    overall,
    percent: overall.total === 0 ? 0 : Math.floor((overall.checked / overall.total) * 100),
  };
}

export function countFor(progress: ChecklistProgress, section: SectionKey): Count {
  switch (section) {
    case 'REQUIRED':
      return progress.required;
    case 'COMMON':
      return progress.common;
    case 'OPTIONAL':
      return progress.optional;
    case 'CUSTOM':
      return progress.custom;
  }
}

/** True when the puja has required items and every one of them is checked. */
export function isRequiredComplete(progress: ChecklistProgress): boolean {
  return progress.required.total > 0 && progress.required.checked === progress.required.total;
}

/** True when there is something to check and all of it is checked. */
export function isChecklistComplete(progress: ChecklistProgress): boolean {
  return progress.overall.total > 0 && progress.overall.checked === progress.overall.total;
}

/**
 * Checked samagri ids that the puja's list no longer contains (the guide was updated and an item was
 * removed). They are kept in the database and shown as "no longer in the guide", never silently dropped.
 */
export function findRemovedIds(
  samagri: readonly { samagriId: string }[],
  checkedSamagriIds: Iterable<string>,
): string[] {
  const current = new Set(samagri.map((s) => s.samagriId));
  return [...new Set(checkedSamagriIds)].filter((id) => !current.has(id)).sort();
}

export type ChecklistEntry = {
  kind: 'samagri' | 'custom';
  /** samagri id or custom item id */
  ref: string;
  section: SectionKey;
  checked: boolean;
};

export type ChecklistFilter = 'all' | SectionKey;

export type SectionGroup<T extends ChecklistEntry> = { section: SectionKey; items: T[] };

/** Groups entries by section in display order, keeping each group's input order. Empty groups are omitted. */
export function groupBySection<T extends ChecklistEntry>(entries: readonly T[]): SectionGroup<T>[] {
  return SECTION_ORDER.map((section) => ({
    section,
    items: entries.filter((e) => e.section === section),
  })).filter((group) => group.items.length > 0);
}

/** Applies the screen's classification filter and "unchecked only" toggle. */
export function filterEntries<T extends ChecklistEntry>(
  entries: readonly T[],
  filter: ChecklistFilter,
  uncheckedOnly: boolean,
): T[] {
  return entries.filter(
    (e) => (filter === 'all' || e.section === filter) && (!uncheckedOnly || !e.checked),
  );
}

/** Shopping list: unchecked items only, required first, custom items last. */
export function buildShoppingList<T extends ChecklistEntry>(
  entries: readonly T[],
): SectionGroup<T>[] {
  return groupBySection(entries.filter((e) => !e.checked));
}
