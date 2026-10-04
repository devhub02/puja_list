import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import PujaDetailsScreen from '../app/puja/[id]';
import { listRecentViews, listSavedPujas } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetUserStateStore } from '@/store/userStateStore';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { back, navigate, resetRouterMock, setParams } from '../testing/routerMock';
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

    // read-only summary; no Samagri / Vidhi / Start buttons yet (Phase 5)
    expect(screen.getByTestId('samagri-counts').props.children).toBe(
      '1 required, 1 commonly used, 0 optional',
    );
    expect(screen.getByTestId('step-count').props.children).toBe('2 steps in the vidhi');
    expect(screen.queryByText(/Start preparation/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /vidhi|samagri/i })).toBeNull();

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
