import { useEffect, useState } from 'react';

import { useOptionalDatabase } from './DatabaseProvider';
import { getContentInfo } from './repositories';
import type { ContentInfo } from './types';

/** Loaded content version and puja count, read from the database. null while loading or if unavailable. */
export function useContentInfo(): ContentInfo | null {
  const db = useOptionalDatabase();
  const [info, setInfo] = useState<ContentInfo | null>(null);
  useEffect(() => {
    if (db === null) return;
    let cancelled = false;
    getContentInfo(db).then(
      (value) => {
        if (!cancelled) setInfo(value);
      },
      () => {
        if (!cancelled) setInfo(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db]);
  return info;
}
