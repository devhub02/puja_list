import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  countRemindersForPreparation,
  createPreparation,
  deletePreparation,
  deleteReminder,
  findReminderAt,
  getReminder,
  insertReminder,
  listReminders,
  listRemindersForPreparation,
  updateReminder,
} from '@/db/repositories';
import { seedContentIfNeeded } from '@/db/seed';

import { makeFixtureBundle } from '../testing/contentFixture';
import { applyMigrations, createMigratedDb, createNodeSqlDb } from '../testing/nodeSqlDb';

describe('reminder repository', () => {
  it('creates, reads, lists in time order, updates and deletes', async () => {
    const db = createMigratedDb();
    const prep = await createPreparation(db, { pujaId: 'puja_test_lakshmi' });
    const late = await insertReminder(
      db,
      { preparationId: prep.id, scheduledAt: '2026-11-09T07:00' },
      10,
    );
    const early = await insertReminder(
      db,
      { preparationId: prep.id, scheduledAt: '2026-11-08T07:00', label: '  flowers ' },
      11,
    );
    expect(early).toMatchObject({
      enabled: true,
      notificationId: null,
      label: 'flowers',
      completedAt: null,
    });
    expect((await listReminders(db)).map((r) => r.id)).toEqual([early.id, late.id]);
    expect(await countRemindersForPreparation(db, prep.id)).toBe(2);
    expect((await findReminderAt(db, prep.id, '2026-11-09T07:00'))?.id).toBe(late.id);
    expect(await findReminderAt(db, prep.id, '2030-01-01T00:00')).toBeNull();

    await updateReminder(
      db,
      early.id,
      { enabled: false, notificationId: 'os-9', pausedReason: 'global_off', label: '' },
      99,
    );
    expect(await getReminder(db, early.id)).toMatchObject({
      enabled: false,
      notificationId: 'os-9',
      pausedReason: 'global_off',
      label: null,
      updatedAt: 99,
    });
    await deleteReminder(db, late.id);
    expect(await getReminder(db, late.id)).toBeNull();
  });

  it('deleting a preparation deletes its reminders and only its own', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' });
    const b = await createPreparation(db, { pujaId: 'puja_a' });
    await insertReminder(db, { preparationId: a.id, scheduledAt: '2026-11-08T07:00' });
    await insertReminder(db, { preparationId: b.id, scheduledAt: '2026-11-08T07:00' });
    await deletePreparation(db, a.id);
    expect(await listRemindersForPreparation(db, a.id)).toEqual([]);
    expect(await listRemindersForPreparation(db, b.id)).toHaveLength(1);
  });

  it('cascades even without the explicit delete (the foreign key does it)', async () => {
    const db = createMigratedDb();
    const a = await createPreparation(db, { pujaId: 'puja_a' });
    await insertReminder(db, { preparationId: a.id, scheduledAt: '2026-11-08T07:00' });
    await db.run('DELETE FROM preparation WHERE id = ?', [a.id]);
    expect(await listReminders(db)).toEqual([]);
  });

  it('survives a simulated app restart (a file database closed and reopened)', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'puja-rem-')), 'test.db');
    const first = createNodeSqlDb(file);
    applyMigrations(first);
    const prep = await createPreparation(first, { pujaId: 'puja_a' });
    const saved = await insertReminder(first, {
      preparationId: prep.id,
      scheduledAt: '2026-11-08T07:00',
      label: 'x',
    });
    await updateReminder(first, saved.id, { notificationId: 'os-1' });
    first.raw.close();

    const second = createNodeSqlDb(file);
    expect(await listReminders(second)).toEqual([
      expect.objectContaining({
        id: saved.id,
        preparationId: prep.id,
        notificationId: 'os-1',
        label: 'x',
      }),
    ]);
    second.raw.close();
  });
});

describe('content re-seed and reminders', () => {
  it('a re-seed (new content version) leaves reminders and their preparations untouched', async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle(), () => 1);
    const prep = await createPreparation(db, { pujaId: 'puja_test_lakshmi' });
    await insertReminder(db, {
      preparationId: prep.id,
      scheduledAt: '2026-11-08T07:00',
      label: 'keep me',
    });
    const before = await listReminders(db);

    const outcome = await seedContentIfNeeded(
      db,
      makeFixtureBundle({ contentVersion: 2, checksum: 'sha256:v2' }),
      () => 2,
    );
    expect(outcome).toBe('seeded');
    expect(await listReminders(db)).toEqual(before);
  });

  it("keeps reminders when the preparation's puja disappears from the content (no crash, no cascade)", async () => {
    const db = createMigratedDb();
    await seedContentIfNeeded(db, makeFixtureBundle(), () => 1);
    const prep = await createPreparation(db, { pujaId: 'puja_test_lakshmi' });
    await insertReminder(db, { preparationId: prep.id, scheduledAt: '2026-11-08T07:00' });
    const without = makeFixtureBundle({ contentVersion: 3, checksum: 'sha256:v3' });
    without.pujas = without.pujas.filter((p) => p.id !== 'puja_test_lakshmi');
    without.festivals = without.festivals.map((f) => ({ ...f, linkedPujaIds: [] }));
    await seedContentIfNeeded(db, without, () => 3);
    expect(await listReminders(db)).toHaveLength(1);
    expect(await countRemindersForPreparation(db, prep.id)).toBe(1);
  });
});
