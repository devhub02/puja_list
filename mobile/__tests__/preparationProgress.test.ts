import {
  buildShoppingList,
  computeProgress,
  filterEntries,
  findRemovedIds,
  groupBySection,
  isChecklistComplete,
  isRequiredComplete,
} from '@/utils/preparationProgress';
import type { ChecklistEntry } from '@/utils/preparationProgress';

const list = [
  { samagriId: 'r1', classification: 'REQUIRED' as const },
  { samagriId: 'r2', classification: 'REQUIRED' as const },
  { samagriId: 'c1', classification: 'COMMON' as const },
  { samagriId: 'o1', classification: 'OPTIONAL' as const },
  { samagriId: 'o2', classification: 'OPTIONAL' as const },
  { samagriId: 'o3', classification: 'OPTIONAL' as const },
];

const base = {
  samagri: list,
  customIds: [] as string[],
  checkedSamagriIds: [],
  checkedCustomIds: [],
};

describe('computeProgress', () => {
  it('counts each classification separately', () => {
    const p = computeProgress({ ...base, checkedSamagriIds: ['r1', 'c1', 'o1', 'o2'] });
    expect(p.required).toEqual({ checked: 1, total: 2 });
    expect(p.common).toEqual({ checked: 1, total: 1 });
    expect(p.optional).toEqual({ checked: 2, total: 3 });
    expect(p.custom).toEqual({ checked: 0, total: 0 });
    expect(p.overall).toEqual({ checked: 4, total: 6 });
    expect(p.percent).toBe(66);
  });

  it('checking optional items never raises the required count', () => {
    const p = computeProgress({ ...base, checkedSamagriIds: ['o1', 'o2', 'o3', 'c1'] });
    expect(p.required.checked).toBe(0);
    expect(isRequiredComplete(p)).toBe(false);
    expect(p.optional.checked).toBe(3);
  });

  it('checking required items does not touch the other groups', () => {
    const p = computeProgress({ ...base, checkedSamagriIds: ['r1', 'r2'] });
    expect(p.common.checked).toBe(0);
    expect(p.optional.checked).toBe(0);
    expect(isRequiredComplete(p)).toBe(true);
    expect(isChecklistComplete(p)).toBe(false);
  });

  it('counts custom items in their own group and in the overall total', () => {
    const p = computeProgress({
      ...base,
      customIds: ['u1', 'u2'],
      checkedSamagriIds: ['r1'],
      checkedCustomIds: ['u2'],
    });
    expect(p.custom).toEqual({ checked: 1, total: 2 });
    expect(p.overall).toEqual({ checked: 2, total: 8 });
    expect(p.required).toEqual({ checked: 1, total: 2 });
  });

  it('handles a puja with zero samagri and no custom items', () => {
    const p = computeProgress({ ...base, samagri: [] });
    expect(p.overall).toEqual({ checked: 0, total: 0 });
    expect(p.percent).toBe(0);
    expect(isRequiredComplete(p)).toBe(false);
    expect(isChecklistComplete(p)).toBe(false);
  });

  it('handles only custom items', () => {
    const p = computeProgress({
      ...base,
      samagri: [],
      customIds: ['u1', 'u2'],
      checkedCustomIds: ['u1', 'u2'],
    });
    expect(p.overall).toEqual({ checked: 2, total: 2 });
    expect(p.percent).toBe(100);
    expect(p.required.total).toBe(0);
    expect(isChecklistComplete(p)).toBe(true);
  });

  it('reaches 100 only when every item is checked (percent rounds down)', () => {
    const almost = computeProgress({
      ...base,
      checkedSamagriIds: ['r1', 'r2', 'c1', 'o1', 'o2'],
    });
    expect(almost.percent).toBe(83);
    const all = computeProgress({
      ...base,
      checkedSamagriIds: list.map((i) => i.samagriId),
    });
    expect(all.percent).toBe(100);
    const many = computeProgress({
      samagri: Array.from({ length: 1000 }, (_, i) => ({
        samagriId: `s${i}`,
        classification: 'COMMON' as const,
      })),
      customIds: [],
      checkedSamagriIds: Array.from({ length: 999 }, (_, i) => `s${i}`),
      checkedCustomIds: [],
    });
    expect(many.percent).toBe(99);
  });

  it('ignores checked ids that are not in the puja list (deprecated or missing samagri)', () => {
    const p = computeProgress({
      ...base,
      checkedSamagriIds: ['r1', 'sm_gone', 'sm_also_gone'],
      checkedCustomIds: ['usr_not_there'],
    });
    expect(p.required.checked).toBe(1);
    expect(p.overall).toEqual({ checked: 1, total: 6 });
  });

  it('counts a duplicated id once', () => {
    const p = computeProgress({
      samagri: [...list, { samagriId: 'r1', classification: 'OPTIONAL' }],
      customIds: ['u1', 'u1'],
      checkedSamagriIds: ['r1', 'r1'],
      checkedCustomIds: ['u1'],
    });
    expect(p.overall.total).toBe(7);
    expect(p.required).toEqual({ checked: 1, total: 2 });
    expect(p.optional.total).toBe(3);
    expect(p.custom).toEqual({ checked: 1, total: 1 });
  });
});

describe('findRemovedIds', () => {
  it('lists checked ids the guide no longer contains, sorted and unique', () => {
    expect(findRemovedIds(list, ['r1', 'sm_z', 'sm_a', 'sm_z'])).toEqual(['sm_a', 'sm_z']);
    expect(findRemovedIds(list, ['r1', 'o3'])).toEqual([]);
    expect(findRemovedIds([], ['r1'])).toEqual(['r1']);
  });
});

const entries: (ChecklistEntry & { name: string })[] = [
  { kind: 'samagri', ref: 'o1', section: 'OPTIONAL', checked: false, name: 'o1' },
  { kind: 'samagri', ref: 'r1', section: 'REQUIRED', checked: true, name: 'r1' },
  { kind: 'custom', ref: 'u1', section: 'CUSTOM', checked: false, name: 'u1' },
  { kind: 'samagri', ref: 'r2', section: 'REQUIRED', checked: false, name: 'r2' },
  { kind: 'samagri', ref: 'c1', section: 'COMMON', checked: true, name: 'c1' },
];

describe('grouping and filtering', () => {
  it('groups in the order Required, Common, Optional, Mine and keeps input order inside a group', () => {
    const groups = groupBySection(entries);
    expect(groups.map((g) => g.section)).toEqual(['REQUIRED', 'COMMON', 'OPTIONAL', 'CUSTOM']);
    expect(groups[0].items.map((e) => e.ref)).toEqual(['r1', 'r2']);
  });

  it('omits empty groups', () => {
    expect(groupBySection(entries.filter((e) => e.section === 'COMMON'))).toHaveLength(1);
    expect(groupBySection([])).toEqual([]);
  });

  it('filters by classification and by unchecked only', () => {
    expect(filterEntries(entries, 'all', false)).toHaveLength(5);
    expect(filterEntries(entries, 'REQUIRED', false).map((e) => e.ref)).toEqual(['r1', 'r2']);
    expect(filterEntries(entries, 'CUSTOM', false).map((e) => e.ref)).toEqual(['u1']);
    expect(filterEntries(entries, 'all', true).map((e) => e.ref)).toEqual(['o1', 'u1', 'r2']);
    expect(filterEntries(entries, 'REQUIRED', true).map((e) => e.ref)).toEqual(['r2']);
  });

  it('shopping list = unchecked items only, required first, custom items included', () => {
    const groups = buildShoppingList(entries);
    expect(groups.map((g) => [g.section, g.items.map((e) => e.ref)])).toEqual([
      ['REQUIRED', ['r2']],
      ['OPTIONAL', ['o1']],
      ['CUSTOM', ['u1']],
    ]);
    expect(buildShoppingList(entries.map((e) => ({ ...e, checked: true })))).toEqual([]);
  });
});
