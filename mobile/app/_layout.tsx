import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSettingsHydrated } from '@/store/settingsStore';
import { ThemeProvider, useAppFonts, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function ThemedShell() {
  const { colors, isDark } = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
    </>
  );
}

export default function RootLayout() {
  const fontsReady = useAppFonts();
  const settingsReady = useSettingsHydrated();
  const ready = fontsReady && settingsReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // The splash screen stays up until fonts and saved settings are loaded: no wrong theme/language flash.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
