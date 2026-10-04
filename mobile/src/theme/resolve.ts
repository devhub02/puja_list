import type { ColorScheme, TextSize } from './tokens';
import { textSizeScale } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

export const themeModes: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** Resolves the setting against the OS scheme. Unknown/null system scheme means light. */
export function resolveColorScheme(
  mode: ThemeMode,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function getTextScale(size: TextSize): number {
  return textSizeScale[size];
}
