/**
 * A change counter for preparation data. The database is the source of truth; every write bumps the
 * counter and the screens that show preparations (Puja details, Samagri, Vidhi, My Preparation) re-read
 * when it changes, so a tick on one screen shows up on the others at once.
 */
import { create } from 'zustand';

type PreparationStore = { revision: number; bump: () => void };

export const usePreparationStore = create<PreparationStore>()((set) => ({
  revision: 0,
  bump: () => set((s) => ({ revision: s.revision + 1 })),
}));

/** Runs a database write, then tells every preparation screen to re-read. */
export async function writeAndRefresh<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } finally {
    usePreparationStore.getState().bump();
  }
}

/** For tests. */
export function resetPreparationStore(): void {
  usePreparationStore.setState({ revision: 0 });
}
