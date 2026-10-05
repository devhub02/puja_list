/**
 * Pure placement logic for the Library's inline banner: one ad after about 8 items, repeating no
 * more often than every 15 items, never as the first or last row, and never while a filter or
 * search is active with fewer than 8 results (CLAUDE.md "Ads rules", Phase 7 brief §3b).
 */
const FIRST_AD_AFTER = 8;
const REPEAT_EVERY = 15;

/**
 * 0-based indices into the item list after which an ad row should be inserted (i.e. an index of 8
 * means "insert an ad after the 9th item, before the 10th"). Never includes the position after the
 * last item.
 */
export function getLibraryAdInsertPositions(
  totalItems: number,
  filterOrSearchActive: boolean,
): number[] {
  if (totalItems <= 0) return [];
  if (filterOrSearchActive && totalItems < FIRST_AD_AFTER) return [];

  const positions: number[] = [];
  // pos >= FIRST_AD_AFTER keeps it off row 0; pos < totalItems - 1 keeps it off the last row.
  for (let pos = FIRST_AD_AFTER; pos < totalItems - 1; pos += REPEAT_EVERY) {
    positions.push(pos);
  }
  return positions;
}
