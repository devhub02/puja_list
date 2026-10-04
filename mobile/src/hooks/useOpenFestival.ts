import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Festival } from '@/db/types';
import { activeLinkedPujaIds } from '@/utils/calendarDisplay';

import { useCatalog } from './useCatalog';

/**
 * Opens a festival from a calendar row: exactly one linked, active puja opens that puja's details; no puja
 * (calendar-only festival) or several pujas open the Festival Details screen.
 */
export function useOpenFestival(): (festival: Festival) => void {
  const router = useRouter();
  const catalog = useCatalog();
  const activeIds = useMemo(() => new Set(catalog.pujas.map((p) => p.id)), [catalog.pujas]);
  return useCallback(
    (festival: Festival) => {
      const linked = activeLinkedPujaIds(festival, activeIds);
      if (linked.length === 1) router.push({ pathname: '/puja/[id]', params: { id: linked[0] } });
      else router.push({ pathname: '/festival/[id]', params: { id: festival.id } });
    },
    [activeIds, router],
  );
}
