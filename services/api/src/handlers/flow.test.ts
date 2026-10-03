// The course of a catch-up that writes (#271 fills it in): with the
// operation's changes in one batch, or written before a read; refused, the
// server's failure.
import {
  createIdSource,
  operations,
  type Change,
  type Records,
} from '@itera/application';
import { timeZone } from '@itera/domain';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import type { AppEnv } from '../env';
import { testNow } from '../test-env';
import { createFlow } from './flow';

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
afterEach(() => {
  close?.();
  vi.restoreAllMocks();
});

/** A catch-up that writes: an Area made by the system. */
const writingCatchUp: Change = (records, ctx) => {
  const made = operations.createArea({ name: 'システム' })(records, ctx);
  if (!made.ok) return made;
  const { changes, activities } = made.value;
  return { ok: true, value: { changes, activities } };
};

/** The flow behind a route of each kind, signed in as Alice. */
async function setup(catchUp: Change) {
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
  });
  const flow = createFlow({ now: () => testNow, catchUp });
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    c.set('db', db);
    c.set('userId', alice);
    await next();
  });
  app.post('/operate', async (c) =>
    c.json(await flow.operate(c, operations.createArea({ name: '仕事' }))),
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
    // Hono's own error handler, which logs it: the app's turns it into
    // internalError.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await app.request('/operate', { method: 'POST' })).status).toBe(
      500,
    );
    expect((await app.request('/read')).status).toBe(500);
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });
});
