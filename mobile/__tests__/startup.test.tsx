import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';

import SettingsScreen from '../app/(tabs)/settings';
import { StartupError } from '@/components/StartupError';
import { DatabaseProvider, useDatabaseInit } from '@/db/DatabaseProvider';
import { seedContentIfNeeded } from '@/db/seed';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { renderThemed, resetSettings } from '../testing/utils';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

beforeEach(() => resetSettings('en'));

describe('StartupError', () => {
  it('shows a translated message and a Retry button (English)', async () => {
    const onRetry = jest.fn();
    await renderThemed(<StartupError onRetry={onRetry} />);
    expect(screen.getByText('Could not open the puja library')).toBeTruthy();
    const retry = screen.getByTestId('startup-retry');
    expect(retry.props.accessibilityRole).toBe('button');
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('is translated to Hindi', async () => {
    await resetSettings('hi');
    await renderThemed(<StartupError onRetry={jest.fn()} />);
    expect(screen.getByText('पूजा लाइब्रेरी नहीं खुल सकी')).toBeTruthy();
    expect(screen.getByText('फिर कोशिश करें')).toBeTruthy();
  });

  it('disables the button while a retry is running', async () => {
    const onRetry = jest.fn();
    await renderThemed(<StartupError onRetry={onRetry} busy />);
    expect(screen.getByText('Trying again…')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('startup-retry'));
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe('useDatabaseInit', () => {
  it('goes loading -> error -> (retry) -> ready, without ever "unsettling" the splash gate', async () => {
    const db = createMigratedDb();
    let failFirst!: (error: Error) => void;
    let finishSecond!: () => void;
    const init = jest
      .fn<Promise<typeof db>, []>()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (failFirst = reject)))
      .mockImplementationOnce(() => new Promise((resolve) => (finishSecond = () => resolve(db))));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = await renderHook(() => useDatabaseInit(init));
    expect(result.current.status).toBe('loading');
    expect(result.current.settledOnce).toBe(false);

    await act(async () => failFirst(new Error('disk full')));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.settledOnce).toBe(true);

    await act(async () => result.current.retry());
    expect(result.current.status).toBe('loading');
    expect(result.current.settledOnce).toBe(true);

    await act(async () => finishSecond());
    expect(result.current.status).toBe('ready');
    expect(result.current.db).toBe(db);
    expect(init).toHaveBeenCalledTimes(2);
  });
});

describe('Settings > About content info', () => {
  it('shows the real content version and puja count from the database', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle({ contentVersion: 7, checksum: 'sha256:x' }));
    await renderThemed(
      <DatabaseProvider db={db}>
        <SettingsScreen />
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('content-version').props.children).toBe(7));
    expect(screen.getByTestId('puja-count').props.children).toBe(3);
    expect(screen.getByTestId('festival-count').props.children).toBe(2);
    expect(screen.getByText('Content version')).toBeTruthy();
    expect(screen.getByText('Pujas in this version')).toBeTruthy();
    expect(screen.getByText('Festivals in this version')).toBeTruthy();
  });

  it('shows 0 pujas for the empty Phase 2 bundle', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(
      db,
      makeFixtureBundle({ festivals: [], pujas: [], samagri: [], calendar: [], contentVersion: 1 }),
    );
    await renderThemed(
      <DatabaseProvider db={db}>
        <SettingsScreen />
      </DatabaseProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('content-version').props.children).toBe(1));
    expect(screen.getByTestId('puja-count').props.children).toBe(0);
  });

  it('shows "Not loaded" (translated) when there is no database', async () => {
    await renderThemed(<SettingsScreen />);
    expect(screen.getAllByText('Not loaded')).toHaveLength(3);
    await fireEvent.press(screen.getByTestId('language-hi'));
    expect(screen.getAllByText('लोड नहीं हुआ')).toHaveLength(3);
    expect(screen.getByText('कंटेंट वर्ज़न')).toBeTruthy();
  });
});
