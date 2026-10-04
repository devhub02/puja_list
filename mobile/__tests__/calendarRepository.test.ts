import {
  getNextDate,
  listDatesForMonth,
  listFestivals,
  listFestivalsWithoutDate,
  listNextDates,
  listUpcomingFestivals,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';

import { makeCalendarBundle } from '../testing/calendarFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';

// Fixtures are marked "TEST FIXTURE, not real dates" (see testing/calendarFixture.ts).

async function db() {
  const database = createMigratedDb();
  await seedContentIfNeeded(database, makeCalendarBundle());
  return database;
}

const ids = (list: { festival: { id: string } }[]) => list.map((o) => o.festival.id);

describe('dates for a month', () => {
  it('lists the observances that touch the month, by start date, and skips deprecated festivals', async () => {
    const march = await listDatesForMonth(await db(), 2031, 3);
    expect(ids(march)).toEqual(['fest_cal_beta', 'fest_cal_alpha', 'fest_cal_gamma']);
    expect(march.map((o) => o.date.date)).toEqual(['2031-03-12', '2031-03-14', '2031-03-31']);
    expect(ids(march)).not.toContain('fest_test_old');
  });

  it('includes a multi-day festival in the later month it runs into', async () => {
    const april = await listDatesForMonth(await db(), 2031, 4);
    expect(ids(april)).toEqual(['fest_cal_gamma']);
    expect(april[0].date).toMatchObject({ date: '2031-03-31', endDate: '2031-04-02' });
  });

  it('returns an empty list for a month without bundled data', async () => {
    const database = await db();
    expect(await listDatesForMonth(database, 2031, 5)).toEqual([]);
    expect(await listDatesForMonth(database, 2026, 11)).toEqual([]);
  });

  it('returns the festival with its catalog fields (regions come from the festival, not the date)', async () => {
    const [beta] = await listDatesForMonth(await db(), 2031, 3);
    expect(beta.festival.regions).toEqual(['south']);
    expect(beta.festival.category).toBe('harvest_seasonal');
    expect(beta.date.certainty).toBe('varies_by_region');
  });
});

describe('upcoming festivals', () => {
  it('includes a festival that is on right now, then the next ones, soonest first', async () => {
    const upcoming = await listUpcomingFestivals(await db(), '2031-03-13', 5);
    expect(ids(upcoming)).toEqual([
      'fest_cal_beta', // 12th to 16th: ongoing on the 13th
      'fest_cal_alpha',
      'fest_cal_gamma',
      'fest_test_lamps',
    ]);
  });

  it('keeps a festival on its last day and drops it the day after', async () => {
    const database = await db();
    expect(ids(await listUpcomingFestivals(database, '2031-03-16', 10))).toContain('fest_cal_beta');
    expect(ids(await listUpcomingFestivals(database, '2031-03-17', 10))).not.toContain(
      'fest_cal_beta',
    );
  });

  it('applies the limit', async () => {
    const database = await db();
    expect(ids(await listUpcomingFestivals(database, '2031-03-01', 2))).toEqual([
      'fest_cal_beta',
      'fest_cal_alpha',
    ]);
    expect(await listUpcomingFestivals(database, '2031-03-01', 0)).toEqual([]);
  });

  it('lists one date per festival (its next one) even when later years are bundled', async () => {
    const next = await listNextDates(await db(), '2031-01-01');
    expect(ids(next).filter((id) => id === 'fest_cal_alpha')).toHaveLength(1);
    expect(next.find((o) => o.festival.id === 'fest_cal_alpha')?.date.date).toBe('2031-03-14');
  });

  it('is empty when every bundled date is in the past', async () => {
    expect(await listUpcomingFestivals(await db(), '2033-01-01', 5)).toEqual([]);
  });
});

describe('next date of one festival', () => {
  it('picks the first date that is not over, across years', async () => {
    const database = await db();
    expect((await getNextDate(database, 'fest_cal_alpha', '2031-03-14'))?.date).toBe('2031-03-14');
    expect((await getNextDate(database, 'fest_cal_alpha', '2031-03-15'))?.date).toBe('2032-03-03');
    expect((await getNextDate(database, 'fest_cal_beta', '2031-03-15'))?.endDate).toBe(
      '2031-03-16',
    );
  });

  it('is null when there is no later date or the festival has none (never a guess)', async () => {
    const database = await db();
    expect(await getNextDate(database, 'fest_cal_alpha', '2032-03-04')).toBeNull();
    expect(await getNextDate(database, 'fest_cal_delta', '2031-01-01')).toBeNull();
    expect(await getNextDate(database, 'fest_does_not_exist', '2031-01-01')).toBeNull();
  });
});

describe('festivals without a date', () => {
  it('lists active festivals with no date in the year, and never a deprecated one', async () => {
    const database = await db();
    const none2031 = (await listFestivalsWithoutDate(database, 2031)).map((f) => f.id);
    expect(none2031).toEqual(['fest_cal_delta']);
    const none2032 = (await listFestivalsWithoutDate(database, 2032)).map((f) => f.id);
    expect(none2032).toEqual(
      expect.arrayContaining([
        'fest_cal_beta',
        'fest_cal_gamma',
        'fest_cal_delta',
        'fest_test_lamps',
      ]),
    );
    expect(none2032).not.toContain('fest_cal_alpha');
    expect(none2032).not.toContain('fest_test_old');
  });

  it('lists every festival for a year that has no data at all', async () => {
    const database = await db();
    const active = (await listFestivals(database)).length;
    expect((await listFestivalsWithoutDate(database, 2040)).length).toBe(active);
  });
});
