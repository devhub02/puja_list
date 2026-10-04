export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  /** Boundaries of interactive controls (needs 3:1 against its surroundings). */
  borderStrong: string;
  text: string;
  textSecondary: string;
  heading: string;
  /** Saffron for text, icons and filled buttons (passes AA with onPrimary). */
  primary: string;
  onPrimary: string;
  /** Tinted fill behind a primary-coloured icon. */
  primaryTint: string;
  /** Gold: decorative only (rings, dividers), never carries text or meaning. */
  gold: string;
  /** Gold dark enough to be used as text/icon colour. */
  goldText: string;
  tabBar: string;
  pressed: string;
  focusRing: string;
};

export const lightColors: ThemeColors = {
  background: '#FFF8EC',
  surface: '#FFFFFF',
  surfaceAlt: '#FBEFD9',
  border: '#E8D8BC',
  borderStrong: '#8E7658',
  text: '#3A2A22',
  textSecondary: '#6B5648',
  heading: '#6B1D2A',
  primary: '#A84606',
  onPrimary: '#FFFFFF',
  primaryTint: '#FBE3C8',
  gold: '#C9A24B',
  goldText: '#7A5F18',
  tabBar: '#FFFFFF',
  pressed: '#F3E3C6',
  focusRing: '#6B1D2A',
};

export const darkColors: ThemeColors = {
  background: '#1C1411',
  surface: '#2A1E19',
  surfaceAlt: '#35261F',
  border: '#4A372D',
  borderStrong: '#9A7F6C',
  text: '#F6EBDD',
  textSecondary: '#C9B5A3',
  heading: '#F2B8A8',
  primary: '#F28B3C',
  onPrimary: '#2A1206',
  primaryTint: '#4A2A14',
  gold: '#E0BC6A',
  goldText: '#E0BC6A',
  tabBar: '#241A15',
  pressed: '#3F2E25',
  focusRing: '#F2B8A8',
};

export const palettes: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** 4/8dp rhythm. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const iconSize = {
  sm: 20,
  md: 24,
  lg: 32,
  hero: 56,
} as const;

/** Minimum touch target on Android (dp). */
export const minTouchTarget = 48;

export type ElevationLevel = 0 | 1 | 2;

/** Soft, warm-tinted shadows. Dark theme relies on surface colour instead of shadow. */
export const elevation = {
  light: {
    0: {},
    1: {
      shadowColor: '#6B1D2A',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    2: {
      shadowColor: '#6B1D2A',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  },
  dark: {
    0: {},
    1: { elevation: 0 },
    2: { elevation: 0 },
  },
} as const;

export type TextVariant =
  'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodySmall' | 'caption' | 'label';

export type FontWeightToken = 'regular' | 'semibold' | 'bold';

type VariantSpec = { size: number; weight: FontWeightToken; scales: boolean };

/**
 * Type scale (sp, before the user text-size factor).
 * `scales: false` keeps interface chrome (tab and segment labels) at a fixed size so the
 * navigation never overflows; reading text scales with the text-size setting.
 */
export const typeScale: Record<TextVariant, VariantSpec> = {
  display: { size: 32, weight: 'bold', scales: true },
  title: { size: 24, weight: 'bold', scales: true },
  heading: { size: 20, weight: 'semibold', scales: true },
  subheading: { size: 17, weight: 'semibold', scales: true },
  body: { size: 16, weight: 'regular', scales: true },
  bodySmall: { size: 14, weight: 'regular', scales: true },
  caption: { size: 13, weight: 'regular', scales: true },
  label: { size: 13, weight: 'semibold', scales: false },
};

/** Line-height multipliers. Devanagari matras above/below the line need more room. */
export const lineHeightFactor = { latin: 1.4, devanagari: 1.65 } as const;

export type TextSize = 'small' | 'medium' | 'large' | 'extraLarge';

export const textSizeScale: Record<TextSize, number> = {
  small: 0.875,
  medium: 1,
  large: 1.15,
  extraLarge: 1.3,
};

export const textSizeOrder: readonly TextSize[] = ['small', 'medium', 'large', 'extraLarge'];

/** Upper bound for the OS font scale so layouts stay intact. */
export const maxSystemFontMultiplier = 1.6;
