import { fireEvent, screen } from '@testing-library/react-native';

import FestivalDetailsScreen from '../app/festival/[id]';
import CalendarScreen from '../app/(tabs)/calendar';
import HomeScreen from '../app/(tabs)/index';
import PujaDetailsScreen from '../app/puja/[id]';
import bundledJson from '../assets/puja_data/content.json';
import { listFestivalsWithoutDate, listNextDates } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';

import { setToday } from '../testing/dateMock';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock);
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

// These tests use the REAL exported content.json (the dates you entered in calendar_dates.csv), unlike the
// fixture-based tests. They check what is in the bundle; they never write or compute a date.

const bundled = bundledJson as unknown as ContentBundle;

async function realDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, bundled);
  return db;
}

function entryOf(festivalId: string) {
  return bundled.calendar.flatMap((y) => y.entries).find((e) => e.festivalId === festivalId);
}

beforeEach(async () => {
  resetRouterMock();
  setToday('2026-11-10');
  await resetSettings('en');
});

describe('real bundled calendar data', () => {
  it('has only 2026, with the imported dates and the schema certainty values', () => {
    expect(bundled.calendar.map((y) => y.year)).toEqual([2026]);
    const entries = bundled.calendar[0].entries;
    expect(entries).toHaveLength(25);
    expect(
      entries.every((e) => ['confirmed', 'provisional', 'varies_by_region'].includes(e.certainty)),
    ).toBe(true);
    const dates = entries.map((e) => e.date).sort();
    expect(dates[0]).toBe('2026-10-11');
    expect(dates[dates.length - 1]).toBe('2026-12-23');
  });

  it('has Diwali on 2026-11-08 and Chhath from 2026-11-13 to 2026-11-16', () => {
    expect(entryOf('fest_diwali')).toMatchObject({ date: '2026-11-08' });
    expect(entryOf('fest_diwali')?.endDate ?? '2026-11-08').toBe('2026-11-08');
    expect(entryOf('fest_chhath')).toMatchObject({ date: '2026-11-13', endDate: '2026-11-16' });
  });

  it('every other festival stays discoverable as "Date not available" for 2026 and 2027', async () => {
    const db = await realDb();
    expect((await listFestivalsWithoutDate(db, 2026)).length).toBe(bundled.festivals.length - 25);
    expect((await listFestivalsWithoutDate(db, 2027)).length).toBe(bundled.festivals.length);
  });
});

describe('Calendar on the real content', () => {
  it('shows November 2026 with Diwali on the 8th and Chhath spanning the 13th to the 16th', async () => {
    await renderWithDb(<CalendarScreen />, await realDb());
    expect(await screen.findByTestId('festival-row-fest_diwali')).toBeTruthy();
    expect(screen.getByTestId('month-title').props.children).toBe('November 2026');
    expect(screen.getByTestId('festival-row-fest_diwali-date').props.children).toBe('8 Nov 2026');
    for (const day of ['13', '14', '15', '16']) {
      expect(
        screen.getByTestId(`span-2026-11-${day}`, { includeHiddenElements: true }),
      ).toBeTruthy();
    }
    expect(screen.queryByTestId('span-2026-11-12', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('span-2026-11-17', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('day-2026-11-08').props.accessibilityLabel).toMatch(
      /Sunday, 8 November 2026/,
    );

    // The month list is virtualised, so select a day to bring Chhath's row on screen.
    await fireEvent.press(screen.getByTestId('day-2026-11-14'));
    expect(await screen.findByTestId('festival-row-fest_chhath')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_chhath-date').props.children).toBe(
      '13 Nov – 16 Nov 2026',
    );
    expect(screen.queryByTestId('festival-row-fest_diwali')).toBeNull();
  });

  it('shows a month before the data starts with a clear note, and still lists the festivals in All festivals', async () => {
    await renderWithDb(<CalendarScreen />, await realDb());
    await screen.findByTestId('festival-row-fest_diwali');
    for (let i = 0; i < 7; i += 1) await fireEvent.press(screen.getByTestId('month-prev')); // April 2026
    expect(await screen.findByTestId('month-no-data')).toBeTruthy();
    expect(screen.getByTestId('month-grid')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('calendar-view-all'));
    expect(await screen.findByTestId('section-month-10')).toBeTruthy();
    // 25 festivals have a 2026 date and the other 78 are listed as "Date not available": all 103 are there
    expect(screen.getByTestId('list-count').props.children).toBe(
      `${bundled.festivals.length} festivals`,
    );

    await fireEvent.press(screen.getByTestId('year-next')); // 2027: nothing bundled yet
    expect(await screen.findByTestId('year-no-data')).toBeTruthy();
    expect(screen.queryByTestId('section-month-10')).toBeNull();
    expect(screen.getByTestId('section-no-date')).toBeTruthy();
    expect(screen.getByTestId('list-count').props.children).toBe(
      `${bundled.festivals.length} festivals`,
    );
  });

  it('finds a festival by name, English or Hindi, on the real catalog', async () => {
    await renderWithDb(<CalendarScreen />, await realDb());
    await screen.findByTestId('festival-row-fest_diwali');
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), 'chhath');
    expect(await screen.findByTestId('festival-row-fest_chhath')).toBeTruthy();
    expect(screen.queryByTestId('festival-row-fest_diwali')).toBeNull();
    const hindi = bundled.festivals.find((f) => f.id === 'fest_diwali')?.name.hi ?? '';
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), hindi);
    expect(await screen.findByTestId('festival-row-fest_diwali')).toBeTruthy();
  });

  it('renders in Hindi without crashing', async () => {
    await resetSettings('hi');
    await renderWithDb(<CalendarScreen />, await realDb());
    expect(await screen.findByTestId('festival-row-fest_diwali')).toBeTruthy();
    expect(screen.getByTestId('month-title').props.children).toMatch(/[ऀ-ॿ]/);
    expect(screen.getByTestId('festival-row-fest_diwali-certainty').props.children).toBeTruthy();
  });
});

describe('Festival Details on the real content', () => {
  it('shows Diwali with its bundled date, certainty and the standard disclaimer', async () => {
    setParams({ id: 'fest_diwali' });
    await renderWithDb(<FestivalDetailsScreen />, await realDb());
    expect(await screen.findByTestId('festival-name')).toBeTruthy();
    expect(screen.getByTestId('festival-date-text').props.children).toBe('8 Nov 2026');
    expect(screen.getByTestId('festival-review-badge')).toBeTruthy();
    expect(screen.getByTestId('disclaimer')).toBeTruthy();
  });

  it('shows Chhath as a range and a festival without a date as "not available"', async () => {
    setParams({ id: 'fest_chhath' });
    const db = await realDb();
    const first = await renderWithDb(<FestivalDetailsScreen />, db);
    expect((await screen.findByTestId('festival-date-text')).props.children).toBe(
      '13 Nov – 16 Nov 2026',
    );
    await first.unmount();
    const undated = bundled.festivals.find((f) => !entryOf(f.id));
    setParams({ id: undated?.id });
    await renderWithDb(<FestivalDetailsScreen />, db);
    expect(await screen.findByTestId('festival-no-dates')).toBeTruthy();
  });
});

describe('Home and Puja Details on the real content', () => {
  it('Home features Sharad Navratri (not Mysuru Dasara) on 2026-10-05, though both start on 2026-10-11', async () => {
    setToday('2026-10-05');
    expect(entryOf('fest_navratri')?.date).toBe('2026-10-11');
    expect(entryOf('fest_mysuru_dasara')?.date).toBe('2026-10-11');
    await renderWithDb(<HomeScreen />, await realDb());
    expect(await screen.findByTestId('next-festival-card')).toBeTruthy();
    expect(screen.getByTestId('next-festival-name').props.children).toBe('Sharad Navratri');
    expect(screen.getByTestId('next-festival-date').props.children).toBe('11 Oct – 20 Oct 2026');
    expect(screen.getByTestId('next-festival-countdown').props.children).toBe('In 6 days');
    expect(screen.queryByText('AI draft')).toBeNull();
    expect(screen.queryByText('Mysuru Dasara')).toBeNull();
    // the count is real: other festivals with a date in 2026-10-05 .. 2026-11-04, each once
    expect(screen.getByTestId('more-soon').props.children).toMatch(
      /^\d+ more in the next 30 days$/,
    );
  });

  it('Home features the festival that is on right now, and shows "Ongoing"', async () => {
    setToday('2026-11-14');
    await renderWithDb(<HomeScreen />, await realDb());
    expect(await screen.findByTestId('next-festival-card')).toBeTruthy();
    expect(screen.getByTestId('next-festival-countdown').props.children).toBe('Ongoing');
    expect(screen.getByTestId('see-calendar')).toBeTruthy();
  });

  it('Home hides the section after the last bundled date', async () => {
    setToday('2027-01-01');
    await renderWithDb(<HomeScreen />, await realDb());
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-section')).toBeNull();
  });

  it('Puja Details shows "Next date" for a puja whose festival has a bundled date, and nothing otherwise', async () => {
    const db = await realDb();
    const next = new Map(
      (await listNextDates(db, '2026-10-04')).map((o) => [o.festival.id, o.date]),
    );
    const withDate = bundled.pujas.find((p) => p.festivalId && next.has(p.festivalId));
    const without = bundled.pujas.find((p) => !p.festivalId || !next.has(p.festivalId));
    expect(withDate).toBeTruthy();
    expect(without).toBeTruthy();

    setToday('2026-10-04');
    setParams({ id: withDate?.id });
    const first = await renderWithDb(<PujaDetailsScreen />, db);
    expect((await screen.findByTestId('next-date')).props.children).toMatch(/2026/);
    expect(screen.getByTestId('next-date-certainty')).toBeTruthy();
    await first.unmount();

    setParams({ id: without?.id });
    await renderWithDb(<PujaDetailsScreen />, db);
    expect(await screen.findByTestId('details-name')).toBeTruthy();
    expect(screen.queryByTestId('next-date')).toBeNull();
  });
});
