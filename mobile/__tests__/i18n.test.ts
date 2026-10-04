import { createInstance } from 'i18next';

import i18n from '@/i18n';
import { formatToday } from '@/i18n/format';
import en from '@/i18n/locales/en';
import hi from '@/i18n/locales/hi';
import { isLocaleMap, localize } from '@/i18n/localeMap';
import type { LocaleMap } from '@/i18n/localeMap';
import { languageCodes, languages } from '@/i18n/registry';
import { useSettingsStore } from '@/store/settingsStore';

function leaves(obj: object, prefix = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? leaves(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

afterEach(async () => {
  useSettingsStore.setState({ language: 'en' });
  await i18n.changeLanguage('en');
});

describe('i18n', () => {
  it('switches language and follows the settings store', () => {
    expect(i18n.t('tabs.settings')).toBe('Settings');
    useSettingsStore.getState().setLanguage('hi');
    expect(i18n.language).toBe('hi');
    expect(i18n.t('tabs.settings')).toBe('सेटिंग्स');
  });

  it('falls back to English for a key missing in the selected language', async () => {
    const instance = createInstance();
    await instance.init({
      lng: 'hi',
      fallbackLng: 'en',
      resources: {
        en: { translation: { both: 'Both EN', onlyEnglish: 'English only' } },
        hi: { translation: { both: 'दोनों' } },
      },
    });
    const translate = instance.t as (key: string) => string;
    expect(translate('both')).toBe('दोनों');
    expect(translate('onlyEnglish')).toBe('English only');
  });

  it('gives every registered language the same keys as English', () => {
    const reference = leaves(en)
      .map(([k]) => k)
      .sort();
    for (const code of languageCodes) {
      expect(
        leaves(languages[code].translation)
          .map(([k]) => k)
          .sort(),
      ).toEqual(reference);
    }
  });

  it('has no empty strings in any locale file', () => {
    for (const code of languageCodes) {
      for (const [path, value] of leaves(languages[code].translation)) {
        expect([code, path, value === '']).toEqual([code, path, false]);
      }
    }
  });

  it('uses Devanagari for Hindi text', () => {
    expect(hi.settings.disclaimer.body).toMatch(/[ऀ-ॿ]/);
    expect(hi.tabs.home).toMatch(/[ऀ-ॿ]/);
  });

  it('formats the date in the selected language', () => {
    const date = new Date(2026, 9, 4);
    expect(formatToday(date, 'en')).toContain('October');
    expect(formatToday(date, 'hi')).toMatch(/[ऀ-ॿ]/);
  });
});

describe('locale map helper', () => {
  const map: LocaleMap = { en: 'Diwali', hi: 'दीवाली' };

  it('returns the selected language', () => {
    expect(localize(map, 'hi')).toBe('दीवाली');
    expect(localize(map, 'en')).toBe('Diwali');
  });

  it('falls back to English when the language is missing or empty', () => {
    expect(localize({ en: 'Holi' }, 'hi')).toBe('Holi');
    expect(localize({ en: 'Holi', hi: '' }, 'hi')).toBe('Holi');
  });

  it('validates untyped content', () => {
    expect(isLocaleMap({ en: 'a', hi: 'b' })).toBe(true);
    expect(isLocaleMap({ hi: 'b' })).toBe(false);
    expect(isLocaleMap({ en: '' })).toBe(false);
    expect(isLocaleMap({ en: 'a', hi: 5 })).toBe(false);
    expect(isLocaleMap(null)).toBe(false);
    expect(isLocaleMap('Diwali')).toBe(false);
  });
});
