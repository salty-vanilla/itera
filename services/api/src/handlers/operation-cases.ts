// A test double of the whole app on one of the fixture's states, and the
// runner of a table of operations (#267; #268–#270 use it for theirs): each
// operation succeeds with a response the contract's schema accepts, a
// changed record and the person's Activity, and is refused with the
// domain's error for an input the domain refuses, writing nothing. On an
// in-memory database with the migrations applied, behind a fake
// Authenticator. For tests only.
import * as contract from '@itera/api-contract';
import {
  createIdSource,
  type Clock,
  type OperationName,
  type Records,
} from '@itera/application';
import {
  fixtureSnapshot,
  type FixtureStateId,
} from '@itera/application/fixtures';
import { localDate } from '@itera/domain';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import { testDependencies, testEnv, testNow, testOrigin } from '../test-env';

const newIds = createIdSource((bytes) => crypto.getRandomValues(bytes));

/** An ID of the right kind that no record has. */
export const missing = (kind: string) => newIds.newId(kind, testNow);

/** The clock the app reads with: the fixed `testNow`, in the fixture's zone. */
export const fixtureClock: Clock = {
  now: testNow,
  today: localDate('2026-10-03'),
};

const open: (() => void)[] = [];

/** Closes the databases `setupFixtureApp` opened. Call it in `afterEach`. */
export function closeFixtureApps() {
  for (const close of open.splice(0)) close();
}

/**
 * The app on a database holding the fixture's state, signed in as its user.
 * `edit` changes the records first, for a state the fixture does not have.
 */
export async function setupFixtureApp(
  state: FixtureStateId,
  edit: (records: Records) => Records = (records) => records,
) {
  const { activities, ...fixture } = fixtureSnapshot(state).records;
  const records = edit(fixture);
  const memory = await createMemoryDatabase();
  open.push(memory.close);
  const { db } = memory;
  const userId = records.user.id;
  await db
    .insert(authUser)
    .values({ id: userId, name: 'わたし', email: 'me@example.com' });
  await saveRecords(db, {
    userId,
    loaded: { revision: 0, records: null },
    changes: records,
    activities,
  });
  const authenticator: Authenticator = {
    authenticate: async () => ({ userId }),
    handle: async () => new Response(null, { status: 404 }),
  };
  const app = createApp(
    testDependencies({
      database: () => db,
      authenticator: () => authenticator,
    }),
  );
  return {
    db,
    post: (name: OperationName, body: unknown) =>
      app.request(
        `/api/operations/${name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: testOrigin },
          body: JSON.stringify(body),
        },
        testEnv,
      ),
    get: (path: string) => app.request(`/api${path}`, {}, testEnv),
    /** The user's records as saved, with their revision. */
    async saved() {
      const loaded = await loadRecords(db, userId);
      return { revision: loaded.revision, records: loaded.records! };
    },
  };
}

export type FixtureApp = Awaited<ReturnType<typeof setupFixtureApp>>;

/** An operation run to bring the records to where a case starts. */
export type Step = readonly [OperationName, (records: Records) => unknown];

/** An operation of a table: its input, from the records it runs on. */
type Case = {
  readonly name: OperationName;
  /** The fixture state it runs on. */
  readonly state?: FixtureStateId;
  readonly prepare?: readonly Step[];
  readonly body: (records: Records) => unknown;
};

export type Success = Case & {
  /** What the operation changed, beyond the contract's response schema. */
  readonly check: (
    after: Records,
    before: Records,
    response: unknown,
  ) => void | Promise<void>;
};

export type Failure = Case & {
  readonly status: number;
  readonly code: string;
};

/** The contract's response schema of an operation, by its name. */
function responseSchema(name: OperationName): v.GenericSchema {
  const key = `v${name[0]!.toUpperCase()}${name.slice(1)}Response`;
  return (contract as Record<string, unknown>)[key] as v.GenericSchema;
}

async function prepared(app: FixtureApp, steps: readonly Step[] = []) {
  for (const [name, body] of steps) {
    const response = await app.post(name, body((await app.saved()).records));
    expect(response.status, `${name} (prepare)`).toBeLessThan(300);
  }
  return app.saved();
}

/**
 * Runs the tables. A success answers what the contract says (204 for a
 * response without a value, 200 and the schema's parse otherwise), raises
 * the revision once and writes the person's Activity in the same batch. A
 * failure answers the status and code and leaves the records as they were.
 */
export function describeOperations(
  title: string,
  {
    state = 'backlog-capture',
    successes,
    failures,
  }: {
    readonly state?: FixtureStateId;
    readonly successes: readonly Success[];
    readonly failures: readonly Failure[];
  },
) {
  describe(title, () => {
    describe.each(successes)('$name', (c) => {
      it('changes the records and answers what the contract says', async () => {
        const app = await setupFixtureApp(c.state ?? state);
        const before = await prepared(app, c.prepare);
        const response = await app.post(c.name, c.body(before.records));

        const schema = responseSchema(c.name);
        let body: unknown;
        if (v.is(schema, undefined)) {
          expect(response.status).toBe(204);
          expect(await response.text()).toBe('');
        } else {
          expect(response.status).toBe(200);
          body = v.parse(schema, await response.json());
        }

        const after = await app.saved();
        expect(after.revision).toBe(before.revision + 1);
        expect(after.records).not.toEqual(before.records);
        await c.check(after.records, before.records, body);
        // The person's entry is in the revision's batch; an operation may
        // also leave the system's (undoPastDay closes the day, invariant 24).
        const entries = await app.db.select().from(activity);
        expect(
          entries.filter((e) => e.revision === after.revision),
        ).toContainEqual(
          expect.objectContaining({ actor: 'user', at: testNow }),
        );
      });
    });

    describe.each(failures)('$name refused: $code', (c) => {
      it('answers the domain’s error and writes nothing', async () => {
        const app = await setupFixtureApp(c.state ?? state);
        const before = await prepared(app, c.prepare);
        const response = await app.post(c.name, c.body(before.records));

        expect(response.status).toBe(c.status);
        expect(await response.json()).toMatchObject({ code: c.code });
        expect(await app.saved()).toEqual(before);
      });
    });
  });
}
