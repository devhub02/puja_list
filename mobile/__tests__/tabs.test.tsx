import { fireEvent } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../app/(tabs)/_layout';
import HomeScreen from '../app/(tabs)/index';
import CalendarScreen from '../app/(tabs)/calendar';
import LibraryScreen from '../app/(tabs)/library';
import PreparationScreen from '../app/(tabs)/preparation';
import SettingsScreen from '../app/(tabs)/settings';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { seedContentIfNeeded } from '@/db/seed';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { TestProviders, resetSettings } from '../testing/utils';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const db = createMigratedDb();
const seeded = seedContentIfNeeded(db, makeFixtureBundle());

const routes = {
  _layout: () => (
    <TestProviders>
      <DatabaseProvider db={db}>
        <Slot />
      </DatabaseProvider>
    </TestProviders>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/library': LibraryScreen,
  '(tabs)/calendar': CalendarScreen,
  '(tabs)/preparation': PreparationScreen,
  '(tabs)/settings': SettingsScreen,
};

describe('bottom tabs', () => {
  it('renders five tabs with English titles', async () => {
    await resetSettings('en');
    await renderRouter(routes, { initialUrl: '/' });
    for (const title of ['Home', 'Library', 'Calendar', 'My Preparation', 'Settings']) {
      expect(await screen.findByLabelText(title)).toBeTruthy();
    }
  });

  it('renders five tabs with Hindi titles', async () => {
    await resetSettings('hi');
    await renderRouter(routes, { initialUrl: '/' });
    for (const title of ['होम', 'लाइब्रेरी', 'कैलेंडर', 'मेरी तैयारी', 'सेटिंग्स']) {
      expect(await screen.findByLabelText(title)).toBeTruthy();
    }
  });

  it('navigates to Library and lists the pujas from the database', async () => {
    await seeded;
    await resetSettings('en');
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText('Library'));
    expect(await screen.findByTestId('library-count')).toBeTruthy();
    expect(await screen.findByTestId('puja-card-puja_test_lakshmi')).toBeTruthy();
  });

  it('opens the Calendar tab', async () => {
    await seeded;
    await resetSettings('en');
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText('Calendar'));
    expect(await screen.findByTestId('month-grid')).toBeTruthy();
    expect(screen.getByTestId('date-note')).toBeTruthy();
  });
});
