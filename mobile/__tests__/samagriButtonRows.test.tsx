import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import SamagriScreen from '../app/puja/[id]/samagri';
import { seedContentIfNeeded } from '@/db/seed';
import { useSettingsStore } from '@/store/settingsStore';
import { resetPreparationStore } from '@/store/preparationStore';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

/**
 * Regression for the button-row rule (docs/DESIGN_SYSTEM.md, "Button rows"): on Samagri the action buttons and the
 * "Remind me" pill share a row. At large text they must wrap or take a full line, never squeeze a label mid-word.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('Samagri button rows', () => {
  beforeEach(async () => {
    resetRouterMock();
    resetPreparationStore();
    await resetSettings('en');
  });

  it.each([
    ['English, medium text', 'en', 'medium'],
    ['English, extra-large text', 'en', 'extraLarge'],
    ['Hindi, medium text', 'hi', 'medium'],
    ['Hindi, extra-large text', 'hi', 'extraLarge'],
  ] as const)(
    'wraps the action row and the header, keeping every button whole (%s)',
    async (_n, language, size) => {
      await resetSettings(language);
      useSettingsStore.setState({ textSize: size });
      const db = createMigratedDb();
      await seedContentIfNeeded(db, makePreparationBundle());
      setParams({ id: RICH_ID });
      await renderWithDb(<SamagriScreen />, db);
      await screen.findByTestId('overall-text');

      expect(flat('samagri-actions').flexWrap).toBe('wrap');
      for (const id of ['add-item', 'reset-checklist']) {
        expect(flat(id).flexShrink).toBe(0);
      }
      expect(flat('remind-me').flexWrap).toBe('wrap');
      expect(flat('remind-me').flexShrink).toBe(1);
      expect(screen.getByTestId('share-checklist')).toBeTruthy();
      expect(screen.getByTestId('samagri-back')).toBeTruthy();
    },
  );
});
