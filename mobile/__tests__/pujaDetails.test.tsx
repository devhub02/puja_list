import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import PujaDetailsScreen from '../app/puja/[id]';
import {
  createPreparation,
  listPreparations,
  listRecentViews,
  listSavedPujas,
  setItemChecked,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetPreparationStore } from '@/store/preparationStore';
import { resetUserStateStore } from '@/store/userStateStore';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { back, navigate, push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  resetUserStateStore();
  await resetSettings('en');
});

async function fixtureDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makeFixtureBundle());
  return db;
}

describe('Puja details', () => {
  it('shows name, secondary language, intro, significance, variations, counts, disclaimer and the review badge', async () => {
    setParams({ id: 'puja_test_lakshmi' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());

    expect((await screen.findByTestId('details-name')).props.children).toBe('Lakshmi Puja (test)');
    expect(screen.getByTestId('details-other-name').props.children).toBe('लक्ष्मी पूजा (परीक्षण)');
    expect(screen.getByText('About this puja')).toBeTruthy();
    expect(screen.getByText('Significance')).toBeTruthy();
    expect(screen.getAllByText('TEST FIXTURE, not real content.').length).toBeGreaterThan(0);

    // not expert verified -> visible label + explanation
    expect(screen.getByTestId('review-badge')).toBeTruthy();
    expect(screen.getAllByText('AI draft').length).toBeGreaterThan(0);
    expect(screen.getByTestId('review-explain').props.children).toMatch(
      /not been checked by a pandit/,
    );

    // variations are labelled as regional / family practice, never as the universal rule
    expect(screen.getByText('Regional and family variations')).toBeTruthy();
    expect(screen.getByText(/not the rule for everyone/)).toBeTruthy();
    expect(screen.getByText('Fixture variation')).toBeTruthy();
    expect(screen.getByText('East India')).toBeTruthy();

    // read-only summary, plus the Phase 5 buttons (no preparation yet, so no progress card)
    expect(screen.getByTestId('samagri-counts').props.children).toBe(
      '1 required, 1 commonly used, 0 optional',
    );
    expect(screen.getByTestId('step-count').props.children).toBe('2 steps in the vidhi');
    expect(screen.getByTestId('start-preparation')).toBeTruthy();
    expect(screen.getByTestId('open-samagri')).toBeTruthy();
    expect(screen.getByTestId('open-vidhi')).toBeTruthy();
    expect(screen.queryByTestId('my-progress')).toBeNull();

    // the date is never invented
    expect(screen.getByTestId('date-unavailable').props.children).toMatch(/Date not available/);

    // standard disclaimer
    expect(
      screen.getByText(/Vidhi and samagri can differ by region, family tradition/),
    ).toBeTruthy();
  });

  it('does not show a verification warning for an expert-verified puja', async () => {
    setParams({ id: 'puja_test_vrat' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());
    await screen.findByTestId('details-name');
    expect(screen.getAllByText('Expert verified').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('review-explain')).toBeNull();
    expect(screen.queryByText('AI draft')).toBeNull();
  });

  it('renders in Hindi, with English as the secondary line', async () => {
    await resetSettings('hi');
    setParams({ id: 'puja_test_lakshmi' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());
    expect((await screen.findByTestId('details-name')).props.children).toBe(
      'लक्ष्मी पूजा (परीक्षण)',
    );
    expect(screen.getByTestId('details-other-name').props.children).toBe('Lakshmi Puja (test)');
    expect(screen.getByText('इस पूजा के बारे में')).toBeTruthy();
    expect(screen.getAllByText('AI ड्राफ़्ट').length).toBeGreaterThan(0);
    expect(screen.getByText(/विधि और सामग्री क्षेत्र, पारिवारिक परंपरा/)).toBeTruthy();
    expect(screen.getByTestId('samagri-counts').props.children).toBe(
      '1 आवश्यक, 1 आम तौर पर इस्तेमाल, 0 वैकल्पिक',
    );
  });

  it('saves and unsaves, persisting to the database', async () => {
    setParams({ id: 'puja_test_lakshmi' });
    const db = await fixtureDb();
    await renderWithDb(<PujaDetailsScreen />, db);
    const button = await screen.findByTestId('save-button');
    expect(screen.getByText('Save to favorites')).toBeTruthy();

    await fireEvent.press(button);
    expect(await screen.findByText('Saved to favorites')).toBeTruthy();
    expect(screen.getByTestId('save-button').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await waitFor(async () =>
      expect((await listSavedPujas(db)).map((s) => s.pujaId)).toEqual(['puja_test_lakshmi']),
    );

    await fireEvent.press(screen.getByTestId('save-button'));
    expect(await screen.findByText('Save to favorites')).toBeTruthy();
    await waitFor(async () => expect(await listSavedPujas(db)).toEqual([]));
  });

  it('records the view in recent_view', async () => {
    setParams({ id: 'puja_test_vrat' });
    const db = await fixtureDb();
    await renderWithDb(<PujaDetailsScreen />, db);
    await screen.findByTestId('details-name');
    await waitFor(async () =>
      expect((await listRecentViews(db)).map((v) => v.pujaId)).toEqual(['puja_test_vrat']),
    );
  });

  it('shows a translated error state for an unknown id, and one for a retired puja', async () => {
    setParams({ id: 'puja_does_not_exist' });
    const db = await fixtureDb();
    await renderWithDb(<PujaDetailsScreen />, db);
    expect(await screen.findByText('This puja is not available')).toBeTruthy();
    await fireEvent.press(screen.getByText('Open library'));
    expect(navigate).toHaveBeenCalledWith('/library');
    expect(await listRecentViews(db)).toEqual([]);
  });

  it('unknown id in Hindi, and a deprecated puja is treated as not available', async () => {
    await resetSettings('hi');
    setParams({ id: 'puja_test_retired' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());
    expect(await screen.findByText('यह पूजा उपलब्ध नहीं है')).toBeTruthy();
    expect(screen.getByText('लाइब्रेरी खोलें')).toBeTruthy();
  });

  it('back button goes back', async () => {
    setParams({ id: 'puja_test_vrat' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());
    await screen.findByTestId('details-name');
    await fireEvent.press(screen.getByTestId('details-back'));
    expect(back).toHaveBeenCalled();
  });

  it('shows the safety/health notes found in the content, and none when there are none', async () => {
    const base = makeFixtureBundle();
    const withSafety = {
      ...base,
      pujas: base.pujas.map((p) =>
        p.id === 'puja_test_lakshmi'
          ? {
              ...p,
              steps: [
                ...p.steps,
                {
                  id: 'step_test_safety',
                  stepNumber: 3,
                  title: { en: 'Safety Note: Open flames', hi: 'सुरक्षा नोट: खुली लौ' },
                  description: { en: 'FIXTURE safety text', hi: 'परीक्षण सुरक्षा पाठ' },
                  relatedSamagriIds: [],
                  isOptional: false,
                },
              ],
            }
          : p,
      ),
    };
    const db = createMigratedDb();
    await seedContentIfNeeded(db, withSafety);
    setParams({ id: 'puja_test_lakshmi' });
    await renderWithDb(<PujaDetailsScreen />, db);
    expect(await screen.findByTestId('safety-notes')).toBeTruthy();
    expect(screen.getByText('Safety and health')).toBeTruthy();
    expect(screen.getByText('Safety Note: Open flames')).toBeTruthy();
    expect(screen.getByText('FIXTURE safety text')).toBeTruthy();
  });

  it('has no safety card for a puja without safety notes', async () => {
    setParams({ id: 'puja_test_vrat' });
    await renderWithDb(<PujaDetailsScreen />, await fixtureDb());
    await screen.findByTestId('details-name');
    expect(screen.queryByTestId('safety-notes')).toBeNull();
  });
});

describe('Puja details: preparation buttons (Phase 5)', () => {
  async function richDb() {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makePreparationBundle());
    return db;
  }

  it('Samagri and Vidhi open their screens for this puja', async () => {
    setParams({ id: RICH_ID });
    await renderWithDb(<PujaDetailsScreen />, await richDb());
    await fireEvent.press(await screen.findByTestId('open-samagri'));
    expect(push).toHaveBeenCalledWith({ pathname: '/puja/[id]/samagri', params: { id: RICH_ID } });
    await fireEvent.press(screen.getByTestId('open-vidhi'));
    expect(push).toHaveBeenCalledWith({ pathname: '/puja/[id]/vidhi', params: { id: RICH_ID } });
  });

  it('"Start preparation" with none yet creates one and opens its checklist (no dialog)', async () => {
    const db = await richDb();
    setParams({ id: RICH_ID });
    await renderWithDb(<PujaDetailsScreen />, db);
    await fireEvent.press(await screen.findByTestId('start-preparation'));
    await waitFor(async () => expect(await listPreparations(db)).toHaveLength(1));
    const [prep] = await listPreparations(db);
    expect(screen.queryByTestId('start-dialog')).toBeNull();
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id },
    });
  });

  it('with an existing preparation it asks: continue the existing one, or start a new one', async () => {
    const db = await richDb();
    const existing = await createPreparation(db, { pujaId: RICH_ID });
    setParams({ id: RICH_ID });
    await renderWithDb(<PujaDetailsScreen />, db);
    await fireEvent.press(await screen.findByTestId('start-preparation'));
    expect(screen.getByText('You already have a preparation for this puja')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(await listPreparations(db)).toHaveLength(1);

    // Cancel changes nothing
    await fireEvent.press(screen.getByTestId('start-cancel'));
    expect(screen.queryByText('You already have a preparation for this puja')).toBeNull();
    expect(await listPreparations(db)).toHaveLength(1);

    // Continue opens the existing one without creating another
    await fireEvent.press(screen.getByTestId('start-preparation'));
    await fireEvent.press(screen.getByTestId('start-continue'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: existing.id },
    });
    expect(await listPreparations(db)).toHaveLength(1);

    // Start a new one creates a second
    push.mockClear();
    await fireEvent.press(screen.getByTestId('start-preparation'));
    await fireEvent.press(screen.getByTestId('start-new'));
    await waitFor(async () => expect(await listPreparations(db)).toHaveLength(2));
    const created = (await listPreparations(db)).find((p) => p.id !== existing.id)!;
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: created.id },
    });
  });

  it('shows my progress for this puja ("Required 1 of 2") and opens that checklist', async () => {
    const db = await richDb();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
    setParams({ id: RICH_ID });
    await renderWithDb(<PujaDetailsScreen />, db);
    expect((await screen.findByTestId('my-progress-required')).props.children).toBe(
      'Required 1 of 2',
    );
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('1 of 7 items checked')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-samagri'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id },
    });
  });

  it('shows no progress card when there is no preparation', async () => {
    setParams({ id: RICH_ID });
    await renderWithDb(<PujaDetailsScreen />, await richDb());
    await screen.findByTestId('start-preparation');
    expect(screen.queryByTestId('my-progress')).toBeNull();
  });
});
