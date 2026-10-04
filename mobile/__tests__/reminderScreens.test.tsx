import { Share } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import ManageRemindersScreen from '../app/reminders';
import PreparationScreen from '../app/(tabs)/preparation';
import SamagriScreen from '../app/puja/[id]/samagri';
import {
  createPreparation,
  getReminder,
  insertReminder,
  listPreparations,
  listReminders,
  updateReminder,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { openTappedReminder } from '@/notifications/NotificationRouter';
import { setNotificationScheduler } from '@/notifications/scheduler';
import { resetPreparationStore } from '@/store/preparationStore';
import { resetReminderStore } from '@/store/reminderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { resetUserStateStore } from '@/store/userStateStore';
import { pickDate, pickTime } from '@/utils/dateTimePicker';

import { createFakeScheduler } from '../testing/fakeScheduler';
import type { FakeScheduler } from '../testing/fakeScheduler';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { navigate, push, resetRouterMock, setParams } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock);
jest.mock('@/utils/dateTimePicker', () => ({ pickDate: jest.fn(), pickTime: jest.fn() }));

// TEST FIXTURE dates: the device "today" is 2031-10-04 (dateMock); the fixture festival runs 2031-10-30.
const LAKSHMI = 'puja_test_lakshmi';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../testing/dateMock').setToday('2031-10-04');
  (pickDate as jest.Mock).mockReset().mockResolvedValue('2031-11-08');
  (pickTime as jest.Mock).mockReset().mockResolvedValue('07:00');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  setNotificationScheduler(null);
  jest.restoreAllMocks();
});

async function openSamagri(db: Db, pujaId = RICH_ID, params: Record<string, string> = {}) {
  setParams({ id: pujaId, ...params });
  await renderWithDb(<SamagriScreen />, db);
  await screen.findByTestId('overall-text');
}

async function fillAndSave() {
  await fireEvent.press(await screen.findByTestId('reminder-add'));
  await fireEvent.press(screen.getByTestId('pick-date'));
  await fireEvent.press(screen.getByTestId('pick-time'));
  await waitFor(() =>
    expect(screen.getByTestId('reminder-save').props.accessibilityState.disabled).toBe(false),
  );
  await fireEvent.press(screen.getByTestId('reminder-save'));
}

describe('Remind me on the Samagri screen', () => {
  it('opens the sheet without creating a preparation, with the battery note and an empty list', async () => {
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    expect(await screen.findByTestId('reminder-sheet')).toBeTruthy();
    expect(screen.getByTestId('battery-note')).toBeTruthy();
    expect(
      screen.getByText(/Android may delay notifications because of battery optimization/),
    ).toBeTruthy();
    expect(screen.getByTestId('reminder-empty')).toBeTruthy();
    expect(await listPreparations(db)).toEqual([]);
  });

  it('first save: explains why, asks permission, creates the default preparation lazily and schedules', async () => {
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();

    // the explanation comes BEFORE the system dialog
    expect(await screen.findByTestId('permission-why-dialog')).toBeTruthy();
    expect(os.calls).not.toContain('requestPermission');
    await fireEvent.press(screen.getByTestId('permission-why-continue'));

    await waitFor(async () => expect(await listReminders(db)).toHaveLength(1));
    expect(os.calls).toContain('requestPermission');
    expect(os.channels).toHaveLength(1);
    expect(os.channels[0].name).toBe('Puja reminders');
    const [reminder] = await listReminders(db);
    expect(reminder).toMatchObject({
      scheduledAt: '2031-11-08T07:00',
      notificationId: 'os-1',
      pausedReason: null,
    });
    expect(await listPreparations(db)).toHaveLength(1);
    expect([...os.scheduled.values()][0]).toMatchObject({
      title: 'Rich Puja (fixture)',
      body: 'Time to check your samagri checklist.',
    });
    expect(await screen.findByTestId(`reminder-${reminder.id}`)).toBeTruthy();
  });

  it('never asks for permission just by opening the screen or the sheet', async () => {
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await screen.findByTestId('reminder-sheet');
    expect(os.calls).not.toContain('requestPermission');
    expect(os.calls).not.toContain('ensureChannel');
  });

  it('"Not now" at the explanation: the reminder is saved paused, a dialog says so, and settings can be opened', async () => {
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();
    await fireEvent.press(await screen.findByTestId('permission-why-later'));

    const dialog = await screen.findByTestId('permission-paused-dialog');
    expect(within(dialog).getByText('Reminder saved, but paused')).toBeTruthy();
    const [reminder] = await listReminders(db);
    expect(reminder).toMatchObject({ notificationId: null, pausedReason: 'no_permission' });
    expect(os.calls).not.toContain('requestPermission');
    await fireEvent.press(screen.getByTestId('permission-open-settings'));
    await waitFor(() => expect(os.settingsOpened).toBe(1));
  });

  it('permission denied for good: no explanation, saved paused, blocked wording and a settings button', async () => {
    os.permission = { status: 'denied', canAskAgain: false };
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();
    const dialog = await screen.findByTestId('permission-paused-dialog');
    expect(within(dialog).getByText(/blocked for Puja Saathi in your phone settings/)).toBeTruthy();
    expect(screen.queryByTestId('permission-why-dialog')).toBeNull();
    expect((await listReminders(db))[0].pausedReason).toBe('no_permission');
    expect(os.scheduled.size).toBe(0);
  });

  it('denied in the system dialog: saved paused and the app keeps working', async () => {
    os.nextRequestResult = { status: 'denied', canAskAgain: true };
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();
    await fireEvent.press(await screen.findByTestId('permission-why-continue'));
    expect(await screen.findByTestId('permission-paused-dialog')).toBeTruthy();
    expect((await listReminders(db))[0].pausedReason).toBe('no_permission');
    await fireEvent.press(screen.getByTestId('permission-paused-close'));
    expect(screen.queryByTestId('permission-paused-dialog')).toBeNull();
    expect(screen.getByTestId('reminder-sheet')).toBeTruthy();
  });

  it('with the global switch off: no permission prompt, saved paused, and the sheet explains', async () => {
    useSettingsStore.setState({ notificationsEnabled: false });
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    expect(screen.getByTestId('notifications-off-note')).toBeTruthy();
    await fillAndSave();
    const dialog = await screen.findByTestId('permission-paused-dialog');
    expect(within(dialog).getByText(/Notifications are switched off in Settings/)).toBeTruthy();
    // no "open system settings" button: the switch is in the app's own Settings
    expect(screen.queryByTestId('permission-open-settings')).toBeNull();
    expect(os.calls).not.toContain('requestPermission');
    expect((await listReminders(db))[0]).toMatchObject({
      pausedReason: 'global_off',
      notificationId: null,
    });
  });

  it('rejects a time in the past with a translated message and saves nothing', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    (pickDate as jest.Mock).mockResolvedValue('2020-01-01');
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();
    expect(await screen.findByText('Choose a time in the future.')).toBeTruthy();
    expect(await listReminders(db)).toEqual([]);
    // a refused first reminder does not leave a preparation behind
    expect(await listPreparations(db)).toEqual([]);
    expect(os.calls).not.toContain('requestPermission');
  });

  it('shows the past-time error in Hindi', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    await resetSettings('hi');
    (pickDate as jest.Mock).mockResolvedValue('2020-01-01');
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fillAndSave();
    expect(await screen.findByText('आगे का कोई समय चुनें।')).toBeTruthy();
  });

  it('keeps Save disabled until a date and a time are chosen', async () => {
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId('reminder-add'));
    expect(screen.getByTestId('reminder-save').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('reminder-need')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pick-date'));
    expect(screen.getByTestId('reminder-save').props.accessibilityState.disabled).toBe(true);
  });

  it('a dismissed picker changes nothing', async () => {
    (pickDate as jest.Mock).mockResolvedValue(null);
    const db = await database();
    await openSamagri(db);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId('reminder-add'));
    await fireEvent.press(screen.getByTestId('pick-date'));
    expect(screen.getByText('Choose date')).toBeTruthy();
  });

  it('offers quick picks only when the puja has a festival with a real future bundled date; they set the date only', async () => {
    const db = await database();
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId('reminder-add'));
    expect(screen.queryByTestId('quick-picks')).toBeNull(); // the rich puja has no festival date
  });

  it('quick picks for a puja whose festival has a bundled date: day before / morning of, time still needed', async () => {
    const db = await database();
    await openSamagri(db, LAKSHMI);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId('reminder-add'));
    expect(await screen.findByTestId('quick-picks')).toBeTruthy();
    expect(screen.getByText('Day before the festival')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('quick-dayBefore'));
    expect(screen.getByText(/Date: 29 Oct 2031/)).toBeTruthy();
    // the date is set but the user still has to confirm a time
    expect(screen.getByTestId('reminder-save').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('quick-morningOf'));
    expect(screen.getByText(/Date: 30 Oct 2031/)).toBeTruthy();
  });

  it('shows no quick picks once the festival date has passed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../testing/dateMock').setToday('2031-11-10');
    const db = await database();
    await openSamagri(db, LAKSHMI);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId('reminder-add'));
    expect(screen.queryByTestId('quick-picks')).toBeNull();
  });
});

describe('the reminder list in the sheet', () => {
  async function withReminder(db: Db) {
    os.permission = { status: 'granted', canAskAgain: true };
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
      label: 'flowers',
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

  it('shows the reminder with its time, note and status, and switches it off and on', async () => {
    const db = await database();
    const { reminder } = await withReminder(db);
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('remind-me'));
    expect(await screen.findByTestId(`reminder-when-${reminder.id}`)).toBeTruthy();
    expect(screen.getByText('flowers')).toBeTruthy();
    expect(screen.getByTestId(`reminder-status-${reminder.id}`).props.children).toBe('On');

    await fireEvent(screen.getByTestId(`reminder-switch-${reminder.id}`), 'valueChange', false);
    await waitFor(async () => expect((await getReminder(db, reminder.id))?.enabled).toBe(false));
    expect(os.scheduled.size).toBe(0);
    await waitFor(() =>
      expect(screen.getByTestId(`reminder-status-${reminder.id}`).props.children).toBe('Off'),
    );

    await fireEvent(screen.getByTestId(`reminder-switch-${reminder.id}`), 'valueChange', true);
    await waitFor(async () =>
      expect((await getReminder(db, reminder.id))?.notificationId).not.toBeNull(),
    );
    expect(os.scheduled.size).toBe(1);
  });

  it('edits a reminder: the old notification is cancelled and the new time scheduled', async () => {
    const db = await database();
    const { reminder } = await withReminder(db);
    (pickTime as jest.Mock).mockResolvedValue('18:30');
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId(`reminder-edit-${reminder.id}`));
    await fireEvent.press(screen.getByTestId('pick-time'));
    await fireEvent.press(screen.getByTestId('reminder-save'));
    await waitFor(async () =>
      expect((await getReminder(db, reminder.id))?.scheduledAt).toBe('2031-11-08T18:30'),
    );
    expect(os.calls).toContain('cancel:os-seed');
    expect(os.scheduled.size).toBe(1);
  });

  it('deleting needs a confirmation; cancelling keeps it, confirming removes it and its notification', async () => {
    const db = await database();
    const { reminder } = await withReminder(db);
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await fireEvent.press(await screen.findByTestId(`reminder-delete-${reminder.id}`));
    expect(await screen.findByTestId('reminder-delete-dialog')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reminder-delete-cancel'));
    expect(await getReminder(db, reminder.id)).not.toBeNull();

    await fireEvent.press(screen.getByTestId(`reminder-delete-${reminder.id}`));
    await fireEvent.press(await screen.findByTestId('reminder-delete-confirm'));
    await waitFor(async () => expect(await getReminder(db, reminder.id)).toBeNull());
    expect(os.scheduled.size).toBe(0);
    expect(await screen.findByTestId('reminder-empty')).toBeTruthy();
  });

  it('stops offering "Add" at the per-checklist limit and says why', async () => {
    const db = await database();
    const { prep } = await withReminder(db);
    for (let i = 2; i <= 5; i += 1) {
      await insertReminder(db, { preparationId: prep.id, scheduledAt: `2031-11-0${i}T07:00` });
    }
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('remind-me'));
    await screen.findByTestId('reminder-add');
    await waitFor(() =>
      expect(screen.getByTestId('reminder-add').props.accessibilityState.disabled).toBe(true),
    );
    expect(screen.getByText('You can set up to 5 reminders for one checklist.')).toBeTruthy();
  });
});

describe('Manage reminders screen', () => {
  it('has a real empty state that leads to My Preparation', async () => {
    const db = await database();
    await renderWithDb(<ManageRemindersScreen />, db);
    expect(await screen.findByText('No reminders yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Open My Preparation'));
    expect(navigate).toHaveBeenCalledWith('/preparation');
  });

  it('groups reminders as upcoming, paused and past, each with its checklist name', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    const upcoming = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    const paused = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-09T07:00',
    });
    await updateReminder(db, paused.id, { enabled: false });
    const past = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2020-01-01T07:00',
    });
    await renderWithDb(<ManageRemindersScreen />, db);
    await screen.findByTestId('reminders-list');
    expect(screen.getByText('Upcoming (1)')).toBeTruthy();
    expect(screen.getByText('Paused (1)')).toBeTruthy();
    expect(screen.getByText('Past (1)')).toBeTruthy();
    expect(screen.getAllByText('Rich Puja (fixture), Home').length).toBe(3);
    expect(screen.getByTestId(`reminder-status-${upcoming.id}`).props.children).toBe('On');
    expect(screen.getByTestId(`reminder-status-${paused.id}`).props.children).toBe('Off');
    expect(screen.getByTestId(`reminder-status-${past.id}`).props.children).toBe('Time has passed');
    // a past reminder cannot be switched on
    expect(screen.getByTestId(`reminder-switch-${past.id}`).props.disabled).toBe(true);
  });

  it('toggles and deletes from the list (with confirmation)', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    await renderWithDb(<ManageRemindersScreen />, db);
    await fireEvent(
      await screen.findByTestId(`reminder-switch-${reminder.id}`),
      'valueChange',
      true,
    );
    await waitFor(async () =>
      expect((await getReminder(db, reminder.id))?.notificationId).toBe('os-1'),
    );
    await fireEvent.press(screen.getByTestId(`reminder-delete-${reminder.id}`));
    await fireEvent.press(await screen.findByTestId('reminder-delete-confirm'));
    await waitFor(async () => expect(await listReminders(db)).toEqual([]));
    expect(os.scheduled.size).toBe(0);
    expect(await screen.findByText('No reminders yet')).toBeTruthy();
  });

  it('edit opens the form for that reminder', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    await renderWithDb(<ManageRemindersScreen />, db);
    await fireEvent.press(await screen.findByTestId(`reminder-edit-${reminder.id}`));
    expect(await screen.findByText('Edit reminder')).toBeTruthy();
    expect(screen.getByText(/Date: 8 Nov 2031/)).toBeTruthy();
  });

  it('says when notifications are off in Settings', async () => {
    useSettingsStore.setState({ notificationsEnabled: false });
    await renderWithDb(<ManageRemindersScreen />, await database());
    expect(await screen.findByTestId('notifications-off-note')).toBeTruthy();
  });
});

describe('My Preparation: reminder and share actions', () => {
  it('each card has a reminder action that opens the same sheet for that preparation', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    await renderWithDb(<PreparationScreen />, db);
    await fireEvent.press(await screen.findByTestId(`prep-remind-${prep.id}`));
    expect(await screen.findByTestId('reminder-sheet')).toBeTruthy();
    expect(screen.getByTestId('reminder-sheet-title').props.children).toBe(
      'Rich Puja (fixture), Home',
    );
  });

  it('links to Manage reminders', async () => {
    await renderWithDb(<PreparationScreen />, await database());
    await fireEvent.press(await screen.findByTestId('manage-reminders'));
    expect(push).toHaveBeenCalledWith('/reminders');
  });

  it('deleting a preparation takes its OS notifications away too', async () => {
    os.permission = { status: 'granted', canAskAgain: true };
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
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
    await renderWithDb(<PreparationScreen />, db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${prep.id}`));
    await fireEvent.press(screen.getByTestId('action-delete'));
    await fireEvent.press(screen.getByTestId('delete-prep-confirm'));
    await waitFor(() => expect(os.scheduled.size).toBe(0));
    expect(await listReminders(db)).toEqual([]);
  });

  it('shares the checklist as text from the card menu; cancelling the share sheet is not an error', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'Home' });
    await renderWithDb(<PreparationScreen />, db);
    await fireEvent.press(await screen.findByTestId(`prep-more-${prep.id}`));
    await fireEvent.press(screen.getByTestId('action-share'));
    await fireEvent.press(await screen.findByTestId('share-mode-needed'));
    await fireEvent.press(screen.getByTestId('share-send'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message.split('\n').slice(0, 2)).toEqual(['Rich Puja (fixture)', 'Home']);
    expect(message).toContain('[ ] Item r1 (fixture) (As needed)');
    await waitFor(() => expect(screen.queryByTestId('share-dialog')).toBeNull());
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('share from the Samagri screen', () => {
  it('shares all items, including ticked ones, in the selected language', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await resetSettings('hi');
    const db = await database();
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('share-checklist'));
    await fireEvent.press(await screen.findByTestId('share-send'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain('आवश्यक');
    expect(message).toContain('[ ] Item r1 (परीक्षण)');
    expect(message).toContain('पूजा साथी - विधि और सामग्री');
  });

  it('shows a translated error when sharing fails', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no app'));
    const db = await database();
    await openSamagri(db, RICH_ID);
    await fireEvent.press(screen.getByTestId('share-checklist'));
    await fireEvent.press(await screen.findByTestId('share-send'));
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    // the dialog stays open so the user can try again
    expect(screen.getByTestId('share-dialog')).toBeTruthy();
  });

  it('a checklist with nothing to share explains and does not share', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const db = await database();
    const prep = await createPreparation(db, { pujaId: EMPTY_PUJA });
    expect(prep.id).toBeTruthy();
    await openSamagri(db, EMPTY_PUJA);
    await fireEvent.press(screen.getByTestId('share-checklist'));
    await fireEvent.press(await screen.findByTestId('share-mode-needed'));
    expect(screen.getByTestId('share-nothing')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('share-send'));
    expect(share).not.toHaveBeenCalled();
  });
});
const EMPTY_PUJA = 'puja_test_empty';

describe('tapping a reminder notification', () => {
  it('opens the checklist of its preparation', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await act(async () => {
      await openTappedReminder(db, { push, navigate } as never, {
        preparationId: prep.id,
        key: 'k',
      });
    });
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id },
    });
  });

  it('opens My Preparation (no crash) when the preparation no longer exists or the tap carries no id', async () => {
    const db = await database();
    await openTappedReminder(db, { push, navigate } as never, {
      preparationId: 'prep_gone',
      key: 'a',
    });
    await openTappedReminder(db, { push, navigate } as never, { preparationId: null, key: 'b' });
    expect(push).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('/preparation');
  });
});
