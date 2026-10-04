import { fireEvent, screen } from '@testing-library/react-native';

import CalendarScreen from '../app/(tabs)/calendar';
import FestivalDetailsScreen from '../app/festival/[id]';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';
import type { SqlDb } from '@/db/sqlDb';
import { formatMonthYear } from '@/i18n/format';

import { makeCalendarBundle } from '../testing/calendarFixture';
import { setToday } from '../testing/dateMock';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock);
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

// All dates below are TEST FIXTURE dates in 2031 (see testing/calendarFixture.ts), not real dates.

beforeEach(async () => {
  resetRouterMock();
  setToday('2031-03-10');
  await resetSettings('en');
});

async function fixtureDb(bundle: ContentBundle = makeCalendarBundle()) {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, bundle);
  return db;
}

async function openCalendar(db?: SqlDb) {
  await renderWithDb(<CalendarScreen />, db ?? (await fixtureDb()));
  return screen.findByTestId('festival-row-fest_cal_beta');
}

// The markers inside a day cell are hidden from screen readers (the cell's label says it all).
const hidden = { includeHiddenElements: true };

const rowIds = () =>
  screen.queryAllByTestId(/^festival-row-fest_[a-z_]+$/).map((n) => n.props.testID as string);

describe('Calendar: month view', () => {
  it('shows the month, a grid with markers, the panchang note and the festivals of the month', async () => {
    await openCalendar();
    expect(screen.getByTestId('month-title').props.children).toBe('March 2031');
    expect(screen.getByTestId('month-grid')).toBeTruthy();
    expect(screen.getByTestId('date-note')).toBeTruthy();
    expect(screen.getByText(/confirm with a local panchang/)).toBeTruthy();
    expect(rowIds()).toEqual([
      'festival-row-fest_cal_beta',
      'festival-row-fest_cal_alpha',
      'festival-row-fest_cal_gamma',
    ]);
    // no deprecated festival, even though it has a (fixture) date in March
    expect(screen.queryByTestId('festival-row-fest_test_old')).toBeNull();
    expect(screen.getByTestId('list-count').props.children).toBe('3 festivals');
  });

  it('marks today and spans a multi-day festival over each of its days', async () => {
    await openCalendar();
    expect(screen.getByTestId('day-2031-03-10').props.accessibilityLabel).toMatch(/today/);
    for (const day of ['12', '13', '14', '15', '16']) {
      expect(screen.getByTestId(`span-2031-03-${day}`, hidden)).toBeTruthy();
    }
    expect(screen.queryByTestId('span-2031-03-11', hidden)).toBeNull();
    expect(screen.queryByTestId('span-2031-03-17', hidden)).toBeNull();
    // the single-day festival is a dot, not a span, and the 14th has two festivals
    expect(screen.getByTestId('day-2031-03-14').props.accessibilityLabel).toMatch(/2 festivals/);
    expect(screen.getByTestId('day-2031-03-20').props.accessibilityLabel).toMatch(/no festivals/);
  });

  it('every row shows name, date or range, a certainty label, the review status and the regions', async () => {
    await openCalendar();
    expect(screen.getByText('Calendar Test Beta')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_beta-date').props.children).toBe(
      '12 Mar – 16 Mar 2031',
    );
    expect(screen.getByTestId('festival-row-fest_cal_alpha-date').props.children).toBe(
      '14 Mar 2031',
    );
    expect(screen.getByTestId('festival-row-fest_cal_alpha-certainty').props.children).toBe(
      'Date confirmed',
    );
    expect(screen.getByTestId('festival-row-fest_cal_beta-certainty').props.children).toBe(
      'Date varies by region',
    );
    expect(screen.getAllByText('AI draft').length).toBe(3);
    expect(screen.getByText('Mainly observed in: South India')).toBeTruthy();
    expect(screen.getByText('Mainly observed in: Across India')).toBeTruthy();
    expect(screen.getByText('Mainly observed in: North India, West India')).toBeTruthy();
  });

  it('shows a neutral label for a certainty value it does not know, without crashing', async () => {
    await openCalendar();
    expect(screen.getByTestId('festival-row-fest_cal_gamma-certainty').props.children).toBe(
      'Certainty not stated',
    );
  });

  it('selecting a day lists only its festivals; selecting it again shows the month; an empty day says so', async () => {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('day-2031-03-14'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_beta', 'festival-row-fest_cal_alpha']);
    expect(screen.getByTestId('list-title').props.children).toMatch(/Festivals on .*14 March 2031/);
    expect(screen.getByTestId('day-2031-03-14').props.accessibilityState.selected).toBe(true);

    // a day in the middle of the range lists the range festival
    await fireEvent.press(screen.getByTestId('day-2031-03-15'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_beta']);

    await fireEvent.press(screen.getByTestId('day-2031-03-20'));
    expect(screen.getByTestId('day-empty')).toBeTruthy();
    expect(screen.getByText('No festival on this day.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('clear-day'));
    expect(rowIds()).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('day-2031-03-14'));
    await fireEvent.press(screen.getByTestId('day-2031-03-14'));
    expect(rowIds()).toHaveLength(3);
  });

  it('moves across months; a multi-day festival continues into the next month', async () => {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('month-next'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('April 2031');
    expect(await screen.findByTestId('festival-row-fest_cal_gamma')).toBeTruthy();
    expect(rowIds()).toEqual(['festival-row-fest_cal_gamma']);
    expect(screen.getByTestId('span-2031-04-01', hidden)).toBeTruthy();
    expect(screen.getByTestId('span-2031-04-02', hidden)).toBeTruthy();
    expect(screen.queryByTestId('span-2031-04-03', hidden)).toBeNull();

    await fireEvent.press(screen.getByTestId('month-prev'));
    await fireEvent.press(screen.getByTestId('month-prev'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('February 2031');
    expect(await screen.findByTestId('month-no-data')).toBeTruthy();
  });

  it('crosses a year boundary in both directions', async () => {
    await openCalendar();
    for (let i = 0; i < 10; i += 1) await fireEvent.press(screen.getByTestId('month-next'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('January 2032');
    await fireEvent.press(screen.getByTestId('month-prev'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('December 2031');
  });

  it('a month without bundled data shows a clear note and still shows the grid', async () => {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('month-next'));
    await fireEvent.press(screen.getByTestId('month-next'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('May 2031');
    expect(
      await screen.findByText('Dates for this month are not available in this version.'),
    ).toBeTruthy();
    expect(screen.getByTestId('month-grid')).toBeTruthy();
    expect(screen.getByTestId('day-2031-05-31')).toBeTruthy();
    expect(rowIds()).toEqual([]);
    expect(screen.getByTestId('date-note')).toBeTruthy();
  });

  it('"Today" jumps back to today\'s month and selects today', async () => {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('month-next'));
    await fireEvent.press(screen.getByTestId('month-next'));
    await fireEvent.press(screen.getByTestId('jump-today'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('March 2031');
    expect(screen.getByTestId('day-2031-03-10').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('day-empty')).toBeTruthy();
  });
});

describe('Calendar: filters and search', () => {
  it('only offers region and category chips that exist in the catalog', async () => {
    await openCalendar();
    expect(await screen.findByTestId('filter-region-south')).toBeTruthy();
    for (const r of ['north', 'east', 'west']) {
      expect(screen.getByTestId(`filter-region-${r}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('filter-region-central')).toBeNull();
    expect(screen.getByTestId('filter-region-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('filter-category-vrat_fasting')).toBeTruthy();
    expect(screen.queryByTestId('filter-category-yatra_mela')).toBeNull();
  });

  it('a region filter keeps festivals that match any of their regions, and pan_india ones always', async () => {
    await openCalendar();
    await fireEvent.press(await screen.findByTestId('filter-region-south'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_beta', 'festival-row-fest_cal_alpha']);
    await fireEvent.press(screen.getByTestId('filter-region-west'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_alpha', 'festival-row-fest_cal_gamma']);
    await fireEvent.press(screen.getByTestId('filter-region-north'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_alpha', 'festival-row-fest_cal_gamma']);
    await fireEvent.press(screen.getByTestId('filter-region-east'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_alpha']);
  });

  it('a category filter works, also changes the grid markers, and "Clear filters" resets everything', async () => {
    await openCalendar();
    await fireEvent.press(await screen.findByTestId('filter-category-harvest_seasonal'));
    expect(rowIds()).toEqual(['festival-row-fest_cal_beta']);
    expect(screen.getByTestId('day-2031-03-14').props.accessibilityLabel).toMatch(/1 festival$/);
    expect(screen.getByTestId('day-2031-03-31').props.accessibilityLabel).toMatch(/no festivals/);

    await fireEvent.press(screen.getByTestId('clear-filters'));
    expect(rowIds()).toHaveLength(3);
    expect(screen.queryByTestId('clear-filters')).toBeNull();
    expect(screen.getByTestId('filter-category-all').props.accessibilityState.selected).toBe(true);
  });

  it('filters that match nothing show an empty state with a way out', async () => {
    await openCalendar();
    await fireEvent.press(await screen.findByTestId('filter-category-nature_ritual'));
    expect(await screen.findByText('No festivals match')).toBeTruthy();
    expect(rowIds()).toEqual([]);
    await fireEvent.press(screen.getByTestId('clear-filters'));
    expect(rowIds()).toHaveLength(3);
  });

  it('finds a festival by its English or Hindi name', async () => {
    await openCalendar();
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), 'gamma');
    expect(rowIds()).toEqual(['festival-row-fest_cal_gamma']);
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), 'बीटा');
    expect(rowIds()).toEqual(['festival-row-fest_cal_beta']);
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), 'zzzz');
    expect(await screen.findByText('No festivals match')).toBeTruthy();
    expect(screen.getByText('Open All festivals')).toBeTruthy();
  });
});

describe('Calendar: All festivals', () => {
  async function openAll() {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('calendar-view-all'));
    return screen.findByTestId('section-month-3');
  }

  it('groups festivals that have a date by month of the shown year', async () => {
    await openAll();
    expect(screen.getByTestId('year-title').props.children).toBe('2031');
    expect(screen.getByTestId('section-month-3')).toBeTruthy();
    expect(screen.getByTestId('section-month-10')).toBeTruthy();
    expect(screen.getByText('March 2031')).toBeTruthy();
    expect(screen.getByText('October 2031')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_alpha')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_test_lamps')).toBeTruthy();
  });

  it('lists festivals with no date for the year under "Date not available" and never hides them', async () => {
    await openAll();
    expect(screen.getByTestId('section-no-date')).toBeTruthy();
    expect(screen.getByText(/No verified date for 2031 is included in this version/)).toBeTruthy();
    const delta = screen.getByTestId('festival-row-fest_cal_delta');
    expect(delta).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_delta-date').props.children).toBe(
      'Date not available',
    );
    expect(screen.queryByTestId('festival-row-fest_cal_delta-certainty')).toBeNull();
  });

  it('a year without any bundled date says so and still lists every festival', async () => {
    await openAll();
    await fireEvent.press(screen.getByTestId('year-next')); // 2032 has one date (alpha)
    await fireEvent.press(screen.getByTestId('year-next')); // 2033: none
    expect(await screen.findByTestId('year-no-data')).toBeTruthy();
    expect(screen.getByText('Dates for 2033 are not available in this version.')).toBeTruthy();
    expect(screen.queryByTestId('section-month-3')).toBeNull();
    expect(screen.getByTestId('section-no-date')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_alpha')).toBeTruthy();
    expect(screen.getByTestId('list-count').props.children).toBe('5 festivals');
  });

  it('region and category filters and the name search apply here too', async () => {
    await openAll();
    await fireEvent.press(await screen.findByTestId('filter-region-east'));
    expect(screen.getByTestId('festival-row-fest_cal_delta')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_alpha')).toBeTruthy(); // pan_india
    expect(screen.queryByTestId('festival-row-fest_cal_beta')).toBeNull();
    await fireEvent.press(screen.getByTestId('clear-filters'));
    await fireEvent.changeText(screen.getByTestId('calendar-search-input'), 'delta');
    expect(screen.getByTestId('festival-row-fest_cal_delta')).toBeTruthy();
    expect(screen.queryByTestId('festival-row-fest_cal_alpha')).toBeNull();
  });
});

describe('Calendar: opening a festival', () => {
  it('opens the linked puja when there is exactly one, otherwise the Festival Details screen', async () => {
    await openCalendar();
    await fireEvent.press(screen.getByTestId('festival-row-fest_cal_alpha'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/festival/[id]',
      params: { id: 'fest_cal_alpha' },
    });

    await fireEvent.press(screen.getByTestId('month-next'));
    await fireEvent.press(screen.getByTestId('month-next'));
    await fireEvent.press(screen.getByTestId('month-next'));
    for (let i = 0; i < 4; i += 1) await fireEvent.press(screen.getByTestId('month-next'));
    expect(await screen.findByTestId('month-title')).toHaveTextContent('October 2031');
    await fireEvent.press(await screen.findByTestId('festival-row-fest_test_lamps'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
  });
});

describe('Calendar: states and Hindi', () => {
  it('shows a retryable error when the database read fails', async () => {
    const db = await fixtureDb();
    const failing: SqlDb = {
      ...db,
      all: async (sql, params) => {
        if (/calendar_date/.test(sql)) throw new Error('boom');
        return db.all(sql, params);
      },
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderWithDb(<CalendarScreen />, failing);
    expect(await screen.findByTestId('error-title')).toBeTruthy();
    expect(screen.getByTestId('month-grid')).toBeTruthy();
    spy.mockRestore();
  });

  it('renders month and day names, the note, certainty labels and regions in Hindi', async () => {
    await resetSettings('hi');
    await openCalendar();
    const title = screen.getByTestId('month-title').props.children as string;
    expect(title).toBe(formatMonthYear(2031, 3, 'hi'));
    expect(title).toMatch(/[ऀ-ॿ]/);
    expect(screen.getByText(/स्थानीय पंचांग से पुष्टि कर लें/)).toBeTruthy();
    expect(screen.getByText('कैलेंडर परीक्षण बीटा')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_alpha-certainty').props.children).toBe(
      'तारीख़ की पुष्टि हुई',
    );
    expect(screen.getByText('मुख्य रूप से मनाया जाता है: दक्षिण भारत')).toBeTruthy();
    expect(screen.getByTestId('festival-row-fest_cal_gamma-certainty').props.children).toBe(
      'निश्चितता का उल्लेख नहीं',
    );
    expect(screen.getByTestId('day-2031-03-14').props.accessibilityLabel).toMatch(/[ऀ-ॿ]/);
  });
});

describe('Festival Details', () => {
  async function open(id: string, lang: 'en' | 'hi' = 'en') {
    await resetSettings(lang);
    setParams({ id });
    await renderWithDb(<FestivalDetailsScreen />, await fixtureDb());
  }

  it('shows description, regions, observance, dates with certainty, review badge and the disclaimer', async () => {
    await open('fest_cal_beta');
    expect((await screen.findByTestId('festival-name')).props.children).toBe('Calendar Test Beta');
    expect(screen.getByTestId('festival-review-badge')).toBeTruthy();
    expect(screen.getAllByText('TEST FIXTURE, not real content.').length).toBeGreaterThan(0);
    expect(screen.getByTestId('festival-regions').props.children).toBe('South India');
    expect(screen.getByTestId('festival-observance')).toBeTruthy();
    expect(screen.getByTestId('festival-date-text').props.children).toBe('12 Mar – 16 Mar 2031');
    expect(screen.getByText('Date varies by region')).toBeTruthy();
    expect(screen.getByTestId('festival-no-pujas')).toBeTruthy();
    expect(
      screen.getByText(/Vidhi and samagri can differ by region, family tradition/),
    ).toBeTruthy();
  });

  it('a festival without any date says "no date available", never a guess', async () => {
    await open('fest_cal_delta');
    expect(await screen.findByTestId('festival-no-dates')).toBeTruthy();
    expect(screen.queryByTestId('festival-date-text')).toBeNull();
  });

  it('lists linked pujas and opens them', async () => {
    await open('fest_test_lamps');
    await fireEvent.press(await screen.findByTestId('open-puja-puja_test_lakshmi'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
  });

  it('shows the standard disclaimer in Hindi', async () => {
    await open('fest_cal_gamma', 'hi');
    expect(await screen.findByTestId('festival-name')).toBeTruthy();
    expect(screen.getByText(/क्षेत्र, पारिवारिक परंपरा, सम्प्रदाय/)).toBeTruthy();
    expect(screen.getByText('निश्चितता का उल्लेख नहीं')).toBeTruthy();
  });

  it('shows a not-found state for an unknown or retired festival', async () => {
    await open('fest_does_not_exist');
    expect(await screen.findByText('This festival is not available')).toBeTruthy();
  });

  it('treats a deprecated festival as not found', async () => {
    await open('fest_test_old');
    expect(await screen.findByText('This festival is not available')).toBeTruthy();
  });
});
