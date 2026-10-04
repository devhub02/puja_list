import { act, fireEvent, screen, within } from '@testing-library/react-native';

import PujaDetailsScreen from '../app/puja/[id]';
import SearchScreen from '../app/search';
import HomeScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import bundledJson from '../assets/puja_data/content.json';
import { getContentInfo } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import type { ContentBundle } from '@/db/types';
import { resetUserStateStore } from '@/store/userStateStore';

import { createMigratedDb } from '../testing/nodeSqlDb';
import { push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

const bundled = bundledJson as unknown as ContentBundle;

async function realDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, bundled);
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

beforeEach(async () => {
  resetRouterMock();
  resetUserStateStore();
  await resetSettings('en');
});

describe('browse screens on the REAL exported content.json', () => {
  it('seeds 16 pujas, all ai_drafted', async () => {
    const db = await realDb();
    expect((await getContentInfo(db)).pujaCount).toBe(16);
    expect(bundled.pujas).toHaveLength(16);
    expect(bundled.pujas.every((p) => p.reviewStatus === 'ai_drafted')).toBe(true);
  });

  it('Library lists all 16 pujas with artwork, Home shows 6 featured and 6 categories', async () => {
    const db = await realDb();
    const library = await renderWithDb(<LibraryScreen />, db);
    expect(await screen.findByTestId('library-count')).toBeTruthy();
    expect(screen.getByTestId('library-count').props.children).toBe('16 pujas');
    // the list is virtualised, so only the first screenful of rows is rendered
    expect(screen.getAllByTestId(/^puja-card-/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^puja-card-/).length).toBeLessThanOrEqual(16);
    // a visible review label on every rendered card
    expect(screen.getAllByText('AI draft').length).toBe(
      screen.getAllByTestId(/^puja-card-/).length,
    );
    // only categories with pujas get a chip (festival, vrat, household in the shipped content)
    expect(screen.getByTestId('filter-category-festival')).toBeTruthy();
    expect(screen.getByTestId('filter-category-vrat')).toBeTruthy();
    expect(screen.getByTestId('filter-category-household')).toBeTruthy();
    expect(screen.queryByTestId('filter-category-tribal')).toBeNull();
    await library.unmount();

    await renderWithDb(<HomeScreen />, db);
    expect(await screen.findByText('Featured pujas')).toBeTruthy();
    expect(screen.getAllByTestId(/^featured-/)).toHaveLength(6);
    expect(screen.getAllByTestId(/^category-card-/)).toHaveLength(6);
  });

  it('category counts add up to 16 on the filters', async () => {
    const db = await realDb();
    await renderWithDb(<LibraryScreen />, db);
    await screen.findByTestId('library-count');
    let total = 0;
    for (const category of ['festival', 'vrat', 'household']) {
      await fireEvent.press(screen.getByTestId(`filter-category-${category}`));
      total += Number(String(screen.getByTestId('library-count').props.children).split(' ')[0]);
    }
    expect(total).toBe(16);
  });

  it('Details renders every one of the 16 real pujas without errors, with badge, counts and disclaimer', async () => {
    const db = await realDb();
    for (const puja of bundled.pujas) {
      setParams({ id: puja.id });
      const view = await renderWithDb(<PujaDetailsScreen />, db);
      expect((await screen.findByTestId('details-name')).props.children).toBe(puja.name.en);
      expect(screen.getByTestId('review-badge')).toBeTruthy();
      expect(screen.getByTestId('review-explain')).toBeTruthy();
      expect(screen.getByTestId('disclaimer')).toBeTruthy();
      const required = puja.samagri.filter((s) => s.classification === 'REQUIRED').length;
      expect(String(screen.getByTestId('samagri-counts').props.children)).toMatch(
        new RegExp(`^${required} required, \\d+ commonly used, \\d+ optional$`),
      );
      await view.unmount();
    }
  }, 60000);

  it('safety notes appear for the fasting, ghat and tool pujas', async () => {
    const db = await realDb();
    for (const id of [
      'puja_chhath',
      'puja_karwa_chauth',
      'puja_jitiya',
      'puja_hartalika_teej',
      'puja_vishwakarma',
    ]) {
      setParams({ id });
      const view = await renderWithDb(<PujaDetailsScreen />, db);
      expect(await screen.findByTestId('safety-notes')).toBeTruthy();
      await view.unmount();
    }
    setParams({ id: 'puja_chhath' });
    await renderWithDb(<PujaDetailsScreen />, db);
    expect(await screen.findByText('Safety Note: Ghat Safety')).toBeTruthy();
  });

  it('Details in Hindi shows the Hindi name first for a real puja', async () => {
    await resetSettings('hi');
    setParams({ id: 'puja_chhath' });
    await renderWithDb(<PujaDetailsScreen />, await realDb());
    expect((await screen.findByTestId('details-name')).props.children).toBe('छठ पूजा');
    expect(screen.getByTestId('details-other-name').props.children).toBe('Chhath Puja');
  });

  describe('searching real names', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const cases: [string, string][] = [
      ['Ganesh', 'puja_ganesh_chaturthi'],
      ['गणेश', 'puja_ganesh_chaturthi'],
      ['Laxmi', 'puja_diwali_lakshmi_puja'],
      ['लक्ष्मी', 'puja_diwali_lakshmi_puja'],
      ['chhath', 'puja_chhath'],
      ['छठ', 'puja_chhath'],
      ['Karwa', 'puja_karwa_chauth'],
      ['जन्माष्टमी', 'puja_janmashtami'],
    ];

    it.each(cases)('the Search screen finds "%s" -> %s', async (query, pujaId) => {
      await renderWithDb(<SearchScreen />, await realDb());
      await fireEvent.changeText(screen.getByTestId('search-screen-bar-input'), query);
      await settle();
      expect(await screen.findByTestId(`search-result-${pujaId}`)).toBeTruthy();
      await fireEvent.press(screen.getByTestId(`search-result-${pujaId}`));
      expect(push).toHaveBeenCalledWith({ pathname: '/puja/[id]', params: { id: pujaId } });
    });

    it('a samagri search (diya / दीपक) says which pujas contain it', async () => {
      await renderWithDb(<SearchScreen />, await realDb());
      const input = screen.getByTestId('search-screen-bar-input');
      await fireEvent.changeText(input, 'diya');
      await settle();
      await screen.findByTestId('search-instant');
      expect(screen.getAllByText(/^Found in: /).length).toBeGreaterThan(0);
      await fireEvent.changeText(input, 'दीपक');
      await settle();
      await screen.findByTestId('search-instant');
      expect(screen.getAllByText(/^इस पूजा में:|^Found in: /).length).toBeGreaterThan(0);
    });

    it('the Library filters the real list in place by a Hindi name', async () => {
      await renderWithDb(<LibraryScreen />, await realDb());
      await fireEvent.changeText(screen.getByTestId('library-search-input'), 'छठ');
      await settle();
      const card = await screen.findByTestId('puja-card-puja_chhath');
      expect(within(card).getByText('Chhath Puja')).toBeTruthy();
      expect(screen.getAllByTestId(/^puja-card-/)).toHaveLength(1);
      expect(screen.getByTestId('library-count').props.children).toBe('1 puja');
    });
  });
});
