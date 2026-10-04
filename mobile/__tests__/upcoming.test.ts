import type { FestivalOccurrence } from '@/db/repositories';
import type { CalendarDate, Festival } from '@/db/types';
import { addDays, daysBetween } from '@/utils/dateUtils';
import { countMoreSoon, countdownFor, pickNextFestival } from '@/utils/upcoming';

// TEST FIXTURE, not real festivals or dates.
function fest(id: string, overrides: Partial<Festival> = {}): Festival {
  return {
    id,
    name: { en: id, hi: id },
    shortDescription: { en: 'TEST FIXTURE' },
    regions: ['north'],
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

const noGuide = () => false;
const idOf = (o: FestivalOccurrence | null) => o?.festival.id ?? null;

describe('pickNextFestival', () => {
  it('picks the earliest start date', () => {
    const list = [occ(fest('later'), '2031-03-20'), occ(fest('sooner'), '2031-03-12')];
    expect(idOf(pickNextFestival(list, '2031-03-10', noGuide))).toBe('sooner');
  });

  it('counts a festival that is on right now (ongoing) and prefers its earlier start', () => {
    const list = [
      occ(fest('ahead'), '2031-03-12'),
      occ(fest('ongoing'), '2031-03-08', '2031-03-14'),
    ];
    expect(idOf(pickNextFestival(list, '2031-03-10', noGuide))).toBe('ongoing');
  });

  it('counts a festival on its last day and drops it the day after', () => {
    const list = [occ(fest('ending'), '2031-03-08', '2031-03-10'), occ(fest('next'), '2031-03-20')];
    expect(idOf(pickNextFestival(list, '2031-03-10', noGuide))).toBe('ending');
    expect(idOf(pickNextFestival(list, '2031-03-11', noGuide))).toBe('next');
  });

  it('on a tie, prefers a festival with a linked puja guide', () => {
    const withGuide = fest('with_guide', { regions: ['south'] });
    const without = fest('a_without', { regions: ['pan_india'] });
    const list = [occ(without, '2031-03-12'), occ(withGuide, '2031-03-12')];
    expect(idOf(pickNextFestival(list, '2031-03-10', (f) => f.id === 'with_guide'))).toBe(
      'with_guide',
    );
  });

  it('then prefers pan_india, then the English name', () => {
    const regional = fest('a_regional', { regions: ['south'] });
    const pan = fest('z_pan', { regions: ['north', 'pan_india'] });
    expect(
      idOf(
        pickNextFestival(
          [occ(regional, '2031-03-12'), occ(pan, '2031-03-12')],
          '2031-03-10',
          noGuide,
        ),
      ),
    ).toBe('z_pan');
    const b = fest('b_name', { name: { en: 'Banana', hi: 'x' } });
    const a = fest('a_name', { name: { en: 'Apple', hi: 'x' } });
    expect(
      idOf(pickNextFestival([occ(b, '2031-03-12'), occ(a, '2031-03-12')], '2031-03-10', noGuide)),
    ).toBe('a_name');
  });

  it('works when no festival has a linked puja', () => {
    const list = [occ(fest('b'), '2031-03-12'), occ(fest('a'), '2031-03-12')];
    expect(idOf(pickNextFestival(list, '2031-03-10', noGuide))).toBe('a');
  });

  it('works when the only candidate is a regional festival', () => {
    const only = occ(fest('only_regional', { regions: ['south'] }), '2031-03-12');
    expect(idOf(pickNextFestival([only], '2031-03-10', noGuide))).toBe('only_regional');
  });

  it('is null when nothing is upcoming', () => {
    expect(pickNextFestival([], '2031-03-10', noGuide)).toBeNull();
    expect(pickNextFestival([occ(fest('past'), '2031-03-01')], '2031-03-10', noGuide)).toBeNull();
  });

  it('the guide rule beats pan_india, and the start date beats both', () => {
    const regionalGuide = fest('regional_guide', { regions: ['south'] });
    const pan = fest('pan', { regions: ['pan_india'] });
    const list = [occ(pan, '2031-03-12'), occ(regionalGuide, '2031-03-12')];
    expect(idOf(pickNextFestival(list, '2031-03-10', (f) => f.id === 'regional_guide'))).toBe(
      'regional_guide',
    );
    const earlier = [
      occ(pan, '2031-03-13'),
      occ(fest('early_regional', { regions: ['south'] }), '2031-03-11'),
    ];
    expect(idOf(pickNextFestival(earlier, '2031-03-10', noGuide))).toBe('early_regional');
  });
});

describe('countdownFor', () => {
  it('starts today (single and multi-day)', () => {
    expect(countdownFor('2031-03-10', undefined, '2031-03-10')).toEqual({ kind: 'today' });
    expect(countdownFor('2031-03-10', '2031-03-14', '2031-03-10')).toEqual({ kind: 'today' });
  });

  it('is "in 1 day" tomorrow and "in N days" later', () => {
    expect(countdownFor('2031-03-11', undefined, '2031-03-10')).toEqual({ kind: 'in', days: 1 });
    expect(countdownFor('2031-03-16', '2031-03-18', '2031-03-10')).toEqual({ kind: 'in', days: 6 });
    expect(countdownFor('2031-04-09', undefined, '2031-03-10')).toEqual({ kind: 'in', days: 30 });
  });

  it('is ongoing from the day after the start through the last day', () => {
    expect(countdownFor('2031-03-08', '2031-03-14', '2031-03-09')).toEqual({ kind: 'ongoing' });
    expect(countdownFor('2031-03-08', '2031-03-14', '2031-03-14')).toEqual({ kind: 'ongoing' });
  });

  it('is null once the festival is over', () => {
    expect(countdownFor('2031-03-08', '2031-03-14', '2031-03-15')).toBeNull();
    expect(countdownFor('2031-03-08', undefined, '2031-03-09')).toBeNull();
  });

  it('counts across month, year and leap-day boundaries', () => {
    expect(countdownFor('2031-04-02', undefined, '2031-03-30')).toEqual({ kind: 'in', days: 3 });
    expect(countdownFor('2027-01-02', undefined, '2026-12-30')).toEqual({ kind: 'in', days: 3 });
    expect(countdownFor('2028-03-01', undefined, '2028-02-27')).toEqual({ kind: 'in', days: 3 });
    expect(countdownFor('2027-03-01', undefined, '2027-02-27')).toEqual({ kind: 'in', days: 2 });
  });

  it('never throws on a bad date', () => {
    expect(countdownFor('nope', undefined, '2031-03-10')).toBeNull();
  });
});

describe('daysBetween and addDays', () => {
  it('are plain calendar arithmetic across boundaries', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2027-01-01', '2026-12-31')).toBe(-1);
    expect(daysBetween('2026-10-05', '2026-10-05')).toBe(0);
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19');
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-10-05', -5)).toBe('2026-09-30');
    expect(addDays('garbage', 1)).toBeNull();
    expect(daysBetween('garbage', '2026-10-05')).toBeNull();
  });
});

describe('countMoreSoon', () => {
  const today = '2031-03-10';
  const hero = fest('hero');

  it('counts other festivals with a date in the next 30 days, each once', () => {
    const a = fest('a');
    const list = [
      occ(hero, '2031-03-11'),
      occ(a, '2031-03-15'),
      occ(a, '2031-03-25'), // the same festival twice counts once
      occ(fest('b'), '2031-04-09'), // day 30: included
      occ(fest('c'), '2031-04-10'), // day 31: not included
    ];
    expect(countMoreSoon(list, 'hero', today)).toBe(2);
  });

  it('never counts the featured festival, and counts an ongoing one', () => {
    const list = [
      occ(hero, '2031-03-08', '2031-03-14'),
      occ(fest('ongoing'), '2031-03-05', '2031-03-12'),
    ];
    expect(countMoreSoon(list, 'hero', today)).toBe(1);
  });

  it('ignores festivals that are over', () => {
    expect(countMoreSoon([occ(fest('over'), '2031-03-01', '2031-03-09')], 'hero', today)).toBe(0);
  });

  it('is zero when there is nothing else (so the UI hides the count)', () => {
    expect(countMoreSoon([occ(hero, '2031-03-11')], 'hero', today)).toBe(0);
    expect(countMoreSoon([], 'hero', today)).toBe(0);
    expect(countMoreSoon([occ(fest('far'), '2031-09-01')], 'hero', today)).toBe(0);
  });

  it('counts across a year boundary', () => {
    const list = [occ(fest('new_year'), '2027-01-10')];
    expect(countMoreSoon(list, 'hero', '2026-12-20')).toBe(1);
    expect(countMoreSoon(list, 'hero', '2026-12-05')).toBe(0);
  });
});
