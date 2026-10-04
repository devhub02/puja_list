/**
 * In-memory mirror of the user-data tables the browse screens show (saved pujas, recently viewed pujas,
 * recent searches). The database stays the source of truth: every action writes to it and screens read the
 * mirror, so a favorite toggled on a card updates Home, Library and Details at once.
 */
import { create } from 'zustand';

import {
  clearRecentSearches,
  listRecentSearches,
  listRecentViews,
  listSavedPujas,
  recordSearch,
  recordView,
  savePuja,
  unsavePuja,
} from '@/db/repositories';
import type { SqlDb } from '@/db/sqlDb';

type UserState = {
  loaded: boolean;
  /** Newest first. May contain ids whose content no longer exists; screens drop those at read time. */
  savedIds: string[];
  recentIds: string[];
  recentSearches: string[];
  load: (db: SqlDb) => Promise<void>;
  toggleSaved: (db: SqlDb, pujaId: string) => Promise<void>;
  noteView: (db: SqlDb, pujaId: string) => Promise<void>;
  noteSearch: (db: SqlDb, query: string) => Promise<void>;
  clearSearches: (db: SqlDb) => Promise<void>;
};

const initial = { loaded: false, savedIds: [], recentIds: [], recentSearches: [] };

async function readAll(db: SqlDb) {
  const [saved, views, searches] = await Promise.all([
    listSavedPujas(db),
    listRecentViews(db),
    listRecentSearches(db),
  ]);
  return {
    loaded: true,
    savedIds: saved.map((s) => s.pujaId),
    recentIds: views.map((v) => v.pujaId),
    recentSearches: searches,
  };
}

let loading: Promise<void> | null = null;

export const useUserStateStore = create<UserState>()((set, get) => ({
  ...initial,

  load: (db) => {
    if (!loading) {
      loading = readAll(db)
        .then((state) => set(state))
        .catch((error: unknown) => console.error('Could not read saved data', error))
        .finally(() => {
          loading = null;
        });
    }
    return loading;
  },

  toggleSaved: async (db, pujaId) => {
    const wasSaved = get().savedIds.includes(pujaId);
    // Optimistic: the heart changes immediately, then the database write follows.
    set((s) => ({
      savedIds: wasSaved ? s.savedIds.filter((id) => id !== pujaId) : [pujaId, ...s.savedIds],
    }));
    try {
      await (wasSaved ? unsavePuja(db, pujaId) : savePuja(db, pujaId));
    } catch (error) {
      console.error('Could not update saved puja', error);
      set({ savedIds: (await listSavedPujas(db).catch(() => [])).map((s) => s.pujaId) });
    }
  },

  noteView: async (db, pujaId) => {
    set((s) => ({
      recentIds: [pujaId, ...s.recentIds.filter((id) => id !== pujaId)].slice(0, 20),
    }));
    try {
      await recordView(db, pujaId);
    } catch (error) {
      console.error('Could not record view', error);
    }
  },

  noteSearch: async (db, query) => {
    try {
      await recordSearch(db, query);
      set({ recentSearches: await listRecentSearches(db) });
    } catch (error) {
      console.error('Could not record search', error);
    }
  },

  clearSearches: async (db) => {
    set({ recentSearches: [] });
    try {
      await clearRecentSearches(db);
    } catch (error) {
      console.error('Could not clear searches', error);
    }
  },
}));

/** For tests. */
export function resetUserStateStore(): void {
  loading = null;
  useUserStateStore.setState({ ...initial });
}
