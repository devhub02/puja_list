import { fireEvent, screen, within } from '@testing-library/react-native';

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

describe('Home: next festival hero', () => {
  it('is hidden completely when no date is bundled', async () => {
    await renderWithDb(<HomeScreen />, await db({ calendar: [] }));
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-section')).toBeNull();
    expect(screen.queryByTestId('next-festival-card')).toBeNull();
    expect(screen.queryByTestId('see-calendar')).toBeNull();
  });

  it('is hidden when every bundled date is already over', async () => {
    setToday('2033-01-01');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-section')).toBeNull();
  });

  it('shows ONE card with name, range, countdown and certainty, and no review badge', async () => {
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByTestId('next-festival-card')).toBeTruthy();
    expect(screen.getAllByTestId('next-festival-card')).toHaveLength(1);
    expect(screen.getByText('Next festival')).toBeTruthy();
    expect(screen.getByTestId('next-festival-name').props.children).toBe('Calendar Test Beta');
    expect(screen.getByTestId('next-festival-date').props.children).toBe('12 Mar – 16 Mar 2031');
    expect(screen.getByTestId('next-festival-countdown').props.children).toBe('In 2 days');
    expect(screen.getByTestId('next-festival-certainty').props.children).toBe(
      'Date varies by region',
    );
    // the fixture festivals are all ai_drafted, but the hero never shows the review badge
    const card = screen.getByTestId('next-festival-card');
    expect(within(card).queryByText('AI draft')).toBeNull();
    expect(screen.queryByText('AI draft')).toBeNull();
    // one card only: no list of other festivals on Home
    expect(screen.queryByTestId('upcoming-fest_cal_alpha')).toBeNull();
    expect(screen.getByTestId('next-festival-card').props.accessibilityLabel).toMatch(
      /Next festival: Calendar Test Beta\. 12 Mar – 16 Mar 2031\. In 2 days\. Date varies by region/,
    );
  });

  it('under the card, See calendar says how many OTHER festivals fall in the next 30 days', async () => {
    await renderWithDb(<HomeScreen />, await db());
    // alpha (14 Mar) and gamma (31 Mar); beta is the hero; lamps is months away
    expect((await screen.findByTestId('more-soon')).props.children).toBe(
      '2 more in the next 30 days',
    );
    expect(screen.getByText('See calendar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('see-calendar'));
    expect(navigate).toHaveBeenCalledWith('/calendar');
  });

  it('hides the count (not the link) when no other festival is in the next 30 days', async () => {
    setToday('2031-10-31'); // lamps is ongoing; alpha's next date is in March 2032
    await renderWithDb(<HomeScreen />, await db());
    expect((await screen.findByTestId('next-festival-name')).props.children).toBe(
      'Test Festival of Lamps',
    );
    expect(screen.queryByTestId('more-soon')).toBeNull();
    expect(screen.queryByText(/more in the next 30 days/)).toBeNull();
    expect(screen.getByTestId('see-calendar')).toBeTruthy();
  });

  it('shows "Ongoing" for a festival that is on, and "Starts today" on its first day', async () => {
    setToday('2031-03-13');
    const first = await renderWithDb(<HomeScreen />, await db());
    expect((await screen.findByTestId('next-festival-countdown')).props.children).toBe('Ongoing');
    await first.unmount();

    setToday('2031-03-12');
    await renderWithDb(<HomeScreen />, await db());
    expect((await screen.findByTestId('next-festival-countdown')).props.children).toBe(
      'Starts today',
    );
  });

  it('says "In 1 day" the day before', async () => {
    setToday('2031-03-11');
    await renderWithDb(<HomeScreen />, await db());
    expect((await screen.findByTestId('next-festival-countdown')).props.children).toBe('In 1 day');
  });

  it('opens Festival Details for a calendar-only festival and the puja for a linked one', async () => {
    const first = await renderWithDb(<HomeScreen />, await db());
    await fireEvent.press(await screen.findByTestId('next-festival-card'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/festival/[id]',
      params: { id: 'fest_cal_beta' },
    });
    await first.unmount();

    setToday('2031-10-31');
    await renderWithDb(<HomeScreen />, await db());
    await fireEvent.press(await screen.findByTestId('next-festival-card'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
  });

  it('prefers a festival with a puja guide over a calendar-only one that starts the same day', async () => {
    const bundle = makeCalendarBundle();
    // lamps (linked puja) and alpha (calendar-only, pan_india) now both start on 2031-03-12... beta too
    const calendar = [
      {
        year: 2031,
        entries: [
          ...bundle.calendar[0].entries.filter((e) => e.festivalId !== 'fest_test_lamps'),
          {
            id: 'cal_tie_lamps',
            festivalId: 'fest_test_lamps',
            date: '2031-03-12',
            certainty: 'provisional' as const,
          },
        ],
      },
      bundle.calendar[1],
    ];
    await renderWithDb(<HomeScreen />, await db({ calendar }));
    expect((await screen.findByTestId('next-festival-name')).props.children).toBe(
      'Test Festival of Lamps',
    );
  });

  it('shows month names, the countdown and the count in Hindi', async () => {
    await resetSettings('hi');
    await renderWithDb(<HomeScreen />, await db());
    expect(await screen.findByText('अगला पर्व')).toBeTruthy();
    expect(screen.getByText('कैलेंडर देखें')).toBeTruthy();
    expect(screen.getByTestId('next-festival-countdown').props.children).toBe('2 दिन में');
    expect(screen.getByTestId('more-soon').props.children).toBe('अगले 30 दिनों में 2 और पर्व');
    expect(screen.getByTestId('next-festival-certainty').props.children).toBe(
      'तारीख़ क्षेत्र के अनुसार बदलती है',
    );
    expect(screen.getByTestId('next-festival-date').props.children).toMatch(/[\u0900-\u097F]/);
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
