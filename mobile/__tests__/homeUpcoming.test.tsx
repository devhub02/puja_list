import { fireEvent, screen } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';

import { makeCalendarBundle } from '../testing/calendarFixture';
import { setToday } from '../testing/dateMock';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { navigate, push, resetRouterMock } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock);
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

// All dates are TEST FIXTURE dates in 2031 (see testing/calendarFixture.ts), not real dates.

beforeEach(async () => {
  resetRouterMock();
  setToday('2031-03-10');
  await resetSettings('en');
});

async function db(overrides: Partial<ContentBundle> = {}) {
  const database = createMigratedDb();
  await seedContentIfNeeded(database, { ...makeCalendarBundle(), ...overrides });
  return database;
}

describe('Home: upcoming festivals', () => {
  it('is hidden completely when no date is bundled', async () => {
    await renderWithDb(<HomeScreen />, await db({ calendar: [] }));
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-section')).toBeNull();
    expect(screen.queryByText('Upcoming festivals')).toBeNull();
    expect(screen.queryByTestId('see-calendar')).toBeNull();
  });

  it('is hidden when every bundled date is already over', async () => {
    setToday('2033-01-01');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-section')).toBeNull();
  });

  it('shows the next festivals from today with date or range, certainty label and a See calendar link', async () => {
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByTestId('upcoming-section')).toBeTruthy();
    expect(screen.getByText('Upcoming festivals')).toBeTruthy();
    const ids = screen
      .getAllByTestId(/^upcoming-fest_[a-z_]+$/)
      .map((n) => n.props.testID as string);
    expect(ids).toEqual([
      'upcoming-fest_cal_beta',
      'upcoming-fest_cal_alpha',
      'upcoming-fest_cal_gamma',
      'upcoming-fest_test_lamps',
    ]);
    expect(screen.getByTestId('upcoming-fest_cal_alpha-date').props.children).toBe('14 Mar 2031');
    expect(screen.getByTestId('upcoming-fest_cal_beta-date').props.children).toBe(
      '12 Mar – 16 Mar 2031',
    );
    expect(screen.getByTestId('upcoming-fest_cal_alpha-certainty').props.children).toBe(
      'Date confirmed',
    );
    // not a puja: no "Mainly observed in" line on the compact Home rows
    expect(screen.queryByText(/Mainly observed in/)).toBeNull();

    await fireEvent.press(screen.getByTestId('see-calendar'));
    expect(navigate).toHaveBeenCalledWith('/calendar');
  });

  it('includes a festival that is on right now (ongoing) and marks it', async () => {
    setToday('2031-03-13');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByTestId('upcoming-fest_cal_beta')).toBeTruthy();
    expect(screen.getAllByText('Ongoing').length).toBe(1);
  });

  it('drops a festival the day after it ends', async () => {
    setToday('2031-03-17');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByTestId('upcoming-fest_cal_gamma')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-fest_cal_beta')).toBeNull();
    // alpha's 2031 date is over, so its next bundled date (2032) is shown instead
    expect(screen.getByTestId('upcoming-fest_cal_alpha-date').props.children).toBe('3 Mar 2032');
  });

  it('shows at most five festivals', async () => {
    const bundle = makeCalendarBundle();
    const base = bundle.festivals.find((f) => f.id === 'fest_cal_alpha');
    if (!base) throw new Error('fixture changed');
    const extra = [1, 2, 3, 4].map((n) => ({
      ...base,
      id: `fest_cal_extra_${n}`,
      name: { en: `Extra ${n}`, hi: `अतिरिक्त ${n}` },
    }));
    const calendar = [
      {
        year: 2031,
        entries: [
          ...bundle.calendar[0].entries,
          ...extra.map((f, i) => ({
            id: `cal_extra_${i}`,
            festivalId: f.id,
            date: `2031-06-0${i + 1}`,
            certainty: 'provisional' as const,
          })),
        ],
      },
      bundle.calendar[1],
    ];
    const database = createMigratedDb();
    await seedContentIfNeeded(database, {
      ...bundle,
      festivals: [...bundle.festivals, ...extra],
      calendar,
    });
    await renderWithDb(<HomeScreen />, database);
    await screen.findByTestId('upcoming-section');
    expect(screen.getAllByTestId(/^upcoming-fest_[a-z_0-9]+$/)).toHaveLength(5);
  });

  it('opens Festival Details for a calendar-only festival and the puja for a linked one', async () => {
    await renderWithDb(<HomeScreen />, await db());
    await fireEvent.press(await screen.findByTestId('upcoming-fest_cal_alpha'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/festival/[id]',
      params: { id: 'fest_cal_alpha' },
    });
    await fireEvent.press(screen.getByTestId('upcoming-fest_test_lamps'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
  });

  it('shows month names and the certainty label in Hindi', async () => {
    await resetSettings('hi');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByText('आने वाले पर्व')).toBeTruthy();
    expect(screen.getByText('कैलेंडर देखें')).toBeTruthy();
    expect(screen.getByTestId('upcoming-fest_cal_alpha-certainty').props.children).toBe(
      'तारीख़ की पुष्टि हुई',
    );
    expect(screen.getByTestId('upcoming-fest_cal_alpha-date').props.children).toMatch(/[ऀ-ॿ]/);
  });
});

describe('Library: next date on cards', () => {
  it('shows a light "Next:" line only for a puja whose festival has an upcoming bundled date', async () => {
    await renderWithDb(<LibraryScreen />, await db());
    expect(await screen.findByTestId('next-date-puja_test_lakshmi')).toBeTruthy();
    expect(screen.getByTestId('next-date-puja_test_lakshmi').props.children).toBe(
      'Next: 30 Oct – 2 Nov 2031 · Provisional date',
    );
    // a puja with no festival has no date line
    expect(screen.queryByTestId('next-date-puja_test_vrat')).toBeNull();
  });

  it('shows no date line at all when no date is bundled', async () => {
    await renderWithDb(<LibraryScreen />, await db({ calendar: [] }));
    expect(await screen.findByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
    expect(screen.queryByTestId('next-date-puja_test_lakshmi')).toBeNull();
  });
});
