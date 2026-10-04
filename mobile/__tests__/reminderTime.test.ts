import {
  formatLocalDateTime,
  isPastReminder,
  joinDateTime,
  parseReminderTime,
  quickPicksFor,
  toLocalDate,
} from '@/utils/reminderTime';

describe('reminder time convention (local wall clock, YYYY-MM-DDTHH:mm)', () => {
  it('formats a local Date by its local fields, to the minute', () => {
    expect(formatLocalDateTime(new Date(2026, 10, 8, 7, 5, 59))).toBe('2026-11-08T07:05');
  });

  it('parses only real dates and times', () => {
    expect(parseReminderTime('2026-11-08T07:05')).toEqual({
      date: '2026-11-08',
      hour: 7,
      minute: 5,
    });
    expect(parseReminderTime('2026-02-30T07:05')).toBeNull();
    expect(parseReminderTime('2026-11-08T24:00')).toBeNull();
    expect(parseReminderTime('2026-11-08T07:60')).toBeNull();
    expect(parseReminderTime('2026-11-08 07:05')).toBeNull();
    expect(parseReminderTime('2026-11-08')).toBeNull();
  });

  it('turns a string back into the same local wall-clock moment', () => {
    const date = toLocalDate('2026-11-08T07:05') as Date;
    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ]).toEqual([2026, 10, 8, 7, 5]);
    expect(toLocalDate('nonsense')).toBeNull();
  });

  it('treats the current minute and earlier as past, later as future', () => {
    const now = new Date(2026, 10, 8, 7, 5, 30);
    expect(isPastReminder('2026-11-08T07:04', now)).toBe(true);
    expect(isPastReminder('2026-11-08T07:05', now)).toBe(true);
    expect(isPastReminder('2026-11-08T07:06', now)).toBe(false);
    expect(isPastReminder('2026-11-09T00:00', now)).toBe(false);
    expect(isPastReminder('2025-12-31T23:59', now)).toBe(true);
  });

  it('joins a date and a time', () => {
    expect(joinDateTime('2026-11-08', '18:30')).toBe('2026-11-08T18:30');
  });
});

describe('quick picks', () => {
  it('offers the day before and the morning of for a future bundled date', () => {
    expect(quickPicksFor('2026-11-08', '2026-10-04')).toEqual([
      { kind: 'dayBefore', date: '2026-11-07' },
      { kind: 'morningOf', date: '2026-11-08' },
    ]);
  });

  it('offers nothing without a bundled date', () => {
    expect(quickPicksFor(null, '2026-10-04')).toEqual([]);
    expect(quickPicksFor('not-a-date', '2026-10-04')).toEqual([]);
  });

  it('offers nothing for a date that has passed (an ongoing festival that began earlier)', () => {
    expect(quickPicksFor('2026-10-01', '2026-10-04')).toEqual([]);
  });

  it('on the festival day only the morning-of pick remains; the day before is already past', () => {
    expect(quickPicksFor('2026-10-04', '2026-10-04')).toEqual([
      { kind: 'morningOf', date: '2026-10-04' },
    ]);
    expect(quickPicksFor('2026-10-05', '2026-10-04')).toEqual([
      { kind: 'dayBefore', date: '2026-10-04' },
      { kind: 'morningOf', date: '2026-10-05' },
    ]);
  });

  it('shifts across month and year boundaries with plain calendar arithmetic', () => {
    expect(quickPicksFor('2027-01-01', '2026-12-01')[0]).toEqual({
      kind: 'dayBefore',
      date: '2026-12-31',
    });
  });
});
