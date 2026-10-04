import { act, fireEvent, screen } from '@testing-library/react-native';

import SamagriScreen from '../app/puja/[id]/samagri';
import VidhiScreen from '../app/puja/[id]/vidhi';
import bundledJson from '../assets/puja_data/content.json';
import { createPreparation } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';
import { resetPreparationStore } from '@/store/preparationStore';
import { extractSafetyNotes } from '@/utils/pujaDisplay';

import { createMigratedDb } from '../testing/nodeSqlDb';
import { resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const bundled = bundledJson as unknown as ContentBundle;

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  await resetSettings('en');
});

describe('REAL exported content.json', () => {
  it('has 16 pujas and every vidhi related-samagri id resolves to that puja’s own list', () => {
    expect(bundled.pujas).toHaveLength(16);
    for (const puja of bundled.pujas) {
      const own = new Set(puja.samagri.map((s) => s.samagriId));
      const catalogue = new Set(bundled.samagri.map((s) => s.id));
      for (const step of puja.steps) {
        for (const id of step.relatedSamagriIds) {
          expect({ puja: puja.id, step: step.id, id, inOwnList: own.has(id) }).toEqual({
            puja: puja.id,
            step: step.id,
            id,
            inOwnList: true,
          });
          expect(catalogue.has(id)).toBe(true);
        }
      }
    }
  });

  describe.each(bundled.pujas.map((p) => [p.id, p] as const))('%s', (id, puja) => {
    it('renders the Samagri screen with every item in its own group and no crash', async () => {
      const db = createMigratedDb();
      await seedContentIfNeeded(db, bundled);
      await createPreparation(db, { pujaId: id });
      setParams({ id });
      await renderWithDb(<SamagriScreen />, db);
      expect(await screen.findByTestId('overall-text')).toBeTruthy();

      const total = puja.samagri.length;
      expect(screen.getByTestId('overall-text').props.children).toBe(`0 of ${total} items checked`);
      const required = puja.samagri.filter((s) => s.classification === 'REQUIRED').length;
      expect(screen.getByTestId('required-text').props.children).toBe(
        required === 0
          ? 'No required items are listed for this puja'
          : `Required items: 0 of ${required}`,
      );
      // every section counter that is on screen matches the puja's own classification (the list is
      // virtualised, so a section far down may not be rendered yet; the overall/required lines above
      // already cover the totals)
      for (const c of ['REQUIRED', 'COMMON', 'OPTIONAL'] as const) {
        const n = puja.samagri.filter((s) => s.classification === c).length;
        const count = screen.queryByTestId(`section-${c}-count`);
        if (n > 0 && count) expect(count.props.children).toBe(`0/${n}`);
        if (n === 0) expect(count).toBeNull();
      }
      expect(screen.getByTestId('section-REQUIRED-count').props.children).toBe(`0/${required}`);
      // the draft label and the disclaimer are visible
      expect(screen.getByTestId('review-badge')).toBeTruthy();
      expect(screen.getByTestId('disclaimer')).toBeTruthy();

      // ticking the first required item changes only the required counter
      const firstRequired = puja.samagri.find((s) => s.classification === 'REQUIRED');
      if (firstRequired) {
        await fireEvent.press(screen.getByTestId(`check-samagri:${firstRequired.samagriId}`));
        await screen.findByText(`Required items: 1 of ${required}`);
        expect(screen.getByTestId('overall-text').props.children).toBe(
          `1 of ${total} items checked`,
        );
      }
    });

    it('renders every vidhi step, shows the safety notes first and resolves each related-samagri chip', async () => {
      const db = createMigratedDb();
      await seedContentIfNeeded(db, bundled);
      const prep = await createPreparation(db, { pujaId: id });
      setParams({ id, prep: prep.id });
      await renderWithDb(<VidhiScreen />, db);
      await screen.findByTestId('step-counter');

      const safety = extractSafetyNotes(puja.steps);
      if (safety.length > 0) {
        expect(screen.getByTestId('safety-intro')).toBeTruthy();
        expect(screen.getByTestId('open-safety')).toBeTruthy();
        await fireEvent.press(screen.getByTestId('safety-start'));
      }
      const names = new Map(bundled.samagri.map((s) => [s.id, s.name.en]));
      for (let i = 0; i < puja.steps.length; i += 1) {
        const step = puja.steps[i];
        expect(screen.getByTestId('step-counter').props.children).toBe(
          `Step ${i + 1} of ${puja.steps.length}`,
        );
        expect(screen.getByTestId('step-title').props.children).toBe(step.title.en);
        expect(screen.getByTestId('step-description').props.children).toBe(step.description.en);
        expect(Boolean(screen.queryByTestId('optional-marker'))).toBe(step.isOptional);
        expect(Boolean(screen.queryByTestId('important-note'))).toBe(Boolean(step.importantNote));
        // one chip per related id, showing that item's real name
        const chips = screen.queryAllByTestId(/^related-(?!samagri$)/);
        expect(chips).toHaveLength(step.relatedSamagriIds.length);
        for (const related of step.relatedSamagriIds) {
          expect(screen.getByTestId(`related-${related}`).props.accessibilityLabel).toBe(
            names.get(related),
          );
        }
        if (i < puja.steps.length - 1) {
          await fireEvent.press(screen.getByTestId('next-step'));
        }
      }
      await fireEvent.press(screen.getByTestId('next-step')); // Finish
      expect(await screen.findByTestId('completed')).toBeTruthy();
    });
  });

  it('Samagri and Vidhi also render in Hindi for every puja without crashing', async () => {
    await resetSettings('hi');
    const db = createMigratedDb();
    await seedContentIfNeeded(db, bundled);
    for (const puja of bundled.pujas) {
      resetPreparationStore();
      setParams({ id: puja.id });
      const samagri = await renderWithDb(<SamagriScreen />, db);
      expect(await screen.findByTestId('overall-text')).toBeTruthy();
      await samagri.unmount();
      const vidhi = await renderWithDb(<VidhiScreen />, db);
      expect(await screen.findByTestId('step-counter')).toBeTruthy();
      await vidhi.unmount();
    }
    await act(async () => undefined);
  });
});
