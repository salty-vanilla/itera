// The version a write that replaces values was made from (ADR 0006
// 記録ごとの版, #321): reads give each record its etag, such a write sends
// it back in If-Match, and a record that has changed since is not written
// over (412). Other writes, to other records or to the same record's state,
// and the system's catch-up leave the etag as it was. Through the app, on
// an in-memory database holding a fixture's state, with the app's clock.
import * as contract from '@itera/api-contract';
import {
  createIdSource,
  currentCondition,
  tagRecords,
  type OperationName,
  type Records,
} from '@itera/application';
import { fixtureIds } from '@itera/application/fixtures';
import { instant } from '@itera/domain';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { activity } from '../db/schema';
import { writeHeaders } from '../test-env';
import { problemIn } from '../test-problems';
import {
  closeFixtureApps,
  httpRequest,
  setupFixtureApp,
  type FixtureApp,
} from './operation-cases';

afterEach(closeFixtureApps);

const ids = fixtureIds();
const { paper, cleaning } = ids.task;
const { work } = ids.area;

const activeOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;

/** Sends an operation with exactly these condition headers (none, or some). */
function send(
  app: FixtureApp,
  name: OperationName,
  input: unknown,
  headers: Record<string, string> = {},
  key?: string,
) {
  const { url, init } = httpRequest(name, input);
  return app.request(url, {
    ...init,
    headers: {
      ...init.headers,
      ...(key === undefined ? {} : writeHeaders(key)),
      ...headers,
    },
  });
}

/** The Task's etag as the Backlog read gives it. */
async function etagOfTask(app: FixtureApp, taskId: string) {
  const response = await app.get('/backlog');
  expect(response.status).toBe(200);
  const { view } = v.parse(contract.vGetBacklogResponse, await response.json());
  const etag = view.items[taskId]?.task.etag;
  expect(etag).toMatch(/^"\d+"$/);
  return etag!;
}

/** The records as saved, the Activity with them. */
async function state(app: FixtureApp) {
  return {
    ...(await app.saved()),
    activities: await app.db.select().from(activity),
  };
}

/** A Task ID no one has. */
const missingTask = createIdSource((bytes) =>
  crypto.getRandomValues(bytes),
).newId('Task', instant('2026-10-03T00:00:00.000Z'));

const rename = (title: string) => ({ taskId: paper, update: { title } });

describe('a write that replaces values (#321)', () => {
  it('goes through with the etag read, and the record then has another', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    const response = await send(app, 'saveTask', rename('論文を書く'), {
      'If-Match': read,
    });
    expect(response.status).toBe(204);
    const after = await etagOfTask(app, paper);
    expect(after).not.toBe(read);
    const { records } = await app.saved();
    expect(records.tasks.find((t) => t.id === paper)?.title).toBe('論文を書く');
  });

  it('answers the record’s new etag, which the next write sends without reading again', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    // Two fields of one form: the title is saved, then the description,
    // made from the same read.
    const title = await send(app, 'saveTask', rename('題名'), {
      'If-Match': read,
    });
    const etag = title.headers.get('ETag');
    expect(etag).toBe(await etagOfTask(app, paper));
    const description = await send(
      app,
      'saveTask',
      { taskId: paper, update: { description: '説明' } },
      { 'If-Match': etag! },
    );
    expect(description.status).toBe(204);
    expect(description.headers.get('ETag')).toBe(await etagOfTask(app, paper));
  });

  it('answers the same ETag to a write sent again', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    const key = crypto.randomUUID();
    const first = await send(
      app,
      'saveTask',
      rename('再送'),
      { 'If-Match': read },
      key,
    );
    const again = await send(
      app,
      'saveTask',
      rename('再送'),
      { 'If-Match': read },
      key,
    );
    expect(again.headers.get('ETag')).toBe(first.headers.get('ETag'));
    expect(first.headers.get('ETag')).toMatch(/^"\d+"$/);
  });

  it('answers no ETag to a write that does not replace values', async () => {
    const app = await setupFixtureApp('backlog-capture');
    const response = await send(app, 'completeTask', { taskId: paper });
    expect(response.headers.get('ETag')).toBeNull();
  });

  it('answers 412 to an older etag and writes nothing', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    // Another device saves the Task first.
    expect(
      (await send(app, 'saveTask', rename('別の端末'), { 'If-Match': read }))
        .status,
    ).toBe(204);
    const before = await state(app);
    const response = await send(app, 'saveTask', rename('古い表示から'), {
      'If-Match': read,
    });
    expect(await problemIn(response)).toMatchObject({
      status: 412,
      type: '/problems/precondition-failed',
    });
    expect(await state(app)).toEqual(before);
  });

  it('answers 428 without If-Match and writes nothing', async () => {
    const app = await setupFixtureApp('today-daytime');
    await app.get('/me');
    const before = await state(app);
    const response = await send(app, 'saveTask', rename('条件なし'));
    expect(await problemIn(response)).toMatchObject({
      status: 428,
      type: '/problems/precondition-required',
    });
    expect(await state(app)).toEqual(before);
  });

  it.each([
    ['a weak etag', (etag: string) => `W/${etag}`, 412],
    ['any version', () => '*', 204],
    ['one of a list', (etag: string) => `"0", ${etag}`, 204],
  ])('compares %s strongly', async (_, header, status) => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    const response = await send(app, 'saveTask', rename('一覧'), {
      'If-Match': header(read),
    });
    expect(response.status).toBe(status);
  });

  it('answers 400 at the header to an If-Match that is not entity-tags', async () => {
    const app = await setupFixtureApp('today-daytime');
    const response = await send(app, 'saveTask', rename('書式'), {
      'If-Match': '42',
    });
    expect(await problemIn(response)).toMatchObject({
      status: 400,
      errors: [expect.objectContaining({ header: 'If-Match' })],
    });
  });

  it('keeps the etag through writes to other records and the next day’s catch-up', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    const cleaningRead = await etagOfTask(app, cleaning);
    const { records } = await app.saved();
    const sprint = activeOf(records);
    const cleaningTask = sprint.tasks.find((t) => t.taskId === cleaning)!;
    const selection = sprint.dailySelections.find(
      (s) => s.sprintTaskId === cleaningTask.id && s.resolution === 'selected',
    )!;
    // Another record: today's choice of 掃除, completed.
    expect(
      (
        await send(app, 'completeSelection', {
          sprintId: sprint.id,
          selectionId: selection.id,
        })
      ).status,
    ).toBe(204);
    expect(await etagOfTask(app, paper)).toBe(read);
    // Nor the Task of the choice itself (a recurring Task: its row is not
    // written when its choice for today is completed).
    expect(await etagOfTask(app, cleaning)).toBe(cleaningRead);
    // The next morning: the system starts the day (#271).
    app.at(instant('2026-10-04T00:30:00.000Z'));
    expect((await app.get('/me')).status).toBe(200);
    expect((await state(app)).revision).toBeGreaterThan(2);
    expect(await etagOfTask(app, paper)).toBe(read);
    const response = await send(app, 'saveTask', rename('翌日に'), {
      'If-Match': read,
    });
    expect(response.status).toBe(204);
  });

  it('answers a write sent again with its first answer, not 412, once it was saved', async () => {
    const app = await setupFixtureApp('today-daytime');
    const read = await etagOfTask(app, paper);
    const key = crypto.randomUUID();
    const first = await send(
      app,
      'saveTask',
      rename('一度だけ'),
      { 'If-Match': read },
      key,
    );
    expect(first.status).toBe(204);
    const saved = await state(app);
    const again = await send(
      app,
      'saveTask',
      rename('一度だけ'),
      { 'If-Match': read },
      key,
    );
    expect(again.status).toBe(204);
    expect(await state(app)).toEqual(saved);
  });

  it('answers 404 for a record that is not there, before 412', async () => {
    const app = await setupFixtureApp('today-daytime');
    const response = await send(
      app,
      'saveTask',
      { taskId: missingTask, update: { title: 'x' } },
      { 'If-Match': '"0"' },
    );
    expect(await problemIn(response)).toMatchObject({
      status: 404,
      type: '/problems/not-found',
    });
  });

  it('answers 412 before the domain’s 422', async () => {
    const app = await setupFixtureApp('today-daytime');
    await app.get('/me');
    const blank = { areaId: work, name: '  ' };
    const stale = await send(app, 'renameArea', blank, { 'If-Match': '"999"' });
    expect((await problemIn(stale)).status).toBe(412);
    const { records, versions } = await app.saved();
    const area = tagRecords(records, versions).areas.find((a) => a.id === work);
    const current = await send(app, 'renameArea', blank, {
      'If-Match': area!.etag,
    });
    expect(await problemIn(current)).toMatchObject({
      status: 422,
      type: '/problems/invalid-input',
    });
  });

  it('is not asked of a state transition', async () => {
    const app = await setupFixtureApp('backlog-capture');
    const response = await send(app, 'completeTask', { taskId: paper });
    expect(response.status).toBe(204);
  });
});

describe('a Goal, which a write makes when there is none (#321)', () => {
  async function setup() {
    const app = await setupFixtureApp('today-daytime');
    await app.get('/me');
    const { records } = await app.saved();
    const sprint = activeOf(records);
    const without = records.areas.find(
      (a) => !a.archived && !sprint.goals.some((g) => g.areaId === a.id),
    );
    if (without === undefined) throw new Error('Every Area has a Goal.');
    const goal = { sprintId: sprint.id, areaId: without.id, text: '目標' };
    return { app, goal };
  }

  it('is made with If-None-Match: *, and not made twice over', async () => {
    const { app, goal } = await setup();
    const none = { 'If-None-Match': '*' };
    expect((await send(app, 'setGoal', goal, none)).status).toBe(204);
    const again = await send(
      app,
      'setGoal',
      { ...goal, text: '別の端末' },
      none,
    );
    expect(await problemIn(again)).toMatchObject({
      status: 412,
      type: '/problems/precondition-failed',
    });
    const { records } = await app.saved();
    expect(
      activeOf(records).goals.find((g) => g.areaId === goal.areaId)?.text,
    ).toBe('目標');
  });

  it('answers 412 to If-Match when there is none, and 428 to neither', async () => {
    const { app, goal } = await setup();
    const matched = await send(app, 'setGoal', goal, { 'If-Match': '"0"' });
    expect((await problemIn(matched)).status).toBe(412);
    expect((await problemIn(await send(app, 'setGoal', goal))).status).toBe(
      428,
    );
  });

  it('is written over with the etag the Sprint read gives it', async () => {
    const { app, goal } = await setup();
    await send(app, 'setGoal', goal, { 'If-None-Match': '*' });
    const response = await app.get(`/sprints/${goal.sprintId}`);
    const { view } = v.parse(
      contract.vGetSprintResponse,
      await response.json(),
    );
    if (view.state === 'planning') throw new Error('Not running.');
    const etag = view.running.sprint.goals.find(
      (g) => g.areaId === goal.areaId,
    )?.etag;
    const written = await send(
      app,
      'setGoal',
      { ...goal, text: '直した目標' },
      { 'If-Match': etag! },
    );
    expect(written.status).toBe(204);
  });
});

describe('the condition the tests send', () => {
  it('is the one a client sends from the records as they are', async () => {
    const app = await setupFixtureApp('today-daytime');
    const { records, versions } = await app.saved();
    expect(
      currentCondition('saveTask', rename('x') as never, records, versions),
    ).toEqual({ ifMatch: [await etagOfTask(app, paper)] });
  });
});
