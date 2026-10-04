import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import PreparationScreen from '../app/(tabs)/preparation';
import {
  addCustomItem,
  createPreparation,
  getChecklistState,
  listPreparations,
  markVidhiCompleted,
  renamePreparation,
  savePuja,
  saveVidhiPosition,
  setItemChecked,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetPreparationStore, usePreparationStore } from '@/store/preparationStore';
import { resetUserStateStore } from '@/store/userStateStore';

import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { navigate, push, resetRouterMock } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

async function database() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle());
  return db;
}

async function open(db: Awaited<ReturnType<typeof database>>) {
  const view = await renderWithDb(<PreparationScreen />, db);
  await screen.findByText('My Preparation');
  return view;
}

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  resetUserStateStore();
  await resetSettings('en');
});

/** Two preparations of the rich puja: "Home" (2 required of 2 + custom) and "Sister" (nothing ticked). */
async function withTwo(db: Awaited<ReturnType<typeof database>>) {
  const home = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' }, { now: 1000 });
  await setItemChecked(db, home.id, 'samagri', 'sm_r1', true, { now: 1001 });
  const sister = await createPreparation(db, { pujaId: RICH_ID, title: 'Sister' }, { now: 2000 });
  return { home, sister };
}

describe('My Preparation: empty', () => {
  it('explains how to start and offers a button to open the Library', async () => {
    await open(await database());
    expect(await screen.findByText('Nothing to prepare yet')).toBeTruthy();
    expect(screen.getByText(/tap “Start preparation”/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Open library'));
    expect(navigate).toHaveBeenCalledWith('/library');
    // nothing to remind about yet: no per-checklist reminder buttons (only the Manage reminders link)
    expect(screen.queryByTestId(/^prep-remind-/)).toBeNull();
  });

  it('shows the same helpful state in the Shopping list view', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('view-shopping'));
    expect(await screen.findByText('No shopping list yet')).toBeTruthy();
  });
});

describe('My Preparation: cards', () => {
  it('lists preparations most recently opened first, with puja name, label, progress and required x/y', async () => {
    const db = await database();
    const { home, sister } = await withTwo(db);
    await open(db);
    await screen.findByTestId(`prep-card-${home.id}`);
    const cards = screen.getAllByTestId(/^prep-card-/);
    expect(cards.map((c) => c.props.testID)).toEqual([
      `prep-card-${sister.id}`,
      `prep-card-${home.id}`,
    ]);
    expect(screen.getByTestId(`prep-name-${home.id}`).props.children).toBe('Rich Puja (fixture)');
    expect(screen.getByTestId(`prep-title-${home.id}`).props.children).toBe('Home');
    expect(screen.getByTestId(`prep-required-${home.id}`).props.children).toBe('Required 1 of 2');
    expect(screen.getByTestId(`prep-required-${sister.id}`).props.children).toBe('Required 0 of 2');
    const bar = within(screen.getByTestId(`prep-card-${home.id}`)).getByRole('progressbar');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 14 });
    expect(
      within(screen.getByTestId(`prep-card-${home.id}`)).getByText('1 of 7 items checked'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId(`prep-card-${home.id}`)).getByText(/^Last opened /),
    ).toBeTruthy();
  });

  it('shows the vidhi position or completion', async () => {
    const db = await database();
    const { home, sister } = await withTwo(db);
    await saveVidhiPosition(db, home.id, 3);
    await markVidhiCompleted(db, sister.id, 5);
    await open(db);
    expect(await screen.findByTestId(`prep-vidhi-${home.id}`)).toBeTruthy();
    expect(screen.getByTestId(`prep-vidhi-${home.id}`).props.children).toBe('Vidhi: at step 3');
    expect(screen.getByTestId(`prep-vidhi-${sister.id}`).props.children).toBe('Vidhi: completed');
  });

  it('opens the checklist and the vidhi of that preparation', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-open-${home.id}`));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: home.id },
    });
    await fireEvent.press(screen.getByTestId(`prep-vidhi-open-${home.id}`));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/vidhi',
      params: { id: RICH_ID, prep: home.id },
    });
  });

  it('moves a fully checked checklist out of "Current" but keeps it under "Recently used"', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: 'puja_test_vrat' });
    await setItemChecked(db, prep.id, 'samagri', 'sm_test_flower', true);
    await open(db);
    expect(await screen.findByText('All your checklists are complete.')).toBeTruthy();
    expect(screen.queryByTestId(`prep-card-${prep.id}`)).toBeNull();
    expect(screen.getByTestId(`recent-${prep.id}`)).toBeTruthy();
  });

  it('shows a card for a puja that no longer exists, with only management actions', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: 'puja_removed_from_content' });
    await open(db);
    expect((await screen.findAllByText('This puja is no longer available')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId(`prep-open-${prep.id}`)).toBeNull();
    expect(screen.getByTestId(`prep-more-${prep.id}`)).toBeTruthy();
  });

  it('lists saved pujas and opens their details', async () => {
    const db = await database();
    await savePuja(db, RICH_ID);
    await open(db);
    expect(await screen.findByText('Saved pujas')).toBeTruthy();
    await fireEvent.press(await screen.findByTestId(`puja-card-${RICH_ID}`));
    expect(push).toHaveBeenCalledWith({ pathname: '/puja/[id]', params: { id: RICH_ID } });
  });
});

describe('My Preparation: actions', () => {
  it('has accessible names for the More button', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await open(db);
    expect((await screen.findByTestId(`prep-more-${home.id}`)).props.accessibilityLabel).toBe(
      'More actions for Rich Puja (fixture), Home',
    );
  });

  it('renames (and clears the label with an empty one)', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-rename'));
    expect(screen.getByTestId('label-input').props.value).toBe('Home');
    await fireEvent.changeText(screen.getByTestId('label-input'), 'Diwali 2026');
    await fireEvent.press(screen.getByTestId('rename-save'));
    await waitFor(() =>
      expect(screen.getByTestId(`prep-title-${home.id}`).props.children).toBe('Diwali 2026'),
    );

    await fireEvent.press(screen.getByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-rename'));
    await fireEvent.changeText(screen.getByTestId('label-input'), '');
    await fireEvent.press(screen.getByTestId('rename-save'));
    await waitFor(() => expect(screen.queryByTestId(`prep-title-${home.id}`)).toBeNull());
  });

  it('duplicates for another occasion with an optional label: copies custom items, resets ticks', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    const item = await addCustomItem(db, home.id, { name: 'Cloth' });
    await setItemChecked(db, home.id, 'custom', item.id, true);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-duplicate'));
    expect(screen.getByText('Duplicate this checklist')).toBeTruthy();
    expect(screen.getByTestId('duplicate-label').props.value).toBe('');
    await fireEvent.changeText(screen.getByTestId('duplicate-label'), 'Navratri');
    await fireEvent.press(screen.getByTestId('duplicate-confirm'));

    await waitFor(async () => expect(await listPreparations(db)).toHaveLength(3));
    const copy = (await listPreparations(db)).find((p) => p.title === 'Navratri')!;
    const state = await getChecklistState(db, copy.id);
    expect(state?.customItems.map((i) => i.name)).toEqual(['Cloth']);
    expect(state?.checkedSamagriIds).toEqual([]);
    expect(state?.checkedCustomIds).toEqual([]);
    await waitFor(() =>
      expect(screen.getByTestId(`prep-title-${copy.id}`).props.children).toBe('Navratri'),
    );
    // the original keeps its ticks
    expect((await getChecklistState(db, home.id))?.checkedSamagriIds).toEqual(['sm_r1']);
  });

  it('duplicating with the label left empty makes a copy without a label', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-duplicate'));
    await fireEvent.press(screen.getByTestId('duplicate-confirm'));
    await waitFor(async () => expect(await listPreparations(db)).toHaveLength(3));
    expect((await listPreparations(db))[0].title).toBeNull();
  });

  it('asks before deleting; Cancel keeps it; Delete removes only that preparation', async () => {
    const db = await database();
    const { home, sister } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-delete'));
    expect(screen.getByText('Delete this preparation?')).toBeTruthy();
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('delete-prep-cancel'));
    expect(screen.getByTestId(`prep-card-${home.id}`)).toBeTruthy();
    expect(await listPreparations(db)).toHaveLength(2);

    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await fireEvent.press(screen.getByTestId(`prep-more-${home.id}`));
    await fireEvent.press(screen.getByTestId('action-delete'));
    await fireEvent.press(screen.getByTestId('delete-prep-confirm'));
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Preparation deleted'));
    await waitFor(() => expect(screen.queryByTestId(`prep-card-${home.id}`)).toBeNull());
    expect(screen.getByTestId(`prep-card-${sister.id}`)).toBeTruthy();
    expect((await listPreparations(db)).map((p) => p.id)).toEqual([sister.id]);
  });

  it('"Clear completed custom items" appears only when a custom item is checked, asks first, and keeps puja items', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    const done = await addCustomItem(db, home.id, { name: 'Done' });
    await addCustomItem(db, home.id, { name: 'Open' });
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    expect(screen.queryByTestId('action-clear')).toBeNull();
    await fireEvent.press(screen.getByTestId('action-close'));

    await setItemChecked(db, home.id, 'custom', done.id, true);
    await act(async () => usePreparationStore.getState().bump()); // what any in-app write does
    await fireEvent.press(screen.getByTestId(`prep-more-${home.id}`));
    await waitFor(() => expect(screen.getByTestId('action-clear')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('action-clear'));
    expect(screen.getByText('Remove completed custom items?')).toBeTruthy();
    expect(screen.getByText(/1 ticked item of your own will be removed/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('clear-confirm'));
    await waitFor(async () =>
      expect((await getChecklistState(db, home.id))?.customItems).toHaveLength(1),
    );
    expect((await getChecklistState(db, home.id))?.checkedSamagriIds).toEqual(['sm_r1']);
  });

  it('every action button has a 48dp-capable accessible name', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${home.id}`));
    for (const id of ['action-rename', 'action-duplicate', 'action-delete', 'action-close']) {
      expect(screen.getByTestId(id).props.accessibilityRole).toBe('button');
    }
  });
});

describe('My Preparation: shopping list', () => {
  it('shows only UNCHECKED items grouped with required first, including custom items', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
    await setItemChecked(db, prep.id, 'samagri', 'sm_c1', true);
    await addCustomItem(db, prep.id, { name: 'Ghee' });
    await open(db);
    await fireEvent.press(await screen.findByTestId('view-shopping'));
    expect(await screen.findByTestId('shopping-left')).toBeTruthy();
    expect(screen.getByTestId('shopping-left').props.children).toBe('6 items left');

    const rows = screen.getAllByTestId(/^row-/).map((r) => r.props.testID);
    expect(rows).toEqual([
      'row-samagri:sm_r2',
      'row-samagri:sm_c2',
      'row-samagri:sm_o1',
      'row-samagri:sm_o2',
      'row-samagri:sm_o3',
      expect.stringMatching(/^row-custom:usr_/),
    ]);
    expect(screen.queryByTestId('row-samagri:sm_r1')).toBeNull();
    expect(screen.getByText('Ghee')).toBeTruthy();
    for (const heading of ['Required', 'Commonly used', 'Optional', 'My items']) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
  });

  it('ticking an item removes it from the list and saves it', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await open(db);
    await fireEvent.press(await screen.findByTestId('view-shopping'));
    await fireEvent.press(await screen.findByTestId('check-samagri:sm_r1'));
    await waitFor(() => expect(screen.queryByTestId('row-samagri:sm_r1')).toBeNull());
    expect((await getChecklistState(db, prep.id))?.checkedSamagriIds).toEqual(['sm_r1']);
    expect(screen.getByTestId('shopping-left').props.children).toBe('6 items left');
  });

  it('lets you choose the preparation and shows a done message when everything is checked', async () => {
    const db = await database();
    const { home, sister } = await withTwo(db);
    await open(db);
    await fireEvent.press(await screen.findByTestId('view-shopping'));
    await screen.findByTestId('shopping-left');
    // most recent (Sister) first: nothing ticked there
    expect(screen.getByTestId('shopping-left').props.children).toBe('7 items left');
    await fireEvent.press(screen.getByTestId(`shop-choose-${home.id}`));
    await waitFor(() =>
      expect(screen.getByTestId('shopping-left').props.children).toBe('6 items left'),
    );

    for (const id of ['r2', 'c1', 'c2', 'o1', 'o2', 'o3']) {
      await setItemChecked(db, sister.id, 'samagri', `sm_${id}`, true);
    }
    await setItemChecked(db, sister.id, 'samagri', 'sm_r1', true);
    await fireEvent.press(screen.getByTestId(`shop-choose-${sister.id}`));
    expect(await screen.findByText('Everything is checked')).toBeTruthy();
  });

  it('renaming does not break the selection of the shopping list', async () => {
    const db = await database();
    const { home } = await withTwo(db);
    await renamePreparation(db, home.id, 'Renamed');
    await open(db);
    await fireEvent.press(await screen.findByTestId('view-shopping'));
    expect(await screen.findByTestId(`shop-choose-${home.id}`)).toBeTruthy();
  });
});
