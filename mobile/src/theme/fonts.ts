import { useFonts } from 'expo-font';

import type { Script } from '@/i18n/registry';

import type { FontWeightToken } from './tokens';

/** Bundled with the app (assets/fonts, SIL OFL), so text renders offline. */
const fontAssets = {
  NunitoSans_400Regular: require('../../assets/fonts/NunitoSans_400Regular.ttf'),
  NunitoSans_600SemiBold: require('../../assets/fonts/NunitoSans_600SemiBold.ttf'),
  NunitoSans_700Bold: require('../../assets/fonts/NunitoSans_700Bold.ttf'),
  NotoSansDevanagari_400Regular: require('../../assets/fonts/NotoSansDevanagari_400Regular.ttf'),
  NotoSansDevanagari_600SemiBold: require('../../assets/fonts/NotoSansDevanagari_600SemiBold.ttf'),
  NotoSansDevanagari_700Bold: require('../../assets/fonts/NotoSansDevanagari_700Bold.ttf'),
};

export const fontFamilies: Record<Script, Record<FontWeightToken, string>> = {
  latin: {
    regular: 'NunitoSans_400Regular',
    semibold: 'NunitoSans_600SemiBold',
    bold: 'NunitoSans_700Bold',
  },
  // Noto Sans Devanagari also contains Latin glyphs, so mixed text stays in one family.
  devanagari: {
    regular: 'NotoSansDevanagari_400Regular',
    semibold: 'NotoSansDevanagari_600SemiBold',
    bold: 'NotoSansDevanagari_700Bold',
  },
};

export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  // On a font error we still continue with system fonts rather than blocking the app.
  return loaded || error !== null;
}
