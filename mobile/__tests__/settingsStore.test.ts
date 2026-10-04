import AsyncStorage from '@react-native-async-storage/async-storage';

import { pickSupportedLanguage } from '@/i18n/registry';
import { SETTINGS_STORAGE_KEY, defaultSettings, useSettingsStore } from '@/store/settingsStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({ language: 'en', ...defaultSettings });
});

describe('settings store', () => {
  it('starts with defaults: system theme, medium text', () => {
    const { themeMode, textSize } = useSettingsStore.getState();
    expect(themeMode).toBe('system');
    expect(textSize).toBe('medium');
  });

  it('updates language, theme mode and text size', () => {
    const { setLanguage, setThemeMode, setTextSize } = useSettingsStore.getState();
    setLanguage('hi');
    setThemeMode('dark');
    setTextSize('extraLarge');
    expect(useSettingsStore.getState()).toMatchObject({
      language: 'hi',
      themeMode: 'dark',
      textSize: 'extraLarge',
    });
  });

  it('persists changes to AsyncStorage (settings only, no functions)', async () => {
    useSettingsStore.getState().setThemeMode('dark');
    useSettingsStore.getState().setLanguage('hi');
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string);
    expect(saved.state).toEqual({ language: 'hi', themeMode: 'dark', textSize: 'medium' });
  });

  it('restores persisted settings on rehydrate', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        state: { language: 'hi', themeMode: 'light', textSize: 'large' },
        version: 1,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      language: 'hi',
      themeMode: 'light',
      textSize: 'large',
    });
    expect(useSettingsStore.persist.hasHydrated()).toBe(true);
  });

  it('ignores unknown saved values and keeps defaults', async () => {
    await AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        state: { language: 'xx', themeMode: 'neon', textSize: 'huge' },
        version: 1,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ language: 'en', ...defaultSettings });
  });
});

describe('default language detection', () => {
  it('uses the first supported device language', () => {
    expect(pickSupportedLanguage(['hi'])).toBe('hi');
    expect(pickSupportedLanguage(['ta', 'hi-IN'])).toBe('hi');
    expect(pickSupportedLanguage(['en-GB'])).toBe('en');
  });

  it('falls back to English when nothing is supported', () => {
    expect(pickSupportedLanguage(['ta', 'fr'])).toBe('en');
    expect(pickSupportedLanguage([null, undefined])).toBe('en');
    expect(pickSupportedLanguage([])).toBe('en');
  });
});
