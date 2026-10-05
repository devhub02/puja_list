import { getLibraryAdInsertPositions } from '@/ads/libraryAdPlacement';

describe('getLibraryAdInsertPositions', () => {
  it('returns nothing for an empty or tiny list', () => {
    expect(getLibraryAdInsertPositions(0, false)).toEqual([]);
    expect(getLibraryAdInsertPositions(5, false)).toEqual([]);
  });

  it('places the first ad after about 8 items', () => {
    expect(getLibraryAdInsertPositions(10, false)).toEqual([8]);
    expect(getLibraryAdInsertPositions(16, false)).toEqual([8]);
  });

  it('shows no ad when there is no room to avoid the last row', () => {
    // 9 items: the only candidate position (8) would be the last row, so none is shown.
    expect(getLibraryAdInsertPositions(9, false)).toEqual([]);
  });

  it('never places an ad as the first row', () => {
    for (const total of [1, 5, 8, 9, 20, 50]) {
      expect(getLibraryAdInsertPositions(total, false)).not.toContain(0);
    }
  });

  it('never places an ad as the last row', () => {
    for (const total of [1, 5, 8, 9, 20, 23, 24, 50]) {
      const positions = getLibraryAdInsertPositions(total, false);
      expect(positions).not.toContain(total - 1);
    }
  });

  it('repeats no more often than every 15 items', () => {
    expect(getLibraryAdInsertPositions(100, false)).toEqual([8, 23, 38, 53, 68, 83, 98]);
  });

  it('shows nothing when a filter/search is active and there are fewer than 8 results', () => {
    expect(getLibraryAdInsertPositions(7, true)).toEqual([]);
    expect(getLibraryAdInsertPositions(3, true)).toEqual([]);
  });

  it('still shows ads when a filter/search is active with 8 or more results', () => {
    expect(getLibraryAdInsertPositions(16, true)).toEqual([8]);
  });
});
