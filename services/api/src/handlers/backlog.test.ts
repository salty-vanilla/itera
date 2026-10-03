// The Backlog, Tasks and Areas through the app (#267): each operation
// succeeds with a response the contract's schema accepts and a changed
// record, and is refused with the domain's error for an input the domain
// refuses, writing nothing. The reads answer what the application's
// functions give on the same records and the same clock. On an in-memory
// database with the migrations applied, from the fixture's states.
import * as contract from '@itera/api-contract';
import {
  areaList,
  backlogData,
  createIdSource,
  type Clock,
  type OperationName,
  type Records,
} from '@itera/application';
import { fixtureIds, fixtureSnapshot } from '@itera/application/fixtures';
import type { FixtureStateId } from '@itera/application/fixtures';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { Authenticator } from '../auth/authenticator';
import { loadRecords } from '../db/load-records';
import { createMemoryDatabase } from '../db/memory-database';
import { saveRecords } from '../db/save-records';
import { activity, user as authUser } from '../db/schema';
import { testDependencies, testEnv, testNow, testOrigin } from '../test-env';

const ids = fixtureIds();
const newIds = createIdSource((bytes) => crypto.getRandomValues(bytes));

/** The clock of the tests: 2026-10-03 in the fixture's time zone. */
const clock: Clock = { now: testNow, today: '2026-10-03' as Clock['today'] };

let close: (() => void) | undefined;
afterEach(() => close?.());

/** The app on a database holding the fixture's state, signed in as its user. */
async function setup(state: FixtureStateId) {
  const { activities, ...records } = fixtureSnapshot(state).records;
  const memory = await createMemoryDatabase();
  close = memory.close;
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
  const post = (name: OperationName, body: unknown) =>
    app.request(
      `/api/operations/${name}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: testOrigin },
        body: JSON.stringify(body),
      },
      testEnv,
    );
  const get = (path: string) => app.request(`/api${path}`, {}, testEnv);
  const records$ = async () => {
    const loaded = await loadRecords(db, userId);
    return { revision: loaded.revision, records: loaded.records! };
  };
  return { db, post, get, records: records$ };
}

type Step = readonly [OperationName, (records: Records) => unknown];

/** An operation of the table: its input, from the records it runs on. */
type Case = {
  readonly name: OperationName;
  /** The fixture state it runs on. */
  readonly state?: FixtureStateId;
  /** Operations that bring the records to where this one starts. */
  readonly prepare?: readonly Step[];
  readonly body: (records: Records) => unknown;
};

type Success = Case & {
  /** The contract's schema for the 200 response; absent for 204. */
  readonly response?: v.GenericSchema;
  readonly check: (
    after: Records,
    before: Records,
    response: unknown,
  ) => void | Promise<void>;
};

type Failure = Case & {
  readonly status: number;
  readonly code: string;
};

const task = (records: Records, taskId: string) =>
  records.tasks.find((t) => t.id === taskId)!;
const area = (records: Records, areaId: string) =>
  records.areas.find((a) => a.id === areaId)!;
const sprintOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;
const suggestionOf = (records: Records, taskId: string) =>
  task(records, taskId).suggestions[0]!;
const subtasksOf = (records: Records, taskId: string) =>
  task(records, taskId).subtasks;

const { interview, paper, bookshelf, dentist, reading, tax } = ids.task;
const { work, life, study } = ids.area;
/** An ID of the right kind that no record has. */
const missing = (kind: string) => newIds.newId(kind, testNow);

const adopt: Step = [
  'adoptSuggestion',
  (r) => ({
    taskId: interview,
    suggestionId: suggestionOf(r, interview).id,
    bound: 'hi',
  }),
];
const reject: Step = [
  'rejectSuggestion',
  (r) => ({ taskId: interview, suggestionId: suggestionOf(r, interview).id }),
];

const successes: readonly Success[] = [
  {
    name: 'renameArea',
    body: () => ({ areaId: study, name: '学び' }),
    check: (after) => expect(area(after, study).name).toBe('学び'),
  },
  {
    name: 'archiveArea',
    body: () => ({ areaId: life }),
    check: (after) => expect(area(after, life).archived).toBe(true),
  },
  {
    name: 'restoreArea',
    prepare: [['archiveArea', () => ({ areaId: life })]],
    body: () => ({ areaId: life }),
    check: (after) => expect(area(after, life).archived).toBe(false),
  },
  {
    name: 'createTask',
    body: () => ({ title: '請求書を送る', areaId: work }),
    response: contract.vCreateTaskResponse,
    check: (after, before, response) => {
      const { taskId } = response as { taskId: string };
      expect(before.tasks.some((t) => t.id === taskId)).toBe(false);
      expect(task(after, taskId)).toMatchObject({
        title: '請求書を送る',
        areaId: work,
        lifecycle: 'active',
        createdVia: 'backlog',
      });
    },
  },
  {
    name: 'saveTask',
    body: () => ({
      taskId: bookshelf,
      update: { title: '本棚を片づける', areaId: life, priority: 'high' },
      estimate: 2,
    }),
    check: (after) =>
      expect(task(after, bookshelf)).toMatchObject({
        title: '本棚を片づける',
        areaId: life,
        priority: 'high',
        estimate: { hours: 2 },
      }),
  },
  {
    name: 'adoptSuggestion',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      bound: 'hi',
    }),
    check: (after) => {
      expect(task(after, interview).estimate).toMatchObject({ hours: 3 });
      expect(suggestionOf(after, interview).state).toBe('adopted');
    },
  },
  {
    name: 'undoAdoption',
    prepare: [adopt],
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      previous: null,
    }),
    check: (after) => {
      expect(task(after, interview).estimate).toBeUndefined();
      expect(suggestionOf(after, interview).state).toBe('presented');
    },
  },
  {
    name: 'adoptEditedSuggestion',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      hours: 2.5,
    }),
    check: (after) =>
      expect(task(after, interview).estimate).toMatchObject({ hours: 2.5 }),
  },
  {
    name: 'rejectSuggestion',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
    }),
    check: (after) =>
      expect(suggestionOf(after, interview).state).toBe('rejected'),
  },
  {
    name: 'undoRejection',
    prepare: [reject],
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
    }),
    check: (after) =>
      expect(suggestionOf(after, interview).state).toBe('presented'),
  },
  {
    name: 'addSubtask',
    body: () => ({ taskId: bookshelf, title: '上の段', hours: 0.5 }),
    response: contract.vAddSubtaskResponse,
    check: (after, _, response) => {
      const { subtaskId } = response as { subtaskId: string };
      expect(subtasksOf(after, bookshelf)).toEqual([
        { id: subtaskId, title: '上の段', estimate: 0.5, done: false },
      ]);
    },
  },
  {
    name: 'setSubtaskDone',
    body: (r) => ({
      taskId: interview,
      subtaskId: subtasksOf(r, interview)[0]!.id,
      done: true,
    }),
    check: (after) =>
      expect(subtasksOf(after, interview)[0]).toMatchObject({ done: true }),
  },
  {
    name: 'setSubtaskEstimate',
    body: (r) => ({
      taskId: interview,
      subtaskId: subtasksOf(r, interview)[1]!.id,
      hours: 0.5,
    }),
    check: (after) =>
      expect(subtasksOf(after, interview)[1]).toMatchObject({ estimate: 0.5 }),
  },
  {
    name: 'archiveTask',
    body: () => ({ taskId: bookshelf }),
    check: (after) => expect(task(after, bookshelf).lifecycle).toBe('archived'),
  },
  {
    name: 'restoreTask',
    prepare: [['archiveTask', () => ({ taskId: bookshelf })]],
    body: () => ({ taskId: bookshelf }),
    check: (after) => expect(task(after, bookshelf).lifecycle).toBe('active'),
  },
  {
    name: 'completeTask',
    body: () => ({ taskId: dentist }),
    check: (after) => {
      expect(task(after, dentist)).toMatchObject({ lifecycle: 'completed' });
    },
  },
  {
    name: 'undoCompleteTask',
    prepare: [['completeTask', () => ({ taskId: dentist })]],
    body: () => ({ taskId: dentist }),
    check: (after) => {
      expect(task(after, dentist).lifecycle).toBe('active');
      expect(task(after, dentist).completedAt).toBeUndefined();
    },
  },
  {
    name: 'addTaskToToday',
    body: () => ({ taskId: interview }),
    response: contract.vAddTaskToTodayResponse,
    check: (after, _, response) => {
      const { sprintTaskId, selectionId } = response as {
        sprintTaskId: string;
        selectionId: string;
      };
      const sprint = sprintOf(after);
      expect(sprint.tasks.find((t) => t.id === sprintTaskId)).toMatchObject({
        taskId: interview,
        origin: 'midSprint',
      });
      expect(
        sprint.dailySelections.find((s) => s.id === selectionId),
      ).toMatchObject({ sprintTaskId, date: clock.today });
    },
  },
  {
    name: 'addTaskToWeek',
    body: () => ({ taskId: dentist }),
    response: contract.vAddTaskToWeekResponse,
    check: (after, _, response) => {
      const { sprintTaskId } = response as { sprintTaskId: string };
      expect(
        sprintOf(after).tasks.find((t) => t.id === sprintTaskId),
      ).toMatchObject({ taskId: dentist });
    },
  },
  {
    name: 'undoAddTaskToWeek',
    prepare: [['addTaskToWeek', () => ({ taskId: dentist })]],
    body: () => ({ taskId: dentist }),
    check: (after, before) => {
      expect(sprintOf(after).tasks.some((t) => t.taskId === dentist)).toBe(
        false,
      );
      expect(sprintOf(after).tasks).toHaveLength(
        sprintOf(before).tasks.length - 1,
      );
    },
  },
  {
    name: 'setRecurrence',
    body: () => ({
      taskId: bookshelf,
      pattern: { freq: 'weekly', daysOfWeek: [3] },
    }),
    response: contract.vSetRecurrenceResponse,
    check: (after, before, response) => {
      // From the next Sprint not confirmed yet (F1, F15).
      expect(response).toEqual({ effectiveFrom: '2026-10-05' });
      const ruleId = task(after, bookshelf).recurrenceRuleId;
      expect(ruleId).toBeDefined();
      expect(after.rules.find((r) => r.id === ruleId)?.versions).toEqual([
        {
          version: 1,
          pattern: { freq: 'weekly', daysOfWeek: [3] },
          effectiveFrom: '2026-10-05',
        },
      ]);
      expect(before.rules).toHaveLength(after.rules.length - 1);
    },
  },
  {
    name: 'endRecurrence',
    body: () => ({ taskId: reading }),
    response: contract.vEndRecurrenceResponse,
    check: (after, _, response) => {
      expect(response).toEqual({ removed: false });
      expect(task(after, reading).recurrenceRuleId).toBeUndefined();
    },
  },
];

const failures: readonly Failure[] = [
  {
    name: 'renameArea',
    body: () => ({ areaId: study, name: '' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'renameArea',
    body: () => ({ areaId: missing('Area'), name: '学び' }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'archiveArea',
    prepare: [['archiveArea', () => ({ areaId: life })]],
    body: () => ({ areaId: life }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'restoreArea',
    body: () => ({ areaId: life }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'createTask',
    body: () => ({ title: '  ' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'saveTask',
    body: () => ({ taskId: bookshelf, update: { title: '' } }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'adoptSuggestion',
    prepare: [adopt],
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      bound: 'lo',
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoAdoption',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      previous: null,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'adoptEditedSuggestion',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
      hours: 0,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'rejectSuggestion',
    body: () => ({
      taskId: interview,
      suggestionId: missing('EstimateSuggestion'),
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'undoRejection',
    body: (r) => ({
      taskId: interview,
      suggestionId: suggestionOf(r, interview).id,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'addSubtask',
    body: () => ({ taskId: bookshelf, title: '' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'setSubtaskDone',
    body: () => ({
      taskId: interview,
      subtaskId: missing('Subtask'),
      done: true,
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setSubtaskEstimate',
    body: (r) => ({
      taskId: interview,
      subtaskId: subtasksOf(r, interview)[0]!.id,
      hours: -1,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'archiveTask',
    prepare: [['archiveTask', () => ({ taskId: bookshelf })]],
    body: () => ({ taskId: bookshelf }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'restoreTask',
    body: () => ({ taskId: bookshelf }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'completeTask',
    body: () => ({ taskId: reading }),
    status: 422,
    code: 'recurringTaskCannotComplete',
  },
  {
    name: 'undoCompleteTask',
    body: () => ({ taskId: dentist }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    // The week's Sprint is not active yet: it is still in Planning.
    name: 'addTaskToToday',
    state: 'planning-pick',
    body: () => ({ taskId: bookshelf }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'addTaskToToday',
    body: () => ({ taskId: paper }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'addTaskToToday',
    body: () => ({ taskId: tax }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'addTaskToWeek',
    state: 'planning-pick',
    body: () => ({ taskId: bookshelf }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoAddTaskToWeek',
    body: () => ({ taskId: dentist }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setRecurrence',
    body: () => ({
      taskId: bookshelf,
      pattern: { freq: 'weekly', daysOfWeek: [] },
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'endRecurrence',
    body: () => ({ taskId: bookshelf }),
    status: 422,
    code: 'invalidInput',
  },
];

/** Runs the steps through the API and returns the records they leave. */
async function prepared(
  app: Awaited<ReturnType<typeof setup>>,
  steps: readonly Step[] = [],
) {
  for (const [name, body] of steps) {
    const response = await app.post(name, body((await app.records()).records));
    expect(response.status, `${name} (prepare)`).toBeLessThan(300);
  }
  return app.records();
}

describe('the Backlog, Task and Area operations', () => {
  it('are each tested for a success and a refusal', () => {
    const answered = [
      'renameArea',
      'archiveArea',
      'restoreArea',
      'createTask',
      'saveTask',
      'adoptSuggestion',
      'undoAdoption',
      'adoptEditedSuggestion',
      'rejectSuggestion',
      'undoRejection',
      'addSubtask',
      'setSubtaskDone',
      'setSubtaskEstimate',
      'archiveTask',
      'restoreTask',
      'completeTask',
      'undoCompleteTask',
      'addTaskToToday',
      'addTaskToWeek',
      'undoAddTaskToWeek',
      'setRecurrence',
      'endRecurrence',
    ].toSorted();
    expect(successes.map((c) => c.name).toSorted()).toEqual(answered);
    expect([...new Set(failures.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
  });

  describe.each(successes)('$name', (c) => {
    it('changes the records and answers what the contract says', async () => {
      const app = await setup(c.state ?? 'backlog-capture');
      const before = await prepared(app, c.prepare);
      const response = await app.post(c.name, c.body(before.records));

      const schema = (contract as Record<string, unknown>)[
        `v${c.name[0]!.toUpperCase()}${c.name.slice(1)}Response`
      ] as v.GenericSchema;
      if (c.response === undefined) {
        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
        expect(v.is(schema, undefined)).toBe(true);
      } else {
        expect(response.status).toBe(200);
        expect(c.response).toBe(schema);
      }
      const body: unknown =
        c.response === undefined
          ? undefined
          : v.parse(c.response, await response.json());

      const after = await app.records();
      expect(after.revision).toBe(before.revision + 1);
      expect(after.records).not.toEqual(before.records);
      await c.check(after.records, before.records, body);
      // The person's Activity is written in the same batch.
      const entries = await app.db.select().from(activity);
      expect(entries.at(-1)).toMatchObject({
        revision: after.revision,
        actor: 'user',
        at: testNow,
      });
    });
  });

  describe.each(failures)('$name refused: $code', (c) => {
    it('answers the domain’s error and writes nothing', async () => {
      const app = await setup(c.state ?? 'backlog-capture');
      const before = await prepared(app, c.prepare);
      const response = await app.post(c.name, c.body(before.records));

      expect(response.status).toBe(c.status);
      expect(await response.json()).toMatchObject({ code: c.code });
      expect(await app.records()).toEqual(before);
    });
  });

  it('answers 400 to an ID of another kind, writing nothing', async () => {
    const app = await setup('backlog-capture');
    const before = await app.records();
    const response = await app.post('archiveTask', { taskId: life });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validationFailed' });
    expect(await app.records()).toEqual(before);
  });
});

describe('the invariants, through the API', () => {
  const weekly = (...daysOfWeek: number[]) => ({ freq: 'weekly', daysOfWeek });
  const ruleOf = (records: Records, taskId: string) =>
    records.rules.find((r) => r.taskId === taskId);

  it('F9: a Task joins the Sprint with an Area new to it, and the Sprint notes the name', async () => {
    const app = await setup('backlog-capture');
    const made = (await (
      await app.post('createArea', { name: '趣味' })
    ).json()) as {
      areaId: string;
    };
    await app.post('saveTask', {
      taskId: bookshelf,
      update: { areaId: made.areaId },
    });
    // Not in the Sprint yet: nothing to note.
    expect(sprintOf((await app.records()).records).areaSnapshot).toHaveLength(
      4,
    );

    expect(
      (await app.post('addTaskToWeek', { taskId: bookshelf })).status,
    ).toBe(200);
    expect(sprintOf((await app.records()).records).areaSnapshot.at(-1)).toEqual(
      { areaId: made.areaId, name: '趣味', order: 5 },
    );
  });

  it('F9: moving a Task of the Sprint to a new Area notes the name too', async () => {
    const app = await setup('backlog-capture');
    const made = (await (
      await app.post('createArea', { name: '趣味' })
    ).json()) as {
      areaId: string;
    };
    await app.post('saveTask', {
      taskId: paper,
      update: { areaId: made.areaId },
    });
    expect(sprintOf((await app.records()).records).areaSnapshot.at(-1)).toEqual(
      { areaId: made.areaId, name: '趣味', order: 5 },
    );
  });

  it('F1, F39: a rule changes from the next Sprint, and changing it back drops the version', async () => {
    const app = await setup('backlog-capture');
    const { cleaning } = ids.task;
    const first = (await app.records()).records;
    const occurrences = first.occurrences;

    const changed = await app.post('setRecurrence', {
      taskId: cleaning,
      pattern: weekly(0),
    });
    expect(await changed.json()).toEqual({ effectiveFrom: '2026-10-05' });
    let rule = ruleOf((await app.records()).records, cleaning)!;
    expect(rule.versions.map((v) => v.pattern)).toEqual([weekly(6), weekly(0)]);
    // The Sprint under way keeps its occurrences (F1).
    expect((await app.records()).records.occurrences).toEqual(occurrences);

    const back = await app.post('setRecurrence', {
      taskId: cleaning,
      pattern: weekly(6),
    });
    expect(await back.json()).toEqual({ effectiveFrom: '2026-10-05' });
    rule = ruleOf((await app.records()).records, cleaning)!;
    expect(rule.versions.map((v) => v.pattern)).toEqual([weekly(6)]);
  });

  it('F41: ending a rule with no occurrence made deletes it; with some, ends it', async () => {
    const app = await setup('backlog-capture');
    await app.post('setRecurrence', {
      taskId: bookshelf,
      pattern: weekly(3),
    });
    expect(ruleOf((await app.records()).records, bookshelf)).toBeDefined();

    const removed = await app.post('endRecurrence', { taskId: bookshelf });
    expect(await removed.json()).toEqual({ removed: true });
    const after = (await app.records()).records;
    expect(ruleOf(after, bookshelf)).toBeUndefined();
    expect(task(after, bookshelf).recurrenceRuleId).toBeUndefined();

    // The rule of a Task that has occurrences stays, with its last day.
    const ended = await app.post('endRecurrence', { taskId: reading });
    expect(await ended.json()).toEqual({ removed: false });
    const { records } = await app.records();
    expect(ruleOf(records, reading)?.versions.at(-1)).toMatchObject({
      effectiveTo: '2026-10-04',
    });
    // Once ended, it cannot be ended again.
    expect((await app.post('endRecurrence', { taskId: reading })).status).toBe(
      422,
    );
  });
});

describe('the Backlog reads', () => {
  // The same records and the same clock as the application's functions.
  async function read(path: string) {
    const app = await setup('backlog-capture');
    const { records } = await app.records();
    const response = await app.get(path);
    return { response, records, json: await response.json() };
  }

  /** What JSON makes of a value: `undefined` fields are gone. */
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

  it('listAreas answers areaList, archived ones too', async () => {
    const app = await setup('backlog-capture');
    await app.post('archiveArea', { areaId: life });
    const { records } = await app.records();
    const response = await app.get('/areas');
    expect(response.status).toBe(200);
    const body = v.parse(contract.vListAreasResponse, await response.json());
    expect(body).toEqual({ clock, view: asJson(areaList(records)) });
    expect(body.view.find((a) => a.id === life)?.archived).toBe(true);
  });

  it.each([
    ['all', '/backlog', {}],
    ['a slice', '/backlog?view=overdue', { view: 'overdue' }],
    ['an Area', `/backlog?area=${work}`, { area: work }],
    [
      'a slice of an Area',
      `/backlog?view=noArea&area=${work}`,
      { view: 'noArea', area: work },
    ],
  ])('getBacklog (%s) answers backlogData', async (_, path, filter) => {
    const { response, records, json } = await read(path);
    expect(response.status).toBe(200);
    const body = v.parse(contract.vGetBacklogResponse, json);
    expect(body).toEqual({
      clock,
      view: asJson(backlogData(records, clock, filter as never)),
    });
  });

  it('getBacklog shows what an operation just changed', async () => {
    const app = await setup('backlog-capture');
    await app.post('archiveTask', { taskId: bookshelf });
    const body = v.parse(
      contract.vGetBacklogResponse,
      await (await app.get('/backlog')).json(),
    );
    expect(body.view.shown).not.toContain(bookshelf);
  });

  it.each([
    ['a slice that does not exist', '/backlog?view=urgent'],
    ['an ID of another kind', `/backlog?area=${bookshelf}`],
  ])('getBacklog answers 400 to %s', async (_, path) => {
    const { response, json } = await read(path);
    expect(response.status).toBe(400);
    expect(json).toMatchObject({ code: 'validationFailed' });
  });
});
