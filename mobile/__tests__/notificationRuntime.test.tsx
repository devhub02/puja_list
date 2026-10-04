import { AppState } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';

import { createPreparation, getReminder, insertReminder, updateReminder } from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { NotificationRouter } from '@/notifications/NotificationRouter';
import { isQuietRoute } from '@/notifications/quietRoute';
import { createReminder } from '@/notifications/reminderService';
import {
  buildNotificationContent,
  createReminderDeps,
  reconcileAndRefresh,
} from '@/notifications/runtime';
import { setNotificationScheduler, setNotificationTapSource } from '@/notifications/scheduler';
import type { NotificationTap } from '@/notifications/scheduler';
import { useSettingsStore } from '@/store/settingsStore';

import { createFakeScheduler } from '../testing/fakeScheduler';
import type { FakeScheduler } from '../testing/fakeScheduler';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { RICH_ID, makePreparationBundle } from '../testing/preparationFixture';
import { navigate, push, resetRouterMock, setPathname } from '../testing/routerMock';
import { resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

let os: FakeScheduler;

async function database() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makePreparationBundle());
  return db;
}

beforeEach(async () => {
  resetRouterMock();
  await resetSettings('en');
  os = createFakeScheduler();
  setNotificationScheduler(os);
  setNotificationTapSource(null);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  setNotificationScheduler(null);
  setNotificationTapSource(null);
  jest.restoreAllMocks();
});

describe('notification text', () => {
  it('is the puja name plus one generic line, in the selected language, and nothing else', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID, title: 'A private label' });
    const en = await buildNotificationContent(db, prep.id);
    expect(en).toEqual({
      title: 'Rich Puja (fixture)',
      body: 'Time to check your samagri checklist.',
    });
    expect(JSON.stringify(en)).not.toContain('private label');

    await resetSettings('hi');
    const hi = await buildNotificationContent(db, prep.id);
    expect(hi).toEqual({
      title: 'Rich Puja (परीक्षण)',
      body: 'अपनी सामग्री की सूची देखने का समय हो गया है।',
    });
  });

  it('falls back to English when the puja has no text in the selected language', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: 'puja_test_lakshmi' });
    await resetSettings('hi');
    const content = await buildNotificationContent(db, prep.id);
    expect(content.title.length).toBeGreaterThan(0);
  });

  it('uses a generic title when the puja no longer exists (no crash)', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: 'puja_gone' });
    expect((await buildNotificationContent(db, prep.id)).title).toBe('Puja reminder');
    expect((await buildNotificationContent(db, 'prep_missing')).title).toBe('Puja reminder');
  });

  it('is used when a reminder is scheduled through the app deps (language chosen at scheduling time)', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    await resetSettings('hi');
    await createReminder(createReminderDeps(db), {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    expect([...os.scheduled.values()][0].title).toBe('Rich Puja (परीक्षण)');
    expect(useSettingsStore.getState().language).toBe('hi');
  });
});

describe('NotificationRouter', () => {
  async function mount(db: Awaited<ReturnType<typeof database>>) {
    return render(
      <DatabaseProvider db={db}>
        <NotificationRouter />
      </DatabaseProvider>,
    );
  }

  it('renders nothing and reconciles after the first frame, never during it (missing reminders get scheduled)', async () => {
    jest.useFakeTimers();
    try {
      const db = await database();
      const prep = await createPreparation(db, { pujaId: RICH_ID });
      const reminder = await insertReminder(db, {
        preparationId: prep.id,
        scheduledAt: '2031-11-08T07:00',
      });
      const view = await mount(db);
      expect(view.toJSON()).toBeNull();
      // the first render has finished and nothing was scheduled yet: the work is deferred
      expect(os.calls).not.toContain('schedule');
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      await waitFor(async () =>
        expect((await getReminder(db, reminder.id))?.notificationId).toBe('os-1'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('reconciles again when the app returns to the foreground', async () => {
    let onChange: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      handler: (s: string) => void,
    ) => {
      onChange = handler;
      return { remove: jest.fn() };
    }) as never);
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    os.permission = { status: 'denied', canAskAgain: false };
    await mount(db);
    await waitFor(async () =>
      expect((await getReminder(db, reminder.id))?.pausedReason).toBe('no_permission'),
    );
    // the user allows notifications in the system settings and comes back
    os.permission = { status: 'granted', canAskAgain: true };
    await act(async () => onChange('active'));
    await waitFor(async () =>
      expect((await getReminder(db, reminder.id))?.notificationId).toBe('os-1'),
    );
  });

  it('does nothing harmful without a scheduler', async () => {
    setNotificationScheduler(null);
    const db = await database();
    const view = await mount(db);
    expect(view.toJSON()).toBeNull();
  });

  it('opens the checklist for the tap that launched the app, and for later taps, once each', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    let listener: (tap: NotificationTap) => void = () => undefined;
    const initial: NotificationTap = { preparationId: prep.id, key: 'first' };
    setNotificationTapSource({
      initialTap: () => initial,
      subscribe: (l) => {
        listener = l;
        return () => undefined;
      },
    });
    await mount(db);
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith({
      pathname: '/puja/[id]/samagri',
      params: { id: RICH_ID, prep: prep.id },
    });
    await act(async () => listener(initial)); // the same tap again is ignored
    await act(async () => listener({ preparationId: 'prep_deleted', key: 'second' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/preparation'));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('marks the vidhi reader as a quiet route so a reminder never interrupts it', async () => {
    const db = await database();
    setPathname('/puja/puja_x/vidhi');
    await mount(db);
    expect(isQuietRoute()).toBe(true);
    setPathname('/puja/puja_x/samagri');
    await mount(db);
    expect(isQuietRoute()).toBe(false);
    expect(screen).toBeTruthy();
  });
});

describe('a reminder paused by the user stays paused through reconcile', () => {
  it('does not schedule a disabled reminder', async () => {
    const db = await database();
    const prep = await createPreparation(db, { pujaId: RICH_ID });
    const reminder = await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2031-11-08T07:00',
    });
    await updateReminder(db, reminder.id, { enabled: false });
    await reconcileAndRefresh(db);
    expect(os.scheduled.size).toBe(0);
  });
});
