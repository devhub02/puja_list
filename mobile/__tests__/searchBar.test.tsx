import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import SearchScreen from '../app/search';
import { SearchBar } from '@/components/SearchBar';
import { listRecentSearches } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetUserStateStore } from '@/store/userStateStore';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { push, resetRouterMock } from '../testing/routerMock';
import { renderThemed, renderWithDb, resetSettings } from '../testing/utils';

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

/** Lets the debounce (200 ms) and the database read finish. */
async function settle(ms = 250) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('SearchBar component', () => {
  function Harness({ onSubmit }: { onSubmit?: (t: string) => void }) {
    const [text, setText] = useState('');
    return <SearchBar value={text} onChangeText={setText} onSubmit={onSubmit} />;
  }

  it('types, shows a clear (X) button only when there is text, and clears', async () => {
    await renderThemed(<Harness />);
    expect(screen.queryByTestId('search-bar-clear')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('search-bar-input'), 'ganesh');
    expect(screen.getByTestId('search-bar-input').props.value).toBe('ganesh');
    await fireEvent.press(screen.getByTestId('search-bar-clear'));
    expect(screen.getByTestId('search-bar-input').props.value).toBe('');
    expect(screen.queryByTestId('search-bar-clear')).toBeNull();
  });

  it('submits with the keyboard search action and has an accessible label', async () => {
    const onSubmit = jest.fn();
    await renderThemed(<Harness onSubmit={onSubmit} />);
    const input = screen.getByTestId('search-bar-input');
    expect(input.props.accessibilityLabel).toBe('Search pujas');
    expect(input.props.returnKeyType).toBe('search');
    await fireEvent.changeText(input, 'diya');
    await fireEvent(input, 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('diya');
  });

  it('launcher mode is a single button that does not open the keyboard', async () => {
    const onPress = jest.fn();
    await renderThemed(<SearchBar value="" onPress={onPress} placeholder="Search here" />);
    expect(screen.queryByTestId('search-bar-input')).toBeNull();
    const button = screen.getByRole('button', { name: 'Search here' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Search screen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows recent searches (with Clear all) only while the text is empty', async () => {
    const db = await fixtureDb();
    const { recordSearch } = jest.requireActual('@/db/repositories');
    await recordSearch(db, 'laxmi', 1);
    await renderWithDb(<SearchScreen />, db);
    await settle(1);

    expect(await screen.findByTestId('recent-searches')).toBeTruthy();
    expect(screen.getByText('laxmi')).toBeTruthy();
    expect(screen.getByText('Clear all')).toBeTruthy();
    expect(screen.getByTestId('search-suggestions')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'lak');
    expect(screen.queryByTestId('recent-searches')).toBeNull();
    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('clear-all removes recent searches from the screen and the database', async () => {
    const db = await fixtureDb();
    const { recordSearch } = jest.requireActual('@/db/repositories');
    await recordSearch(db, 'laxmi', 1);
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.press(await screen.findByTestId('clear-recent-searches'));
    await settle(1);
    expect(screen.queryByTestId('recent-searches')).toBeNull();
    expect(await listRecentSearches(db)).toEqual([]);
  });

  it('debounces: no results at 100 ms, results after 200 ms of silence', async () => {
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    const input = screen.getByTestId('search-screen-bar-input');

    await fireEvent.changeText(input, 'l');
    await fireEvent.changeText(input, 'la');
    await fireEvent.changeText(input, 'lakshmi');
    await settle(100);
    expect(screen.queryByTestId('search-instant')).toBeNull();
    expect(screen.getByText('Searching…')).toBeTruthy();

    await settle(150);
    expect(await screen.findByTestId('search-instant')).toBeTruthy();
    expect(screen.getByText('Lakshmi Puja (test)')).toBeTruthy();
  });

  it('typing alone does not write a recent search; opening a result does, and navigates', async () => {
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'lakshmi');
    await settle();
    expect(await listRecentSearches(db)).toEqual([]);

    await fireEvent.press(await screen.findByTestId('search-result-puja_test_lakshmi'));
    await settle(1);
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
    await waitFor(async () => expect(await listRecentSearches(db)).toEqual(['lakshmi']));
  });

  it('the keyboard search key records the search and opens the full results list, keeping the text', async () => {
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    const input = screen.getByTestId('search-screen-bar-input');
    await fireEvent.changeText(input, 'लक्ष्मी');
    await settle();
    await fireEvent(input, 'submitEditing');
    await settle(1);
    expect(await screen.findByTestId('search-results')).toBeTruthy();
    expect(screen.getByTestId('search-screen-bar-input').props.value).toBe('लक्ष्मी');
    await waitFor(async () => expect(await listRecentSearches(db)).toEqual(['लक्ष्मी']));
  });

  it('a samagri match shows which puja contains it', async () => {
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'diya');
    await settle();
    expect(await screen.findByText('Test Lamp')).toBeTruthy();
    expect(screen.getByText('Found in: Lakshmi Puja (test)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-result-puja_test_lakshmi'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]',
      params: { id: 'puja_test_lakshmi' },
    });
  });

  it('shows a helpful no-results message and clearing returns to the recent/suggestion view', async () => {
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'zzzqqq');
    await settle();
    expect(await screen.findByText('No results for “zzzqqq”')).toBeTruthy();
    expect(screen.getByText(/search for a samagri item such as diya/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('search-screen-bar-clear'));
    expect(screen.getByTestId('search-screen-bar-input').props.value).toBe('');
    expect(screen.queryByText('No results for “zzzqqq”')).toBeNull();
    expect(screen.getByTestId('search-suggestions')).toBeTruthy();
  });

  it('no-results message is shown in Hindi', async () => {
    await resetSettings('hi');
    const db = await fixtureDb();
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'zzzqqq');
    await settle();
    expect(await screen.findByText('“zzzqqq” के लिए कुछ नहीं मिला')).toBeTruthy();
  });

  it('shows at most six instant suggestions, plus a "see all results" action', async () => {
    const db = createMigratedDb();
    const base = makeFixtureBundle();
    const extra = Array.from({ length: 9 }, (_, i) => ({
      ...base.pujas[1],
      id: `puja_many_${i}`,
      name: { en: `Many Puja ${i}` },
    }));
    await seedContentIfNeeded(db, { ...base, pujas: [...base.pujas, ...extra] });
    await renderWithDb(<SearchScreen />, db);
    await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), 'many');
    await settle();
    expect(await screen.findByTestId('search-instant')).toBeTruthy();
    expect(screen.getAllByTestId(/^search-result-/)).toHaveLength(6);
    await fireEvent.press(screen.getByTestId('see-all-results'));
    await settle(1);
    expect(await screen.findByTestId('search-results')).toBeTruthy();
    expect(screen.getAllByTestId(/^search-result-/)).toHaveLength(9);
  });
});
