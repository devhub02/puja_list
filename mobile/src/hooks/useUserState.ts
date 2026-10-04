import { useEffect } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useUserStateStore } from '@/store/userStateStore';

/** The saved/recent mirror, loaded from the database the first time any screen asks for it. */
export function useUserState() {
  const db = useDatabase();
  const loaded = useUserStateStore((s) => s.loaded);
  const load = useUserStateStore((s) => s.load);
  useEffect(() => {
    if (!loaded) void load(db);
  }, [db, loaded, load]);
  return useUserStateStore();
}
