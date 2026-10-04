// The common course of the contract's routes, through the app (#266):
// authentication, the Origin of a write, the contract's validation, loading,
// running, writing with the revision, and the errors. On an in-memory
// database with the migrations applied, behind a fake Authenticator.
import {
  vCreateAreaResponse,
  vGetBacklogResponse,
  vGetMeResponse,
} from '@itera/api-contract';
import { requestOf, surfaces } from '@itera/api-contract/requests';
import { OPERATION_EXAMPLES } from '@itera/api-contract/testing';
import { createIdSource, type Records } from '@itera/application';
import { localDate, timeZone, type UserId } from '@itera/domain';
import { DrizzleQueryError } from 'drizzle-orm';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import {
  testDependencies,
  testEnv,
  testNow,
  testOrigin,
  writeHeaders,
} from '../test-env';
import { problemIn } from '../test-problems';
import { httpRequest } from './operation-cases';
import { maxBodyBytes } from './body';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const alice = ids.newId('User', testNow);

/** Alice's settings and nothing else: the first save (`PUT /api/me/settings` makes it, #279). */
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

/** 「今日」 at the tests' clock, in Alice's time zone. */
const today = localDate('2026-10-03');

let close: (() => void) | undefined;
afterEach(() => {
  close?.();
  vi.restoreAllMocks();
});

/**
 * The app on a fresh database where Alice has signed up, signed in as
 * `signedIn` (Alice by default, `null` for no session). With `settings`,
 * Alice has made her settings. `wrap` stands between the app and the
 * database.
 */
async function setup({
  settings = true,
  signedIn = alice,
  wrap = (db) => db,
}: {
  settings?: boolean;
  signedIn?: UserId | null;
  wrap?: (db: Database) => Database;
} = {}) {
  const memory = await createMemoryDatabase();
  close = memory.close;
  const { db } = memory;
  await db
    .insert(authUser)
    .values({ id: alice, name: 'Alice', email: 'alice@example.com' });
  if (settings) {
    await saveRecords(db, {
      userId: alice,
      loaded: { revision: 0, records: null },
      changes: settled,
      activities: [],
      caughtUpTo: today,
    });
  }
  const authenticator: Authenticator = {
    authenticate: async () => (signedIn === null ? null : { userId: signedIn }),
    handle: async () => new Response(null, { status: 404 }),
  };
  const app = createApp(
    testDependencies({
      database: () => wrap(db),
      authenticator: () => authenticator,
    }),
  );
  return { app, db };
}

type App = Awaited<ReturnType<typeof setup>>['app'];

/** `createArea`: `POST /api/areas` with the body (a string as it is). */
function post(
  app: App,
  body: unknown,
  headers: Record<string, string> = writeHeaders(),
) {
  return app.request(
    '/api/areas',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    testEnv,
  );
}

function get(app: App, path: string) {
  return app.request(`/api${path}`, {}, testEnv);
}

/** The problem of an error response (its `status` is the response's). */
const errorOf = problemIn;

describe('an operation', () => {
  it('loads, runs, writes and answers with what the contract says', async () => {
    const { app, db } = await setup();
    const response = await post(app, { name: '仕事' });
    expect(response.status).toBe(201);
    const body = v.parse(vCreateAreaResponse, await response.json());

    const { revision, records } = await loadRecords(db, alice);
    expect(revision).toBe(2);
    expect(records?.areas).toEqual([
      {
        id: body.areaId,
        userId: alice,
        name: '仕事',
        color: 1,
        order: 0,
        archived: false,
      },
    ]);
    // The Activity is the person's, at the injected clock's time.
    const [entry] = await db.select().from(activity);
    expect(entry).toMatchObject({
      userId: alice,
      revision: 2,
      actor: 'user',
      at: testNow,
    });
  });

  it('answers 401 without a session, before the Origin check', async () => {
    const { app } = await setup({ signedIn: null });
    const response = await post(app, { name: '仕事' }, {});
    expect(await errorOf(response)).toMatchObject({
      status: 401,
      type: '/problems/unauthenticated',
    });
  });

  it.each([
    ['without an Origin', {}],
    ['from another origin', { Origin: 'https://evil.example' }],
    ['from another port', { Origin: 'http://localhost:5841' }],
  ])('answers 403 to a write %s, writing nothing', async (_, headers) => {
    const { app, db } = await setup();
    const response = await post(app, { name: '仕事' }, headers);
    expect(await errorOf(response)).toMatchObject({
      status: 403,
      type: '/problems/forbidden-origin',
    });
    expect(await loadRecords(db, alice)).toEqual({
      revision: 1,
      records: settled,
      caughtUpTo: today,
    });
  });

  it('answers 403 to every write surface from another origin, before its checks', async () => {
    const { app, db } = await setup();
    const methods = new Set<string>();
    const reached = new Set<string>();
    const examples = Object.entries(OPERATION_EXAMPLES).flatMap(
      ([name, inputs]) => inputs.map((input) => [name, input] as const),
    );
    for (const [name, input] of examples) {
      reached.add(requestOf(name as never, input as never).operationId);
      const { url, init } = httpRequest(name as never, input);
      methods.add(init.method);
      const response = await app.request(
        url,
        {
          ...init,
          headers: { ...init.headers, Origin: 'https://evil.example' },
        },
        testEnv,
      );
      expect(await errorOf(response), name).toMatchObject({
        status: 403,
        type: '/problems/forbidden-origin',
      });
    }
    expect([...methods].toSorted()).toEqual(['DELETE', 'PATCH', 'POST', 'PUT']);
    // Every write surface of the contract was sent.
    expect([...reached].toSorted()).toEqual(Object.keys(surfaces).toSorted());
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it.each([
    [
      'PATCH',
      `/areas/${ids.newId('Area', testNow)}`,
      { name: 'x', archived: true },
    ],
    [
      'PATCH',
      `/sprints/${ids.newId('Sprint', testNow)}/retro`,
      { reflection: 'a', improvement: 'b' },
    ],
    [
      'POST',
      `/sprints/${ids.newId('Sprint', testNow)}/daily-selections`,
      {
        date: '2026-10-03',
        sprintTaskId: ids.newId('SprintTask', testNow),
        taskId: ids.newId('Task', testNow),
      },
    ],
    ['POST', '/tasks', { title: 'x', addTo: 'week' }],
    [
      'DELETE',
      `/sprints/${ids.newId('Sprint', testNow)}/sprint-tasks?ids=${ids.newId('Task', testNow)}`,
      undefined,
    ],
    [
      'DELETE',
      `/sprints/${ids.newId('Sprint', testNow)}/sprint-tasks`,
      undefined,
    ],
  ] as const)(
    'answers 400 to %s %s that names no one operation, writing nothing',
    async (method, path, body) => {
      const { app, db } = await setup();
      const response = await app.request(
        `/api${path}`,
        {
          method,
          headers: { 'Content-Type': 'application/json', ...writeHeaders() },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        testEnv,
      );
      expect(await errorOf(response)).toMatchObject({
        status: 400,
        type: '/problems/validation-failed',
      });
      expect((await loadRecords(db, alice)).revision).toBe(1);
    },
  );

  it.each([
    ['a wrong type', { name: 1 }, '#/name'],
    ['a missing property', {}, '#/name'],
    ['an unknown property', { name: '仕事', color: 3 }, '#/color'],
    ['a body that is not JSON', '{"name":', '#'],
    // A key a URI cannot carry as it is (a lone surrogate).
    [
      'an unknown key no URI can carry',
      '{"name":"x","\\ud800":1}',
      '#/%EF%BF%BD',
    ],
  ])('answers 400 to %s, at %s, writing nothing', async (_, body, pointer) => {
    const { app, db } = await setup();
    const response = await post(app, body);
    expect(await errorOf(response)).toMatchObject({
      status: 400,
      type: '/problems/validation-failed',
      errors: [{ detail: expect.any(String), pointer }],
    });
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it('answers 400 with where in the body the type is wrong', async () => {
    const { app } = await setup();
    const response = await app.request(
      '/api/tasks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...writeHeaders() },
        body: JSON.stringify({ title: 1 }),
      },
      testEnv,
    );
    expect(await errorOf(response)).toMatchObject({
      status: 400,
      errors: [{ pointer: '#/title' }],
    });
  });

  it.each([
    ['a path parameter', '/days/2026-02-30', 'date'],
    ['a query parameter', '/backlog?view=all', 'view'],
    [
      'an ID of another kind',
      `/sprints/${ids.newId('Task', testNow)}`,
      'sprintId',
    ],
  ])('answers 400 naming %s', async (_, path, parameter) => {
    const { app } = await setup();
    expect(await errorOf(await get(app, path))).toMatchObject({
      status: 400,
      errors: [{ detail: expect.any(String), parameter }],
    });
  });

  it.each([
    ['a path no route takes', 'GET', '/api/nothing'],
    ['a method the path does not take', 'DELETE', '/api/me'],
  ])('answers 404 to %s', async (_, method, path) => {
    const { app } = await setup();
    const response = await app.request(
      path,
      { method, headers: { Origin: testOrigin } },
      testEnv,
    );
    expect(await errorOf(response)).toMatchObject({
      status: 404,
      type: '/problems/not-found',
    });
  });

  it('answers 413 to a body larger than the limit', async () => {
    const { app } = await setup();
    const name = 'あ'.repeat(maxBodyBytes / 3 + 1);
    const response = await post(app, { name });
    expect(await errorOf(response)).toMatchObject({
      status: 413,
      type: '/problems/payload-too-large',
    });
  });

  it.each([
    [
      'PUT',
      'setRecurrence',
      { taskId: ids.newId('Task', testNow), pattern: { freq: 'daily' } },
    ],
    ['PATCH', 'renameArea', { areaId: ids.newId('Area', testNow), name: 'x' }],
    [
      'DELETE',
      'removeSprintTasks',
      {
        sprintId: ids.newId('Sprint', testNow),
        sprintTaskIds: [ids.newId('SprintTask', testNow)],
      },
    ],
  ] as const)(
    'answers 413 to a %s (%s) body larger than the limit',
    async (method, name, input) => {
      const { app, db } = await setup();
      const { url, init } = httpRequest(name, input);
      expect(init.method).toBe(method);
      const response = await app.request(
        url,
        {
          ...init,
          body: JSON.stringify({ x: 'あ'.repeat(maxBodyBytes / 3 + 1) }),
        },
        testEnv,
      );
      expect(await errorOf(response)).toMatchObject({
        status: 413,
        type: '/problems/payload-too-large',
      });
      expect((await loadRecords(db, alice)).revision).toBe(1);
    },
  );

  it('answers 422 with the domain’s problem when the domain refuses it', async () => {
    const { app, db } = await setup();
    const response = await post(app, { name: '' });
    expect(await errorOf(response)).toMatchObject({
      status: 422,
      type: '/problems/invalid-input',
    });
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it('answers 409 when another write came first, and writes nothing', async () => {
    let interfered = false;
    const { app, db } = await setup({
      // Right after the operation loads the records, another write (a new
      // display name, from another device) goes in.
      wrap: (db) =>
        new Proxy(db, {
          get(target, key, receiver) {
            if (key !== 'batch') return Reflect.get(target, key, receiver);
            return async (statements: Parameters<Database['batch']>[0]) => {
              const result = await target.batch(statements);
              if (!interfered) {
                interfered = true;
                await saveRecords(target, {
                  userId: alice,
                  loaded: { revision: 1, records: settled },
                  changes: { user: { ...settled.user, displayName: 'A' } },
                  activities: [],
                  caughtUpTo: today,
                });
              }
              return result;
            };
          },
        }),
    });
    const response = await post(app, { name: '仕事' });
    expect(await errorOf(response)).toMatchObject({
      status: 409,
      type: '/problems/revision-conflict',
    });
    expect(await loadRecords(db, alice)).toEqual({
      revision: 2,
      records: { ...settled, user: { ...settled.user, displayName: 'A' } },
      caughtUpTo: today,
    });
    expect(await db.select().from(activity)).toEqual([]);
  });

  it('answers 422 user-not-set-up before the settings are made', async () => {
    const { app } = await setup({ settings: false });
    const response = await post(app, { name: '仕事' });
    expect(await errorOf(response)).toMatchObject({
      status: 422,
      type: '/problems/user-not-set-up',
    });
  });

  it('answers 500 to an unexpected failure, logging no records', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let loads = 0;
    const { app } = await setup({
      // The load goes through; the write fails as a query with the
      // person's text in its parameters.
      wrap: (db) =>
        new Proxy(db, {
          get(target, key, receiver) {
            if (key !== 'batch') return Reflect.get(target, key, receiver);
            return async (statements: Parameters<Database['batch']>[0]) => {
              loads += 1;
              if (loads === 1) return target.batch(statements);
              throw new DrizzleQueryError(
                'insert into "area" ("name") values (?)',
                ['秘密の領域'],
                new Error('SQLITE_FULL: database or disk is full'),
              );
            };
          },
        }),
    });
    const response = await post(app, { name: '秘密の領域' });
    expect(await errorOf(response)).toEqual({
      status: 500,
      type: '/problems/internal-error',
      title: 'An unexpected failure',
      detail: 'An unexpected failure.',
    });
    expect(log).toHaveBeenCalledOnce();
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).not.toContain('秘密');
    expect(logged).toContain('SQLITE_FULL');
    expect(logged).toContain('/api/areas');
  });
});

describe('a read', () => {
  it('answers { clock, view } with the injected clock in the person’s time zone', async () => {
    const { app } = await setup();
    const response = await get(app, '/backlog');
    expect(response.status).toBe(200);
    const body = v.parse(vGetBacklogResponse, await response.json());
    expect(body.clock).toEqual({ today: '2026-10-03', now: testNow });
    expect(body.view).toMatchObject({ timeZone: 'Asia/Tokyo' });
  });

  it('needs no Origin', async () => {
    const { app } = await setup();
    const response = await app.request(
      '/api/backlog',
      { headers: { Origin: 'https://evil.example' } },
      testEnv,
    );
    expect(response.status).toBe(200);
  });

  it('answers 401 without a session', async () => {
    const { app } = await setup({ signedIn: null });
    expect(await errorOf(await get(app, '/backlog'))).toMatchObject({
      status: 401,
      type: '/problems/unauthenticated',
    });
  });

  it('answers 422 user-not-set-up before the settings are made', async () => {
    const { app } = await setup({ settings: false });
    expect(await errorOf(await get(app, '/backlog'))).toMatchObject({
      status: 422,
      type: '/problems/user-not-set-up',
    });
  });
});

describe('GET /api/me', () => {
  it('answers the user and their settings', async () => {
    const { app } = await setup();
    const response = await get(app, '/me');
    expect(response.status).toBe(200);
    expect(v.parse(vGetMeResponse, await response.json())).toEqual({
      userId: alice,
      settings: {
        displayName: 'Alice',
        timeZone: 'Asia/Tokyo',
        weekStartsOn: 1,
      },
      // With the settings, the clock and the Sprints she has now (#295 R1):
      // none yet, and the next Planning starts on this week's Monday.
      clock: { today: '2026-10-03', now: testNow },
      sprints: {
        next: {
          start: '2026-09-28',
          end: '2026-10-04',
          number: 1,
          week: 'current',
        },
      },
    });
  });

  it('answers null settings before they are made', async () => {
    const { app } = await setup({ settings: false });
    const response = await get(app, '/me');
    expect(response.status).toBe(200);
    expect(v.parse(vGetMeResponse, await response.json())).toEqual({
      userId: alice,
      settings: null,
    });
  });
});
