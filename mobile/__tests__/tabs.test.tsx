import { fireEvent } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../app/(tabs)/_layout';
import HomeScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import PreparationScreen from '../app/(tabs)/preparation';
import SettingsScreen from '../app/(tabs)/settings';
import { TestProviders, resetSettings } from '../testing/utils';

const routes = {
  _layout: () => (
    <TestProviders>
      <Slot />
    </TestProviders>
  ),
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/library': LibraryScreen,
  '(tabs)/preparation': PreparationScreen,
  '(tabs)/settings': SettingsScreen,
};

describe('bottom tabs', () => {
  it('renders four tabs with English titles', async () => {
    await resetSettings('en');
    await renderRouter(routes, { initialUrl: '/' });
    for (const title of ['Home', 'Library', 'My Preparation', 'Settings']) {
      expect(await screen.findByLabelText(title)).toBeTruthy();
    }
  });

  it('renders four tabs with Hindi titles', async () => {
    await resetSettings('hi');
    await renderRouter(routes, { initialUrl: '/' });
    for (const title of ['होम', 'लाइब्रेरी', 'मेरी तैयारी', 'सेटिंग्स']) {
      expect(await screen.findByLabelText(title)).toBeTruthy();
    }
  });

  it('navigates to Library and shows its translated empty state', async () => {
    await resetSettings('en');
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText('Library'));
    expect(await screen.findByText('The puja library is being prepared')).toBeTruthy();
  });
});
