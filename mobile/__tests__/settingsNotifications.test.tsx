import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import PreparationScreen from '../app/(tabs)/preparation';
import SettingsScreen from '../app/(tabs)/settings';
import {
  addCustomItem,
  createPreparation,
  getReminder,
  insertReminder,
  listPreparations,
  listReminders,
  savePuja,
  setItemChecked,
  updateReminder,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { setNotificationScheduler } from '@/notifications/scheduler';
import { USER_DATA_TABLES } from '@/services/resetLocalData';
import { resetPreparationStore } from '@/store/preparationStore';
import { resetReminderStore, useReminderStore } from '@/store/reminderStore';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '@/store/settingsStore';
import { resetUserStateStore } from '@/store/userStateStore';

import { createFakeScheduler } from '../testing/fakeScheduler';
import type { FakeScheduler } from '../testing/fakeScheduler';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { push, resetRouterMock } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

let os: FakeScheduler;

async function database() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle());
  return db;
}
type Db = Awaited<ReturnType<typeof database>>;

beforeEach(async () => {
  resetRouterMock();
  resetPreparationStore();
  resetReminderStore();
  resetUserStateStore();
  await resetSettings('en');
  os = createFakeScheduler({ status: 'undetermined', canAskAgain: true });
  setNotificationScheduler(os);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  setNotificationScheduler(null);
  jest.restoreAllMocks();
});

async function withScheduledReminder(db: Db) {
  const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
  const reminder = await insertReminder(db, {
    preparationId: prep.id,
    scheduledAt: '2031-11-08T07:00',
  });
  await updateReminder(db, reminder.id, { notificationId: 'os-seed' });
  os.scheduled.set('os-seed', {
    title: 't',
    body: 'b',
    at: new Date(2031, 10, 8, 7, 0),
    data: { reminderId: reminder.id, preparationId: prep.id },
  });
  return { prep, reminder };
}

describe('Settings: notifications', () => {
  it('shows the section with the switch on, the permission line, the battery note and both links', async () => {
    await renderWithDb(<SettingsScreen />, await database());
    expect(await screen.findByText('Notifications')).toBeTruthy();
    expect(screen.getByTestId('notifications-switch').props.value).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId('permission-line').props.children).toMatch(/Not asked yet/),
    );
    expect(
      screen.getByText(/Android may delay notifications because of battery optimization/),
    ).toBeTruthy();
    // opening Settings never triggers a permission prompt
    expect(os.calls).not.toContain('requestPermission');

    await fireEvent.press(screen.getByTestId('settings-manage-reminders'));
    expect(push).toHaveBeenCalledWith('/reminders');
    await fireEvent.press(screen.getByTestId('settings-open-system'));
    await waitFor(() => expect(os.settingsOpened).toBe(1));
  });

  it('reports each permission state', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    await renderWithDb(<SettingsScreen />, await database());
    await waitFor(() =>
      expect(screen.getByTestId('permission-line').props.children).toMatch(/Allowed/),
    );
    os.permission = { status: 'denied', canAskAgain: false };
    await act(async () => useReminderStore.getState().bump());
    await waitFor(() =>
      expect(screen.getByTestId('permission-line').props.children).toMatch(
        /Blocked in the phone settings/,
      ),
    );
  });

  it('picks up a permission granted later in the system settings when the app returns to the foreground', async () => {
    os.permission = { status: 'denied', canAskAgain: false };
    let onChange: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      handler: (s: string) => void,
    ) => {
      onChange = handler;
      return { remove: jest.fn() };
    }) as never);
    await renderWithDb(<SettingsScreen />, await database());
    await waitFor(() =>
      expect(screen.getByTestId('permission-line').props.children).toMatch(/Blocked/),
    );
    os.permission = { status: 'granted', canAskAgain: true };
    await act(async () => onChange('active'));
    await waitFor(() =>
      expect(screen.getByTestId('permission-line').props.children).toMatch(/Allowed/),
    );
  });

  it('switching off cancels everything scheduled but keeps the reminders, paused; the choice is persisted', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    const db = await database();
    const { reminder } = await withScheduledReminder(db);
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent(await screen.findByTestId('notifications-switch'), 'valueChange', false);

    await waitFor(async () =>
      expect(await getReminder(db, reminder.id)).toMatchObject({
        pausedReason: 'global_off',
        notificationId: null,
      }),
    );
    expect(os.scheduled.size).toBe(0);
    expect(await listReminders(db)).toHaveLength(1);
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false);
    expect(screen.getByTestId('notifications-off-note')).toBeTruthy();
    const saved = JSON.parse((await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)) as string);
    expect(saved.state.notificationsEnabled).toBe(false);
  });

  it('switching on again asks for permission if needed, then reschedules enabled future reminders', async () => {
    useSettingsStore.setState({ notificationsEnabled: false });
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    await updateReminder(db, reminder.id, { pausedReason: 'global_off' });
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent(await screen.findByTestId('notifications-switch'), 'valueChange', true);
    expect(await screen.findByTestId('permission-why-dialog')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('permission-why-continue'));
    await waitFor(async () =>
      expect(await getReminder(db, reminder.id)).toMatchObject({
        notificationId: 'os-1',
        pausedReason: null,
      }),
    );
    expect(os.calls).toContain('requestPermission');
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
  });

  it('switching on with permission blocked leaves reminders paused and offers the system settings', async () => {
    os.permission = { status: 'denied', canAskAgain: false };
    useSettingsStore.setState({ notificationsEnabled: false });
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent(await screen.findByTestId('notifications-switch'), 'valueChange', true);
    expect(await screen.findByTestId('permission-paused-dialog')).toBeTruthy();
    expect(await getReminder(db, reminder.id)).toMatchObject({ pausedReason: 'no_permission' });
    await fireEvent.press(screen.getByTestId('permission-open-settings'));
    await waitFor(() => expect(os.settingsOpened).toBe(1));
  });

  it('shows the notification texts in Hindi', async () => {
    await resetSettings('hi');
    await renderWithDb(<SettingsScreen />, await database());
    expect(await screen.findByText('सूचनाएँ')).toBeTruthy();
    expect(screen.getByText('रिमाइंडर संभालें')).toBeTruthy();
    expect(screen.getByText('स्थानीय डेटा मिटाएँ…')).toBeTruthy();
  });
});

describe('Settings: reset local data', () => {
  async function fullDb() {
    const db = await database();
    const { prep } = await withScheduledReminder(db);
    await setItemChecked(db, prep.id, 'samagri', 'sm_r1', true);
    await addCustomItem(db, prep.id, { name: 'Mine' });
    await savePuja(db, RICH_ID);
    await db.run('INSERT INTO recent_view (puja_id, viewed_at) VALUES (?, ?)', [RICH_ID, 5]);
    await db.run('INSERT INTO recent_search (query, searched_at) VALUES (?, ?)', ['rich', 6]);
    return db;
  }

  it('sits in a danger section at the bottom and the dialog states what is and is not deleted', async () => {
    await renderWithDb(<SettingsScreen />, await fullDb());
    expect(await screen.findByTestId('danger-section')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reset-data-open'));
    const dialog = await screen.findByTestId('reset-data-dialog');
    const deletes = within(dialog)
      .getAllByTestId('reset-deletes-item')
      .map((n) => n.props.children);
    expect(deletes).toEqual([
      '• Saved pujas',
      '• Preparations and their checklist progress',
      '• Your custom items',
      '• Recently viewed pujas and recent searches',
      '• All reminders',
    ]);
    const keeps = within(dialog)
      .getAllByTestId('reset-keeps-item')
      .map((n) => n.props.children);
    expect(keeps).toEqual([
      '• Puja content in the app',
      '• Your language, theme, text size and notification settings',
    ]);
  });

  it('is hard to trigger by accident: confirm stays disabled until the word RESET is typed', async () => {
    const db = await fullDb();
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent.press(await screen.findByTestId('reset-data-open'));
    const confirm = () => screen.getByTestId('reset-data-confirm');
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(confirm());
    expect(await listPreparations(db)).toHaveLength(1);
    await fireEvent.changeText(screen.getByTestId('reset-data-input'), 'rese');
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('reset-data-input'), ' reset ');
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    // cancelling deletes nothing
    await fireEvent.press(screen.getByTestId('reset-data-cancel'));
    expect(await listPreparations(db)).toHaveLength(1);
    expect(os.scheduled.size).toBe(1);
  });

  it('deletes only user data in one go, keeps content and settings, cancels notifications', async () => {
    const db = await fullDb();
    useSettingsStore.setState({ themeMode: 'dark', textSize: 'large' });
    const content = await db.all('SELECT * FROM puja ORDER BY id');
    const meta = await db.all('SELECT * FROM content_meta ORDER BY key');
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent.press(await screen.findByTestId('reset-data-open'));
    await fireEvent.changeText(screen.getByTestId('reset-data-input'), 'RESET');
    await fireEvent.press(screen.getByTestId('reset-data-confirm'));

    await waitFor(async () => expect(await listPreparations(db)).toEqual([]));
    for (const table of USER_DATA_TABLES) {
      expect(await db.all(`SELECT * FROM ${table}`)).toEqual([]);
    }
    expect(await db.all('SELECT * FROM puja ORDER BY id')).toEqual(content);
    expect(await db.all('SELECT * FROM content_meta ORDER BY key')).toEqual(meta);
    expect(os.scheduled.size).toBe(0);
    expect(os.calls).toContain('cancelAll');
    expect(useSettingsStore.getState()).toMatchObject({
      language: 'en',
      themeMode: 'dark',
      textSize: 'large',
      notificationsEnabled: true,
    });
    await waitFor(() => expect(screen.queryByTestId('reset-data-dialog')).toBeNull());
  });

  it('a failure rolls back, deletes nothing, and shows a translated error in the dialog', async () => {
    const db = await fullDb();
    let deletes = 0;
    db.failOnStatement = (sql) => sql.startsWith('DELETE FROM') && (deletes += 1) === 3;
    await renderWithDb(<SettingsScreen />, db);
    await fireEvent.press(await screen.findByTestId('reset-data-open'));
    await fireEvent.changeText(screen.getByTestId('reset-data-input'), 'RESET');
    await fireEvent.press(screen.getByTestId('reset-data-confirm'));
    expect(
      await screen.findByText(
        'Nothing was deleted because something went wrong. Please try again.',
      ),
    ).toBeTruthy();
    db.failOnStatement = undefined;
    expect(await listPreparations(db)).toHaveLength(1);
    expect(await listReminders(db)).toHaveLength(1);
    expect(os.scheduled.size).toBe(1);
    expect(screen.getByTestId('reset-data-dialog')).toBeTruthy();
  });

  it('refreshes the in-memory screens so they show empty states without a restart', async () => {
    const db = await fullDb();
    await renderWithDb(
      <>
        <SettingsScreen />
        <PreparationScreen />
      </>,
      db,
    );
    expect(await screen.findByTestId(/^prep-card-/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reset-data-open'));
    await fireEvent.changeText(screen.getByTestId('reset-data-input'), 'RESET');
    await fireEvent.press(screen.getByTestId('reset-data-confirm'));
    expect(await screen.findByText('Nothing to prepare yet')).toBeTruthy();
    expect(screen.queryByTestId(/^prep-card-/)).toBeNull();
    expect(screen.getByText('Tap the heart on a puja to keep it here.')).toBeTruthy();
  });
});
