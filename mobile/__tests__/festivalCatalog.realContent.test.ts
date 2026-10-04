/**
 * Loads the REAL exported content (assets/puja_data/content.json, written by scripts/export_content.py),
 * seeds it into SQLite and checks the festival catalog the app will ship.
 */
import bundledJson from '../assets/puja_data/content.json';
import { getContentInfo, listFestivals, searchContent } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';

import { createMigratedDb } from '../testing/nodeSqlDb';

const bundled = bundledJson as unknown as ContentBundle;

async function realDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, bundled);
  return db;
}

describe('festival catalog (real exported content)', () => {
  it('has the expected size and seeds every festival into the database', async () => {
    expect(bundled.schemaVersion).toBe(2);
    expect(bundled.festivals.length).toBeGreaterThanOrEqual(80);
    expect(bundled.festivals.length).toBeLessThanOrEqual(130);
    const db = await realDb();
    expect(await getContentInfo(db)).toMatchObject({
      festivalCount: bundled.festivals.length,
      pujaCount: bundled.pujas.length,
    });
    expect((await listFestivals(db)).length).toBe(
      bundled.festivals.filter((f) => f.status === 'active').length,
    );
  });

  it('resolves every linkedPujaId, and every puja festivalId points back', () => {
    const pujaIds = new Set(bundled.pujas.map((p) => p.id));
    const festivalIds = new Set(bundled.festivals.map((f) => f.id));
    for (const festival of bundled.festivals) {
      for (const pujaId of festival.linkedPujaIds ?? []) {
        expect({ festival: festival.id, pujaId, found: pujaIds.has(pujaId) }).toEqual({
          festival: festival.id,
          pujaId,
          found: true,
        });
      }
    }
    for (const puja of bundled.pujas) {
      if (!puja.festivalId) continue;
      expect(festivalIds.has(puja.festivalId)).toBe(true);
      const festival = bundled.festivals.find((f) => f.id === puja.festivalId);
      expect(festival?.linkedPujaIds).toContain(puja.id);
    }
  });

  it('links all 16 existing puja guides to a festival', () => {
    expect(bundled.pujas).toHaveLength(16);
    const linked = new Set(bundled.festivals.flatMap((f) => f.linkedPujaIds ?? []));
    for (const puja of bundled.pujas) expect(linked.has(puja.id)).toBe(true);
  });

  it('keeps calendar-only festivals (no puja guide) and ships no dates in festivals', () => {
    const calendarOnly = bundled.festivals.filter((f) => (f.linkedPujaIds ?? []).length === 0);
    expect(calendarOnly.length).toBeGreaterThan(50);
    const allowedKeys = new Set([
      'id',
      'name',
      'alternateNames',
      'shortDescription',
      'significance',
      'regions',
      'states',
      'category',
      'dateType',
      'observanceDescription',
      'linkedPujaIds',
      'reviewStatus',
      'sourceNote',
      'status',
      'replacedBy',
    ]);
    for (const festival of bundled.festivals) {
      for (const key of Object.keys(festival)) expect(allowedKeys.has(key)).toBe(true);
      expect(festival.name.en).toBeTruthy();
      expect(festival.name.hi).toBeTruthy();
      expect(festival.shortDescription.en).toBeTruthy();
      expect(festival.shortDescription.hi).toBeTruthy();
      expect(festival.reviewStatus).toBe('ai_drafted');
      expect(festival.sourceNote.en).toMatch(/not yet verified/);
      // no ISO date anywhere in the festival's own text
      expect(JSON.stringify(festival)).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    }
  });

  it('covers every region of the fixed list', () => {
    const seen = new Set(bundled.festivals.flatMap((f) => f.regions));
    for (const region of [
      'pan_india',
      'north',
      'east',
      'west',
      'south',
      'central',
      'north_east',
      'himalayan',
      'tribal',
    ])
      expect(seen.has(region as never)).toBe(true);
  });

  it('shows "date not available" for every festival while the calendar CSV is empty', async () => {
    const db = await realDb();
    const list = await listFestivals(db, { year: 2026 });
    const withDates = list.filter((f) => f.dates.length > 0).length;
    expect(withDates).toBe(
      bundled.calendar
        .filter((c) => c.year === 2026)
        .flatMap((c) => c.entries.map((e) => e.festivalId))
        .filter((id, i, all) => all.indexOf(id) === i).length,
    );
  });

  describe('search finds festival names', () => {
    const find = async (query: string) => {
      const db = await realDb();
      return (await searchContent(db, query, { types: ['festival'] })).map((r) => r.entityId);
    };

    it.each([
      ['Pongal', 'fest_pongal'],
      ['pongal', 'fest_pongal'],
      ['Onam', 'fest_onam'],
      ['Lohri', 'fest_lohri'],
      ['Bihu', 'fest_bihu_bohag'],
      ['Bathukamma', 'fest_bathukamma'],
      ['Rath Yatra', 'fest_rath_yatra'],
      ['Sarhul', 'fest_sarhul'],
      ['Holi', 'fest_holi'],
      ['Deepavali', 'fest_diwali'],
      ['Navratri', 'fest_navratri'],
    ])('English "%s" finds %s', async (query, id) => {
      expect(await find(query)).toContain(id);
    });

    it.each([
      ['पोंगल', 'fest_pongal'],
      ['ओणम', 'fest_onam'],
      ['लोहड़ी', 'fest_lohri'],
      ['बिहू', 'fest_bihu_bohag'],
      ['होली', 'fest_holi'],
      ['रथ यात्रा', 'fest_rath_yatra'],
      ['सरहुल', 'fest_sarhul'],
      ['दिवाली', 'fest_diwali'],
      ['दीपावली', 'fest_diwali'],
      ['छठ', 'fest_chhath'],
    ])('Hindi "%s" finds %s', async (query, id) => {
      expect(await find(query)).toContain(id);
    });

    it('finds a festival by an alternate (search-only) name', async () => {
      expect(await find('Vishukkani')).toContain('fest_vishu');
      expect(await find('उत्तरायण')).toContain('fest_makar_sankranti');
    });
  });
});
