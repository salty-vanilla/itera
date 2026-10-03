// The Backlog, Tasks and Areas through the app (#267): each operation
// succeeds and is refused as the domain says (operation-cases.ts), the
// invariants hold through the API, and the reads answer what the
// application's functions give on the same records and the same clock.
import * as contract from '@itera/api-contract';
import {
  areaList,
  backlogData,
  type BacklogFilter,
  type Records,
} from '@itera/application';
import { fixtureIds } from '@itera/application/fixtures';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeFixtureApps,
  describeOperations,
  fixtureClock as clock,
  missing,
  setupFixtureApp as setup,
  type Failure,
  type Step,
  type Success,
} from './operation-cases';

const ids = fixtureIds();

afterEach(closeFixtureApps);

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

describe('the Backlog, Task and Area routes', () => {
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

  it('answers 400 to an ID of another kind, writing nothing', async () => {
    const app = await setup('backlog-capture');
    const before = await app.saved();
    const response = await app.post('archiveTask', { taskId: life });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validationFailed' });
    expect(await app.saved()).toEqual(before);
  });
});

describeOperations('the Backlog, Task and Area operations answer', {
  successes,
  failures,
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
    expect(sprintOf((await app.saved()).records).areaSnapshot).toHaveLength(4);

    expect(
      (await app.post('addTaskToWeek', { taskId: bookshelf })).status,
    ).toBe(200);
    expect(sprintOf((await app.saved()).records).areaSnapshot.at(-1)).toEqual({
      areaId: made.areaId,
      name: '趣味',
      order: 5,
    });
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
    expect(sprintOf((await app.saved()).records).areaSnapshot.at(-1)).toEqual({
      areaId: made.areaId,
      name: '趣味',
      order: 5,
    });
  });

  it('F1, F39: a rule changes from the next Sprint, and changing it back drops the version', async () => {
    const app = await setup('backlog-capture');
    const { cleaning } = ids.task;
    const first = (await app.saved()).records;
    const occurrences = first.occurrences;

    const changed = await app.post('setRecurrence', {
      taskId: cleaning,
      pattern: weekly(0),
    });
    expect(await changed.json()).toEqual({ effectiveFrom: '2026-10-05' });
    let rule = ruleOf((await app.saved()).records, cleaning)!;
    expect(rule.versions.map((v) => v.pattern)).toEqual([weekly(6), weekly(0)]);
    // The Sprint under way keeps its occurrences (F1).
    expect((await app.saved()).records.occurrences).toEqual(occurrences);

    const back = await app.post('setRecurrence', {
      taskId: cleaning,
      pattern: weekly(6),
    });
    expect(await back.json()).toEqual({ effectiveFrom: '2026-10-05' });
    rule = ruleOf((await app.saved()).records, cleaning)!;
    expect(rule.versions.map((v) => v.pattern)).toEqual([weekly(6)]);
  });

  it('F41: ending a rule with no occurrence made deletes it; with some, ends it', async () => {
    const app = await setup('backlog-capture');
    await app.post('setRecurrence', {
      taskId: bookshelf,
      pattern: weekly(3),
    });
    expect(ruleOf((await app.saved()).records, bookshelf)).toBeDefined();

    const removed = await app.post('endRecurrence', { taskId: bookshelf });
    expect(await removed.json()).toEqual({ removed: true });
    const after = (await app.saved()).records;
    expect(ruleOf(after, bookshelf)).toBeUndefined();
    expect(task(after, bookshelf).recurrenceRuleId).toBeUndefined();

    // The rule of a Task that has occurrences stays, with its last day.
    const ended = await app.post('endRecurrence', { taskId: reading });
    expect(await ended.json()).toEqual({ removed: false });
    const { records } = await app.saved();
    expect(ruleOf(records, reading)?.versions.at(-1)).toMatchObject({
      effectiveTo: '2026-10-04',
    });
    // Once ended, it cannot be ended again.
    expect((await app.post('endRecurrence', { taskId: reading })).status).toBe(
      422,
    );
  });
  describe('while the next Sprint is in Planning', () => {
    const occurrencesOf = (records: Records, taskId: string) =>
      records.occurrences
        .filter((o) => o.taskId === taskId)
        .map((o) => `${o.scheduledDate} ${o.state}`);
    const draftOf = (records: Records) =>
      records.sprints.find((s) => s.state === 'planning')!;

    it('F15: a rule made now makes the draft’s occurrences and puts them in the Sprint', async () => {
      const app = await setup('planning-pick');
      const before = (await app.saved()).records;
      const response = await app.post('setRecurrence', {
        taskId: bookshelf,
        pattern: weekly(3),
      });
      expect(await response.json()).toEqual({ effectiveFrom: '2026-09-28' });
      const after = (await app.saved()).records;
      expect(occurrencesOf(after, bookshelf)).toEqual(['2026-09-30 pending']);
      expect(draftOf(after).tasks).toHaveLength(
        draftOf(before).tasks.length + 1,
      );
      expect(
        draftOf(after).tasks.find((t) => t.taskId === bookshelf)?.occurrenceIds,
      ).toHaveLength(1);
    });

    it('F7: changing a rule remakes the draft’s occurrences and keeps the done ones', async () => {
      const app = await setup('planning-pick');
      const { cleaning } = ids.task;
      const before = (await app.saved()).records;
      expect(occurrencesOf(before, cleaning)).toEqual([
        '2026-09-26 done',
        '2026-10-03 pending',
      ]);
      await app.post('setRecurrence', { taskId: cleaning, pattern: weekly(0) });
      expect(occurrencesOf((await app.saved()).records, cleaning)).toEqual([
        '2026-09-26 done',
        '2026-10-04 pending',
      ]);
    });

    it('F41: ending a rule drops the draft’s occurrences and its SprintTask', async () => {
      const app = await setup('planning-pick');
      const before = (await app.saved()).records;
      expect(occurrencesOf(before, reading)).toHaveLength(3);
      const response = await app.post('endRecurrence', { taskId: reading });
      expect(await response.json()).toEqual({ removed: true });
      const after = (await app.saved()).records;
      expect(occurrencesOf(after, reading)).toEqual([]);
      expect(ruleOf(after, reading)).toBeUndefined();
      expect(draftOf(after).tasks).toHaveLength(
        draftOf(before).tasks.length - 1,
      );
    });
  });
});

describe('the Backlog reads', () => {
  // The same records and the same clock as the application's functions.
  async function read(path: string) {
    const app = await setup('backlog-capture');
    const { records } = await app.saved();
    const response = await app.get(path);
    return { response, records, json: await response.json() };
  }

  /** What JSON makes of a value: `undefined` fields are gone. */
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

  it('listAreas answers areaList, archived ones too', async () => {
    const app = await setup('backlog-capture');
    await app.post('archiveArea', { areaId: life });
    const { records } = await app.saved();
    const response = await app.get('/areas');
    expect(response.status).toBe(200);
    const body = v.parse(contract.vListAreasResponse, await response.json());
    expect(body).toEqual({ clock, view: asJson(areaList(records)) });
    expect(body.view.find((a) => a.id === life)?.archived).toBe(true);
  });

  const filters: readonly (readonly [string, string, BacklogFilter])[] = [
    ['all', '/backlog', {}],
    ['a slice', '/backlog?view=overdue', { view: 'overdue' }],
    ['an Area', `/backlog?area=${work}`, { area: work }],
    [
      'a slice of an Area',
      `/backlog?view=noArea&area=${work}`,
      { view: 'noArea', area: work },
    ],
  ];
  it.each(filters)(
    'getBacklog (%s) answers backlogData',
    async (_, path, filter) => {
      const { response, records, json } = await read(path);
      expect(response.status).toBe(200);
      const body = v.parse(contract.vGetBacklogResponse, json);
      expect(body).toEqual({
        clock,
        view: asJson(backlogData(records, clock, filter)),
      });
    },
  );

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
