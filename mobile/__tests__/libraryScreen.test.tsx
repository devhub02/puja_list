import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import { listSavedPujas, recordView, savePuja } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetUserStateStore } from '@/store/userStateStore';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { navigate, push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

beforeEach(async () => {
  resetRouterMock();
  resetUserStateStore();
  await resetSettings('en');
});

async function fixtureDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makeFixtureBundle());
  return db;
}

async function settle(ms = 250) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Library tab', () => {
  it('lists the pujas alphabetically with a count, and hides retired ones', async () => {
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    expect(await screen.findByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
    expect(screen.getByTestId('puja-card-puja_test_vrat')).toBeTruthy();
    expect(screen.queryByTestId('puja-card-puja_test_retired')).toBeNull();
    expect(screen.getByTestId('library-count').props.children).toBe('2 pujas');
    // no month filter: the content has no month data
    expect(screen.queryByText(/month/i)).toBeNull();
  });

  it('filters by category and by festival/household kind, and Clear filters resets', async () => {
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    await screen.findByTestId('puja-card-puja_test_lakshmi');

    await fireEvent.press(screen.getByTestId('filter-category-vrat'));
    expect(screen.queryByTestId('puja-card-puja_test_lakshmi')).toBeNull();
    expect(screen.getByTestId('puja-card-puja_test_vrat')).toBeTruthy();
    expect(screen.getByTestId('filter-category-vrat').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // only categories that contain pujas are offered
    expect(screen.queryByTestId('filter-category-tribal')).toBeNull();

    await fireEvent.press(screen.getByTestId('clear-filters'));
    expect(screen.getByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
    expect(screen.queryByTestId('clear-filters')).toBeNull();

    await fireEvent.press(screen.getByTestId('filter-kind-household'));
    expect(screen.getByText('No pujas match')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('clear-filters'));
    expect(screen.getByTestId('puja-card-puja_test_vrat')).toBeTruthy();
  });

  it('toggling a favorite saves to the database; the Favorites shortcut shows only saved pujas', async () => {
    const db = await fixtureDb();
    await renderWithDb(<LibraryScreen />, db);
    await fireEvent.press(await screen.findByTestId('favorite-puja_test_vrat'));
    await waitFor(async () =>
      expect((await listSavedPujas(db)).map((s) => s.pujaId)).toEqual(['puja_test_vrat']),
    );

    await fireEvent.press(screen.getByTestId('filter-favorites'));
    expect(screen.getByTestId('puja-card-puja_test_vrat')).toBeTruthy();
    expect(screen.queryByTestId('puja-card-puja_test_lakshmi')).toBeNull();

    await fireEvent.press(screen.getByTestId('favorite-puja_test_vrat'));
    expect(await screen.findByText('No favorites yet')).toBeTruthy();
  });

  it('Recently viewed shortcut has an empty state', async () => {
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    await fireEvent.press(await screen.findByTestId('filter-recent'));
    expect(await screen.findByText('Nothing viewed yet')).toBeTruthy();
  });

  it('Recently viewed shortcut lists the viewed pujas', async () => {
    const db = await fixtureDb();
    await recordView(db, 'puja_test_lakshmi', 5);
    await renderWithDb(<LibraryScreen />, db);
    await fireEvent.press(await screen.findByTestId('filter-recent'));
    expect(await screen.findByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
    expect(screen.queryByTestId('puja-card-puja_test_vrat')).toBeNull();
  });

  it('opens the puja details when a card is pressed', async () => {
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    await fireEvent.press(await screen.findByTestId('puja-card-puja_test_vrat'));
    expect(push).toHaveBeenCalledWith({ pathname: '/puja/[id]', params: { id: 'puja_test_vrat' } });
  });

  it('applies the category chosen on Home', async () => {
    setParams({ category: 'vrat', nonce: '1' });
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    expect(await screen.findByTestId('puja-card-puja_test_vrat')).toBeTruthy();
    expect(screen.queryByTestId('puja-card-puja_test_lakshmi')).toBeNull();
  });

  describe('search in place', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('filters the list as you type, combines with filters, shows the samagri hint and a no-results state', async () => {
      await renderWithDb(<LibraryScreen />, await fixtureDb());
      const input = screen.getByTestId('library-search-input');

      await fireEvent.changeText(input, 'diya');
      await settle();
      expect(await screen.findByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
      expect(screen.queryByTestId('puja-card-puja_test_vrat')).toBeNull();
      expect(screen.getByText('Contains: Test Lamp')).toBeTruthy();

      // combined with a filter that excludes the match -> no results (and the query is kept)
      await fireEvent.press(screen.getByTestId('filter-category-vrat'));
      expect(await screen.findByText('No results for “diya”')).toBeTruthy();
      expect(screen.getByTestId('library-search-input').props.value).toBe('diya');

      await fireEvent.press(screen.getByTestId('clear-filters'));
      expect(screen.getByTestId('library-search-input').props.value).toBe('');
      expect(await screen.findByTestId('puja-card-puja_test_vrat')).toBeTruthy();
    });
  });
});

describe('Home tab', () => {
  it('shows brand, today, search launcher, featured, six categories, empty saved/recent hints', async () => {
    await renderWithDb(<HomeScreen />, await fixtureDb());
    expect(await screen.findByText('Puja Saathi')).toBeTruthy();
    expect(screen.getByText('Har Puja Ki Samagri, Vidhi Aur Taiyari')).toBeTruthy();
    expect(screen.getByTestId('home-date').props.children).toMatch(/2\d{3}/);
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.getByTestId('featured-puja_test_lakshmi')).toBeTruthy();
    for (const c of ['festival', 'vrat', 'household', 'life_cycle', 'regional', 'tribal']) {
      expect(screen.getByTestId(`category-card-${c}`)).toBeTruthy();
    }
    expect(screen.getByText('Tap the heart on any puja to keep it here.')).toBeTruthy();
    expect(screen.getByText('Pujas you open will appear here.')).toBeTruthy();
    // no calendar data -> no fake "Upcoming festivals" section
    expect(screen.queryByText(/upcoming/i)).toBeNull();
  });

  it('the search bar opens the Search screen; a category card opens the Library filtered', async () => {
    await renderWithDb(<HomeScreen />, await fixtureDb());
    await fireEvent.press(await screen.findByTestId('search-bar'));
    expect(push).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByTestId('category-card-vrat'));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/library',
        params: expect.objectContaining({ category: 'vrat' }),
      }),
    );
  });

  it('shows saved and recently viewed pujas from the database, hiding ids that no longer exist', async () => {
    const db = await fixtureDb();
    await savePuja(db, 'puja_test_vrat', 1);
    await savePuja(db, 'puja_removed_long_ago', 2);
    await recordView(db, 'puja_test_lakshmi', 3);
    await renderWithDb(<HomeScreen />, db);
    expect(await screen.findByTestId('saved-puja_test_vrat')).toBeTruthy();
    expect(screen.queryByTestId('saved-puja_removed_long_ago')).toBeNull();
    expect(screen.getByTestId('recent-puja_test_lakshmi')).toBeTruthy();
    expect(screen.queryByText('Tap the heart on any puja to keep it here.')).toBeNull();
  });

  it('renders in Hindi', async () => {
    await resetSettings('hi');
    await renderWithDb(<HomeScreen />, await fixtureDb());
    expect(await screen.findByText('पूजा साथी')).toBeTruthy();
    expect(screen.getByText('आज')).toBeTruthy();
    expect(await screen.findByText('चुनी हुई पूजाएँ')).toBeTruthy();
    expect(screen.getByText('श्रेणी के अनुसार देखें')).toBeTruthy();
    expect(within(screen.getByTestId('category-card-vrat')).getByText('व्रत')).toBeTruthy();
  });
});
