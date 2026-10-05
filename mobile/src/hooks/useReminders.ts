import { useDbQuery } from '@/hooks/useDbQuery';
import { getNextDate, getPuja, listReminders } from '@/db/repositories';
import type { Reminder } from '@/db/repositories';
import { useReminderStore } from '@/store/reminderStore';
import { localIsoDate } from '@/utils/dateUtils';
import { quickPicksFor } from '@/utils/reminderTime';
import type { QuickPick } from '@/utils/reminderTime';

/** Every reminder, re-read after any reminder write or reconcile. */
export function useReminders() {
  const revision = useReminderStore((s) => s.revision);
  return useDbQuery<Reminder[]>((db) => listReminders(db), `reminders:${revision}`);
}

/**
 * "Day before" / "Morning of" shortcuts for a puja whose linked festival has a REAL bundled date that is
 * today or later. Empty without such a date: nothing is guessed and no lunar date is computed.
 */
export function useQuickPicks(pujaId: string | null) {
  return useDbQuery<QuickPick[]>(
    async (db) => {
      if (!pujaId) return [];
      const puja = await getPuja(db, pujaId);
      if (!puja?.festivalId) return [];
      const today = localIsoDate();
      const next = await getNextDate(db, puja.festivalId, today);
      return quickPicksFor(next?.date ?? null, today);
    },
    `quick:${pujaId ?? ''}:${localIsoDate()}`,
  );
}
