// A new person's first week (#279), through the app with a clock that
// moves: no records at all, then the settings, an Area and a Task, Sprint 1
// planned and confirmed, the Task chosen for today and completed, and, when
// the week is over, the Retro completed. Each step is the contract's request; the
// records are read back only where an operation needs an ID the answer
// does not carry.
import { createIdSource, type OperationName } from '@itera/application';
import { instant, type Instant } from '@itera/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { user as authUser } from '../db/schema';
import { testDependencies, testEnv, testOrigin } from '../test-env';
import { httpRequest } from './operation-cases';

/** A JSON answer, read where the test needs a value of it. */
type Json = Record<string, unknown>;

const closers: (() => void)[] = [];
afterEach(() => {
  for (const close of closers.splice(0)) close();
});

/** A time in Tokyo: `'10-05 10:00'` is 10:00 on 2026-10-05 JST. */
function jst(time: string): Instant {
  const [day, clock] = time.split(' ');
  return instant(new Date(`2026-${day}T${clock}:00+09:00`).toISOString());
}

const ids = createIdSource((bytes) => crypto.getRandomValues(bytes));

async function setup() {
  let now = jst('10-05 10:00');
  const memory = await createMemoryDatabase();
  closers.push(memory.close);
  const { db } = memory;
  const alice = ids.newId('User', now);
  await db
    .insert(authUser)
    .values({ id: alice, name: 'Alice', email: 'alice@example.com' });
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
  const get = async <T = Json>(path: string) => {
    const response = await app.request(`/api${path}`, {}, testEnv);
    expect(response.status, path).toBe(200);
    return (await response.json()) as T;
  };
  const send = async <T = Json>(
    name: OperationName,
    input: unknown,
    status: number,
  ) => {
    const { url, init } = httpRequest(name, input);
    const response = await app.request(url, init, testEnv);
    expect(response.status, name).toBe(status);
    return status === 204 ? undefined : ((await response.json()) as T);
  };
  return {
    db,
    alice,
    get,
    send,
    app,
    at: (time: string) => {
      now = jst(time);
    },
  };
}

describe('a new person’s first week', () => {
  it('goes from no settings to a completed Retro', async () => {
    const { app, db, alice, get, send, at } = await setup();

    // Signed in with nothing: the answer is that there are no settings.
    expect(await get('/me')).toEqual({ userId: alice, settings: null });

    const settings = {
      displayName: 'Alice',
      timeZone: 'Asia/Tokyo',
      weekStartsOn: 1,
    };
    const made = await app.request(
      '/api/me/settings',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Origin: testOrigin },
        body: JSON.stringify(settings),
      },
      testEnv,
    );
    expect(made.status).toBe(201);

    // Monday 10/5: Sprint 1 is the one to plan, for this week.
    const me = await get('/me');
    expect(me.settings).toEqual(settings);
    expect(me.sprints).toEqual({
      next: {
        start: '2026-10-05',
        end: '2026-10-11',
        number: 1,
        week: 'current',
      },
    });

    const { areaId } = (await send<{ areaId: string }>(
      'createArea',
      { name: '仕事' },
      201,
    ))!;
    const { taskId } = (await send<{ taskId: string }>(
      'createTask',
      { title: '資料を作る', areaId },
      201,
    ))!;
    await send('saveTask', { taskId, update: {}, estimate: 2 }, 204);

    const { sprintId } = (await send<{ sprintId: string }>(
      'beginPlanning',
      undefined,
      201,
    ))!;
    await send('setAvailableHours', { sprintId, hours: 20 }, 204);
    await send('addSprintTasks', { sprintId, taskIds: [taskId] }, 201);
    await send('confirmSprint', { sprintId, applyCriterion: false }, 204);

    const confirmed = (await loadRecords(db, alice)).records!.sprints[0]!;
    expect(confirmed.state).toBe('active');
    const sprintTaskId = confirmed.tasks[0]!.id;

    // Today, Monday: choose, start and complete.
    const { selectionId } = (await send<{ selectionId: string }>(
      'chooseForToday',
      { sprintId, date: '2026-10-05', sprintTaskId },
      201,
    ))!;
    await send('completeSelection', { sprintId, selectionId }, 204);

    // The week ends: Sprint 1 is in Review, the Retro is begun and completed.
    at('10-12 09:00');
    const after = await get<{ sprints: { review?: { id: string } } }>('/me');
    expect(after.sprints.review?.id).toBe(sprintId);
    // The week's end made the Retro, as it does for any Sprint.
    expect((await get(`/sprints/${sprintId}/retro`)).view).not.toBeNull();
    await send('setReflection', { sprintId, text: 'はじめての 1 週' }, 204);
    await send('completeRetro', { sprintId }, 204);
    const done = (await loadRecords(db, alice)).records!.sprints[0]!;
    expect(done.state).toBe('closed');
  });
});
