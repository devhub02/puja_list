import bundledJson from '../assets/puja_data/content.json';
import { searchPujas } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';

import { createMigratedDb } from '../testing/nodeSqlDb';

const bundled = bundledJson as unknown as ContentBundle;

async function realDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, bundled);
  return db;
}

const ids = async (db: Awaited<ReturnType<typeof realDb>>, q: string, categories?: string[]) =>
  (await searchPujas(db, q, { categories })).map((h) => h.pujaId);

describe('searchPujas on the real bundled content', () => {
  it('finds pujas by English and Hindi names and spellings', async () => {
    const db = await realDb();
    expect(await ids(db, 'Ganesh')).toContain('puja_ganesh_chaturthi');
    expect(await ids(db, 'गणेश')).toContain('puja_ganesh_chaturthi');
    expect(await ids(db, 'chhath')).toContain('puja_chhath');
    expect(await ids(db, 'छठ')).toContain('puja_chhath');
    expect((await ids(db, 'Laxmi')).length + (await ids(db, 'Lakshmi')).length).toBeGreaterThan(0);
    expect(await ids(db, 'लक्ष्मी')).toContain('puja_diwali_lakshmi_puja');
  });

  it('finds a puja through its festival name', async () => {
    const db = await realDb();
    expect(await ids(db, 'janmashtami')).toContain('puja_janmashtami');
  });

  it('a samagri match reports which samagri and lists the pujas that use it', async () => {
    const db = await realDb();
    const hits = await searchPujas(db, 'diya');
    const diwali = hits.find((h) => h.pujaId === 'puja_diwali_lakshmi_puja');
    expect(diwali).toBeDefined();
    expect(diwali?.matchedBy).toContain('samagri');
    expect(diwali?.samagri.length).toBeGreaterThan(0);
    expect(diwali?.samagri[0].name.en).toBeTruthy();
    // Hindi spelling of the same item
    expect((await ids(db, 'दीपक')).length).toBeGreaterThan(0);
  });

  it('adds pujas of categories the caller matched, and returns nothing for gibberish', async () => {
    const db = await realDb();
    const vrat = await searchPujas(db, 'vrat', { categories: ['vrat'] });
    expect(
      vrat.some((h) => h.pujaId === 'puja_karwa_chauth' && h.matchedBy.includes('category')),
    ).toBe(true);
    expect(await ids(db, 'zzzzqqqq')).toEqual([]);
    expect(await ids(db, '   ')).toEqual([]);
  });

  it('never returns the same puja twice and respects the limit', async () => {
    const db = await realDb();
    const hits = await searchPujas(db, 'puja', { limit: 5 });
    expect(hits.length).toBeLessThanOrEqual(5);
    expect(new Set(hits.map((h) => h.pujaId)).size).toBe(hits.length);
  });
});
