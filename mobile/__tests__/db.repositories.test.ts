import {
  getContentInfo,
  getFestival,
  getPuja,
  listFestivals,
  listPujas,
  searchContent,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { localize } from '@/i18n/localeMap';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';

async function seeded() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makeFixtureBundle());
  return db;
}

describe('puja repository', () => {
  it('lists active pujas ordered by English name, hiding deprecated ones', async () => {
    const db = await seeded();
    const list = await listPujas(db);
    expect(list.map((p) => p.id)).toEqual(['puja_test_lakshmi', 'puja_test_vrat']);
    expect((await listPujas(db, { includeDeprecated: true })).map((p) => p.id)).toContain(
      'puja_test_retired',
    );
  });

  it('returns domain objects with locale maps, not raw rows', async () => {
    const db = await seeded();
    const [first] = await listPujas(db);
    expect(first).toMatchObject({
      id: 'puja_test_lakshmi',
      festivalId: 'fest_test_lamps',
      category: 'festival',
      regions: ['pan_india'],
      reviewStatus: 'ai_drafted',
      status: 'active',
    });
    expect(localize(first.name, 'hi')).toBe('लक्ष्मी पूजा (परीक्षण)');
    expect(localize(first.name, 'en')).toBe('Lakshmi Puja (test)');
    expect(first).not.toHaveProperty('name_json');
  });

  it('filters by category', async () => {
    const db = await seeded();
    expect((await listPujas(db, { category: 'vrat' })).map((p) => p.id)).toEqual([
      'puja_test_vrat',
    ]);
    expect(await listPujas(db, { category: 'tribal' })).toEqual([]);
  });

  it('filters by month using bundled festival dates (including multi-day overlap)', async () => {
    const db = await seeded();
    const ids = async (year: number, month: number) =>
      (await listPujas(db, { month: { year, month } })).map((p) => p.id);
    expect(await ids(2031, 10)).toEqual(['puja_test_lakshmi']); // starts 30 Oct
    expect(await ids(2031, 11)).toEqual(['puja_test_lakshmi']); // runs until 2 Nov
    expect(await ids(2031, 12)).toEqual([]);
    expect(await ids(2032, 10)).toEqual([]); // no bundled date for that year: nothing, never computed
  });

  it('combines category and month filters', async () => {
    const db = await seeded();
    expect(await listPujas(db, { category: 'vrat', month: { year: 2031, month: 10 } })).toEqual([]);
    expect(
      (await listPujas(db, { category: 'festival', month: { year: 2031, month: 11 } })).map(
        (p) => p.id,
      ),
    ).toEqual(['puja_test_lakshmi']);
  });

  it('gets a puja with ordered samagri, steps, variations and checklist', async () => {
    const db = await seeded();
    const puja = await getPuja(db, 'puja_test_lakshmi');
    expect(puja).not.toBeNull();
    if (!puja) return;
    expect(puja.samagri.map((s) => [s.samagriId, s.classification, s.sortOrder])).toEqual([
      ['sm_test_lamp', 'REQUIRED', 1],
      ['sm_test_flower', 'COMMON', 2],
    ]);
    expect(puja.samagri[0].name.en).toBe('Test Lamp');
    expect(puja.samagri[1].quantityGuidance).toEqual({ en: 'as needed' });
    expect(puja.samagri[0].quantityGuidance).toBeUndefined();
    expect(puja.steps.map((s) => s.stepNumber)).toEqual([1, 2]);
    expect(puja.steps[0]).toMatchObject({
      id: 'step_test_lakshmi_1',
      relatedSamagriIds: ['sm_test_lamp'],
      isOptional: false,
      importantNote: { en: 'fixture note' },
    });
    expect(puja.steps[1].isOptional).toBe(true);
    expect(puja.variations).toEqual([
      expect.objectContaining({
        id: 'var_test_lakshmi_1',
        regions: ['east'],
        affectsStepIds: ['step_test_lakshmi_2'],
      }),
    ]);
    expect(puja.checklist.map((c) => c.id)).toEqual([
      'chk_test_lakshmi_early',
      'chk_test_lakshmi_late',
    ]);
    expect(puja.sourceNote.en).toMatch(/TEST FIXTURE/);
    expect(puja.disclaimer).toBeUndefined();
    expect(puja.contentVersion).toBe(1);
  });

  it('keeps classification per puja for the same samagri item', async () => {
    const db = await seeded();
    const vrat = await getPuja(db, 'puja_test_vrat');
    expect(vrat?.samagri[0]).toMatchObject({
      samagriId: 'sm_test_flower',
      classification: 'OPTIONAL',
    });
    const lakshmi = await getPuja(db, 'puja_test_lakshmi');
    expect(lakshmi?.samagri.find((s) => s.samagriId === 'sm_test_flower')?.classification).toBe(
      'COMMON',
    );
  });

  it('returns null for an unknown puja', async () => {
    expect(await getPuja(await seeded(), 'puja_nope')).toBeNull();
  });
});

describe('festival repository', () => {
  it('lists active festivals with bundled dates for a year', async () => {
    const db = await seeded();
    const list = await listFestivals(db, { year: 2031 });
    expect(list.map((f) => f.id)).toEqual(['fest_test_lamps']);
    expect(list[0].dates).toEqual([
      {
        id: 'cal_test_2031_lamps',
        festivalId: 'fest_test_lamps',
        year: 2031,
        date: '2031-10-30',
        endDate: '2031-11-02',
        certainty: 'provisional',
        regionNote: { en: 'fixture' },
        source: 'TEST FIXTURE',
      },
    ]);
  });

  it('returns empty dates ("date not available") for a year without an entry', async () => {
    const db = await seeded();
    const [festival] = await listFestivals(db, { year: 2040 });
    expect(festival.id).toBe('fest_test_lamps');
    expect(festival.dates).toEqual([]);
  });

  it('gets one festival with all dates, or null', async () => {
    const db = await seeded();
    expect((await getFestival(db, 'fest_test_lamps'))?.dates).toHaveLength(1);
    expect(await getFestival(db, 'fest_none')).toBeNull();
    expect((await listFestivals(db, { includeDeprecated: true })).map((f) => f.id)).toContain(
      'fest_test_old',
    );
  });
});

describe('content info', () => {
  it('reports the loaded version and puja count', async () => {
    expect(await getContentInfo(await seeded())).toMatchObject({ contentVersion: 1, pujaCount: 3 });
  });

  it('reports nulls and zero before anything is seeded', async () => {
    expect(await getContentInfo(createMigratedDb())).toEqual({
      contentVersion: null,
      schemaVersion: null,
      pujaCount: 0,
      seededAt: null,
    });
  });
});

describe('search', () => {
  const ids = async (query: string, options?: Parameters<typeof searchContent>[2]) =>
    (await searchContent(await seeded(), query, options)).map(
      (r) => `${r.entityType}:${r.entityId}`,
    );

  it('matches English prefixes as the user types', async () => {
    expect(await ids('lak')).toContain('puja:puja_test_lakshmi');
    expect(await ids('l')).toContain('puja:puja_test_lakshmi');
    expect(await ids('LAKSH')).toContain('puja:puja_test_lakshmi');
  });

  it('matches several typed words with AND semantics', async () => {
    expect(await ids('lak pu')).toEqual(['puja:puja_test_lakshmi']);
    expect(await ids('lakshmi weekly')).toEqual([]);
  });

  it('matches Hindi (Devanagari with matras and conjuncts), whole word and prefix', async () => {
    expect(await ids('लक्ष्मी')).toContain('puja:puja_test_lakshmi');
    expect(await ids('लक्ष्')).toContain('puja:puja_test_lakshmi');
    expect(await ids('पूजा')).toContain('puja:puja_test_lakshmi');
    expect(await ids('पूज')).toContain('puja:puja_test_lakshmi');
    expect(await ids('परीक्षण दीप')).toContain('festival:fest_test_lamps');
  });

  it('does not match fragments inside a Devanagari word (matras are not separators)', async () => {
    // With the default tokenizer "ष" and "म" would match inside लक्ष्मी.
    expect(await ids('ष')).toEqual([]);
    expect(await ids('मी')).toEqual([]);
    expect(await ids('लक')).not.toContain('puja:puja_test_retired');
  });

  it('finds alternate spellings in English and Hindi', async () => {
    expect(await ids('laxmi')).toContain('puja:puja_test_lakshmi');
    expect(await ids('pooja')).toContain('puja:puja_test_lakshmi');
    expect(await ids('लक्ष्मी पूजन')).toContain('puja:puja_test_lakshmi');
    expect(await ids('लक्षमी')).toContain('puja:puja_test_lakshmi');
    expect(await ids('deepavali')).toContain('festival:fest_test_lamps');
    expect(await ids('दिया')).toContain('samagri:sm_test_lamp');
  });

  it('finds pujas through the samagri they use, and the samagri itself', async () => {
    const found = await ids('flowers');
    expect(found).toContain('samagri:sm_test_flower');
    expect(found).toEqual(
      expect.arrayContaining(['puja:puja_test_lakshmi', 'puja:puja_test_vrat']),
    );
  });

  it('ranks a name match above a match that is only through samagri', async () => {
    const results = await searchContent(await seeded(), 'test flowers');
    expect(results[0].entityType).toBe('samagri');
    expect(results.map((r) => r.rank)).toEqual(results.map((_, i) => i + 1));
  });

  it('ranks the name above an alternate spelling', async () => {
    const db = createMigratedDb();
    const bundle = makeFixtureBundle();
    bundle.pujas = [
      {
        ...bundle.pujas[1],
        id: 'puja_test_alias_only',
        name: { en: 'Something Else' },
        alternateNames: { en: ['Zebra'] },
      },
      { ...bundle.pujas[1], id: 'puja_test_name_match', name: { en: 'Zebra Vrat' } },
    ];
    bundle.festivals = [];
    bundle.calendar = [];
    bundle.samagri = bundle.samagri.filter((s) => s.id === 'sm_test_flower');
    await seedContentIfNeeded(db, bundle);
    const results = await searchContent(db, 'zebra');
    expect(results.map((r) => r.entityId)).toEqual([
      'puja_test_name_match',
      'puja_test_alias_only',
    ]);
  });

  it('returns names as locale maps for display', async () => {
    const [first] = await searchContent(await seeded(), 'laxmi');
    expect(first.name).toEqual({ en: 'Lakshmi Puja (test)', hi: 'लक्ष्मी पूजा (परीक्षण)' });
  });

  it('returns no results for unknown words, empty and punctuation-only input', async () => {
    expect(await ids('qwertyuiop')).toEqual([]);
    expect(await ids('')).toEqual([]);
    expect(await ids('   ')).toEqual([]);
    expect(await ids('"*()')).toEqual([]);
  });

  it('is safe against FTS5 syntax typed by the user', async () => {
    for (const q of [
      'lak OR',
      'NEAR(',
      'a AND',
      '"unterminated',
      'name:lak',
      '-lak',
      'lak*',
      '^lak',
      "l'a",
    ]) {
      await expect(searchContent(await seeded(), q)).resolves.toBeInstanceOf(Array);
    }
  });

  it('does not return deprecated entities', async () => {
    expect(await ids('retired')).toEqual([]);
  });

  it('filters by entity type and respects the limit', async () => {
    expect(await ids('test', { types: ['festival'] })).toEqual(['festival:fest_test_lamps']);
    expect((await ids('test', { limit: 2 })).length).toBe(2);
  });

  it('folds Latin accents (remove_diacritics)', async () => {
    const db = createMigratedDb();
    const bundle = makeFixtureBundle();
    bundle.pujas[0].alternateNames = { en: ['Lakṣmī Pūjā'] };
    await seedContentIfNeeded(db, bundle);
    expect((await searchContent(db, 'laksmi puja')).map((r) => r.entityId)).toContain(
      'puja_test_lakshmi',
    );
  });

  it('treats composed and decomposed Devanagari input the same (NFC)', async () => {
    const decomposed = 'पू'.normalize('NFD') + 'जा';
    expect(await ids(decomposed)).toContain('puja:puja_test_lakshmi');
  });
});
