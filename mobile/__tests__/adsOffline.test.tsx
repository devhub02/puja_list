import { screen } from '@testing-library/react-native';

import HomeScreen from '../app/(tabs)/index';
import LibraryScreen from '../app/(tabs)/library';
import { seedContentIfNeeded } from '@/db/seed';
import { resetUserStateStore } from '@/store/userStateStore';

import { makeFixtureBundle } from '../testing/contentFixture';
import { createMigratedDb } from '../testing/nodeSqlDb';
import { resetRouterMock } from '../testing/routerMock';
import { renderWithDb, resetSettings } from '../testing/utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/utils/dateUtils', () => require('../testing/dateMock').dateMock);
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router', () => require('../testing/routerMock').routerMock);

// Simulates the ads module being unavailable (e.g. the native SDK failed to load, or the device
// is offline so consent was never obtained): Home and Library must still render normally.
jest.mock('@/ads/AdsManager', () => ({
  isAdsInitialized: () => false,
  subscribeAdsReady: () => () => {},
  startAdsFlow: async () => {
    throw new Error('ads unavailable');
  },
}));
jest.mock('@/ads/consent', () => ({
  getConsentState: () => ({ canRequestAds: false, privacyOptionsRequired: false }),
  subscribeConsent: () => () => {},
}));
jest.mock('@/ads/nativeAdsModule', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    BannerAd: (props: object) => React.createElement('BannerAd', props),
    BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test-adaptive-banner-id' },
  };
});

beforeEach(async () => {
  resetRouterMock();
  resetUserStateStore();
  await resetSettings('en');
});

async function fixtureDb() {
  const db = createMigratedDb();
  await seedContentIfNeeded(db, makeFixtureBundle());
  return db;
}

describe('Home and Library render without ads when the ads module is unavailable', () => {
  it('Home renders its content with no ad slot', async () => {
    await renderWithDb(<HomeScreen />, await fixtureDb());
    expect(await screen.findByTestId('home-date')).toBeTruthy();
    expect(screen.queryByTestId('ad-slot-home_banner')).toBeNull();
    expect(screen.queryByText('Advertisement')).toBeNull();
  });

  it('Library renders its list with no ad slot', async () => {
    await renderWithDb(<LibraryScreen />, await fixtureDb());
    expect(await screen.findByTestId('library-list')).toBeTruthy();
    expect(screen.queryByTestId('ad-slot-library_banner')).toBeNull();
    expect(screen.queryByText('Advertisement')).toBeNull();
  });
});
