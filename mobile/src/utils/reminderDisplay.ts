/** Pure helpers that decide how a reminder is grouped and described. No React, no database. */
import type { Reminder } from '@/db/repositories';
import { formatReminderWhen } from '@/i18n/format';
import type { LanguageCode } from '@/i18n/registry';

import { isPastReminder, parseReminderTime } from './reminderTime';

export type ReminderGroup = 'upcoming' | 'paused' | 'past';

/**
 * - past: its time has passed (or reconcile marked it done); it never fires
 * - paused: switched off by the user, or on but not scheduled (notifications off, no permission, OS error)
 * - upcoming: on, in the future, and scheduled (or waiting for the next reconcile to schedule it)
 */
export function reminderGroup(reminder: Reminder, now: Date): ReminderGroup {
  if (reminder.completedAt !== null || isPastReminder(reminder.scheduledAt, now)) return 'past';
  if (!reminder.enabled || reminder.pausedReason !== null) return 'paused';
  return 'upcoming';
}

/** Translation key (under `reminders.status`) for the one-line status of a reminder. */
export type ReminderStatusKey =
  'upcoming' | 'off' | 'pausedGlobalOff' | 'pausedNoPermission' | 'pausedFailed' | 'past';

export function reminderStatusKey(reminder: Reminder, now: Date): ReminderStatusKey {
  if (reminderGroup(reminder, now) === 'past') return 'past';
  if (!reminder.enabled) return 'off';
  switch (reminder.pausedReason) {
    case 'global_off':
      return 'pausedGlobalOff';
    case 'no_permission':
      return 'pausedNoPermission';
    case 'schedule_failed':
      return 'pausedFailed';
    default:
      return 'upcoming';
  }
}

export function groupReminders<T extends Reminder>(
  reminders: readonly T[],
  now: Date,
): Record<ReminderGroup, T[]> {
  const groups: Record<ReminderGroup, T[]> = { upcoming: [], paused: [], past: [] };
  for (const reminder of reminders) groups[reminderGroup(reminder, now)].push(reminder);
  // Upcoming and paused soonest first; past most recent first.
  groups.upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  groups.paused.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  groups.past.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  return groups;
}

/** "8 Nov 2026, 7:00 am" for a reminder time; the raw string if it is somehow invalid. */
export function describeReminderTime(scheduledAt: string, language: LanguageCode): string {
  const parsed = parseReminderTime(scheduledAt);
  if (!parsed) return scheduledAt;
  const [year, month, day] = parsed.date.split('-').map(Number);
  return formatReminderWhen(
    { year, month, day, hour: parsed.hour, minute: parsed.minute },
    language,
  );
}
