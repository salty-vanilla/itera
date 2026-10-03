// The common course of the contract's routes, through the app (#266):
// authentication, the Origin of a write, the contract's validation, loading,
// running, writing with the revision, and the errors. On an in-memory
// database with the migrations applied, behind a fake Authenticator.
import {
  vCreateAreaResponse,
  vGetMeResponse,
  vGetOverviewResponse,
} from '@itera/api-contract';
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
import { testDependencies, testEnv, testNow, testOrigin } from '../test-env';
import { httpRequest } from './operation-cases';
import { maxBodyBytes, unimplementedOperations } from './operations';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const alice = ids.newId('User', testNow);

/** Alice's settings and nothing else: the first save (#279 makes it). */
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
  headers: Record<string, string> = { Origin: testOrigin },
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

async function errorOf(response: Response) {
  return { status: response.status, ...((await response.json()) as object) };
}

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
      code: 'unauthenticated',
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
      code: 'forbiddenOrigin',
    });
    expect(await loadRecords(db, alice)).toEqual({
      revision: 1,
      records: settled,
      caughtUpTo: today,
    });
  });

  it.each([
    ['PUT', 'completeTask'],
    ['PATCH', 'renameArea'],
    ['DELETE', 'undoAddTaskToWeek'],
  ] as const)(
    'answers 403 to a %s (%s) from another origin, writing nothing',
    async (method, name) => {
      const { app, db } = await setup();
      const [input] = OPERATION_EXAMPLES[name];
      const { url, init } = httpRequest(name, input);
      expect(init.method).toBe(method);
      const response = await app.request(
        url,
        {
          ...init,
          headers: { ...init.headers, Origin: 'https://evil.example' },
        },
        testEnv,
      );
      expect(await errorOf(response)).toMatchObject({
        status: 403,
        code: 'forbiddenOrigin',
      });
      expect((await loadRecords(db, alice)).revision).toBe(1);
    },
  );

  it.each([
    ['a wrong type', { name: 1 }],
    ['a missing property', {}],
    ['an unknown property', { name: '仕事', color: 3 }],
    ['a body that is not JSON', '{"name":'],
  ])('answers 400 to %s, writing nothing', async (_, body) => {
    const { app, db } = await setup();
    const response = await post(app, body);
    expect(await errorOf(response)).toMatchObject({
      status: 400,
      code: 'validationFailed',
    });
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it('answers 413 to a body larger than the limit', async () => {
    const { app } = await setup();
    const name = 'あ'.repeat(maxBodyBytes / 3 + 1);
    const response = await post(app, { name });
    expect(await errorOf(response)).toMatchObject({
      status: 413,
      code: 'payloadTooLarge',
    });
  });

  it('answers 422 with the domain’s code when the domain refuses it', async () => {
    const { app, db } = await setup();
    const response = await post(app, { name: '' });
    expect(await errorOf(response)).toMatchObject({
      status: 422,
      code: 'invalidInput',
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
      code: 'revisionConflict',
    });
    expect(await loadRecords(db, alice)).toEqual({
      revision: 2,
      records: { ...settled, user: { ...settled.user, displayName: 'A' } },
      caughtUpTo: today,
    });
    expect(await db.select().from(activity)).toEqual([]);
  });

  it('answers 422 userNotSetUp before the settings are made', async () => {
    const { app } = await setup({ settings: false });
    const response = await post(app, { name: '仕事' });
    expect(await errorOf(response)).toMatchObject({
      status: 422,
      code: 'userNotSetUp',
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
      code: 'internalError',
      message: 'An unexpected failure.',
    });
    expect(log).toHaveBeenCalledOnce();
    const logged = String(log.mock.calls[0]?.[0]);
    expect(logged).not.toContain('秘密');
    expect(logged).toContain('SQLITE_FULL');
    expect(logged).toContain('/api/areas');
  });

  it('is not answered when the API does not implement it yet', async () => {
    const { app } = await setup();
    // Every operation the API answers is registered, so these are the ones
    // that are not.
    for (const name of unimplementedOperations) {
      for (const input of OPERATION_EXAMPLES[name]) {
        const { url, init } = httpRequest(name, input);
        expect((await app.request(url, init, testEnv)).status, name).toBe(404);
      }
    }
  });
});

describe('a read', () => {
  it('answers { clock, view } with the injected clock in the person’s time zone', async () => {
    const { app } = await setup();
    const response = await get(app, '/overview');
    expect(response.status).toBe(200);
    const body = v.parse(vGetOverviewResponse, await response.json());
    expect(body.clock).toEqual({ today: '2026-10-03', now: testNow });
    expect(body.view).toMatchObject({
      backlogCount: 0,
      timeZone: 'Asia/Tokyo',
    });
  });

  it('needs no Origin', async () => {
    const { app } = await setup();
    const response = await app.request(
      '/api/overview',
      { headers: { Origin: 'https://evil.example' } },
      testEnv,
    );
    expect(response.status).toBe(200);
  });

  it('answers 401 without a session', async () => {
    const { app } = await setup({ signedIn: null });
    expect(await errorOf(await get(app, '/overview'))).toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
  });

  it('answers 422 userNotSetUp before the settings are made', async () => {
    const { app } = await setup({ settings: false });
    expect(await errorOf(await get(app, '/overview'))).toMatchObject({
      status: 422,
      code: 'userNotSetUp',
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
