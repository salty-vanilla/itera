// The Idempotency-Key of the writes (ADR 0006 冪等キー, #320): the same
// write sent again answers what it answered the first time and is not made
// twice; a write whose answer was lost, or that came at once with itself,
// answers what was saved rather than 409. Through the app, on an in-memory
// database holding a fixture's state, with the app's clock.
import { idempotencyKeyHeaders } from '@itera/api-contract/requests';
import type { OperationName, Records } from '@itera/application';
import { fixtureIds } from '@itera/application/fixtures';
import { instant, type Instant } from '@itera/domain';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { Database } from '../db/database';
import { KEY_LIFETIME_MS } from '../db/idempotency';
import { activity, idempotencyKey } from '../db/schema';
import { testNow, writeHeaders } from '../test-env';
import { problemIn } from '../test-problems';
import {
  closeFixtureApps,
  fixtureClock,
  httpRequest,
  setupFixtureApp,
  type FixtureApp,
  type Step,
} from './operation-cases';

afterEach(closeFixtureApps);

const ids = fixtureIds();
const { paper, bookshelf, reading } = ids.task;
const activeOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;

/** Sends an operation with the given key. */
function send(
  app: FixtureApp,
  key: string,
  name: OperationName,
  input: unknown,
  condition: Record<string, string> = {},
) {
  const { url, init } = httpRequest(name, input);
  return app.request(url, {
    ...init,
    headers: { ...init.headers, ...writeHeaders(key), ...condition },
  });
}

/** What a response says, to compare two of them. */
async function answer(response: Response) {
  return {
    status: response.status,
    type: response.headers.get('Content-Type'),
    body: await response.text(),
  };
}

/** The records as saved, and the Activity written so far. */
async function state(app: FixtureApp) {
  return {
    ...(await app.saved()),
    activities: await app.db.select().from(activity),
  };
}

/** The app with its catch-up to the clock done, and the steps run. */
async function prepared(app: FixtureApp, steps: readonly Step[] = []) {
  expect((await app.get('/me')).status).toBe(200);
  for (const [name, body] of steps)
    await app.run(name, body((await app.saved()).records));
  return app;
}

const later = (ms: number): Instant =>
  instant(new Date(Date.parse(testNow) + ms).toISOString());

type Case = {
  readonly kind: string;
  readonly name: OperationName;
  readonly state: Parameters<typeof setupFixtureApp>[0];
  readonly prepare?: readonly Step[];
  readonly body: (records: Records) => unknown;
  /** The version the write was made from (#321, #330), sent each time. */
  readonly condition?: Record<string, string>;
};

const cases: readonly Case[] = [
  {
    kind: 'a write that makes a record (POST, 201)',
    name: 'createArea',
    state: 'backlog-capture',
    body: () => ({ name: '家' }),
  },
  {
    kind: 'a write that appends (actual time, POST, 204)',
    name: 'recordActualTime',
    state: 'today-morning',
    prepare: [
      [
        'chooseForToday',
        (r) => ({
          sprintId: activeOf(r).id,
          date: fixtureClock.today,
          sprintTaskId: activeOf(r).tasks.find((t) => t.taskId === paper)!.id,
        }),
      ],
    ],
    body: (r) => ({
      sprintId: activeOf(r).id,
      sprintTaskId: activeOf(r).tasks.find((t) => t.taskId === paper)!.id,
      date: fixtureClock.today,
      hours: 1,
    }),
  },
  {
    kind: 'a PUT',
    name: 'setRecurrence',
    state: 'backlog-capture',
    body: () => ({
      taskId: bookshelf,
      pattern: { freq: 'weekly', daysOfWeek: [3] },
    }),
    // The Task has no rule: the write makes one (#330).
    condition: { 'If-None-Match': '*' },
  },
  {
    kind: 'a DELETE',
    name: 'endRecurrence',
    state: 'backlog-capture',
    body: () => ({ taskId: reading }),
  },
];

describe('a write sent again with its Idempotency-Key', () => {
  it.each(cases)(
    '$kind ($name) answers the same, and is made once',
    async (c) => {
      const app = await prepared(await setupFixtureApp(c.state), c.prepare);
      const before = await state(app);
      const input = c.body(before.records);
      const key = crypto.randomUUID();

      const first = await answer(
        await send(app, key, c.name, input, c.condition),
      );
      expect(first.status).toBeLessThan(300);
      const made = await state(app);
      expect(made.revision).toBe(before.revision + 1);
      expect(made.activities.length).toBeGreaterThan(before.activities.length);

      const again = await answer(
        await send(app, key, c.name, input, c.condition),
      );
      expect(again).toEqual(first);
      expect(await state(app)).toEqual(made);
    },
  );

  it('refuses the key with another body with 422, writing nothing', async () => {
    const app = await prepared(await setupFixtureApp('backlog-capture'));
    const key = crypto.randomUUID();
    expect((await send(app, key, 'createArea', { name: '家' })).status).toBe(
      201,
    );
    const made = await state(app);
    const response = await send(app, key, 'createArea', { name: '庭' });
    expect(await problemIn(response)).toMatchObject({
      status: 422,
      type: '/problems/idempotency-key-reused',
    });
    expect(await state(app)).toEqual(made);
  });

  it('refuses a write without a key, or with one not a UUID, with 400 at the header', async () => {
    const app = await prepared(await setupFixtureApp('backlog-capture'));
    const before = await state(app);
    const { url, init } = httpRequest('createArea', { name: '家' });
    const withoutKey = Object.fromEntries(
      Object.entries(init.headers as Record<string, string>).filter(
        ([name]) => name !== 'Idempotency-Key',
      ),
    );
    for (const headers of [
      withoutKey,
      { ...withoutKey, 'Idempotency-Key': crypto.randomUUID() },
    ]) {
      const response = await app.request(url, { ...init, headers });
      expect(await problemIn(response)).toMatchObject({
        status: 400,
        type: '/problems/validation-failed',
        errors: [{ header: 'Idempotency-Key', detail: expect.any(String) }],
      });
    }
    expect(await state(app)).toEqual(before);
  });

  it('keeps no key for a write that changed nothing: sent again, it runs again', async () => {
    const app = await prepared(await setupFixtureApp('backlog-capture'));
    const { user } = (await app.saved()).records;
    const before = await state(app);
    const key = crypto.randomUUID();
    // The settings as they are: written again, they change nothing (204).
    const sameSettings = () =>
      app.request('/api/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...writeHeaders(key) },
        body: JSON.stringify({
          displayName: user.displayName,
          timeZone: user.timeZone,
          weekStartsOn: user.weekStartsOn,
        }),
      });
    expect((await sameSettings()).status).toBe(204);
    expect(await app.db.select().from(idempotencyKey)).toEqual([]);
    // Run again: still nothing written, and no key.
    expect((await sameSettings()).status).toBe(204);
    expect(await app.db.select().from(idempotencyKey)).toEqual([]);
    expect(await state(app)).toEqual(before);
  });
});

describe('a write whose save meets another', () => {
  it('answers what it saved when its batch went in and the answer was lost', async () => {
    // After `lose` is set, the second batch (the save; the first loads) is
    // made, then fails as if the database's answer were lost.
    let batches: number | undefined;
    const app = await prepared(
      await setupFixtureApp(
        'backlog-capture',
        undefined,
        undefined,
        (db) =>
          new Proxy(db, {
            get(target, key, receiver) {
              if (key !== 'batch') return Reflect.get(target, key, receiver);
              return async (statements: Parameters<Database['batch']>[0]) => {
                const result = await target.batch(statements);
                if (batches !== undefined && (batches += 1) === 2)
                  throw new Error('The answer was lost.');
                return result;
              };
            },
          }),
      ),
    );
    const before = await state(app);
    const key = crypto.randomUUID();
    batches = 0;
    const lost = await answer(
      await send(app, key, 'createArea', { name: '家' }),
    );
    batches = undefined;
    expect(lost.status).toBe(201);
    const made = await state(app);
    expect(made.revision).toBe(before.revision + 1);
    expect(made.records.areas).toHaveLength(before.records.areas.length + 1);
    expect(JSON.parse(lost.body)).toEqual({
      areaId: made.records.areas.at(-1)!.id,
    });
    // Sent again, it answers the same.
    expect(
      await answer(await send(app, key, 'createArea', { name: '家' })),
    ).toEqual(lost);
  });

  it('with the same key at once: made once, and both answer the same', async () => {
    // After `race` is set, the two loads wait for each other, so that both
    // writes are made from the same records and the second save conflicts.
    let race:
      { arrived: number; both: () => void; ready: Promise<void> } | undefined;
    const app = await prepared(
      await setupFixtureApp(
        'backlog-capture',
        undefined,
        undefined,
        (db) =>
          new Proxy(db, {
            get(target, key, receiver) {
              if (key !== 'batch') return Reflect.get(target, key, receiver);
              return async (statements: Parameters<Database['batch']>[0]) => {
                if (race !== undefined && race.arrived < 2) {
                  race.arrived += 1;
                  if (race.arrived === 2) race.both();
                  await race.ready;
                }
                return target.batch(statements);
              };
            },
          }),
      ),
    );
    const before = await state(app);
    let both = () => {};
    const ready = new Promise<void>((resolve) => {
      both = resolve;
    });
    race = { arrived: 0, both, ready };
    const key = crypto.randomUUID();
    const [one, two] = await Promise.all([
      Promise.resolve(send(app, key, 'createArea', { name: '家' })).then(
        answer,
      ),
      Promise.resolve(send(app, key, 'createArea', { name: '家' })).then(
        answer,
      ),
    ]);
    race = undefined;
    expect(one.status).toBe(201);
    expect(two).toEqual(one);
    const made = await state(app);
    expect(made.revision).toBe(before.revision + 1);
    expect(made.records.areas).toHaveLength(before.records.areas.length + 1);
  });

  it('answers 409 when another write came first and this one was not made', async () => {
    let interfere: (() => Promise<void>) | undefined;
    const app = await prepared(
      await setupFixtureApp(
        'backlog-capture',
        undefined,
        undefined,
        (db) =>
          new Proxy(db, {
            get(target, key, receiver) {
              if (key !== 'batch') return Reflect.get(target, key, receiver);
              return async (statements: Parameters<Database['batch']>[0]) => {
                const before = interfere;
                interfere = undefined;
                await before?.();
                return target.batch(statements);
              };
            },
          }),
      ),
    );
    // Another write goes in just before this write's save (its second
    // batch): after its load.
    let batches = 0;
    const other = async () => {
      await app.run('createArea', { name: '庭' });
    };
    interfere = async () => {
      batches += 1;
      interfere = async () => {
        batches += 1;
        await other();
      };
    };
    const response = await send(app, crypto.randomUUID(), 'createArea', {
      name: '家',
    });
    expect(batches).toBe(2);
    expect(await problemIn(response)).toMatchObject({
      status: 409,
      type: '/problems/revision-conflict',
    });
    expect((await app.saved()).records.areas.map((a) => a.name)).toContain(
      '庭',
    );
    expect((await app.saved()).records.areas.map((a) => a.name)).not.toContain(
      '家',
    );
  });
});

describe('a key past its 24 hours', () => {
  it('is a new write, and its row is gone with the person’s other old keys', async () => {
    const app = await prepared(await setupFixtureApp('backlog-capture'));
    const key = crypto.randomUUID();
    const first = await answer(
      await send(app, key, 'createArea', { name: '家' }),
    );
    const other = crypto.randomUUID();
    await send(app, other, 'createArea', { name: '庭' });
    // Within the 24 hours, the same answer.
    app.at(later(KEY_LIFETIME_MS - 1));
    expect(
      await answer(await send(app, key, 'createArea', { name: '家' })),
    ).toEqual(first);
    app.at(later(KEY_LIFETIME_MS));
    const before = await app.saved();
    const second = await answer(
      await send(app, key, 'createArea', { name: '家' }),
    );
    expect(second.status).toBe(201);
    expect(second.body).not.toBe(first.body);
    const after = await app.saved();
    expect(after.records.areas).toHaveLength(before.records.areas.length + 1);
    const rows = await app.db
      .select()
      .from(idempotencyKey)
      .where(eq(idempotencyKey.key, key));
    expect(rows).toEqual([
      expect.objectContaining({ createdAt: later(KEY_LIFETIME_MS) }),
    ]);
    // The other key of the same time went with the same write's batch.
    expect(
      await app.db
        .select()
        .from(idempotencyKey)
        .where(eq(idempotencyKey.key, other)),
    ).toEqual([]);
  });
});

// `idempotencyKeyHeaders` is what the clients send (the contract's).
it('takes the header as the clients send it', () => {
  expect(writeHeaders('8e03978e-40d5-43e8-bc93-6894a57f9324')).toMatchObject(
    idempotencyKeyHeaders('8e03978e-40d5-43e8-bc93-6894a57f9324'),
  );
});
