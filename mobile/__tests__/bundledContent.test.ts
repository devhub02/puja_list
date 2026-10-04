import bundledJson from '../assets/puja_data/content.json';
import { SUPPORTED_SCHEMA_VERSION, seedContentIfNeeded } from '@/db/seed';
import { getContentInfo } from '@/db/repositories';
import type { ContentBundle } from '@/db/types';

import { createMigratedDb } from '../testing/nodeSqlDb';

const bundled = bundledJson as unknown as ContentBundle;

describe('bundled content (mobile/assets/puja_data/content.json)', () => {
  it('has the header the seed loader needs', () => {
    expect(bundled.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(Number.isInteger(bundled.contentVersion)).toBe(true);
    expect(bundled.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(bundled.languages).toContain('en');
  });

  it('seeds into a fresh database exactly as shipped', async () => {
    const db = createMigratedDb();
    expect(await seedContentIfNeeded(db, bundled)).toBe('seeded');
    const info = await getContentInfo(db);
    expect(info.contentVersion).toBe(bundled.contentVersion);
    expect(info.pujaCount).toBe(bundled.pujas.length);
    expect(await seedContentIfNeeded(db, bundled)).toBe('unchanged');
  });
});
