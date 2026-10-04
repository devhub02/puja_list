import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { defaultSettings, useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider } from '@/theme';

export async function resetSettings(language: 'en' | 'hi' = 'en') {
  await AsyncStorage.clear();
  useSettingsStore.setState({ language, ...defaultSettings });
  await i18n.changeLanguage(language);
}

const initialMetrics = {
  frame: { x: 0, y: 0, width: 360, height: 780 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

/** Providers the real root layout supplies (safe area + theme), sized like a 360dp phone. */
export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderThemed(ui: ReactElement) {
  return render(<TestProviders>{ui}</TestProviders>);
}
