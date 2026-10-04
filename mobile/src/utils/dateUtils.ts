/**
 * Pure calendar-date helpers. Dates are plain `YYYY-MM-DD` strings, a calendar date with NO time zone and no
 * time of day. Nothing here knows about lunar months or tithis, and nothing computes a festival date: these
 * functions only do Gregorian arithmetic on dates that already exist in the bundle (or on "today").
 */

export type YearMonth = { year: number; month: number }; // month is 1..12
export type Ymd = { year: number; month: number; day: number };

/** 0 = Sunday ... 6 = Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type GridCell = {
  iso: string;
  day: number;
  /** false for the leading/trailing days of the neighbouring months that fill the first and last week. */
  inMonth: boolean;
  /** Column in the grid, 0 = first day of the week. */
  column: number;
};

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Parses a strict `YYYY-MM-DD` that is a real calendar day; null otherwise. */
export function parseIso(value: string): Ymd | null {
  const match = ISO.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Day of the week of a calendar date, 0 = Sunday. Uses UTC arithmetic only, so the device zone is irrelevant. */
export function weekdayOf(year: number, month: number, day: number): number {
  const probe = new Date(Date.UTC(2000, 0, 1));
  probe.setUTCFullYear(year, month - 1, day);
  return probe.getUTCDay();
}

/** The device's local calendar date as `YYYY-MM-DD` (the only place a device clock is read). */
export function localIsoDate(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthStart(year: number, month: number): string {
  return toIso(year, month, 1);
}

export function monthEnd(year: number, month: number): string {
  return toIso(year, month, daysInMonth(year, month));
}

/** Moves a year/month by `delta` months, crossing year boundaries in both directions. */
export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** The last day of an observance: `endDate`, or the start for a single-day festival. */
export function lastDay(date: string, endDate?: string | null): string {
  return endDate && endDate > date ? endDate : date;
}

/** Whether `iso` falls in the inclusive range [date, endDate]. ISO strings of one format sort like dates. */
export function isInRange(iso: string, date: string, endDate?: string | null): boolean {
  return iso >= date && iso <= lastDay(date, endDate);
}

export function isMultiDay(date: string, endDate?: string | null): boolean {
  return lastDay(date, endDate) > date;
}

/** Number of days in an inclusive range (1 for a single day). Pure calendar arithmetic. */
export function rangeLength(date: string, endDate?: string | null): number {
  const from = parseIso(date);
  const to = parseIso(lastDay(date, endDate));
  if (!from || !to) return 1;
  return utcDays(to) - utcDays(from) + 1;
}

function utcDays({ year, month, day }: Ymd): number {
  const d = new Date(Date.UTC(2000, 0, 1));
  d.setUTCFullYear(year, month - 1, day);
  return Math.round(d.getTime() / 86_400_000);
}

/**
 * Cells of a month grid: whole weeks (4 to 6 rows of 7), starting on `weekStart`, padded with the
 * neighbouring months' days so every row is complete.
 */
export function monthGrid(year: number, month: number, weekStart: WeekStart = 0): GridCell[][] {
  const lead = (weekdayOf(year, month, 1) - weekStart + 7) % 7;
  const length = daysInMonth(year, month);
  const rows = Math.ceil((lead + length) / 7);
  const prev = addMonths({ year, month }, -1);
  const next = addMonths({ year, month }, 1);
  const prevLength = daysInMonth(prev.year, prev.month);

  const weeks: GridCell[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const week: GridCell[] = [];
    for (let column = 0; column < 7; column += 1) {
      const offset = row * 7 + column - lead + 1; // day of `month`; <= 0 or > length is a neighbour
      if (offset < 1) {
        const day = prevLength + offset;
        week.push({ iso: toIso(prev.year, prev.month, day), day, inMonth: false, column });
      } else if (offset > length) {
        const day = offset - length;
        week.push({ iso: toIso(next.year, next.month, day), day, inMonth: false, column });
      } else {
        week.push({ iso: toIso(year, month, offset), day: offset, inMonth: true, column });
      }
    }
    weeks.push(week);
  }
  return weeks;
}

/** Weekday numbers (0 = Sunday) in grid column order for a given week start. */
export function weekdayOrder(weekStart: WeekStart = 0): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). Null if either is not a real date. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return null;
  return utcDays(b) - utcDays(a);
}

/** The calendar date `days` days after `iso` (before it when negative). Null if `iso` is not a real date. */
export function addDays(iso: string, days: number): string | null {
  const ymd = parseIso(iso);
  if (!ymd) return null;
  const probe = new Date(Date.UTC(2000, 0, 1));
  probe.setUTCFullYear(ymd.year, ymd.month - 1, ymd.day + days);
  return toIso(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate());
}
