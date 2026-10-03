// The system's records when the date has moved on (#271), through the app
// with a clock that moves: the end of a Sprint, the start of a day, and a
// catch-up after days without a request. Alice's records are the fixture's
// 「today-daytime」 (Thursday 10/1 of the Sprint 9/28–10/4, Asia/Tokyo): one
// Task started today, 英語の多読 recurring on Mon・Wed・Fri and 部屋の掃除 on
// Saturday.
import type { Records } from '@itera/application';
import { fixtureSnapshot } from '@itera/application/fixtures';
import {
  instant,
  localDate,
  type Instant,
  type LocalDate,
  type Sprint,
} from '@itera/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import { testDependencies, testEnv, testOrigin } from '../test-env';

const daytime = fixtureSnapshot('today-daytime');
const { user, areas, tasks, rules, occurrences, sprints, criteria } =
  daytime.records;
const fixture: Records = {
  user,
  areas,
  tasks,
  rules,
  occurrences,
  sprints,
  criteria,
};
const alice = fixture.user.id;

const closers: (() => void)[] = [];
afterEach(() => {
  for (const close of closers.splice(0)) close();
});

/** A time in Tokyo: `'10-02 07:00'` is 07:00 on 2026-10-02 JST. */
function jst(time: string): Instant {
  const [day, clock] = time.split(' ');
  return instant(new Date(`2026-${day}T${clock}:00+09:00`).toISOString());
}

/**
 * The app on a database holding the fixture as Alice's first save, brought
 * up to the fixture's 「今日」. The clock is `setNow`'s; every statement the
 * app runs is in `statements`.
 */
async function setup() {
  const memory = await createMemoryDatabase();
  closers.push(memory.close);
  const { db } = memory;
  await db
    .insert(authUser)
    .values({ id: alice, name: 'Alice', email: 'alice@example.com' });
  await saveRecords(db, {
    userId: alice,
    loaded: { revision: 0, records: null },
    changes: fixture,
    activities: [],
    caughtUpTo: daytime.clock.today,
  });
  let now = daytime.clock.now;
  // What the database is sent, statement by statement (a batch's too).
  // Drizzle sends `{ sql, args }`.
  const statements: string[] = [];
  const sqlOf = (statement: unknown) =>
    (statement as { readonly sql: string }).sql;
  const { client } = memory;
  const batch = client.batch.bind(client);
  client.batch = (batched, mode) => {
    statements.push(...batched.map(sqlOf));
    return batch(batched, mode);
  };
  const execute = client.execute.bind(client);
  client.execute = ((statement: Parameters<typeof execute>[0]) => {
    statements.push(sqlOf(statement));
    return execute(statement);
  }) as typeof client.execute;
  const authenticator: Authenticator = {
    authenticate: async () => ({ userId: alice }),
    handle: async () => new Response(null, { status: 404 }),
  };
  const app = createApp(
    testDependencies({
      database: () => db,
      authenticator: () => authenticator,
      now: () => now,
    }),
  );
  /** Reads the overview at `time` and answers with its 「今日」. */
  async function readAt(time: Instant) {
    now = time;
    const response = await app.request('/api/overview', {}, testEnv);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { clock: { today: LocalDate } };
    return body.clock.today;
  }
  /** Makes an Area at `time`: an operation of the person's. */
  async function createAreaAt(time: Instant) {
    now = time;
    const response = await app.request(
      '/api/areas',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: testOrigin },
        body: JSON.stringify({ name: '趣味' }),
      },
      testEnv,
    );
    expect(response.status).toBe(201);
  }
  return { db, statements, readAt, createAreaAt };
}

async function sprintOf(db: Database): Promise<Sprint> {
  const { records } = await loadRecords(db, alice);
  const sprint = records?.sprints.find((s) => s.start === '2026-09-28');
  if (sprint === undefined) throw new Error('No Sprint of 9/28.');
  return sprint;
}

async function occurrencesOf(db: Database) {
  return (await loadRecords(db, alice)).records?.occurrences ?? [];
}

/** The selections of a day, by their SprintTask's Task title. */
function selectionsOn(sprint: Sprint, date: string) {
  const titles = new Map(fixture.tasks.map((t) => [t.id, t.title] as const));
  return sprint.dailySelections
    .filter((s) => s.date === date)
    .map((s) => {
      const taskId = sprint.tasks.find((t) => t.id === s.sprintTaskId)?.taskId;
      return [titles.get(taskId!), s.origin, s.resolution];
    });
}

/** Whether any statement writes. */
const writes = (statements: readonly string[]) =>
  statements.filter((s) => !/^select\b/i.test(s.trim()));

describe('the start of a day', () => {
  it('on the first read of a new day, closes the day before and brings in today’s recurring occurrence', async () => {
    const { db, readAt } = await setup();
    expect(selectionsOn(await sprintOf(db), '2026-10-01')).toEqual([
      ['実験データの前処理', 'manual', 'started'],
      ['API 設計のレビュー', 'manual', 'done'],
    ]);

    expect(await readAt(jst('10-02 07:00'))).toBe('2026-10-02');
    const sprint = await sprintOf(db);
    expect(selectionsOn(sprint, '2026-10-01')).toEqual([
      ['実験データの前処理', 'manual', 'unresolved'],
      ['API 設計のレビュー', 'manual', 'done'],
    ]);
    expect(selectionsOn(sprint, '2026-10-02')).toEqual([
      ['英語の多読 30分', 'recurringToday', 'selected'],
    ]);
    // The system's records, at the time they were made.
    const entries = await db.select().from(activity);
    expect(
      entries.map((e) => [e.actor, e.kind, e.at, e.content['date']]),
    ).toEqual([
      ['system', 'todayUnresolved', jst('10-02 07:00'), '2026-10-01'],
      ['system', 'todaySelected', jst('10-02 07:00'), '2026-10-02'],
    ]);
  });

  it('writes nothing on a read with nothing to do', async () => {
    const { db, statements, readAt } = await setup();
    // The fixture's day has already started.
    await readAt(daytime.clock.now);
    await readAt(jst('10-01 23:00'));
    expect(statements.length).toBeGreaterThan(0);
    expect(writes(statements)).toEqual([]);
    expect((await loadRecords(db, alice)).revision).toBe(1);

    // The new day is written once; the next read writes nothing.
    await readAt(jst('10-02 07:00'));
    statements.length = 0;
    await readAt(jst('10-02 07:05'));
    expect(writes(statements)).toEqual([]);
    expect((await loadRecords(db, alice)).revision).toBe(2);
  });

  it('turns over at midnight in the user’s time zone', async () => {
    const { db, statements, readAt } = await setup();
    // 23:59:59.999 in Tokyo is still Wednesday 10/1 (14:59 UTC).
    expect(await readAt(instant('2026-10-01T14:59:59.999Z'))).toBe(
      '2026-10-01',
    );
    expect(writes(statements)).toEqual([]);
    // Midnight in Tokyo is Thursday 10/2, while UTC is still 10/1.
    expect(await readAt(instant('2026-10-01T15:00:00.000Z'))).toBe(
      '2026-10-02',
    );
    expect(selectionsOn(await sprintOf(db), '2026-10-01')).toEqual([
      ['実験データの前処理', 'manual', 'unresolved'],
      ['API 設計のレビュー', 'manual', 'done'],
    ]);
  });
});

describe('the first operation of a new day', () => {
  it('writes the start of the day and the operation in one save, the system’s first', async () => {
    const { db, createAreaAt } = await setup();
    await createAreaAt(jst('10-02 07:00'));
    const { revision, records } = await loadRecords(db, alice);
    expect(revision).toBe(2);
    expect(records?.areas.map((a) => a.name)).toContain('趣味');
    const sprint = await sprintOf(db);
    expect(selectionsOn(sprint, '2026-10-01')).toEqual([
      ['実験データの前処理', 'manual', 'unresolved'],
      ['API 設計のレビュー', 'manual', 'done'],
    ]);
    expect(selectionsOn(sprint, '2026-10-02')).toEqual([
      ['英語の多読 30分', 'recurringToday', 'selected'],
    ]);
    const entries = await db.select().from(activity);
    expect(entries.map((e) => [e.revision, e.actor, e.kind])).toEqual([
      [2, 'system', 'todayUnresolved'],
      [2, 'system', 'todaySelected'],
      [2, 'user', 'areaCreated'],
    ]);
  });
});

describe('the end of a Sprint', () => {
  it('on the day after the end date, the Sprint goes to Review and closes what is open', async () => {
    const { db, readAt } = await setup();
    const before = await occurrencesOf(db);
    expect(await readAt(jst('10-05 08:00'))).toBe('2026-10-05');

    const sprint = await sprintOf(db);
    expect(sprint.state).toBe('review');
    // Nothing chosen for a day is left open.
    expect(
      sprint.dailySelections.filter(
        (s) => s.resolution === 'selected' || s.resolution === 'started',
      ),
    ).toEqual([]);
    // Every occurrence of the Sprint still pending is missed.
    const inSprint = new Set(
      sprint.tasks.flatMap((t) => t.occurrenceIds ?? []),
    );
    const pending = before.filter(
      (o) => inSprint.has(o.id) && o.state === 'pending',
    );
    expect(pending.length).toBeGreaterThan(0);
    const after = await occurrencesOf(db);
    for (const { id } of pending) {
      expect(after.find((o) => o.id === id)?.state).toBe('missed');
    }
    // The days not opened were started as on any day: Thursday's and
    // Saturday's recurring occurrences were chosen, then left unresolved.
    expect(selectionsOn(sprint, '2026-10-02')).toEqual([
      ['英語の多読 30分', 'recurringToday', 'unresolved'],
    ]);
    expect(selectionsOn(sprint, '2026-10-03')).toEqual([
      ['部屋の掃除', 'recurringToday', 'unresolved'],
    ]);
  });
});

describe('two weeks without a request', () => {
  /**
   * The records and Activity, without what differs by when the system ran:
   * the times (the time of the catch-up, #271, also when the Review
   * started), the revisions, and the IDs
   * of the selections it made (each run makes its own), which become the
   * day and what was chosen.
   */
  async function recorded(db: Database) {
    const { records } = await loadRecords(db, alice);
    const keys = new Map<string, string>();
    // toEqual takes a key set to `undefined` as absent.
    const sprints = records!.sprints.map((s) => ({
      ...s,
      retro: s.retro && { ...s.retro, startedAt: undefined },
      dailySelections: s.dailySelections.map((d) => {
        const key = `${d.date} ${d.sprintTaskId} ${d.occurrenceId ?? ''}`;
        keys.set(d.id, key);
        return {
          ...d,
          key,
          id: undefined,
          selectedAt: undefined,
          resolvedAt: undefined,
        };
      }),
    }));
    const occurrences = records!.occurrences.map((o) => ({
      ...o,
      stateChangedAt: undefined,
    }));
    const entries = (await db.select().from(activity)).map((e) => ({
      ...e,
      revision: undefined,
      position: undefined,
      at: undefined,
      content: {
        ...e.content,
        selectionId: keys.get(String(e.content['selectionId'])),
      },
    }));
    return { records: { ...records, sprints, occurrences }, entries };
  }

  it('leaves the same records as a read on every day', async () => {
    const daily = await setup();
    for (let day = 2; day <= 15; day += 1) {
      await daily.readAt(jst(`10-${String(day).padStart(2, '0')} 07:00`));
    }
    const once = await setup();
    expect(await once.readAt(jst('10-15 07:00'))).toBe(localDate('2026-10-15'));

    const expected = await recorded(daily.db);
    expect(expected.records.sprints[1]?.state).toBe('review');
    expect(await recorded(once.db)).toEqual(expected);
    // One save on the read after two weeks.
    expect((await loadRecords(once.db, alice)).revision).toBe(2);
  });
});
