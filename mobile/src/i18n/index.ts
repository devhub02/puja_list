import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';

import { FALLBACK_LANGUAGE, languageCodes, languages } from './registry';
import type { LanguageCode } from './registry';

const resources = Object.fromEntries(
  languageCodes.map((code) => [code, { translation: languages[code].translation }]),
);

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: useSettingsStore.getState().language,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: languageCodes,
  interpolation: { escapeValue: false },
  initAsync: false,
});

function sync(language: LanguageCode) {
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

// Keep i18next in step with the settings store (before React re-renders, so no stale-language frame).
useSettingsStore.subscribe((state) => sync(state.language));
useSettingsStore.persist.onFinishHydration((state) => sync(state.language));
if (useSettingsStore.persist.hasHydrated()) sync(useSettingsStore.getState().language);

export default i18n;
