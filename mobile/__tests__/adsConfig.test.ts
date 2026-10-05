import { readFileSync } from 'fs';
import { join } from 'path';

import { getAdUnitId } from '@/ads/adsConfig';
import { TestIds } from '@/ads/nativeAdsModule';

jest.mock('@/ads/nativeAdsModule', () => ({
  TestIds: { ADAPTIVE_BANNER: 'test-adaptive-banner-id' },
}));

const GOOGLE_TEST_PUBLISHER_ID = '3940256099942544';
/** Matches a real-looking AdMob publisher id: ca-app-pub-<16 digits>. */
const PUBLISHER_ID_PATTERN = /ca-app-pub-(\d{16})/g;

function assertNoRealAdIds(filePath: string) {
  const text = readFileSync(filePath, 'utf8');
  const offenders: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = PUBLISHER_ID_PATTERN.exec(text)) !== null) {
    if (match[1] !== GOOGLE_TEST_PUBLISHER_ID) offenders.push(match[0]);
  }
  expect(offenders).toEqual([]);
}

describe('adsConfig', () => {
  const globalWithDev = global as unknown as { __DEV__: boolean };
  const originalDev = globalWithDev.__DEV__;
  afterEach(() => {
    globalWithDev.__DEV__ = originalDev;
  });

  it('uses TestIds in a dev build', () => {
    globalWithDev.__DEV__ = true;
    expect(getAdUnitId('home_banner')).toBe(TestIds.ADAPTIVE_BANNER);
    expect(getAdUnitId('library_banner')).toBe(TestIds.ADAPTIVE_BANNER);
  });

  it('disables a placement in release when its real id is empty', () => {
    globalWithDev.__DEV__ = false;
    expect(getAdUnitId('home_banner')).toBeNull();
    expect(getAdUnitId('library_banner')).toBeNull();
  });

  it('never has a real AdMob id committed in adsConfig.release.ts', () => {
    assertNoRealAdIds(join(__dirname, '..', 'src', 'ads', 'adsConfig.release.ts'));
  });

  it('never has a real AdMob id committed in app.json', () => {
    assertNoRealAdIds(join(__dirname, '..', 'app.json'));
  });
});

describe('app.json ads plugin', () => {
  // The library's Gradle script reads rootProject.ext.googleMobileAdsJson unless the
  // RNGMA_ANDROID_BACKEND gradle property is set, and that property is only written when the
  // plugin gets an androidSdk option. Without it the Android build fails at configure time.
  it('sets androidSdk so the Android build does not depend on an unset Gradle extension', () => {
    const appJson = JSON.parse(readFileSync(join(__dirname, '..', 'app.json'), 'utf8')) as {
      expo: { plugins: unknown[] };
    };
    const entry = appJson.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads',
    );
    expect(entry?.[1]).toMatchObject({ androidSdk: 'classic' });
  });
});
