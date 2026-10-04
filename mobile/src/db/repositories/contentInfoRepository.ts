import type { SqlDb } from '../sqlDb';
import type { ContentInfo } from '../types';

/** What content is loaded on this phone right now (shown in Settings > About). */
export async function getContentInfo(db: SqlDb): Promise<ContentInfo> {
  const meta = await db.all<{ key: string; value: string }>('SELECT key, value FROM content_meta');
  const get = (key: string): number | null => {
    const found = meta.find((row) => row.key === key);
    return found ? Number(found.value) : null;
  };
  const [count] = await db.all<{ n: number }>('SELECT COUNT(*) AS n FROM puja');
  return {
    contentVersion: get('content_version'),
    schemaVersion: get('schema_version'),
    pujaCount: count?.n ?? 0,
    seededAt: get('seeded_at'),
  };
}
