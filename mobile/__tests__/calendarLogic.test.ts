import type { FestivalOccurrence } from '@/db/repositories';
import type { CalendarDate, Festival } from '@/db/types';
import {
  buildDayInfo,
  categoryOptions,
  emptyCalendarFilters,
  festivalMatchesFilters,
  festivalMatchesQuery,
  filterItems,
  groupByMonth,
  occurrencesOnDay,
  regionOptions,
} from '@/utils/calendarLogic';
import { certaintyLabelKey } from '@/utils/certainty';
import en from '@/i18n/locales/en';
import hi from '@/i18n/locales/hi';

// TEST FIXTURE, not real festivals or dates.
function fest(id: string, overrides: Partial<Festival> = {}): Festival {
  return {
    id,
    name: { en: `Fest ${id}`, hi: `पर्व ${id}` },
    shortDescription: { en: 'TEST FIXTURE' },
    regions: ['pan_india'],
    states: [],
    category: 'deity_festival',
    dateType: 'lunar',
    linkedPujaIds: [],
    reviewStatus: 'ai_drafted',
    sourceNote: { en: 'TEST FIXTURE' },
    status: 'active',
    ...overrides,
  };
}

function occ(festival: Festival, date: string, endDate?: string): FestivalOccurrence {
  const entry: CalendarDate = {
    id: `cal_${festival.id}_${date}`,
    festivalId: festival.id,
    year: Number(date.slice(0, 4)),
    date,
    endDate,
    region: 'all',
    certainty: 'confirmed',
  };
  return { festival, date: entry };
}

describe('region and category filters', () => {
  const pan = fest('pan');
  const south = fest('south', { regions: ['south'], category: 'harvest_seasonal' });
  const multi = fest('multi', { regions: ['north', 'west'], category: 'vrat_fasting' });

  it('shows everything with no filter (All India)', () => {
    for (const f of [pan, south, multi]) {
      expect(festivalMatchesFilters(f, emptyCalendarFilters)).toBe(true);
    }
  });

  it('a pan_india festival matches every region; a regional one only its own regions', () => {
    const north = { ...emptyCalendarFilters, region: 'north' as const };
    expect(festivalMatchesFilters(pan, north)).toBe(true);
    expect(festivalMatchesFilters(south, north)).toBe(false);
    expect(festivalMatchesFilters(multi, north)).toBe(true);
  });

  it('a festival with several regions matches any of them', () => {
    const west = { ...emptyCalendarFilters, region: 'west' as const };
    const east = { ...emptyCalendarFilters, region: 'east' as const };
    expect(festivalMatchesFilters(multi, west)).toBe(true);
    expect(festivalMatchesFilters(multi, east)).toBe(false);
  });

  it('the category filter is exact (pan_india does not bypass it) and combines with region', () => {
    expect(festivalMatchesFilters(pan, { region: null, category: 'vrat_fasting' })).toBe(false);
    expect(festivalMatchesFilters(multi, { region: null, category: 'vrat_fasting' })).toBe(true);
    expect(festivalMatchesFilters(multi, { region: 'north', category: 'vrat_fasting' })).toBe(true);
    expect(festivalMatchesFilters(multi, { region: 'south', category: 'vrat_fasting' })).toBe(
      false,
    );
  });

  it('offers only regions and categories that exist in the catalog, in a fixed order', () => {
    expect(regionOptions([pan, south, multi])).toEqual(['north', 'south', 'west']);
    expect(regionOptions([pan])).toEqual([]);
    expect(categoryOptions([multi, south])).toEqual(['harvest_seasonal', 'vrat_fasting']);
  });
});

describe('name search', () => {
  const f = fest('x', {
    name: { en: 'Mahashivratri', hi: 'महाशिवरात्रि' },
    alternateNames: { en: ['Maha Shivaratri'], hi: ['शिवरात्रि'] },
  });

  it('matches English, Hindi and alternate names, ignoring case and spacing', () => {
    expect(festivalMatchesQuery(f, 'shiv')).toBe(true);
    expect(festivalMatchesQuery(f, '  MAHASHIV ')).toBe(true);
    expect(festivalMatchesQuery(f, 'maha   shivaratri')).toBe(true);
    expect(festivalMatchesQuery(f, 'महाशिव')).toBe(true);
    expect(festivalMatchesQuery(f, 'शिवरात्रि')).toBe(true);
    expect(festivalMatchesQuery(f, 'diwali')).toBe(false);
  });

  it('an empty query matches everything', () => {
    expect(festivalMatchesQuery(f, '')).toBe(true);
    expect(festivalMatchesQuery(f, '   ')).toBe(true);
  });

  it('filterItems applies filters and the query together', () => {
    const a = occ(
      fest('a', { name: { en: 'Alpha', hi: 'अल्फा' }, regions: ['south'] }),
      '2031-03-01',
    );
    const b = occ(fest('b', { name: { en: 'Beta', hi: 'बीटा' } }), '2031-03-02');
    expect(filterItems([a, b], { region: 'south', category: null }, '')).toEqual([a, b]);
    expect(filterItems([a, b], { region: 'north', category: null }, '')).toEqual([b]);
    expect(filterItems([a, b], emptyCalendarFilters, 'alp')).toEqual([a]);
    expect(filterItems([a, b], emptyCalendarFilters, 'zzz')).toEqual([]);
  });
});

describe('day markers and multi-day span', () => {
  const single = occ(fest('single'), '2031-03-14');
  const range = occ(fest('range'), '2031-03-12', '2031-03-16');
  const sameDay = occ(fest('same'), '2031-03-20', '2031-03-20');
  const cross = occ(fest('cross'), '2031-03-31', '2031-04-02');
  const info = buildDayInfo([single, range, sameDay, cross]);

  it('marks a single-day festival as one dot', () => {
    expect(info.get('2031-03-20')).toMatchObject({ count: 1, singles: 1, ranges: [] });
    expect(info.get('2031-03-14')).toMatchObject({ count: 2, singles: 1 });
  });

  it('spans every day of a multi-day festival, both ends included', () => {
    for (const day of ['12', '13', '14', '15', '16']) {
      expect(info.get(`2031-03-${day}`)?.ranges.map((r) => r.start)).toContain('2031-03-12');
    }
    expect(info.get('2031-03-11')).toBeUndefined();
    expect(info.get('2031-03-17')).toBeUndefined();
  });

  it('spans across a month boundary', () => {
    expect(info.get('2031-03-31')?.ranges).toHaveLength(1);
    expect(info.get('2031-04-01')?.ranges).toHaveLength(1);
    expect(info.get('2031-04-02')?.ranges).toHaveLength(1);
    expect(info.get('2031-04-03')).toBeUndefined();
  });

  it('finds the festivals on a given day, including ones in the middle of a range', () => {
    const all = [single, range, sameDay, cross];
    expect(occurrencesOnDay(all, '2031-03-14').map((o) => o.festival.id)).toEqual([
      'single',
      'range',
    ]);
    expect(occurrencesOnDay(all, '2031-03-15').map((o) => o.festival.id)).toEqual(['range']);
    expect(occurrencesOnDay(all, '2031-03-18')).toEqual([]);
    expect(occurrencesOnDay(all, '2031-04-01').map((o) => o.festival.id)).toEqual(['cross']);
  });
});

describe('grouping by month', () => {
  it('groups by the month of the start date, in month order, and skips rows without a date', () => {
    const items = [
      occ(fest('nov'), '2031-11-08'),
      occ(fest('mar2'), '2031-03-20'),
      occ(fest('mar1'), '2031-03-02'),
      { festival: fest('undated') },
    ];
    const groups = groupByMonth(items);
    expect(groups.map((g) => g.month)).toEqual([3, 11]);
    expect(groups[0].data.map((i) => i.festival.id)).toEqual(['mar1', 'mar2']);
    expect(groupByMonth([{ festival: fest('only-undated') }])).toEqual([]);
  });
});

describe('certainty labels', () => {
  it('maps every schema value to a translated label in both languages', () => {
    for (const value of ['confirmed', 'provisional', 'varies_by_region']) {
      const key = certaintyLabelKey(value);
      expect(key).toBe(`calendar.certainty.${value}`);
      const name = key.split('.').pop() as keyof typeof en.calendar.certainty;
      expect(en.calendar.certainty[name]).toBeTruthy();
      expect(hi.calendar.certainty[name]).toBeTruthy();
    }
  });

  it('falls back to a neutral label for a value it does not know, and never throws', () => {
    for (const value of ['mystery', '', 'high', 'constructor', '__proto__', 'toString']) {
      expect(certaintyLabelKey(value)).toBe('calendar.certainty.unknown');
    }
    expect(en.calendar.certainty.unknown).toBe('Certainty not stated');
    expect(hi.calendar.certainty.unknown).toBeTruthy();
  });
});
