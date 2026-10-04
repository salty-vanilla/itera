// The fixture's 12 states (PRD §12) survive the database: written as a first
// save and read back, the records are deeply equal to the fixture's (#266).
import { fixtureSnapshot, fixtureStateIds } from '@itera/application/fixtures';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRecords } from './load-records';
import { createMemoryDatabase } from './memory-database';
import { saveRecords } from './save-records';
import { activity, user as authUser } from './schema';

let close: (() => void) | undefined;
afterEach(() => close?.());

describe('the fixture states', () => {
  it.each(fixtureStateIds)(
    'read back as they were written: %s',
    async (state) => {
      const { records: all, clock } = fixtureSnapshot(state);
      const { activities, ...records } = all;
      const memory = await createMemoryDatabase();
      close = memory.close;
      const { db } = memory;
      await db
        .insert(authUser)
        .values({ id: records.user.id, name: 'n', email: 'n@example.com' });

      const saved = await saveRecords(db, {
        userId: records.user.id,
        loaded: { revision: 0, records: null, versions: new Map() },
        changes: records,
        activities,
        caughtUpTo: clock.today,
      });
      expect(saved).toMatchObject({ ok: true, revision: 1 });
      // toStrictEqual also fails on a key present as `undefined`. Every
      // record is at the version of the save that wrote it (#321).
      expect(await loadRecords(db, records.user.id)).toStrictEqual({
        revision: 1,
        records,
        caughtUpTo: clock.today,
        versions: saved.ok ? saved.versions : undefined,
      });
      expect(await db.select().from(activity)).toHaveLength(activities.length);
    },
  );
});
