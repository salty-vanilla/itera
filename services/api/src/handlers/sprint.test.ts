// The Sprint, in Planning and running, through the app (#268): each
// operation succeeds and is refused as the domain says (operation-cases.ts),
// the invariants hold through the API, and the reads answer what the
// application's functions give on the same records and the same clock.
import * as contract from '@itera/api-contract';
import {
  planningData,
  runningData,
  sprintChoice,
  type Records,
} from '@itera/application';
import { fixtureIds } from '@itera/application/fixtures';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { activity } from '../db/schema';
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
const draftOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'planning')!;
const activeOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;
const sprintTaskOf = (records: Records, taskId: string) =>
  draftOf(records).tasks.find((t) => t.taskId === taskId)!;
const activeSprintTaskOf = (records: Records, taskId: string) =>
  activeOf(records).tasks.find((t) => t.taskId === taskId)!;
const occurrencesOf = (records: Records, taskId: string) =>
  records.occurrences.filter((o) => o.taskId === taskId);
const selectionOf = (records: Records, taskId: string, date: string) => {
  const sprint = activeOf(records);
  const sprintTaskId = activeSprintTaskOf(records, taskId).id;
  return sprint.dailySelections.find(
    (s) => s.sprintTaskId === sprintTaskId && s.date === date,
  )!;
};

const { paper, tax, dataset, reading, bookshelf } = ids.task;
const { work, research, study, life } = ids.area;

const choose = (...taskIds: string[]): Step => [
  'chooseTasks',
  () => ({ taskIds }),
];

const planningSuccesses: readonly Success[] = [
  {
    name: 'chooseTasks',
    body: () => ({ taskIds: [tax, dataset] }),
    check: (after, before, response) => {
      const { sprintTaskIds } = response as { sprintTaskIds: string[] };
      expect(sprintTaskIds).toHaveLength(2);
      for (const [i, taskId] of [tax, dataset].entries()) {
        expect(sprintTaskOf(before, taskId)).toBeUndefined();
        expect(sprintTaskOf(after, taskId)).toMatchObject({
          id: sprintTaskIds[i],
          outcome: 'draft',
        });
      }
    },
  },
  {
    name: 'unchooseTasks',
    body: (r) => ({ sprintTaskIds: [sprintTaskOf(r, paper).id] }),
    check: (after) => expect(sprintTaskOf(after, paper)).toBeUndefined(),
  },
  {
    name: 'unchooseTasksByTask',
    prepare: [choose(tax)],
    body: () => ({ taskIds: [tax] }),
    check: (after) => expect(sprintTaskOf(after, tax)).toBeUndefined(),
  },
  {
    name: 'setOccurrenceIncluded',
    body: (r) => ({
      occurrenceId: occurrencesOf(r, reading)[0]!.id,
      included: false,
    }),
    check: (after, before) => {
      expect(occurrencesOf(after, reading).map((o) => o.state)).toEqual([
        'excluded',
        ...occurrencesOf(before, reading)
          .slice(1)
          .map((o) => o.state),
      ]);
    },
  },
  {
    name: 'includeOccurrences',
    prepare: [
      [
        'setOccurrenceIncluded',
        (r) => ({
          occurrenceId: occurrencesOf(r, reading)[0]!.id,
          included: false,
        }),
      ],
      [
        'setOccurrenceIncluded',
        (r) => ({
          occurrenceId: occurrencesOf(r, reading)[1]!.id,
          included: false,
        }),
      ],
    ],
    body: (r) => ({
      occurrenceIds: occurrencesOf(r, reading)
        .slice(0, 2)
        .map((o) => o.id),
    }),
    check: (after) =>
      expect(occurrencesOf(after, reading).map((o) => o.state)).toEqual([
        'pending',
        'pending',
        'pending',
      ]),
  },
  {
    name: 'excludeAllOccurrences',
    body: (r) => ({ sprintTaskId: sprintTaskOf(r, reading).id }),
    check: (after) => {
      expect(occurrencesOf(after, reading).map((o) => o.state)).toEqual([
        'excluded',
        'excluded',
        'excluded',
      ]);
      expect(sprintTaskOf(after, reading)).toBeUndefined();
    },
  },
  {
    name: 'createAndChooseTask',
    body: () => ({ title: '請求書を送る', areaId: work }),
    check: (after, before, response) => {
      const { taskId, sprintTaskId } = response as {
        taskId: string;
        sprintTaskId: string;
      };
      expect(before.tasks.some((t) => t.id === taskId)).toBe(false);
      expect(task(after, taskId)).toMatchObject({
        title: '請求書を送る',
        areaId: work,
        lifecycle: 'active',
      });
      expect(sprintTaskOf(after, taskId)).toMatchObject({
        id: sprintTaskId,
        outcome: 'draft',
      });
    },
  },
  {
    name: 'setPlanningGoal',
    body: () => ({ areaId: study, text: '型の変更点を読み終える' }),
    check: (after) =>
      expect(draftOf(after).goals).toEqual([
        { areaId: study, text: '型の変更点を読み終える' },
      ]),
  },
  {
    name: 'setGoalLink',
    state: 'planning-shape',
    body: (r) => ({
      sprintTaskId: sprintTaskOf(r, paper).id,
      goalLink: 'unlinked',
    }),
    check: (after) =>
      expect(sprintTaskOf(after, paper).goalLink).toBe('unlinked'),
  },
  {
    name: 'setPlanningAvailableHours',
    body: () => ({ hours: 18 }),
    check: (after) => expect(draftOf(after).availableHours).toBe(18),
  },
  {
    name: 'confirmSprint',
    state: 'planning-check',
    body: () => ({ applyCriterion: true }),
    check: (after, before) => {
      const sprint = after.sprints.find((s) => s.id === draftOf(before).id)!;
      expect(sprint.state).toBe('active');
      expect(sprint.tasks.every((t) => t.outcome !== 'draft')).toBe(true);
    },
  },
];

const runningSuccesses: readonly Success[] = [
  {
    name: 'setRunningGoal',
    state: 'today-morning',
    body: () => ({ areaId: research, text: '先行研究を二本読む' }),
    check: (after) =>
      expect(
        activeOf(after).goals.find((g) => g.areaId === research),
      ).toMatchObject({
        text: '先行研究を二本読む',
        plannedText: '先行研究を押さえる',
      }),
  },
  {
    name: 'setRunningAvailableHours',
    state: 'today-morning',
    body: () => ({ hours: 20 }),
    check: (after) => expect(activeOf(after).availableHours).toBe(20),
  },
  {
    name: 'undoPastDay',
    state: 'today-morning',
    body: (r) => ({ selectionId: selectionOf(r, tax, '2026-09-29').id }),
    check: (after) => {
      expect(activeSprintTaskOf(after, tax).outcome).toBe('planned');
    },
  },
];

const successes = [...planningSuccesses, ...runningSuccesses];

const failures: readonly Failure[] = [
  {
    name: 'chooseTasks',
    body: () => ({ taskIds: [tax, missing('Task')] }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'chooseTasks',
    body: () => ({ taskIds: [paper] }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'chooseTasks',
    state: 'today-morning',
    body: () => ({ taskIds: [bookshelf] }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'unchooseTasks',
    body: (r) => ({
      sprintTaskIds: [sprintTaskOf(r, paper).id, missing('SprintTask')],
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'unchooseTasksByTask',
    body: () => ({ taskIds: [tax] }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setOccurrenceIncluded',
    body: () => ({ occurrenceId: missing('Occurrence'), included: false }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setOccurrenceIncluded',
    body: (r) => ({
      occurrenceId: occurrencesOf(r, reading)[0]!.id,
      included: true,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'includeOccurrences',
    body: (r) => ({
      occurrenceIds: [occurrencesOf(r, reading)[0]!.id],
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'excludeAllOccurrences',
    body: () => ({ sprintTaskId: missing('SprintTask') }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'createAndChooseTask',
    body: () => ({ title: '   ' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'createAndChooseTask',
    state: 'today-morning',
    body: () => ({ title: '請求書を送る' }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setPlanningGoal',
    state: 'today-morning',
    body: () => ({ areaId: study, text: '型の変更点を読み終える' }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setGoalLink',
    body: () => ({ sprintTaskId: missing('SprintTask'), goalLink: 'linked' }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setPlanningAvailableHours',
    body: () => ({ hours: -1 }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'confirmSprint',
    state: 'today-morning',
    body: () => ({ applyCriterion: true }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'confirmSprint',
    state: 'planning-check',
    prepare: [['completeTask', () => ({ taskId: paper })]],
    body: () => ({ applyCriterion: true }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'setRunningGoal',
    state: 'today-morning',
    body: () => ({ areaId: research, text: '' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'setRunningGoal',
    body: () => ({ areaId: research, text: '先行研究を二本読む' }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'setRunningAvailableHours',
    state: 'today-morning',
    body: () => ({ hours: -3 }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'setRunningAvailableHours',
    body: () => ({ hours: 20 }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'undoPastDay',
    state: 'today-morning',
    // Deferred, not completed or skipped: there is nothing to take back.
    body: (r) => ({ selectionId: selectionOf(r, paper, '2026-09-28').id }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoPastDay',
    state: 'today-morning',
    body: () => ({ selectionId: missing('DailySelection') }),
    status: 404,
    code: 'notFound',
  },
];

describe('the Sprint routes', () => {
  it('are each tested for a success and a refusal', () => {
    const answered = [
      'chooseTasks',
      'unchooseTasks',
      'unchooseTasksByTask',
      'setOccurrenceIncluded',
      'includeOccurrences',
      'excludeAllOccurrences',
      'createAndChooseTask',
      'setPlanningGoal',
      'setGoalLink',
      'setPlanningAvailableHours',
      'confirmSprint',
      'setRunningGoal',
      'setRunningAvailableHours',
      'undoPastDay',
    ].toSorted();
    expect(successes.map((c) => c.name).toSorted()).toEqual(answered);
    expect([...new Set(failures.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
  });

  it('answers 400 to an ID of another kind, writing nothing', async () => {
    const app = await setup('planning-pick');
    const before = await app.saved();
    const response = await app.post('chooseTasks', { taskIds: [life] });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validationFailed' });
    expect(await app.saved()).toEqual(before);
  });
});

describeOperations('the Sprint operations answer', {
  state: 'planning-pick',
  successes,
  failures,
});

describe('the invariants, through the API', () => {
  it('invariant 33: an occurrence taken out stays as a record, and goes back in', async () => {
    const app = await setup('planning-pick');
    const first = occurrencesOf((await app.saved()).records, reading)[0]!;
    await app.run('setOccurrenceIncluded', {
      occurrenceId: first.id,
      included: false,
    });
    let records = (await app.saved()).records;
    expect(records.occurrences.find((o) => o.id === first.id)?.state).toBe(
      'excluded',
    );
    // The other two occurrences keep the Task in the week.
    expect(sprintTaskOf(records, reading).occurrenceIds).toHaveLength(2);

    await app.run('setOccurrenceIncluded', {
      occurrenceId: first.id,
      included: true,
    });
    records = (await app.saved()).records;
    expect(records.occurrences.find((o) => o.id === first.id)?.state).toBe(
      'pending',
    );
    expect(sprintTaskOf(records, reading).occurrenceIds).toHaveLength(3);
  });

  it('invariant 33: taking out the last occurrence takes the Task out of the week', async () => {
    const app = await setup('planning-pick');
    for (const occurrence of occurrencesOf(
      (await app.saved()).records,
      reading,
    )) {
      const response = await app.post('setOccurrenceIncluded', {
        occurrenceId: occurrence.id,
        included: false,
      });
      expect(response.status).toBe(204);
    }
    const { records } = await app.saved();
    expect(sprintTaskOf(records, reading)).toBeUndefined();
    // Putting one back makes the Task's SprintTask again.
    await app.run('setOccurrenceIncluded', {
      occurrenceId: occurrencesOf(records, reading)[0]!.id,
      included: true,
    });
    expect(
      sprintTaskOf((await app.saved()).records, reading).occurrenceIds,
    ).toHaveLength(1);
  });

  it('invariant 12: confirming waits for the previous Sprint’s Retro, and the draft can be edited meanwhile', async () => {
    const app = await setup('planning-check', (records) => ({
      ...records,
      sprints: records.sprints.map((s) =>
        s.state === 'closed' ? { ...s, state: 'review' as const } : s,
      ),
    }));
    const before = await app.saved();
    const refused = await app.post('confirmSprint', { applyCriterion: true });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ code: 'invalidTransition' });
    expect(await app.saved()).toEqual(before);

    // Planning goes on: the draft's hours change.
    const edited = await app.post('setPlanningAvailableHours', { hours: 12 });
    expect(edited.status).toBe(204);
    expect(draftOf((await app.saved()).records).availableHours).toBe(12);
  });

  it('invariants 16, 18: confirming fixes every planned value, and later edits leave them', async () => {
    const app = await setup('planning-check');
    const response = await app.post('confirmSprint', { applyCriterion: true });
    expect(response.status).toBe(204);
    const confirmed = activeOf((await app.saved()).records);
    expect(confirmed.tasks.length).toBeGreaterThan(0);
    for (const sprintTask of confirmed.tasks) {
      expect(sprintTask.outcome).toBe('planned');
      expect(sprintTask.planSnapshot).toBeDefined();
    }
    expect(confirmed.goals.map((g) => g.plannedText)).toEqual(
      confirmed.goals.map((g) => g.text),
    );
    expect(confirmed.areaSnapshot.map((a) => a.name)).toEqual([
      '仕事',
      '研究',
      '学習',
      '生活',
    ]);

    // After confirm: the Task's estimate, an Area's name, the Goal's text and
    // the hours change; what was written down at confirm does not.
    await app.run('saveTask', { taskId: paper, update: {}, estimate: 9 });
    await app.run('renameArea', { areaId: research, name: '調査' });
    await app.run('setRunningGoal', {
      areaId: research,
      text: '書き直した文',
    });
    await app.run('setRunningAvailableHours', { hours: 5 });
    const { records } = await app.saved();
    // The edits took effect…
    expect(task(records, paper).estimate).toMatchObject({ hours: 9 });
    expect(records.areas.find((a) => a.id === research)?.name).toBe('調査');
    const later = activeOf(records);
    // …and what was written down at confirm stayed.
    expect(later.tasks.map((t) => t.planSnapshot)).toEqual(
      confirmed.tasks.map((t) => t.planSnapshot),
    );
    expect(later.areaSnapshot).toEqual(confirmed.areaSnapshot);
    expect(later.goals.find((g) => g.areaId === research)).toMatchObject({
      text: '書き直した文',
      plannedText: '先行研究を押さえる',
    });
    expect(later.availableHours).toBe(5);
  });

  it('invariant 36: confirming with an active criterion makes its CriterionUse, applied or not', async () => {
    const applied = await setup('planning-check');
    await applied.run('confirmSprint', { applyCriterion: true });
    expect(activeOf((await applied.saved()).records).criterionUse).toEqual({
      criterionId: expect.any(String),
      appliedAtConfirm: true,
    });

    const left = await setup('planning-check');
    await left.run('confirmSprint', { applyCriterion: false });
    expect(activeOf((await left.saved()).records).criterionUse).toEqual({
      criterionId: expect.any(String),
      appliedAtConfirm: false,
    });
    // The criterion's effect is in the planned values only when applied.
    const planned = (r: Records) =>
      activeOf(r).tasks.map((t) => t.planSnapshot?.value.criterionApplied);
    expect(planned((await applied.saved()).records)).toContain(true);
    expect(planned((await left.saved()).records)).not.toContain(true);
  });

  it('F42: a criterion that acts on no chosen Task is not applied, even when asked', async () => {
    const app = await setup('planning-check');
    let { records } = await app.saved();
    // Take every Task of the Area the criterion covers out of the week.
    const sprintTaskIds = draftOf(records)
      .tasks.filter((t) => task(records, t.taskId).areaId === research)
      .map((t) => t.id);
    expect(sprintTaskIds.length).toBeGreaterThan(0);
    await app.run('unchooseTasks', { sprintTaskIds });
    ({ records } = await app.saved());
    expect(
      draftOf(records).tasks.some(
        (t) => task(records, t.taskId).areaId === research,
      ),
    ).toBe(false);
    const response = await app.post('confirmSprint', { applyCriterion: true });
    expect(response.status).toBe(204);
    expect(activeOf((await app.saved()).records).criterionUse).toMatchObject({
      appliedAtConfirm: false,
    });
  });

  it('capacity: exceeding the available hours does not stop the confirm', async () => {
    const app = await setup('planning-check');
    await app.run('setPlanningAvailableHours', { hours: 1 });
    const planning = v.parse(
      contract.vGetPlanningResponse,
      await (await app.get('/planning')).json(),
    ).view!;
    expect(planning.totals.capacity?.status).toBe('exceeds');
    const response = await app.post('confirmSprint', { applyCriterion: true });
    expect(response.status).toBe(204);
  });

  it('F16: a Goal written after confirm has no planned text, and is not removed', async () => {
    const app = await setup('today-morning');
    await app.run('setRunningGoal', { areaId: study, text: '新しい目標' });
    const goal = activeOf((await app.saved()).records).goals.find(
      (g) => g.areaId === study,
    );
    expect(goal).toEqual({ areaId: study, text: '新しい目標' });
    const removed = await app.post('setRunningGoal', {
      areaId: study,
      text: '',
    });
    expect(removed.status).toBe(422);
    expect(
      activeOf((await app.saved()).records).goals.some(
        (g) => g.areaId === study,
      ),
    ).toBe(true);
  });

  it('F33: undoing a past day’s completion makes the Task planned again, and the system closes the day', async () => {
    const app = await setup('today-morning');
    // Brought up to the day first (#271), so that the system's entry in the
    // undo's revision is the undo's own.
    await app.get('/overview');
    const before = (await app.saved()).records;
    const selection = selectionOf(before, tax, '2026-09-29');
    expect(activeSprintTaskOf(before, tax).outcome).toBe('done');
    const response = await app.post('undoPastDay', {
      selectionId: selection.id,
    });
    expect(response.status).toBe(204);
    const saved = await app.saved();
    expect(activeSprintTaskOf(saved.records, tax).outcome).toBe('planned');
    expect(task(saved.records, tax).lifecycle).toBe('active');
    // The past day is not left open: the system closes it as unresolved
    // (invariant 24), in the same change as the person's undo.
    expect(selectionOf(saved.records, tax, '2026-09-29').resolution).toBe(
      'unresolved',
    );
    const actors = (await app.db.select().from(activity))
      .filter((e) => e.revision === saved.revision)
      .map((e) => e.actor);
    expect(actors).toContain('user');
    expect(actors).toContain('system');
  });

  it('F9: a Task of a new Area chosen in Planning is in the Sprint’s Area names at confirm', async () => {
    const app = await setup('planning-check');
    const made = (await (
      await app.run('createArea', { name: '趣味' })
    ).json()) as { areaId: string };
    await app.run('createAndChooseTask', {
      title: '写真を整理する',
      areaId: made.areaId,
    });
    await app.run('confirmSprint', { applyCriterion: false });
    expect(
      activeOf((await app.saved()).records).areaSnapshot.map((a) => a.name),
    ).toEqual(['仕事', '研究', '学習', '生活', '趣味']);
  });
});

describe('the Sprint reads', () => {
  /** What JSON makes of a value: `undefined` fields are gone. */
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

  async function readOn(state: Parameters<typeof setup>[0], path: string) {
    const app = await setup(state);
    const response = await app.get(path);
    // The records as the read left them, brought up to the clock's day (#271).
    const { records } = await app.saved();
    return { response, records, json: await response.json() };
  }

  describe('getPlanning', () => {
    it.each([
      ['applying the criterion', '?apply-criterion=true', true],
      ['not applying it', '?apply-criterion=false', false],
      ['by default', '', false],
    ])('answers planningData %s', async (_, query, applyCriterion) => {
      const { response, records, json } = await readOn(
        'planning-check',
        `/planning${query}`,
      );
      expect(response.status).toBe(200);
      const body = v.parse(contract.vGetPlanningResponse, json);
      expect(body).toEqual({
        clock,
        view: asJson(planningData(records, clock, { applyCriterion })),
      });
      expect(body.view?.criterion?.applied).toBe(applyCriterion);
    });

    it('writes nothing, whatever it is asked', async () => {
      const app = await setup('planning-check');
      // The first read brings the records up to the day (#271); the asked
      // read after it writes nothing.
      await app.get('/overview');
      const before = await app.saved();
      await app.get('/planning?apply-criterion=true');
      expect(await app.saved()).toEqual(before);
    });

    it('answers null when no Sprint is being planned', async () => {
      const { response, json } = await readOn('today-morning', '/planning');
      expect(response.status).toBe(200);
      expect(json).toEqual({ clock, view: null });
    });

    it('shows what an operation just changed', async () => {
      const app = await setup('planning-pick');
      await app.run('chooseTasks', { taskIds: [tax] });
      const body = v.parse(
        contract.vGetPlanningResponse,
        await (await app.get('/planning')).json(),
      );
      expect(body.view?.chosenCount).toBe(5);
    });

    it('answers 400 to a value that is not a boolean', async () => {
      const { response, json } = await readOn(
        'planning-check',
        '/planning?apply-criterion=yes',
      );
      expect(response.status).toBe(400);
      expect(json).toMatchObject({ code: 'validationFailed' });
    });
  });

  describe('getRunning', () => {
    it('answers runningData of the running Sprint', async () => {
      const { response, records, json } = await readOn(
        'today-morning',
        '/running',
      );
      expect(response.status).toBe(200);
      const body = v.parse(contract.vGetRunningResponse, json);
      expect(body).toEqual({
        clock,
        view: asJson(runningData(records, clock)),
      });
      expect(body.view?.sprint.state).toBe('active');
    });

    it.each([
      ['a closed Sprint', 1, ids.sprint.previous],
      ['the running Sprint', 2, ids.sprint.current],
    ])(
      'answers runningData of %s by its number',
      async (_, number, sprintId) => {
        const { response, records, json } = await readOn(
          'today-morning',
          `/running?sprint=${number}`,
        );
        expect(response.status).toBe(200);
        const body = v.parse(contract.vGetRunningResponse, json);
        expect(body).toEqual({
          clock,
          view: asJson(runningData(records, clock, sprintId)),
        });
        expect(body.view?.sprint.id).toBe(sprintId);
      },
    );

    it.each([
      ['a number with no Sprint', 'today-morning', '/running?sprint=9'],
      [
        'the next week, before its Planning',
        'today-morning',
        '/running?sprint=3',
      ],
      ['a Sprint still being planned', 'planning-pick', '/running?sprint=2'],
      ['no running Sprint', 'planning-pick', '/running'],
    ] as const)('answers null for %s', async (_, state, path) => {
      const { response, json } = await readOn(state, path);
      expect(response.status).toBe(200);
      expect(json).toEqual({ clock, view: null });
    });

    it('shows what an operation just changed', async () => {
      const app = await setup('today-morning');
      await app.run('setRunningAvailableHours', { hours: 20 });
      const body = v.parse(
        contract.vGetRunningResponse,
        await (await app.get('/running')).json(),
      );
      expect(body.view?.sprint.availableHours).toBe(20);
    });

    it.each([
      ['a number below 1', '/running?sprint=0'],
      ['a fraction', '/running?sprint=1.5'],
      ['text', '/running?sprint=two'],
    ])('answers 400 to %s', async (_, path) => {
      const { response, json } = await readOn('today-morning', path);
      expect(response.status).toBe(400);
      expect(json).toMatchObject({ code: 'validationFailed' });
    });
  });

  describe('getSprintChoice', () => {
    it.each([
      ['planning-pick', 'sprint', undefined],
      ['planning-pick', 'sprint', 1],
      ['today-morning', 'sprint', undefined],
      ['today-morning', 'sprint', 3],
      ['today-morning', 'retro', undefined],
      ['retro-start', 'retro', undefined],
      ['retro-start', 'sprint', undefined],
      ['planning-pick', 'sprint', 9],
    ] as const)(
      'answers sprintChoice (%s, %s, sprint %s)',
      async (state, screen, number) => {
        const query =
          number === undefined
            ? `screen=${screen}`
            : `screen=${screen}&sprint=${number}`;
        const { response, records, json } = await readOn(
          state,
          `/sprint-choice?${query}`,
        );
        expect(response.status).toBe(200);
        const body = v.parse(contract.vGetSprintChoiceResponse, json);
        const expected =
          screen === 'sprint'
            ? sprintChoice(records, clock, 'sprint', number)
            : sprintChoice(records, clock, 'retro', number);
        expect(body).toEqual({ clock, view: asJson(expected ?? null) });
      },
    );

    it('opens the running Sprint, with the one before and after it', async () => {
      const { json } = await readOn(
        'today-morning',
        '/sprint-choice?screen=sprint',
      );
      const { view } = v.parse(contract.vGetSprintChoiceResponse, json);
      expect(view?.current.number).toBe(2);
      expect(view?.previous?.number).toBe(1);
      expect(view?.next?.number).toBe(3);
    });

    it.each([
      ['no screen', '/sprint-choice'],
      ['a screen that does not exist', '/sprint-choice?screen=today'],
      ['a number below 1', '/sprint-choice?screen=sprint&sprint=0'],
    ])('answers 400 to %s', async (_, path) => {
      const { response, json } = await readOn('today-morning', path);
      expect(response.status).toBe(400);
      expect(json).toMatchObject({ code: 'validationFailed' });
    });
  });
});
