// The person's settings (#279): `PUT /api/me/settings` makes them (201) and
// writes the display name again (204), and until they are made every other operation and read is refused with 422
// `userNotSetUp` while `GET /api/me` answers. Through the app, on an
// in-memory database with the migrations applied, behind a fake
// Authenticator.
import { vGetMeResponse, vSetSettingsResponse } from '@itera/api-contract';
import { OPERATION_EXAMPLES } from '@itera/api-contract/testing';
import { createIdSource, type OperationName } from '@itera/application';
import { instant, type Instant } from '@itera/domain';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import type { Database } from '../db/database';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { loadUserSettings } from '../db/user-settings';
import { activity, user as authUser } from '../db/schema';
import { testDependencies, testEnv, testNow, testOrigin } from '../test-env';
import { httpRequest, missing } from './operation-cases';
import { maxBodyBytes } from './body';

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));
const alice = ids.newId('User', testNow);

const settings = {
  displayName: 'Alice',
  timeZone: 'Asia/Tokyo',
  weekStartsOn: 1,
} as const;

let close: (() => void) | undefined;
afterEach(() => close?.());

/** A new person: signed up, with no settings and no records. */
async function setup({ signedIn = true } = {}) {
  let now: Instant = testNow;
  const memory = await createMemoryDatabase();
  close = memory.close;
  const { db } = memory;
  await db
    .insert(authUser)
    .values({ id: alice, name: 'Alice', email: 'alice@example.com' });
  const authenticator: Authenticator = {
    authenticate: async () => (signedIn ? { userId: alice } : null),
    handle: async () => new Response(null, { status: 404 }),
  };
  const app = createApp(
    testDependencies({
      database: () => db,
      authenticator: () => authenticator,
      now: () => now,
    }),
  );
  return {
    app,
    db,
    /** Moves the app's clock. */
    at: (time: Instant) => {
      now = time;
    },
  };
}

type App = Awaited<ReturnType<typeof setup>>['app'];

function put(
  app: App,
  body: unknown,
  headers: Record<string, string> = { Origin: testOrigin },
) {
  return app.request(
    '/api/me/settings',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    testEnv,
  );
}

const get = (app: App, path: string) => app.request(`/api${path}`, {}, testEnv);

async function errorOf(response: Response) {
  return { status: response.status, ...((await response.json()) as object) };
}

describe('before the settings are made', () => {
  it('answers /me with null settings, and no clock', async () => {
    const { app } = await setup();
    const response = await get(app, '/me');
    expect(response.status).toBe(200);
    expect(v.parse(vGetMeResponse, await response.json())).toEqual({
      userId: alice,
      settings: null,
    });
  });

  it.each(Object.keys(OPERATION_EXAMPLES) as OperationName[])(
    'refuses the operation %s with 422 userNotSetUp',
    async (name) => {
      const { app, db } = await setup();
      const [input] = OPERATION_EXAMPLES[name] as readonly unknown[];
      const { url, init } = httpRequest(name, input);
      const response = await app.request(url, init, testEnv);
      expect(await errorOf(response)).toMatchObject({
        status: 422,
        code: 'userNotSetUp',
      });
      expect(await loadRecords(db, alice)).toMatchObject({ revision: 0 });
    },
  );

  const sprintId = missing('Sprint');
  it.each([
    '/areas',
    '/backlog',
    '/sprints',
    `/sprints/${sprintId}`,
    `/sprints/${sprintId}/candidates`,
    `/sprints/${sprintId}/retro`,
    '/days/2026-10-03',
  ])('refuses the read %s with 422 userNotSetUp', async (path) => {
    const { app } = await setup();
    expect(await errorOf(await get(app, path))).toMatchObject({
      status: 422,
      code: 'userNotSetUp',
    });
  });
});

describe('PUT /api/me/settings', () => {
  it('makes the settings: one write, no Activity, today in her zone', async () => {
    const { app, db } = await setup();
    const response = await put(app, settings);
    expect(response.status).toBe(201);
    expect(v.parse(vSetSettingsResponse, await response.json())).toEqual(
      settings,
    );

    expect(await loadUserSettings(db, alice)).toEqual(settings);
    const loaded = await loadRecords(db, alice);
    expect(loaded.revision).toBe(1);
    expect(loaded.caughtUpTo).toBe('2026-10-03');
    expect(await db.select().from(activity)).toEqual([]);

    const me = v.parse(vGetMeResponse, await (await get(app, '/me')).json());
    expect(me).toMatchObject({
      userId: alice,
      settings,
      clock: { today: '2026-10-03', now: testNow },
    });
  });

  it('decides today by the time zone it was given', async () => {
    // 2026-10-03 00:30Z is still the 2nd in Los Angeles.
    const { app } = await setup();
    const response = await put(app, {
      ...settings,
      timeZone: 'America/Los_Angeles',
    });
    expect(response.status).toBe(201);
    const me = v.parse(vGetMeResponse, await (await get(app, '/me')).json());
    expect(me.clock?.today).toBe('2026-10-02');
  });

  it('lets the other operations through once made', async () => {
    const { app } = await setup();
    await put(app, settings);
    const { url, init } = httpRequest('createArea', { name: '仕事' });
    expect((await app.request(url, init, testEnv)).status).toBe(201);
  });

  it('takes the same settings again and writes nothing', async () => {
    const { app, db } = await setup();
    await put(app, settings);
    const response = await put(app, settings);
    expect(response.status).toBe(204);
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });

  it('stores the time zone as Intl spells it', async () => {
    const { app, db } = await setup();
    await put(app, { ...settings, timeZone: 'asia/tokyo' });
    expect(await loadUserSettings(db, alice)).toEqual(settings);
    // The same zone in another spelling is the same settings again.
    expect(
      (await put(app, { ...settings, timeZone: 'ASIA/TOKYO' })).status,
    ).toBe(204);
  });

  it('trims the name, and answers with the settings as made', async () => {
    const { app, db } = await setup();
    const response = await put(app, { ...settings, displayName: '  Alice ' });
    expect(await response.json()).toEqual(settings);
    expect(await loadUserSettings(db, alice)).toEqual(settings);
  });

  it('writes the display name again: 204, one more write', async () => {
    const { app, db } = await setup();
    await put(app, settings);
    const response = await put(app, { ...settings, displayName: 'Alice A.' });
    expect(response.status).toBe(204);
    expect(await loadUserSettings(db, alice)).toEqual({
      ...settings,
      displayName: 'Alice A.',
    });
    expect((await loadRecords(db, alice)).revision).toBe(2);
  });

  it('does not move the day the records were brought up to when it writes the name again', async () => {
    // Nothing is caught up by this write, so the days since the last
    // catch-up must still be run by the next read or operation.
    const { app, db, at } = await setup();
    await put(app, settings);
    expect((await loadRecords(db, alice)).caughtUpTo).toBe('2026-10-03');
    at(instant('2026-10-07T01:00:00.000Z'));
    await put(app, { ...settings, displayName: 'Alice A.' });
    expect((await loadRecords(db, alice)).caughtUpTo).toBe('2026-10-03');
  });

  it('refuses without a session: 401', async () => {
    const { app } = await setup({ signedIn: false });
    expect(await errorOf(await put(app, settings))).toMatchObject({
      status: 401,
      code: 'unauthenticated',
    });
  });

  it.each([
    ['time zone', { ...settings, timeZone: 'UTC' }],
    ['first day of the week', { ...settings, weekStartsOn: 0 }],
  ])(
    'refuses another %s once they are made: 422 invalidInput',
    async (_, other) => {
      const { app, db } = await setup();
      await put(app, settings);
      expect(await errorOf(await put(app, other))).toMatchObject({
        status: 422,
        code: 'invalidInput',
      });
      expect(await loadUserSettings(db, alice)).toEqual(settings);
      expect((await loadRecords(db, alice)).revision).toBe(1);
    },
  );

  it.each([
    ['an empty name', { ...settings, displayName: ' ' }, 'invalidInput'],
    [
      'a time zone that does not exist',
      { ...settings, timeZone: 'Mars/Olympus' },
      'invalidInput',
    ],
  ])('refuses %s: 422 %s', async (_, body, code) => {
    const { app, db } = await setup();
    expect(await errorOf(await put(app, body))).toMatchObject({
      status: 422,
      code,
    });
    expect(await loadUserSettings(db, alice)).toBeNull();
    expect((await loadRecords(db, alice)).revision).toBe(0);
  });

  it.each([
    ['no body', ''],
    ['a body that is not JSON', 'nope'],
    ['a missing property', { displayName: 'Alice', timeZone: 'Asia/Tokyo' }],
    ['a first day that is not a day', { ...settings, weekStartsOn: 7 }],
    ['a property the contract does not have', { ...settings, extra: 1 }],
    ['a name that is not text', { ...settings, displayName: 1 }],
  ])('refuses %s: 400 validationFailed', async (_, body) => {
    const { app, db } = await setup();
    expect(await errorOf(await put(app, body))).toMatchObject({
      status: 400,
      code: 'validationFailed',
    });
    expect(await loadUserSettings(db, alice)).toBeNull();
  });

  it('refuses a write from another origin: 403', async () => {
    const { app } = await setup();
    const response = await put(app, settings, {
      Origin: 'https://evil.example',
    });
    expect(await errorOf(response)).toMatchObject({
      status: 403,
      code: 'forbiddenOrigin',
    });
  });

  it('refuses a body over the limit: 413', async () => {
    const { app } = await setup();
    const response = await put(app, {
      ...settings,
      displayName: 'a'.repeat(maxBodyBytes),
    });
    expect(await errorOf(response)).toMatchObject({
      status: 413,
      code: 'payloadTooLarge',
    });
  });

  it('answers 409 when another write came first, and the first write stands', async () => {
    const { db } = await setup();
    // Another save makes the first row of this person between the load and
    // the write: the second first-save fails on the revision.
    const racing = new Proxy(db, {
      get(target, key, receiver) {
        if (key !== 'batch') return Reflect.get(target, key, receiver);
        return async (statements: Parameters<Database['batch']>[0]) => {
          await target.batch(statements);
          return target.batch(statements);
        };
      },
    });
    const conflicting = createApp(
      testDependencies({
        database: () => racing,
        authenticator: () => ({
          authenticate: async () => ({ userId: alice }),
          handle: async () => new Response(null, { status: 404 }),
        }),
      }),
    );
    expect(await errorOf(await put(conflicting, settings))).toMatchObject({
      status: 409,
      code: 'revisionConflict',
    });
    expect((await loadRecords(db, alice)).revision).toBe(1);
  });
});
