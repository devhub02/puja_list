import { AccessibilityInfo } from 'react-native';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import SamagriScreen from '../app/puja/[id]/samagri';
import {
  addCustomItem,
  createPreparation,
  getChecklistState,
  listPreparations,
  setItemChecked,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetPreparationStore } from '@/store/preparationStore';

import { EMPTY_ID, RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { back, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

async function database() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle());
  return db;
}

async function open(db: Awaited<ReturnType<typeof database>>, params: Record<string, string> = {}) {
  setParams({ id: RICH_ID, ...params });
  const view = await renderWithDb(<SamagriScreen />, db);
  await screen.findByTestId('overall-text');
  return view;
}

const tick = async (key: string) => {
  await fireEvent.press(screen.getByTestId(`check-${key}`));
};

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  await resetSettings('en');
});

describe('Samagri screen', () => {
  it('shows Required, Commonly used and Optional in that order, each with its own counter', async () => {
    await open(await database());
    const headers = screen.getAllByTestId(/^section-(REQUIRED|COMMON|OPTIONAL|CUSTOM)$/);
    expect(headers.map((h) => h.props.testID)).toEqual([
      'section-REQUIRED',
      'section-COMMON',
      'section-OPTIONAL',
    ]);
    expect(screen.getByTestId('section-REQUIRED-count').props.children).toBe('0/2');
    expect(screen.getByTestId('section-COMMON-count').props.children).toBe('0/2');
    expect(screen.getByTestId('section-OPTIONAL-count').props.children).toBe('0/3');
    expect(within(screen.getByTestId('section-REQUIRED')).getByText('Required')).toBeTruthy();
    expect(within(screen.getByTestId('section-COMMON')).getByText('Commonly used')).toBeTruthy();
    expect(within(screen.getByTestId('section-OPTIONAL')).getByText('Optional')).toBeTruthy();
    expect(screen.queryByText('My items')).toBeNull();
  });

  it('shows the top summary: overall bar, counts and "required items: x of y"', async () => {
    await open(await database());
    expect(screen.getByTestId('overall-text').props.children).toBe('0 of 7 items checked');
    expect(screen.getByTestId('counts-text').props.children).toBe('0 checked · 7 left');
    expect(screen.getByTestId('required-text').props.children).toBe('Required items: 0 of 2');
    expect(screen.getByTestId('overall-bar').props.accessibilityValue).toMatchObject({
      min: 0,
      max: 100,
      now: 0,
    });
  });

  it('does not create a preparation just by viewing', async () => {
    const db = await database();
    await open(db);
    expect(await listPreparations(db)).toEqual([]);
  });

  it('creates the default preparation on the FIRST tick and saves it at once', async () => {
    const db = await database();
    await open(db);
    await tick('samagri:sm_r1');
    await waitFor(() =>
      expect(screen.getByTestId('required-text').props.children).toBe('Required items: 1 of 2'),
    );
    const preparations = await listPreparations(db);
    expect(preparations).toHaveLength(1);
    expect(preparations[0].pujaId).toBe(RICH_ID);
    expect((await getChecklistState(db, preparations[0].id))?.checkedSamagriIds).toEqual(['sm_r1']);
    expect(screen.getByTestId('overall-text').props.children).toBe('1 of 7 items checked');
    expect(screen.getByTestId('section-REQUIRED-count').props.children).toBe('1/2');
    // a second tick reuses it
    await tick('samagri:sm_c1');
    await waitFor(() =>
      expect(screen.getByTestId('overall-text').props.children).toBe('2 of 7 items checked'),
    );
    expect(await listPreparations(db)).toHaveLength(1);
  });

  it('announces the checkbox state and toggles back off', async () => {
    await open(await database());
    const box = () => screen.getByTestId('check-samagri:sm_r1');
    expect(box().props.accessibilityRole).toBe('checkbox');
    expect(box().props.accessibilityState).toMatchObject({ checked: false });
    await tick('samagri:sm_r1');
    await waitFor(() => expect(box().props.accessibilityState).toMatchObject({ checked: true }));
    await tick('samagri:sm_r1');
    await waitFor(() => expect(box().props.accessibilityState).toMatchObject({ checked: false }));
  });

  it('never counts an optional item as required, and sections do not affect each other', async () => {
    await open(await database());
    for (const id of ['sm_o1', 'sm_o2', 'sm_o3']) await tick(`samagri:${id}`);
    await waitFor(() =>
      expect(screen.getByTestId('section-OPTIONAL-count').props.children).toBe('3/3'),
    );
    expect(screen.getByTestId('required-text').props.children).toBe('Required items: 0 of 2');
    expect(screen.getByTestId('section-REQUIRED-count').props.children).toBe('0/2');
    expect(screen.getByTestId('section-COMMON-count').props.children).toBe('0/2');
    expect(screen.getByTestId('overall-text').props.children).toBe('3 of 7 items checked');
  });

  it('shows purpose, quantity, preparation and regional notes, and folds long ones behind Show more', async () => {
    await open(await database());
    expect(screen.getByText('Purpose of r1 (fixture)')).toBeTruthy();
    expect(screen.getByText(/As needed/)).toBeTruthy(); // short row: details always visible
    expect(screen.queryByTestId('expand-samagri:sm_r1')).toBeNull();
    // the long optional row is folded
    expect(screen.queryByText(/Followed in some regions only/)).toBeNull();
    await fireEvent.press(screen.getByTestId('expand-samagri:sm_o1'));
    expect(screen.getByText(/Quantity per family custom/)).toBeTruthy();
    expect(screen.getByText(/A long preparation note/)).toBeTruthy();
    expect(screen.getByText(/Followed in some regions only/)).toBeTruthy();
    expect(screen.getByTestId('expand-samagri:sm_o1').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await fireEvent.press(screen.getByTestId('expand-samagri:sm_o1'));
    expect(screen.queryByText(/Followed in some regions only/)).toBeNull();
  });

  it('shows names in Hindi with the Hindi labels', async () => {
    await resetSettings('hi');
    await open(await database());
    expect(screen.getByText('Item r1 (परीक्षण)')).toBeTruthy();
    expect(screen.getByText('आवश्यक सामग्री: 2 में से 0')).toBeTruthy();
    expect(
      within(screen.getByTestId('section-COMMON')).getByText('आम तौर पर इस्तेमाल'),
    ).toBeTruthy();
    expect(within(screen.getByTestId('section-OPTIONAL')).getByText('वैकल्पिक')).toBeTruthy();
  });

  it('collapses and expands a section', async () => {
    await open(await database());
    expect(screen.getByTestId('row-samagri:sm_o1')).toBeTruthy();
    const header = screen.getByTestId('section-OPTIONAL');
    expect(header.props.accessibilityState).toMatchObject({ expanded: true });
    await fireEvent.press(header);
    expect(screen.queryByTestId('row-samagri:sm_o1')).toBeNull();
    expect(screen.getByTestId('section-OPTIONAL').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.getByTestId('section-OPTIONAL-count').props.children).toBe('0/3');
    await fireEvent.press(screen.getByTestId('section-OPTIONAL'));
    expect(screen.getByTestId('row-samagri:sm_o1')).toBeTruthy();
  });

  it('filters by classification and by "Unchecked only"', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('filter-REQUIRED'));
    expect(screen.getByTestId('row-samagri:sm_r1')).toBeTruthy();
    expect(screen.queryByTestId('row-samagri:sm_c1')).toBeNull();
    expect(screen.queryByTestId('row-samagri:sm_o1')).toBeNull();
    expect(screen.getByTestId('filter-REQUIRED').props.accessibilityState).toMatchObject({
      checked: true,
    });

    await fireEvent.press(screen.getByTestId('filter-all'));
    await tick('samagri:sm_r1');
    await waitFor(() =>
      expect(screen.getByTestId('overall-text').props.children).toBe('1 of 7 items checked'),
    );
    await fireEvent.press(screen.getByTestId('filter-unchecked'));
    expect(screen.queryByTestId('row-samagri:sm_r1')).toBeNull();
    expect(screen.getByTestId('row-samagri:sm_r2')).toBeTruthy();
    // section counter still counts everything, not only what is visible
    expect(screen.getByTestId('section-REQUIRED-count').props.children).toBe('1/2');
  });

  it('shows a helpful message when a filter matches nothing, and clears it', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('filter-CUSTOM'));
    expect(screen.getByText('You have not added any items of your own yet.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-all'));
    await fireEvent.press(screen.getByTestId('filter-unchecked'));
    for (const id of ['r1', 'r2', 'c1', 'c2', 'o1', 'o2', 'o3']) await tick(`samagri:sm_${id}`);
    await waitFor(() => expect(screen.getByTestId('empty-filter')).toBeTruthy());
    await fireEvent.press(screen.getByText('Show all items'));
    expect(screen.getByTestId('row-samagri:sm_r1')).toBeTruthy();
  });

  describe('custom items', () => {
    it('adds an item (name required), puts it under "My items" and counts it', async () => {
      const db = await database();
      await open(db);
      await fireEvent.press(screen.getByTestId('add-item'));
      expect(screen.getByText('Add your own item')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('item-save')); // empty name
      expect(screen.getByTestId('item-name-error').props.children).toBe(
        'Please enter a name for the item.',
      );

      await fireEvent.changeText(screen.getByTestId('item-name'), '  Red cloth ');
      await fireEvent.changeText(screen.getByTestId('item-note'), 'for the seat');
      await fireEvent.press(screen.getByTestId('item-save'));
      await waitFor(() => expect(screen.getByTestId('section-CUSTOM')).toBeTruthy());
      expect(screen.getByText('Red cloth')).toBeTruthy();
      expect(screen.getByText('for the seat')).toBeTruthy();
      expect(screen.getByText('My items')).toBeTruthy();
      expect(screen.getByTestId('section-CUSTOM-count').props.children).toBe('0/1');
      expect(screen.getByTestId('overall-text').props.children).toBe('0 of 8 items checked');
      // the required counter is untouched by custom items
      expect(screen.getByTestId('required-text').props.children).toBe('Required items: 0 of 2');
      const [prep] = await listPreparations(db);
      expect((await getChecklistState(db, prep.id))?.customItems[0]).toMatchObject({
        name: 'Red cloth',
        note: 'for the seat',
      });
    });

    it('edits an item', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      const item = await addCustomItem(db, prep.id, { name: 'Old name' });
      await open(db, { prep: prep.id });
      await fireEvent.press(screen.getByTestId(`edit-custom:${item.id}`));
      expect(screen.getByTestId('item-name').props.value).toBe('Old name');
      await fireEvent.changeText(screen.getByTestId('item-name'), 'New name');
      await fireEvent.press(screen.getByTestId('item-save'));
      await waitFor(() => expect(screen.getByText('New name')).toBeTruthy());
      expect(screen.queryByText('Old name')).toBeNull();
    });

    it('asks before deleting, keeps the item on Cancel and removes it on Delete', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      const item = await addCustomItem(db, prep.id, { name: 'Ghee' });
      await open(db, { prep: prep.id });

      await fireEvent.press(screen.getByTestId(`delete-custom:${item.id}`));
      expect(screen.getByText('Delete this item?')).toBeTruthy();
      expect(screen.getByText('“Ghee” will be removed from your checklist.')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('delete-cancel'));
      expect(screen.getByText('Ghee')).toBeTruthy();
      expect((await getChecklistState(db, prep.id))?.customItems).toHaveLength(1);

      await fireEvent.press(screen.getByTestId(`delete-custom:${item.id}`));
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      await waitFor(() => expect(screen.queryByText('Ghee')).toBeNull());
      expect((await getChecklistState(db, prep.id))?.customItems).toHaveLength(0);
    });

    it('custom edit/delete buttons have accessible names and 48dp targets', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      const item = await addCustomItem(db, prep.id, { name: 'Ghee' });
      await open(db, { prep: prep.id });
      const edit = screen.getByTestId(`edit-custom:${item.id}`);
      expect(edit.props.accessibilityLabel).toBe('Edit Ghee');
      expect(screen.getByTestId(`delete-custom:${item.id}`).props.accessibilityLabel).toBe(
        'Delete Ghee',
      );
      expect(edit.props.accessibilityRole).toBe('button');
    });
  });

  describe('reset', () => {
    it('is disabled until something is checked', async () => {
      await open(await database());
      expect(screen.getByTestId('reset-checklist').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('asks first; Cancel keeps ticks; Reset removes ticks but keeps custom items', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      const item = await addCustomItem(db, prep.id, { name: 'Ghee' });
      await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
      await setItemChecked(db, prep.id, 'custom', item.id, true);
      await open(db, { prep: prep.id });
      expect(screen.getByTestId('overall-text').props.children).toBe('2 of 8 items checked');

      await fireEvent.press(screen.getByTestId('reset-checklist'));
      expect(screen.getByText('Reset this checklist?')).toBeTruthy();
      expect(screen.getByText('All ticks will be removed. Your own items are kept.')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('reset-cancel'));
      expect(screen.getByTestId('overall-text').props.children).toBe('2 of 8 items checked');

      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await fireEvent.press(screen.getByTestId('reset-checklist'));
      await fireEvent.press(screen.getByTestId('reset-confirm'));
      await waitFor(() => expect(announce).toHaveBeenCalledWith('Checklist reset')); // success is never silent
      await waitFor(() =>
        expect(screen.getByTestId('overall-text').props.children).toBe('0 of 8 items checked'),
      );
      expect(screen.getByText('Ghee')).toBeTruthy();
      expect((await getChecklistState(db, prep.id))?.customItems).toHaveLength(1);
    });
  });

  it('shows the standard disclaimer and the review badge for a draft puja', async () => {
    await open(await database());
    expect(screen.getByTestId('review-badge')).toBeTruthy();
    expect(screen.getAllByText('AI draft').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Vidhi and samagri can differ by region, family tradition/),
    ).toBeTruthy();
  });

  it('shows no review badge for an expert-verified puja', async () => {
    const db = await database();
    setParams({ id: 'puja_test_vrat' });
    await renderWithDb(<SamagriScreen />, db);
    await screen.findByTestId('overall-text');
    expect(screen.queryByTestId('review-badge')).toBeNull();
  });

  it('handles a puja with zero samagri: explains it, still lets you add your own items', async () => {
    const db = await database();
    setParams({ id: EMPTY_ID });
    await renderWithDb(<SamagriScreen />, db);
    expect(await screen.findByTestId('empty-samagri')).toBeTruthy();
    expect(screen.getByText('No samagri listed')).toBeTruthy();
    expect(screen.getByTestId('overall-text').props.children).toBe('0 of 0 items checked');
    expect(screen.getByTestId('required-text').props.children).toBe(
      'No required items are listed for this puja',
    );
    await fireEvent.press(screen.getByTestId('add-item'));
    await fireEvent.changeText(screen.getByTestId('item-name'), 'My item');
    await fireEvent.press(screen.getByTestId('item-save'));
    await waitFor(() => expect(screen.getByText('My item')).toBeTruthy());
    expect(screen.getByTestId('overall-text').props.children).toBe('0 of 1 items checked');
  });

  it('shows an explanation for an unknown puja', async () => {
    const db = await database();
    setParams({ id: 'puja_nope' });
    await renderWithDb(<SamagriScreen />, db);
    expect(await screen.findByText('This puja is not available')).toBeTruthy();
  });

  it('goes back', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('samagri-back'));
    expect(back).toHaveBeenCalled();
  });

  it('opens at a focused item (from a vidhi chip) without crashing and highlights it', async () => {
    await open(await database(), { focus: 'sm_o2' });
    expect(screen.getByTestId('row-samagri:sm_o2')).toBeTruthy();
  });

  describe('items the guide no longer lists (after a content update)', () => {
    it('keeps them out of the counts, labels them, and lets the user remove them', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
      await setItemChecked(db, prep.id, 'samagri', 'sm_o3', true);

      // content update: sm_o3 leaves the puja's list, sm_r2's catalogue entry is gone entirely
      const next = makePreparationBundle({ contentVersion: 2, checksum: 'sha256:v2' });
      const rich = next.pujas.find((p) => p.id === RICH_ID)!;
      rich.samagri = rich.samagri.filter((s) => s.samagriId !== 'sm_o3');
      await seedContentIfNeeded(db, next);

      await open(db, { prep: prep.id });
      expect(screen.getByTestId('overall-text').props.children).toBe('1 of 6 items checked');
      expect(screen.getByTestId('section-OPTIONAL-count').props.children).toBe('0/2');
      const removed = screen.getByTestId('removed-sm_o3');
      expect(within(removed).getByText('Item o3 (fixture)')).toBeTruthy();
      expect(within(removed).getByText('No longer in the guide')).toBeTruthy();
      expect(screen.getByTestId('removed-section')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('forget-sm_o3'));
      await waitFor(() => expect(screen.queryByTestId('removed-sm_o3')).toBeNull());
      expect((await getChecklistState(db, prep.id))?.checkedSamagriIds).toEqual(['sm_r1']);
    });

    it('shows a generic label when the catalogue entry is gone too', async () => {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      await setItemChecked(db, prep.id, 'samagri', 'sm_never_existed', true);
      await open(db, { prep: prep.id });
      expect(
        within(screen.getByTestId('removed-sm_never_existed')).getByText('Removed item'),
      ).toBeTruthy();
      expect(screen.getByTestId('overall-text').props.children).toBe('0 of 7 items checked');
    });
  });
});
