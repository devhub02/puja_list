import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import VidhiScreen from '../app/puja/[id]/vidhi';
import {
  createPreparation,
  getVidhiProgress,
  listPreparations,
  markVidhiCompleted,
  saveVidhiPosition,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { resetPreparationStore } from '@/store/preparationStore';
import { useSettingsStore } from '@/store/settingsStore';

import { EMPTY_ID, RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { back, push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

async function database() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle());
  return db;
}

async function open(
  db: Awaited<ReturnType<typeof database>>,
  params: Record<string, string> = {},
  id = RICH_ID,
) {
  setParams({ id, ...params });
  const view = await renderWithDb(<VidhiScreen />, db);
  await screen.findByTestId('step-counter');
  return view;
}

const counter = () => screen.getByTestId('step-counter').props.children;

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  jest.clearAllMocks();
  await resetSettings('en');
});

describe('Vidhi reader', () => {
  it('shows the safety notes BEFORE step 1 and does not hide them', async () => {
    await open(await database());
    expect(screen.getByTestId('safety-intro')).toBeTruthy();
    expect(screen.getByText('Please read these notes before you begin.')).toBeTruthy();
    expect(screen.getByText('Safety Note: open flame')).toBeTruthy();
    expect(screen.getByText('Keep the lamp away from curtains.')).toBeTruthy();
    expect(screen.queryByTestId('prev-step')).toBeNull();

    await fireEvent.press(screen.getByTestId('safety-start'));
    expect(counter()).toBe('Step 1 of 5');
    expect(screen.getByTestId('step-title').props.children).toBe('Prepare the space');
  });

  it('keeps the safety notes reachable from every step', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('safety-start'));
    await fireEvent.press(screen.getByTestId('open-safety'));
    const dialog = screen.getByTestId('safety-dialog');
    expect(within(dialog).getByText('Safety and health')).toBeTruthy();
    expect(within(dialog).getByText('Keep the lamp away from curtains.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('safety-close'));
    expect(counter()).toBe('Step 1 of 5');
  });

  it('shows step number, title, description, progress and the previous/next buttons', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('safety-start'));
    expect(screen.getByTestId('step-description').props.children).toBe('Step one description.');
    expect(screen.getByTestId('reading-progress').props.accessibilityValue).toMatchObject({
      now: 20,
      text: 'Step 1 of 5',
    });
    expect(screen.getByTestId('prev-step').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('next-step')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('does not create a preparation while you only read step 1, but does when you advance past it', async () => {
    const db = await database();
    await open(db);
    await fireEvent.press(screen.getByTestId('safety-start'));
    expect(await listPreparations(db)).toEqual([]);

    await fireEvent.press(screen.getByTestId('next-step'));
    await waitFor(async () => expect(await listPreparations(db)).toHaveLength(1));
    const [prep] = await listPreparations(db);
    expect(counter()).toBe('Step 2 of 5');
    await waitFor(async () =>
      expect((await getVidhiProgress(db, prep.id))?.lastStepNumber).toBe(2),
    );
  });

  it('goes back and forth, saving the position each time', async () => {
    const db = await database();
    await open(db);
    await fireEvent.press(screen.getByTestId('safety-start'));
    await fireEvent.press(screen.getByTestId('next-step'));
    await fireEvent.press(screen.getByTestId('next-step'));
    expect(counter()).toBe('Step 3 of 5');
    await fireEvent.press(screen.getByTestId('prev-step'));
    expect(counter()).toBe('Step 2 of 5');
    const [prep] = await listPreparations(db);
    await waitFor(async () =>
      expect((await getVidhiProgress(db, prep.id))?.lastStepNumber).toBe(2),
    );
    expect(await listPreparations(db)).toHaveLength(1);
  });

  it('marks optional steps, highlights the important note, and shows no invented text', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await saveVidhiPosition(db, prep.id, 3);
    await open(db, { prep: prep.id });
    expect(screen.getByTestId('optional-marker')).toBeTruthy();
    expect(screen.getByText('Optional step')).toBeTruthy();
    const note = screen.getByTestId('important-note');
    expect(within(note).getByText('Important')).toBeTruthy();
    // content that defers to tradition is shown exactly as written
    expect(within(note).getByText('Recitation as per family tradition or pandit.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('next-step'));
    expect(screen.queryByTestId('optional-marker')).toBeNull();
    expect(screen.queryByTestId('important-note')).toBeNull();
  });

  it('shows related samagri as chips that open that item in the Samagri screen', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('safety-start'));
    const block = screen.getByTestId('related-samagri');
    expect(within(block).getByText('Item r1 (fixture)')).toBeTruthy();
    expect(within(block).getByText('Item o1 (fixture)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('related-sm_o1'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, focus: 'sm_o1' },
    });
  });

  it('passes the preparation along to the Samagri screen when there is one', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await open(db, { prep: prep.id });
    await fireEvent.press(screen.getByTestId('safety-start'));
    await fireEvent.press(screen.getByTestId('related-sm_r1'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id, focus: 'sm_r1' },
    });
  });

  it('resumes where you left off, without showing the safety intro again', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await saveVidhiPosition(db, prep.id, 4);
    await open(db, { prep: prep.id });
    expect(counter()).toBe('Step 4 of 5');
    expect(screen.queryByTestId('safety-intro')).toBeNull();
    expect(screen.getByTestId('step-title').props.children).toBe('Main offering');
  });

  it('resumes the most recent preparation of the puja when none is given', async () => {
    const db = await database();
    const older = await createPreparation(db, { pujaId: RICH_ID }, { now: 1 });
    const newer = await createPreparation(db, { pujaId: RICH_ID }, { now: 2 });
    await saveVidhiPosition(db, older.id, 2);
    await saveVidhiPosition(db, newer.id, 5);
    await open(db);
    expect(counter()).toBe('Step 5 of 5');
  });

  it('survives leaving and coming back (a simulated restart)', async () => {
    const db = await database();
    const first = await open(db);
    await fireEvent.press(screen.getByTestId('safety-start'));
    await fireEvent.press(screen.getByTestId('next-step'));
    await fireEvent.press(screen.getByTestId('next-step'));
    const [prep] = await listPreparations(db);
    await waitFor(async () =>
      expect((await getVidhiProgress(db, prep.id))?.lastStepNumber).toBe(3),
    );
    await first.unmount();
    resetPreparationStore();
    await open(db);
    expect(counter()).toBe('Step 3 of 5');
  });

  it('finishes into a clear Completed screen, remembers it, and can restart from step 1', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await saveVidhiPosition(db, prep.id, 5);
    await open(db, { prep: prep.id });
    expect(screen.getByText('Finish')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('next-step'));

    const done = await screen.findByTestId('completed');
    expect(within(done).getByText('Vidhi completed')).toBeTruthy();
    expect(within(done).getByText('You have read all 5 steps.')).toBeTruthy();
    expect(screen.getByTestId('reading-progress').props.accessibilityValue).toMatchObject({
      now: 100,
    });
    await waitFor(async () =>
      expect((await getVidhiProgress(db, prep.id))?.completedAt).not.toBeNull(),
    );

    // reopening shows the Completed screen again
    await fireEvent.press(screen.getByTestId('back-to-puja'));
    expect(back).toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Read again from step 1'));
    expect(counter()).toBe('Step 1 of 5');
    await waitFor(async () =>
      expect(await getVidhiProgress(db, prep.id)).toMatchObject({
        lastStepNumber: 1,
        completedAt: null,
      }),
    );
  });

  it('opens straight on the Completed screen for a finished vidhi', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await markVidhiCompleted(db, prep.id, 5);
    await open(db, { prep: prep.id });
    expect(screen.getByTestId('completed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-checklist'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id },
    });
  });

  describe('text size', () => {
    it('A+ / A- change the same global setting the Settings screen uses', async () => {
      await open(await database());
      expect(useSettingsStore.getState().textSize).toBe('medium');
      await fireEvent.press(screen.getByTestId('text-larger'));
      expect(useSettingsStore.getState().textSize).toBe('large');
      expect(screen.getByTestId('text-size-value').props.children).toBe('Large');
      await fireEvent.press(screen.getByTestId('text-larger'));
      expect(useSettingsStore.getState().textSize).toBe('extraLarge');
      expect(screen.getByTestId('text-larger').props.accessibilityState).toMatchObject({
        disabled: true,
      });
      await fireEvent.press(screen.getByTestId('text-smaller'));
      await fireEvent.press(screen.getByTestId('text-smaller'));
      await fireEvent.press(screen.getByTestId('text-smaller'));
      expect(useSettingsStore.getState().textSize).toBe('small');
      expect(screen.getByTestId('text-smaller').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('has accessible labels', async () => {
      await open(await database());
      expect(screen.getByTestId('text-smaller').props.accessibilityLabel).toBe('Smaller text');
      expect(screen.getByTestId('text-larger').props.accessibilityLabel).toBe('Larger text');
    });

    it('actually scales the step text', async () => {
      await open(await database());
      await fireEvent.press(screen.getByTestId('safety-start'));
      const size = () =>
        (screen.getByTestId('step-description').props.style as Record<string, unknown>[])
          .flat()
          .reduce<number>(
            (acc, st) => (st && typeof st.fontSize === 'number' ? st.fontSize : acc),
            0,
          );
      const before = size();
      await fireEvent.press(screen.getByTestId('text-larger'));
      await fireEvent.press(screen.getByTestId('text-larger'));
      expect(size()).toBeGreaterThan(before);
    });
  });

  it('uses Devanagari-safe line height in Hindi and shows Hindi text', async () => {
    await resetSettings('hi');
    await open(await database());
    await fireEvent.press(screen.getByTestId('safety-start'));
    expect(screen.getByTestId('step-counter').props.children).toBe('चरण 1 / 5');
    expect(screen.getByTestId('step-title').props.children).toBe('स्थान तैयार करें');
    const styles = (
      screen.getByTestId('step-description').props.style as Record<string, number>[]
    ).flat();
    const style = Object.assign({}, ...styles);
    expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.6);
  });

  it('keeps the screen awake while reading and releases it on leaving', async () => {
    const view = await open(await database());
    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
    await view.unmount();
    expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('starts at step 1 for a puja without safety notes', async () => {
    const db = await database();
    await open(db, {}, 'puja_test_lakshmi');
    expect(counter()).toBe('Step 1 of 2');
    expect(screen.queryByTestId('open-safety')).toBeNull();
  });

  it('explains a puja with no steps', async () => {
    const db = await database();
    setParams({ id: EMPTY_ID });
    await renderWithDb(<VidhiScreen />, db);
    expect(await screen.findByText('No steps yet')).toBeTruthy();
    expect(screen.getByText('The vidhi for this puja has not been added yet.')).toBeTruthy();
  });

  it('shows an explanation for an unknown puja', async () => {
    const db = await database();
    setParams({ id: 'puja_nope' });
    await renderWithDb(<VidhiScreen />, db);
    expect(await screen.findByText('This puja is not available')).toBeTruthy();
  });

  it('goes back', async () => {
    await open(await database());
    await fireEvent.press(screen.getByTestId('vidhi-back'));
    expect(back).toHaveBeenCalled();
  });
});
