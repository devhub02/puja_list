import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isLanguageCode, pickSupportedLanguage } from '@/i18n/registry';
import type { LanguageCode } from '@/i18n/registry';
import { themeModes } from '@/theme/resolve';
import type { ThemeMode } from '@/theme/resolve';
import { textSizeOrder } from '@/theme/tokens';
import type { TextSize } from '@/theme/tokens';

export const SETTINGS_STORAGE_KEY = 'puja-saathi-settings';

export type SettingsState = {
  language: LanguageCode;
  themeMode: ThemeMode;
  textSize: TextSize;
  /** Global switch for reminder notifications. Off = nothing is scheduled; reminders stay saved, paused. */
  notificationsEnabled: boolean;
  setLanguage: (language: LanguageCode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTextSize: (size: TextSize) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};

/** Device language if supported, else English. */
export function detectDeviceLanguage(): LanguageCode {
  try {
    return pickSupportedLanguage(getLocales().map((locale) => locale.languageCode));
  } catch {
    return 'en';
  }
}

export const defaultSettings = {
  themeMode: 'system' as ThemeMode,
  textSize: 'medium' as TextSize,
  notificationsEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: detectDeviceLanguage(),
      ...defaultSettings,
      setLanguage: (language) => set({ language }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setTextSize: (textSize) => set({ textSize }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ language, themeMode, textSize, notificationsEnabled }) => ({
        language,
        themeMode,
        textSize,
        notificationsEnabled,
      }),
      // Ignore stale/unknown saved values (e.g. a language removed in a later version).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          language: isLanguageCode(saved.language) ? saved.language : current.language,
          themeMode: themeModes.includes(saved.themeMode as ThemeMode)
            ? (saved.themeMode as ThemeMode)
            : current.themeMode,
          textSize: textSizeOrder.includes(saved.textSize as TextSize)
            ? (saved.textSize as TextSize)
            : current.textSize,
          notificationsEnabled:
            typeof saved.notificationsEnabled === 'boolean'
              ? saved.notificationsEnabled
              : current.notificationsEnabled,
        };
      },
    },
  ),
);

/** True once the persisted settings have been read from AsyncStorage. */
export function useSettingsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSettingsStore.persist.onFinishHydration(onChange),
    () => useSettingsStore.persist.hasHydrated(),
    () => false,
  );
}
