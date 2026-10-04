// The fixture's 12 states (PRD §12) survive the database: written as a first
// save and read back, the records are deeply equal to the fixture's (#266).
import {
  applyRecordChanges,
  catchUp,
  createIdSource,
  nextVersions,
  operations,
  versionKey,
  type Change,
  type Records,
} from '@itera/application';
import {
  fixtureIds,
  fixtureSnapshot,
  fixtureStateIds,
} from '@itera/application/fixtures';
import { addDays, id, instant, type DayOfWeek } from '@itera/domain';
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
      // Every record with an etag has a version, under the key the
      // application gives it (#321).
      const none = {
        ...records,
        areas: [],
        tasks: [],
        sprints: [],
        criteria: [],
        rules: [],
      };
      expect(saved.ok && saved.versions).toEqual(
        nextVersions(new Map(), none, records, 1),
      );
    },
  );
});

describe('the versions a save writes (#321)', () => {
  // The rows the database writes and the records the memory store compares
  // (packages/application nextVersions) raise the same versions.
  const ids = fixtureIds();
  const fresh = createIdSource((bytes) => crypto.getRandomValues(bytes));
  const sprintOf = (records: Records) =>
    records.sprints.find((s) => s.state === 'active')!;
  const changes: readonly (readonly [
    string,
    (r: Records) => Change<unknown>,
  ])[] = [
    [
      'a Task renamed',
      () =>
        operations.saveTask({
          taskId: id<'Task'>(ids.task.paper),
          update: { title: '論文を書く' },
        }),
    ],
    [
      'the first note deleted (the next ones move up)',
      (r) =>
        operations.deleteInterrupt({
          sprintId: sprintOf(r).id,
          interruptNoteId: sprintOf(r).interrupts[0]!.id,
        }),
    ],
    [
      'a Goal written for an Area without one',
      (r) =>
        operations.setGoal({
          sprintId: sprintOf(r).id,
          areaId: r.areas.find(
            (a) => !sprintOf(r).goals.some((g) => g.areaId === a.id),
          )!.id,
          text: '目標',
        }),
    ],
    [
      'a rule made for a Task without one',
      () =>
        operations.setRecurrence({
          taskId: id<'Task'>(ids.task.paper),
          pattern: { freq: 'daily' },
        }),
    ],
    [
      'a rule changed from the next Sprint (a version added)',
      () =>
        operations.setRecurrence({
          taskId: id<'Task'>(ids.task.cleaning),
          pattern: { freq: 'weekly', daysOfWeek: [6, 0] },
        }),
    ],
    [
      'a rule ended',
      () => operations.endRecurrence({ taskId: id<'Task'>(ids.task.cleaning) }),
    ],
    ['the next day caught up (the system)', () => catchUp(null)],
  ];

  it.each(changes)('%s', async (_, make) => {
    const { records: all, clock } = fixtureSnapshot('today-interrupt');
    const { activities, ...records } = all;
    const memory = await createMemoryDatabase();
    close = memory.close;
    const { db } = memory;
    await db
      .insert(authUser)
      .values({ id: records.user.id, name: 'n', email: 'n@example.com' });
    await saveRecords(db, {
      userId: records.user.id,
      loaded: { revision: 0, records: null, versions: new Map() },
      changes: records,
      activities,
      caughtUpTo: clock.today,
    });
    const loaded = await loadRecords(db, records.user.id);
    const before = loaded.records!;
    // The system's catch-up runs on the next morning.
    const system = make === changes.at(-1)![1];
    const today = system ? addDays(clock.today, 1) : clock.today;
    const now = system ? instant(`${today}T00:30:00.000Z`) : clock.now;
    const result = make(before)(before, {
      now,
      today,
      actor: system ? 'system' : 'user',
      newId: (kind) => fresh.newId(kind, now),
    });
    if (!result.ok) throw new Error(result.error.message);
    const after = applyRecordChanges(before, result.value.changes);
    const saved = await saveRecords(db, {
      userId: records.user.id,
      loaded,
      changes: result.value.changes,
      activities: result.value.activities,
      caughtUpTo: today,
    });
    if (!saved.ok) throw new Error('not saved');
    expect(saved.versions).toEqual(
      nextVersions(loaded.versions, before, after, saved.revision),
    );
    if (system) {
      // The day's start writes choices and occurrences, none of the
      // records a write replaces values of: their etags stay.
      expect(saved.revision).toBe(loaded.revision + 1);
      expect(saved.versions).toEqual(loaded.versions);
    } else {
      expect(saved.versions).not.toEqual(loaded.versions);
    }
    expect((await loadRecords(db, records.user.id)).versions).toEqual(
      saved.versions,
    );
  });

  it('moves a rule’s version when a day of one of its versions is taken off (#330)', async () => {
    // The fixture's rule changes to Sundays from the next Sprint. Saturday
    // added to that version, then taken off: the day's row is deleted, and
    // no other row of the rule changes but its own.
    const { records: all, clock } = fixtureSnapshot('backlog-recurrence');
    const { activities, ...records } = all;
    const memory = await createMemoryDatabase();
    close = memory.close;
    const { db } = memory;
    await db
      .insert(authUser)
      .values({ id: records.user.id, name: 'n', email: 'n@example.com' });
    await saveRecords(db, {
      userId: records.user.id,
      loaded: { revision: 0, records: null, versions: new Map() },
      changes: records,
      activities,
      caughtUpTo: clock.today,
    });
    const cleaning = id<'Task'>(ids.task.cleaning);
    const ruleKey = versionKey.rule(
      records.tasks.find((t) => t.id === cleaning)!.recurrenceRuleId!,
    );
    const run = async (daysOfWeek: DayOfWeek[]) => {
      const loaded = await loadRecords(db, records.user.id);
      const before = loaded.records!;
      const result = operations.setRecurrence({
        taskId: cleaning,
        pattern: { freq: 'weekly', daysOfWeek },
      })(before, {
        now: clock.now,
        today: clock.today,
        actor: 'user',
        newId: (kind) => fresh.newId(kind, clock.now),
      });
      if (!result.ok) throw new Error(result.error.message);
      const after = applyRecordChanges(before, result.value.changes);
      const saved = await saveRecords(db, {
        userId: records.user.id,
        loaded,
        changes: result.value.changes,
        activities: result.value.activities,
        caughtUpTo: clock.today,
      });
      if (!saved.ok) throw new Error('not saved');
      expect(saved.versions).toEqual(
        nextVersions(loaded.versions, before, after, saved.revision),
      );
      expect(saved.versions.get(ruleKey)).toBe(saved.revision);
      expect((await loadRecords(db, records.user.id)).versions).toEqual(
        saved.versions,
      );
    };
    await run([6, 0]);
    await run([0]);
  });
});
