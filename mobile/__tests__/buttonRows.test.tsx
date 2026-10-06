import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { PreparationCard } from '@/components/PreparationCard';
import type { PreparationSummary } from '@/db/repositories';
import { useSettingsStore } from '@/store/settingsStore';

import { renderThemed, resetSettings } from '../testing/utils';

/**
 * Regression for the My Preparation layout bug: the "Checklist" and "Vidhi" buttons broke words mid-word because
 * the card squeezed them into thirds of a 360dp row. The rule (docs/DESIGN_SYSTEM.md, "Button rows"): the action
 * row wraps, and each text button keeps its natural width, so a label never breaks inside a word.
 */
const count = (checked: number, total: number) => ({ checked, total });
const summary: PreparationSummary = {
  id: 'prep_1',
  pujaId: 'puja_ganesh',
  title: null,
  createdAt: 0,
  updatedAt: 0,
  lastOpenedAt: 0,
  progress: {
    required: count(1, 4),
    common: count(0, 4),
    optional: count(0, 4),
    custom: count(0, 0),
    overall: count(1, 12),
    percent: 8,
  },
  vidhi: null,
};

async function renderCard(language: 'en' | 'hi', textSize: 'medium' | 'extraLarge') {
  useSettingsStore.setState({ textSize });
  return await renderThemed(
    <PreparationCard
      summary={summary}
      pujaName="Ganesh Chaturthi Puja"
      language={language}
      onOpenChecklist={jest.fn()}
      onOpenVidhi={jest.fn()}
      onMore={jest.fn()}
      onRemind={jest.fn()}
    />,
  );
}

const flat = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

describe('My Preparation action row', () => {
  beforeEach(() => resetSettings('en'));

  it.each([
    ['English, medium text', 'en', 'medium'],
    ['English, extra-large text', 'en', 'extraLarge'],
    ['Hindi, medium text', 'hi', 'medium'],
    ['Hindi, extra-large text', 'hi', 'extraLarge'],
  ] as const)(
    'wraps the row and keeps both text buttons at their natural width (%s)',
    async (_name, language, size) => {
      await resetSettings(language);
      await renderCard(language, size);

      expect(flat('prep-actions-prep_1').flexWrap).toBe('wrap');
      for (const id of ['prep-open-prep_1', 'prep-vidhi-open-prep_1']) {
        const style = flat(id);
        expect(style.flexShrink).toBe(0);
        expect(style.flexGrow).toBe(1);
      }
      expect(screen.getByTestId('prep-remind-prep_1')).toBeTruthy();
      expect(screen.getByTestId('prep-more-prep_1')).toBeTruthy();
    },
  );
});
