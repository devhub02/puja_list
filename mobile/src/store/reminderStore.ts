/**
 * A change counter for reminder data (same idea as `preparationStore`): every write or reconcile bumps it and
 * the screens that list reminders re-read. The database stays the source of truth.
 */
import { create } from 'zustand';

type ReminderStore = { revision: number; bump: () => void };

export const useReminderStore = create<ReminderStore>()((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

/** For tests. */
export function resetReminderStore(): void {
  useReminderStore.setState({ revision: 0 });
}
