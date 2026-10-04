/**
 * Reminder time convention (docs/DB_SCHEMA.md section 3.2): a reminder time is a LOCAL wall-clock date-time
 * string `YYYY-MM-DDTHH:mm` (minutes, no seconds, no time zone). "8:00 on 8 Nov" means 8:00 on the phone's
 * clock, wherever the phone is. Strings in this format sort and compare like the moments they name, so
 * "is it in the past" is a plain string comparison with the current local minute.
 *
 * Nothing here computes a festival date: quick picks only shift a bundled date by one day (plain calendar
 * arithmetic from `dateUtils`) and never involve a lunar calculation or a time zone.
 */
import { addDays, localIsoDate, parseIso } from './dateUtils';

export type ReminderTime = string;

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** `HH:mm` from hour and minute. */
export function formatTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Joins a `YYYY-MM-DD` date and an `HH:mm` time. */
export function joinDateTime(isoDate: string, time: string): ReminderTime {
  return `${isoDate}T${time}`;
}

/** `YYYY-MM-DDTHH:mm` for a Date, read in the device's local zone (minutes; seconds are dropped). */
export function formatLocalDateTime(date: Date): ReminderTime {
  return joinDateTime(localIsoDate(date), formatTime(date.getHours(), date.getMinutes()));
}

export type ParsedReminderTime = {
  date: string;
  hour: number;
  minute: number;
};

/** Strict parse: a real calendar day and a real time of day, else null. */
export function parseReminderTime(value: string): ParsedReminderTime | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  if (parseIso(match[1]) === null) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) return null;
  return { date: match[1], hour, minute };
}

/** The moment to hand to the OS: the local wall-clock time on the phone. Null for an invalid string. */
export function toLocalDate(value: ReminderTime): Date | null {
  const parsed = parseReminderTime(value);
  if (!parsed) return null;
  const ymd = parseIso(parsed.date);
  if (!ymd) return null;
  return new Date(ymd.year, ymd.month - 1, ymd.day, parsed.hour, parsed.minute, 0, 0);
}

/** True when the time is not strictly after the current local minute (such a reminder can never fire). */
export function isPastReminder(value: ReminderTime, now: Date): boolean {
  return value <= formatLocalDateTime(now);
}

export type QuickPickKind = 'dayBefore' | 'morningOf';
export type QuickPick = { kind: QuickPickKind; date: string };

/**
 * "Day before" and "Morning of" shortcuts for a festival whose real bundled date is today or later. They only
 * choose the DATE; the user still confirms the time. Without a bundled date (null) nothing is offered.
 * An ongoing multi-day festival uses its bundled start date, which is already past, so nothing is offered.
 */
export function quickPicksFor(festivalDate: string | null, today: string): QuickPick[] {
  if (festivalDate === null || parseIso(festivalDate) === null) return [];
  const picks: QuickPick[] = [];
  const before = addDays(festivalDate, -1);
  if (before !== null && before >= today) picks.push({ kind: 'dayBefore', date: before });
  if (festivalDate >= today) picks.push({ kind: 'morningOf', date: festivalDate });
  return picks;
}
