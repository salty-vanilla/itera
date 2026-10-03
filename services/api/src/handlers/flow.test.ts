// The course of a catch-up that writes: with the
// operation's changes in one batch, or written before a read; refused, the
// server's failure.
import {
  createIdSource,
  operations,
  type Change,
  type Records,
} from '@itera/application';
import { localDate, timeZone } from '@itera/domain';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError, errorResponse } from '../errors';
import { testNow } from '../test-env';
import { createFlow } from './flow';
import { answerOf, answerResponse } from './idempotency';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const alice = ids.newId('User', testNow);

const settled: Records = {
  user: {
    id: alice,
    displayName: 'Alice',
    timeZone: timeZone('Asia/Tokyo'),
    weekStartsOn: 1,
  },
  areas: [],
  tasks: [],
  rules: [],
  occurrences: [],
  sprints: [],
  criteria: [],
};

let close: (() => void) | undefined;
afterEach(() => close?.());

/** A catch-up that writes: an Area made by the system. */
const writingCatchUp: Change = (records, ctx) => {
  const made = operations.createArea({ name: 'システム' })(records, ctx);
  if (!made.ok) return made;
  const { changes, activities } = made.value;
  return { ok: true, value: { changes, activities } };
};

/**
 * The flow behind a route of each kind, signed in as Alice. `interfere`
 * runs before each batch the flow sends, on the database itself.
 */
async function setup(
  catchUp: Change,
  interfere: (db: Database) => Promise<void> = async () => {},
) {
  const memory = await createMemoryDatabase();
  close = memory.close;
  const { db } = memory;
  await db
    .insert(authUser)
    .values({ id: alice, name: 'Alice', email: 'alice@example.com' });
  await saveRecords(db, {
    userId: alice,
    loaded: { revision: 0, records: null },
    changes: settled,
    activities: [],
    caughtUpTo: localDate('2026-10-03'),
  });
  const flow = createFlow({ now: () => testNow, catchUp: () => catchUp });
  const app = new Hono<AppEnv>();
  // The contract's errors as the app answers them; anything else is 500.
  app.onError((error, c) =>
    error instanceof ApiError
      ? errorResponse(c, error.failure)
      : c.text('', 500),
  );
  const interfering = new Proxy(db, {
    get(target, key, receiver) {
      if (key !== 'batch') return Reflect.get(target, key, receiver);
      return async (statements: Parameters<Database['batch']>[0]) => {
        await interfere(target);
        return target.batch(statements);
      };
    },
  });
  app.use(async (c, next) => {
    c.set('db', interfering);
    c.set('userId', alice);
    c.set('write', { key: crypto.randomUUID(), fingerprint: 'operate' });
    await next();
  });
  app.post('/operate', async (c) =>
    answerResponse(
      c,
      await flow.operate(c, operations.createArea({ name: '仕事' }), (value) =>
        answerOf(200, value),
      ),
    ),
  );
  app.get('/read', async (c) =>
    c.json(await flow.read(c, (records) => records.areas.map((a) => a.name))),
  );
  return { app, db };
}

describe('a catch-up that writes', () => {
  it('goes into the operation’s batch, before the operation', async () => {
    const { app, db } = await setup(writingCatchUp);
    expect((await app.request('/operate', { method: 'POST' })).status).toBe(
      200,
    );
    const { revision, records } = await loadRecords(db, alice);
    // One save: the revision goes up once.
    expect(revision).toBe(2);
    expect(records?.areas.map((a) => [a.name, a.order])).toEqual([
      ['システム', 0],
      ['仕事', 1],
    ]);
    const entries = await db.select().from(activity);
    expect(entries.map((e) => [e.revision, e.position, e.actor])).toEqual([
      [2, 0, 'system'],
      [2, 1, 'user'],
    ]);
  });

  it('is written before a read, which sees it', async () => {
    const { app, db } = await setup(writingCatchUp);
    const response = await app.request('/read');
    expect(await response.json()).toMatchObject({ view: ['システム'] });
    expect((await loadRecords(db, alice)).revision).toBe(2);
  });

  it('writes nothing when there is nothing to do', async () => {
    const { app, db } = await setup(() => ({
      ok: true,
      value: { changes: {}, activities: [] },
    }));
    await app.request('/read');
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it('refused, is the server’s failure, and nothing is written', async () => {
    const { app, db } = await setup(
      operations.renameArea({ areaId: ids.newId('Area', testNow), name: 'x' }),
    );
    expect((await app.request('/operate', { method: 'POST' })).status).toBe(
      500,
    );
    expect((await app.request('/read')).status).toBe(500);
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });
});

describe('a read whose catch-up meets another write', () => {
  /** Another device's save: the settings, renamed. */
  async function anotherSave(db: Database) {
    const loaded = await loadRecords(db, alice);
    await saveRecords(db, {
      userId: alice,
      loaded,
      changes: {
        user: { ...settled.user, displayName: `A${loaded.revision}` },
      },
      activities: [],
      caughtUpTo: localDate('2026-10-03'),
    });
  }

  /** Interferes before the first `times` saves (a load is a batch too). */
  function before(times: number) {
    let saves = 0;
    let loads = 0;
    return async (db: Database) => {
      loads += 1;
      // The flow loads, then saves: every second batch is a save.
      if (loads % 2 === 0 && saves < times) {
        saves += 1;
        await anotherSave(db);
      }
    };
  }

  it('loads again and writes once', async () => {
    const { app, db } = await setup(writingCatchUp, before(1));
    const response = await app.request('/read');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ view: ['システム'] });
    const { revision, records } = await loadRecords(db, alice);
    // The other save, then the catch-up on top of it.
    expect(revision).toBe(3);
    expect(records?.user.displayName).toBe('A1');
    expect(records?.areas.map((a) => a.name)).toEqual(['システム']);
  });

  it('meeting another write again, answers 409', async () => {
    const { app, db } = await setup(writingCatchUp, before(2));
    const response = await app.request('/read');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      type: '/problems/revision-conflict',
    });
    const { revision, records } = await loadRecords(db, alice);
    expect(revision).toBe(3);
    expect(records?.areas).toEqual([]);
  });
});
