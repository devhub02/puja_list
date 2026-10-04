import type { PujaSearchHit } from '@/db/repositories';
import type { ContentBundle, PujaSummary } from '@/db/types';
import { toSearchRows } from '@/search/searchRows';
import { getCategoryImage, getPujaImage } from '@/theme/images';
import { matchCategoryIds } from '@/utils/categorySearch';
import { buildLibraryItems, emptyFilters, hasActiveFilters } from '@/utils/libraryFilter';
import {
  extractSafetyNotes,
  kindOf,
  pickFeatured,
  secondaryName,
  sortByName,
} from '@/utils/pujaDisplay';

import bundledJson from '../assets/puja_data/content.json';

const make = (
  id: string,
  en: string,
  hi: string | undefined,
  category: PujaSummary['category'] = 'festival',
): PujaSummary => ({
  id,
  name: hi ? { en, hi } : { en },
  category,
  regions: ['pan_india'],
  summary: { en: 'x' },
  reviewStatus: 'ai_drafted',
  status: 'active',
});

const pujas = [
  make('p_chhath', 'Chhath Puja', 'छठ पूजा', 'vrat'),
  make('p_ganesh', 'Ganesh Chaturthi', 'गणेश चतुर्थी', 'festival'),
  make('p_annakut', 'Annakut', 'अन्नकूट', 'household'),
  make('p_karwa', 'Karwa Chauth', 'करवा चौथ', 'vrat'),
  make('p_noHindi', 'Bhai Dooj', undefined, 'household'),
];

const base = { language: 'en' as const, savedIds: [], recentIds: [], searchHits: null };
const idsOf = (items: { puja: PujaSummary }[]) => items.map((i) => i.puja.id);

describe('library filtering', () => {
  it('sorts alphabetically in English and in Hindi (Devanagari collation)', () => {
    expect(idsOf(buildLibraryItems(pujas, emptyFilters, base))).toEqual([
      'p_annakut',
      'p_noHindi',
      'p_chhath',
      'p_ganesh',
      'p_karwa',
    ]);
    const hindi = idsOf(buildLibraryItems(pujas, emptyFilters, { ...base, language: 'hi' }));
    // अन्नकूट < करवा < गणेश < छठ (dictionary order of the Devanagari letters). A puja without a Hindi name
    // falls back to its English name, which the Hindi collation places after the Devanagari names.
    expect(hindi).toEqual(['p_annakut', 'p_karwa', 'p_ganesh', 'p_chhath', 'p_noHindi']);
  });

  it('filters by category and by festival/household kind', () => {
    expect(idsOf(buildLibraryItems(pujas, { ...emptyFilters, category: 'vrat' }, base))).toEqual([
      'p_chhath',
      'p_karwa',
    ]);
    expect(idsOf(buildLibraryItems(pujas, { ...emptyFilters, kind: 'household' }, base))).toEqual([
      'p_annakut',
      'p_noHindi',
    ]);
    expect(kindOf('festival')).toBe('festival');
    expect(kindOf('life_cycle')).toBe('household');
  });

  it('favorites and recently-viewed shortcuts (recent is newest first; unknown ids are ignored)', () => {
    const ctx = {
      ...base,
      savedIds: ['p_karwa', 'gone'],
      recentIds: ['p_ganesh', 'gone', 'p_chhath'],
    };
    expect(idsOf(buildLibraryItems(pujas, { ...emptyFilters, scope: 'favorites' }, ctx))).toEqual([
      'p_karwa',
    ]);
    expect(idsOf(buildLibraryItems(pujas, { ...emptyFilters, scope: 'recent' }, ctx))).toEqual([
      'p_ganesh',
      'p_chhath',
    ]);
  });

  it('combines search hits with filters and keeps best-match order', () => {
    const hit = (pujaId: string, samagri: PujaSearchHit['samagri'] = []): PujaSearchHit => ({
      pujaId,
      name: { en: pujaId },
      matchedBy: ['name'],
      samagri,
    });
    const hits = [
      hit('p_karwa'),
      hit('p_ganesh'),
      hit('p_chhath', [{ id: 's', name: { en: 'Diya' } }]),
    ];
    const all = buildLibraryItems(pujas, emptyFilters, { ...base, searchHits: hits });
    expect(idsOf(all)).toEqual(['p_karwa', 'p_ganesh', 'p_chhath']);
    expect(all[2].matchedSamagri).toEqual([{ en: 'Diya' }]);
    const vratOnly = buildLibraryItems(
      pujas,
      { ...emptyFilters, category: 'vrat' },
      { ...base, searchHits: hits },
    );
    expect(idsOf(vratOnly)).toEqual(['p_karwa', 'p_chhath']);
    expect(buildLibraryItems(pujas, emptyFilters, { ...base, searchHits: [] })).toEqual([]);
  });

  it('has no month filter: the content has no festival month data', () => {
    expect(Object.keys(emptyFilters).sort()).toEqual(['category', 'kind', 'scope']);
    expect(hasActiveFilters(emptyFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyFilters, kind: 'festival' })).toBe(true);
  });
});

describe('display helpers', () => {
  it('shows the other language as the secondary name, and nothing when there is none', () => {
    const name = { en: 'Chhath Puja', hi: 'छठ पूजा' };
    expect(secondaryName(name, 'en')).toBe('छठ पूजा');
    expect(secondaryName(name, 'hi')).toBe('Chhath Puja');
    expect(secondaryName({ en: 'Bhai Dooj' }, 'en')).toBeUndefined();
    expect(secondaryName({ en: 'Bhai Dooj' }, 'hi')).toBeUndefined();
  });

  it('featured = first six active pujas by id (no isFeatured data exists), stable', () => {
    const many = 'jihgfedcba'.split('').map((c) => make(`p_${c}`, `Name ${c}`, undefined));
    const retired: PujaSummary = { ...make('p_0', 'Retired', undefined), status: 'deprecated' };
    const picked = pickFeatured([...many, retired]).map((p) => p.id);
    expect(picked).toEqual(['p_a', 'p_b', 'p_c', 'p_d', 'p_e', 'p_f']);
    expect(pickFeatured([...many].reverse()).map((p) => p.id)).toEqual(picked);
  });

  it('sortByName breaks ties by id', () => {
    const twins = [make('b', 'Same', undefined), make('a', 'Same', undefined)];
    expect(sortByName(twins, 'en').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('finds safety notes by their step title', () => {
    const step = (id: string, en: string) => ({
      id,
      stepNumber: 1,
      title: { en },
      description: { en: 'd' },
      relatedSamagriIds: [],
      isOptional: false,
    });
    const steps = [
      step('a', 'Safety Note: Ghat Safety'),
      step('b', 'Kharna (Second Day)'),
      step('c', 'Health Note: Fasting Safety'),
      step('d', 'Health and Safety Note'),
      step('e', 'Safety first aarti'),
    ];
    expect(extractSafetyNotes(steps).map((s) => s.id)).toEqual(['a', 'c', 'd']);
  });

  it('matches categories by name in any language', () => {
    expect(matchCategoryIds('vrat')).toEqual(['vrat']);
    expect(matchCategoryIds('व्रत')).toEqual(['vrat']);
    expect(matchCategoryIds('house')).toEqual(['household']);
    expect(matchCategoryIds('zzz')).toEqual([]);
    expect(matchCategoryIds('  ')).toEqual([]);
  });

  it('search rows name the puja that contains a samagri match', () => {
    const hits: PujaSearchHit[] = [
      {
        pujaId: 'a',
        name: { en: 'Diwali Lakshmi Puja', hi: 'दिवाली लक्ष्मी पूजा' },
        matchedBy: ['samagri'],
        samagri: [{ id: 'sm_diya', name: { en: 'Diya/lamp', hi: 'दीया' } }],
      },
      { pujaId: 'b', name: { en: 'Chhath Puja' }, matchedBy: ['name'], samagri: [] },
    ];
    const rows = toSearchRows(hits, 'en', (p) => `Found in: ${p}`);
    expect(rows[0]).toMatchObject({
      kind: 'samagri',
      title: 'Diya/lamp',
      subtitle: 'Found in: Diwali Lakshmi Puja',
    });
    expect(rows[1]).toMatchObject({ kind: 'puja', title: 'Chhath Puja' });
    expect(toSearchRows(hits, 'hi', (p) => `में: ${p}`)[0]).toMatchObject({
      title: 'दीया',
      subtitle: 'में: दिवाली लक्ष्मी पूजा',
    });
  });
});

describe('image mapping', () => {
  const bundled = bundledJson as unknown as ContentBundle;

  it('every bundled puja has artwork', () => {
    for (const puja of bundled.pujas) expect(getPujaImage(puja.id, puja.category)).not.toBeNull();
  });

  it('falls back to the category image, then to null, and never throws', () => {
    expect(getPujaImage('puja_unknown', 'vrat')).toBe(getCategoryImage('vrat'));
    expect(getPujaImage('puja_unknown', 'tribal')).toBeNull();
    expect(getPujaImage('puja_unknown')).toBeNull();
    expect(getPujaImage('__proto__', 'constructor')).toBeNull();
    expect(getCategoryImage(undefined)).toBeNull();
  });
});
