import type { DateCertainty } from '@/db/types';

/**
 * The single place that maps a date's `certainty` value to a translated label. The values are the schema enum
 * (`DateCertainty`); a value that has no entry here (an older or newer bundle) gets the neutral fallback label
 * instead of crashing or being shown raw.
 */
const certaintyLabelKeys = new Map<string, string>([
  ['confirmed', 'calendar.certainty.confirmed'],
  ['provisional', 'calendar.certainty.provisional'],
  ['varies_by_region', 'calendar.certainty.varies_by_region'],
] satisfies [DateCertainty, string][]);

export const UNKNOWN_CERTAINTY_KEY = 'calendar.certainty.unknown';

export type CertaintyLabelKey =
  | 'calendar.certainty.confirmed'
  | 'calendar.certainty.provisional'
  | 'calendar.certainty.varies_by_region'
  | 'calendar.certainty.unknown';

export function certaintyLabelKey(value: string): CertaintyLabelKey {
  return (certaintyLabelKeys.get(value) ?? UNKNOWN_CERTAINTY_KEY) as CertaintyLabelKey;
}
