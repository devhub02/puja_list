import { contrastRatio } from '@/theme/contrast';
import { getTextScale, resolveColorScheme } from '@/theme/resolve';
import { darkColors, lightColors, palettes, textSizeOrder, textSizeScale } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

describe('theme mode resolution', () => {
  it('follows the system scheme in system mode', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('falls back to light when the system scheme is unknown', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
    expect(resolveColorScheme('system', 'unspecified')).toBe('light');
  });

  it('forces light or dark regardless of the system scheme', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });
});

describe('text size scale', () => {
  it('grows monotonically from small to extra large, medium being 1x', () => {
    const scales = textSizeOrder.map(getTextScale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
    expect(textSizeScale.medium).toBe(1);
  });
});

describe('design tokens', () => {
  it('defines the same keys for light and dark', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    expect(palettes.light).toBe(lightColors);
    expect(palettes.dark).toBe(darkColors);
  });

  it('computes WCAG contrast correctly', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'surfaceAlt'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
    ['textSecondary', 'surfaceAlt'],
    ['heading', 'background'],
    ['heading', 'surface'],
    ['heading', 'surfaceAlt'],
    ['primary', 'background'],
    ['primary', 'surface'],
    ['primary', 'surfaceAlt'],
    ['primary', 'primaryTint'],
    ['onPrimary', 'primary'],
    ['goldText', 'surfaceAlt'],
    ['goldText', 'background'],
    ['text', 'tabBar'],
    ['textSecondary', 'tabBar'],
    ['primary', 'tabBar'],
  ];

  describe.each(['light', 'dark'] as const)('%s palette', (scheme) => {
    it.each(textPairs)('%s on %s meets WCAG AA text contrast (4.5:1)', (fg, bg) => {
      expect(contrastRatio(palettes[scheme][fg], palettes[scheme][bg])).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps control boundaries at 3:1 against the surrounding surface', () => {
      const p = palettes[scheme];
      expect(contrastRatio(p.borderStrong, p.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.borderStrong, p.background)).toBeGreaterThanOrEqual(3);
    });
  });
});
