import {
  addMonths,
  daysInMonth,
  isInRange,
  isLeapYear,
  isMultiDay,
  lastDay,
  localIsoDate,
  monthGrid,
  monthStart,
  monthEnd,
  parseIso,
  rangeLength,
  toIso,
  weekdayOf,
  weekdayOrder,
} from '@/utils/dateUtils';

// Dates in these tests are only used to check calendar arithmetic; none is a festival date.

describe('leap years and month lengths', () => {
  it('knows the Gregorian leap-year rule', () => {
    expect([2024, 2028, 2000, 2400].every(isLeapYear)).toBe(true);
    expect([2023, 2026, 2027, 1900, 2100].some(isLeapYear)).toBe(false);
  });

  it('gives the number of days of every month, including February in leap years', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => daysInMonth(2026, m))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(monthStart(2028, 2)).toBe('2028-02-01');
    expect(monthEnd(2028, 2)).toBe('2028-02-29');
  });
});

describe('ISO dates', () => {
  it('formats and parses plain calendar dates', () => {
    expect(toIso(2026, 11, 8)).toBe('2026-11-08');
    expect(parseIso('2026-11-08')).toEqual({ year: 2026, month: 11, day: 8 });
  });

  it('rejects anything that is not a real YYYY-MM-DD day', () => {
    for (const bad of [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-11-31',
      '26-11-08',
      '2026-1-8',
      '',
      'abc',
    ]) {
      expect(parseIso(bad)).toBeNull();
    }
    expect(parseIso('2028-02-29')).not.toBeNull();
  });

  it('gets the weekday without depending on the device time zone', () => {
    expect(weekdayOf(2026, 10, 4)).toBe(0); // Sunday
    expect(weekdayOf(2026, 11, 8)).toBe(0);
    expect(weekdayOf(2000, 1, 1)).toBe(6); // Saturday
    expect(weekdayOf(2024, 2, 29)).toBe(4); // Thursday
    expect(weekdayOf(99, 1, 1)).toBeGreaterThanOrEqual(0); // years below 100 are not remapped to 19xx
  });

  it('reads the device-local date of a Date, with no UTC conversion', () => {
    expect(localIsoDate(new Date(2026, 9, 4, 23, 59))).toBe('2026-10-04');
    expect(localIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('month navigation', () => {
  it('moves across month and year boundaries in both directions', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 3 }, 12)).toEqual({ year: 2027, month: 3 });
    expect(addMonths({ year: 2026, month: 3 }, -15)).toEqual({ year: 2024, month: 12 });
    expect(addMonths({ year: 2026, month: 3 }, 0)).toEqual({ year: 2026, month: 3 });
  });
});

describe('multi-day ranges', () => {
  it('treats end_date equal to date, or missing, as a single day', () => {
    expect(lastDay('2026-11-08', '2026-11-08')).toBe('2026-11-08');
    expect(lastDay('2026-11-08')).toBe('2026-11-08');
    expect(lastDay('2026-11-08', null)).toBe('2026-11-08');
    expect(isMultiDay('2026-11-08', '2026-11-08')).toBe(false);
    expect(rangeLength('2026-11-08', '2026-11-08')).toBe(1);
  });

  it('includes both ends of a range and nothing outside it', () => {
    expect(isMultiDay('2026-11-13', '2026-11-16')).toBe(true);
    expect(rangeLength('2026-11-13', '2026-11-16')).toBe(4);
    for (const day of ['2026-11-13', '2026-11-14', '2026-11-16']) {
      expect(isInRange(day, '2026-11-13', '2026-11-16')).toBe(true);
    }
    expect(isInRange('2026-11-12', '2026-11-13', '2026-11-16')).toBe(false);
    expect(isInRange('2026-11-17', '2026-11-13', '2026-11-16')).toBe(false);
    expect(isInRange('2026-11-08', '2026-11-08')).toBe(true);
    expect(isInRange('2026-11-09', '2026-11-08')).toBe(false);
  });

  it('counts days across a month end and a leap day', () => {
    expect(rangeLength('2031-03-31', '2031-04-02')).toBe(3);
    expect(rangeLength('2028-02-28', '2028-03-01')).toBe(3);
    expect(rangeLength('2027-02-28', '2027-03-01')).toBe(2);
  });
});

describe('month grid', () => {
  it('always has whole weeks of seven cells, 4 to 6 rows, and every day of the month once', () => {
    for (const [year, month] of [
      [2026, 2],
      [2026, 10],
      [2026, 11],
      [2028, 2],
      [2027, 5],
      [2026, 8],
    ]) {
      for (const start of [0, 1, 6] as const) {
        const weeks = monthGrid(year, month, start);
        expect(weeks.length).toBeGreaterThanOrEqual(4);
        expect(weeks.length).toBeLessThanOrEqual(6);
        expect(weeks.every((w) => w.length === 7)).toBe(true);
        const days = weeks.flat().filter((c) => c.inMonth);
        expect(days.map((c) => c.day)).toEqual(
          Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
        );
        expect(weeks.flat().map((c) => c.column)).toEqual(
          Array.from({ length: weeks.length * 7 }, (_, i) => i % 7),
        );
      }
    }
  });

  it('puts 1 November 2026 (a Sunday) in the first column when weeks start on Sunday', () => {
    const weeks = monthGrid(2026, 11, 0);
    expect(weeks[0][0]).toEqual({ iso: '2026-11-01', day: 1, inMonth: true, column: 0 });
    expect(weeks).toHaveLength(5);
    expect(weeks[4][1].iso).toBe('2026-11-30');
    expect(weeks[4][2]).toMatchObject({ iso: '2026-12-01', inMonth: false });
  });

  it('shifts the same month by the week start (Monday-first)', () => {
    const weeks = monthGrid(2026, 11, 1);
    expect(weeks[0][6].iso).toBe('2026-11-01');
    expect(weeks[0][0]).toMatchObject({ iso: '2026-10-26', day: 26, inMonth: false });
  });

  it('pads with the neighbouring months across a year boundary', () => {
    const weeks = monthGrid(2027, 1, 0); // 1 Jan 2027 is a Friday
    expect(weeks[0][5].iso).toBe('2027-01-01');
    expect(weeks[0][0]).toMatchObject({ iso: '2026-12-27', inMonth: false });
    const dec = monthGrid(2026, 12, 0);
    const last = dec[dec.length - 1];
    expect(last[last.length - 1].inMonth).toBe(false);
    expect(last[last.length - 1].iso.startsWith('2027-01')).toBe(true);
  });

  it('handles a leap February that fits exactly four rows', () => {
    // 1 Feb 2026 is a Sunday: 28 days = exactly 4 Sunday-first rows
    expect(monthGrid(2026, 2, 0)).toHaveLength(4);
    expect(
      monthGrid(2026, 2, 0)
        .flat()
        .every((c) => c.inMonth),
    ).toBe(true);
    const leap = monthGrid(2028, 2, 0);
    expect(leap.flat().filter((c) => c.inMonth)).toHaveLength(29);
    expect(leap.flat().some((c) => c.iso === '2028-02-29' && c.inMonth)).toBe(true);
  });

  it('lists weekdays in column order for a week start', () => {
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(6)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });
});
