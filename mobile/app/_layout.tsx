import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startAdsFlow } from '@/ads/AdsManager';
import { StartupError } from '@/components/StartupError';
import { initializeDatabase } from '@/db/database';
import { DatabaseProvider, useDatabaseInit } from '@/db/DatabaseProvider';
import { installNotifications } from '@/notifications/install';
import { NotificationRouter } from '@/notifications/NotificationRouter';
import { useSettingsHydrated } from '@/store/settingsStore';
import { ThemeProvider, useAppFonts, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();
installNotifications();

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
  const database = useDatabaseInit(initializeDatabase);
  // The first frame is never blocked: database setup starts after the first render, and the splash
  // screen simply stays up until fonts, settings and the first database attempt have all finished.
  const ready = fontsReady && settingsReady && database.settledOnce;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Consent + ads init: started after the first render, never blocks it; fails closed (no ads) on
  // any error, offline included (see src/ads/AdsManager.ts).
  useEffect(() => {
    void startAdsFlow();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {database.status === 'ready' ? (
          <DatabaseProvider db={database.db}>
            <ThemedShell />
            <NotificationRouter />
          </DatabaseProvider>
        ) : (
          <StartupError onRetry={database.retry} busy={database.status === 'loading'} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
