import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { TextStyle } from 'react-native';

import { languages } from '@/i18n/registry';
import { useSettingsStore } from '@/store/settingsStore';

import { fontFamilies } from './fonts';
import { getTextScale, resolveColorScheme } from './resolve';
import { elevation, lineHeightFactor, palettes, typeScale } from './tokens';
import type { ColorScheme, TextVariant, ThemeColors } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  textScale: number;
  /** Font, size and line height for a variant, in the current language and text size. */
  textStyle: (variant: TextVariant) => Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight'>;
  /** Shadow style for an elevation level in the current scheme. */
  shadow: (level: 0 | 1 | 2) => object;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const textSize = useSettingsStore((s) => s.textSize);
  const language = useSettingsStore((s) => s.language);
  const systemScheme = useColorScheme();

  const theme = useMemo<Theme>(() => {
    const scheme = resolveColorScheme(themeMode, systemScheme);
    const textScale = getTextScale(textSize);
    const script = languages[language].script;
    const lineFactor = lineHeightFactor[script];
    return {
      scheme,
      isDark: scheme === 'dark',
      colors: palettes[scheme],
      textScale,
      textStyle: (variant) => {
        const spec = typeScale[variant];
        const fontSize = Math.round(spec.scales ? spec.size * textScale : spec.size);
        return {
          fontFamily: fontFamilies[script][spec.weight],
          fontSize,
          lineHeight: Math.round(fontSize * lineFactor),
        };
      },
      shadow: (level) => elevation[scheme][level],
    };
  }, [themeMode, textSize, language, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
