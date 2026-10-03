// The Retro, through the app (#270, #295): each operation succeeds and is
// refused as the domain says (operation-cases.ts), on the Sprint the
// request names; the invariants of the Retro and of the criterion hold
// through the API, and the Retro read answers what the application's
// function gives on the same records and the same clock.
import * as contract from '@itera/api-contract';
import {
  sprintCandidates,
  sprintRetro,
  type Records,
} from '@itera/application';
import { fixtureIds } from '@itera/application/fixtures';
import { instant, localDate } from '@itera/domain';
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

const { research, work, life } = ids.area;

const reviewOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'review')!;
const activeOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;
const draftOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'planning')!;
const criterionOf = (records: Records, criterionId: string) =>
  records.criteria.find((c) => c.id === criterionId);
const activeCriterion = (records: Records) =>
  records.criteria.find((c) => c.state === 'active')!;
/** The Sprint in Review, as a request names it. */
const reviewing = (r: Records) => ({ sprintId: reviewOf(r).id });
const running = (r: Records) => ({ sprintId: activeOf(r).id });

/** The last day of the running Sprint, 09:30 in Tokyo. */
const lastDay = instant('2026-10-04T00:30:00.000Z');
const lastDayClock = { now: lastDay, today: localDate('2026-10-04') };

const policy = { scope: { kind: 'area', areaId: research }, rangePolicy: 'hi' };
const widerPolicy = { scope: { kind: 'all' }, rangePolicy: 'hi' };

const improve = (text = '論文は 1本ずつタスクに分ける'): Step => [
  'setImprovement',
  (r) => ({ ...reviewing(r), text }),
];
const draft: Step = ['draftCriterion', (r) => ({ ...reviewing(r), policy })];
const decide = (decision: 'continue' | 'end' | 'replace'): Step => [
  'decideCriterion',
  (r) => ({ ...reviewing(r), decision }),
];
/** A SprintTask done in the Sprint in Review, one-off (actual time goes to its day). */
const oneOffDone = (r: Records) =>
  reviewOf(r).tasks.find(
    (t) => t.outcome === 'done' && t.occurrenceIds === undefined,
  )!;
const draftIdOf = (r: Records) => reviewOf(r).retro!.improvement!.criterionId!;

const successes: readonly Success[] = [
  {
    name: 'beginRetro',
    state: 'today-morning',
    now: lastDay,
    body: running,
    check: (after, before) => {
      const sprint = after.sprints.find((s) => s.id === activeOf(before).id)!;
      expect(sprint.state).toBe('review');
      expect(sprint.retro).toMatchObject({ pins: [], reflection: '' });
      expect(sprint.retro?.completedAt).toBeUndefined();
    },
  },
  {
    name: 'assessGoal',
    body: (r) => ({ ...reviewing(r), areaId: research, assessment: 'partly' }),
    check: (after) =>
      expect(
        reviewOf(after).goals.find((g) => g.areaId === research),
      ).toMatchObject({ selfAssessment: 'partly' }),
  },
  {
    name: 'assessGoal',
    state: 'retro-reflect',
    body: (r) => ({ ...reviewing(r), areaId: research, assessment: null }),
    check: (after) =>
      expect(
        reviewOf(after).goals.find((g) => g.areaId === research),
      ).not.toHaveProperty('selfAssessment'),
  },
  ...(
    [
      [
        'sprintTask',
        (r: Records) =>
          reviewOf(r).tasks.find((t) => t.outcome === 'carriedOver')!.id,
      ],
      ['dailySelection', (r: Records) => reviewOf(r).dailySelections[0]!.id],
      [
        'occurrence',
        (r: Records) =>
          reviewOf(r)
            .tasks.flatMap((t) => t.occurrenceIds ?? [])
            .at(0)!,
      ],
      ['interrupt', (r: Records) => reviewOf(r).interrupts[0]!.id],
      ['goal', () => research],
    ] as const
  ).map(([kind, idOf]): Success => ({
    name: 'pinFact',
    body: (r) => ({ ...reviewing(r), pin: { kind, id: idOf(r) } }),
    check: (after, before) =>
      expect(reviewOf(after).retro?.pins).toEqual([{ kind, id: idOf(before) }]),
  })),
  {
    name: 'pinFact',
    body: (r) => ({ ...reviewing(r), pin: { kind: 'availableHours' } }),
    check: (after) =>
      expect(reviewOf(after).retro?.pins).toEqual([{ kind: 'availableHours' }]),
  },
  {
    name: 'unpinFact',
    state: 'retro-reflect',
    body: (r) => ({
      ...reviewing(r),
      pin: { kind: 'sprintTask', id: reviewOf(r).retro!.pins[0]!.id },
    }),
    check: (after) => expect(reviewOf(after).retro?.pins).toEqual([]),
  },
  {
    name: 'setReflection',
    body: (r) => ({ ...reviewing(r), text: '午後が崩れた日があった' }),
    check: (after) =>
      expect(reviewOf(after).retro?.reflection).toBe('午後が崩れた日があった'),
  },
  {
    name: 'setImprovement',
    body: (r) => ({ ...reviewing(r), text: '論文は 1本ずつタスクに分ける' }),
    check: (after) =>
      expect(reviewOf(after).retro?.improvement).toEqual({
        text: '論文は 1本ずつタスクに分ける',
      }),
  },
  {
    name: 'draftCriterion',
    prepare: [improve()],
    body: (r) => ({ ...reviewing(r), policy }),
    check: (after, _before, response) => {
      const { criterionId } = response as { criterionId: string };
      expect(criterionOf(after, criterionId)).toMatchObject({
        state: 'draft',
        policy,
        sourceSprintId: reviewOf(after).id,
      });
      expect(reviewOf(after).retro?.improvement?.criterionId).toBe(criterionId);
    },
  },
  {
    name: 'setDraftPolicy',
    prepare: [improve(), draft],
    body: (r) => ({ criterionId: draftIdOf(r), policy: widerPolicy }),
    check: (after, before) =>
      expect(criterionOf(after, draftIdOf(before))).toMatchObject({
        state: 'draft',
        policy: widerPolicy,
      }),
  },
  {
    name: 'dropCriterionDraft',
    prepare: [improve(), draft],
    body: (r) => ({ criterionId: draftIdOf(r) }),
    check: (after, before) => {
      expect(criterionOf(after, draftIdOf(before))).toBeUndefined();
      expect(reviewOf(after).retro?.improvement).toEqual({
        text: '論文は 1本ずつタスクに分ける',
      });
    },
  },
  {
    name: 'decideCriterion',
    body: (r) => ({ ...reviewing(r), decision: 'end' }),
    check: (after) =>
      expect(reviewOf(after).criterionUse?.retroDecision).toBe('end'),
  },
  {
    name: 'completeRetro',
    state: 'retro-before-complete',
    body: reviewing,
    check: (after, before) => {
      const sprint = after.sprints.find((s) => s.id === reviewOf(before).id)!;
      expect(sprint.state).toBe('closed');
      expect(sprint.retro?.completedAt).toBeDefined();
      // 続ける: the criterion stays as it was.
      expect(activeCriterion(after)).toEqual(activeCriterion(before));
    },
  },
  {
    name: 'completeRetro',
    prepare: [decide('end')],
    body: reviewing,
    check: (after, before) => {
      expect(after.sprints.some((s) => s.state === 'review')).toBe(false);
      expect(criterionOf(after, activeCriterion(before).id)?.state).toBe(
        'ended',
      );
    },
  },
  {
    // F22: actual time can still be added in Review.
    name: 'recordActualTime',
    body: (r) => ({
      ...reviewing(r),
      sprintTaskId: oneOffDone(r).id,
      date: reviewOf(r).end,
      hours: 1.5,
    }),
    check: (after, before) => {
      const hours = (r: Records) =>
        reviewOf(r).actualTimes.reduce((sum, a) => sum + a.hours, 0);
      expect(hours(after)).toBe(hours(before) + 1.5);
    },
  },
  {
    name: 'beginPlanning',
    state: 'today-morning',
    body: () => undefined,
    check: (after, before, response) => {
      const { sprintId } = response as { sprintId: string };
      expect(before.sprints.some((s) => s.id === sprintId)).toBe(false);
      expect(after.sprints.find((s) => s.id === sprintId)).toMatchObject({
        state: 'planning',
        previousSprintId: activeOf(before).id,
      });
    },
  },
];

const failures: readonly Failure[] = [
  // beginRetro: the last day of a running Sprint, once.
  {
    name: 'beginRetro',
    state: 'today-morning',
    body: running,
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'beginRetro',
    body: reviewing,
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'beginRetro',
    body: () => ({ sprintId: ids.sprint.previous }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'beginRetro',
    state: 'today-morning',
    body: () => ({ sprintId: missing('Sprint') }),
    status: 404,
    type: '/problems/not-found',
  },
  // The Retro's operations are on a Sprint in Review.
  {
    name: 'assessGoal',
    state: 'today-morning',
    body: (r) => ({ ...running(r), areaId: research, assessment: 'achieved' }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'assessGoal',
    body: (r) => ({ ...reviewing(r), areaId: life, assessment: 'achieved' }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    name: 'assessGoal',
    body: () => ({
      sprintId: missing('Sprint'),
      areaId: research,
      assessment: 'achieved',
    }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    name: 'pinFact',
    body: (r) => ({
      ...reviewing(r),
      pin: { kind: 'sprintTask', id: missing('SprintTask') },
    }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    // A fact of another Sprint is not one of this Retro's.
    name: 'pinFact',
    body: (r) => ({
      ...reviewing(r),
      pin: {
        kind: 'sprintTask',
        id: r.sprints.find((s) => s.id === ids.sprint.previous)!.tasks[0]!.id,
      },
    }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    name: 'pinFact',
    body: (r) => ({ ...reviewing(r), pin: { kind: 'goal', id: life } }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    name: 'pinFact',
    state: 'today-morning',
    body: (r) => ({ ...running(r), pin: { kind: 'availableHours' } }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'unpinFact',
    state: 'today-morning',
    body: (r) => ({ ...running(r), pin: { kind: 'availableHours' } }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'setReflection',
    state: 'today-morning',
    body: (r) => ({ ...running(r), text: '早すぎる' }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'setImprovement',
    state: 'today-morning',
    body: (r) => ({ ...running(r), text: '早すぎる' }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    // The text cannot be emptied while a criterion is made from it.
    name: 'setImprovement',
    prepare: [improve(), draft],
    body: (r) => ({ ...reviewing(r), text: '' }),
    status: 422,
    type: '/problems/invalid-input',
  },
  {
    name: 'draftCriterion',
    body: (r) => ({ ...reviewing(r), policy }),
    status: 422,
    type: '/problems/invalid-input',
  },
  {
    name: 'draftCriterion',
    prepare: [improve(), draft],
    body: (r) => ({ ...reviewing(r), policy: widerPolicy }),
    status: 422,
    type: '/problems/invalid-input',
  },
  {
    name: 'draftCriterion',
    state: 'today-morning',
    body: (r) => ({ ...running(r), policy }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'setDraftPolicy',
    body: () => ({ criterionId: missing('PlanningCriterion'), policy }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    // The active criterion is no draft of the Retro in progress.
    name: 'setDraftPolicy',
    body: (r) => ({ criterionId: activeCriterion(r).id, policy }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'dropCriterionDraft',
    body: () => ({ criterionId: missing('PlanningCriterion') }),
    status: 404,
    type: '/problems/not-found',
  },
  {
    name: 'dropCriterionDraft',
    body: (r) => ({ criterionId: activeCriterion(r).id }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    // Replacing needs the draft that replaces it.
    name: 'decideCriterion',
    body: (r) => ({ ...reviewing(r), decision: 'replace' }),
    status: 422,
    type: '/problems/invalid-input',
  },
  {
    name: 'decideCriterion',
    state: 'today-morning',
    body: (r) => ({ ...running(r), decision: 'end' }),
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    // Invariant 36: the criterion the Sprint had is decided on first.
    name: 'completeRetro',
    body: reviewing,
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    // Invariant 35: continuing keeps the active one, so the draft goes first.
    name: 'completeRetro',
    state: 'retro-before-complete',
    prepare: [draft],
    body: reviewing,
    status: 422,
    type: '/problems/invalid-input',
  },
  {
    name: 'completeRetro',
    state: 'today-morning',
    body: running,
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    // Closed with the Retro: no more actual time (F22).
    name: 'recordActualTime',
    body: (r) => {
      const closed = r.sprints.find((s) => s.id === ids.sprint.previous)!;
      return {
        sprintId: closed.id,
        sprintTaskId: closed.tasks[0]!.id,
        date: closed.end,
        hours: 1,
      };
    },
    status: 422,
    type: '/problems/invalid-transition',
  },
  {
    name: 'beginPlanning',
    state: 'planning-pick',
    body: () => undefined,
    status: 422,
    type: '/problems/invalid-transition',
  },
];

describeOperations('the Retro operations', {
  state: 'retro-start',
  successes,
  failures,
});

describe('the Retro operations as a whole', () => {
  const answered = [
    'beginRetro',
    'assessGoal',
    'pinFact',
    'unpinFact',
    'setReflection',
    'setImprovement',
    'draftCriterion',
    'setDraftPolicy',
    'dropCriterionDraft',
    'decideCriterion',
    'completeRetro',
    'beginPlanning',
    'recordActualTime',
  ].toSorted();

  it('are each tested for a success and a refusal', () => {
    expect([...new Set(successes.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
    expect([...new Set(failures.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
  });

  it.each([
    [
      'a Task’s ID as the Sprint',
      (r: Records) => ({ ...reviewing(r), sprintId: ids.task.paper }),
    ],
    [
      'an assessment that is not one',
      (r: Records) => ({
        ...reviewing(r),
        areaId: research,
        assessment: 'great',
      }),
    ],
  ])('answer 400 to %s', async (_, body) => {
    const app = await setup('retro-start');
    await app.get('/me');
    const before = await app.saved();
    const response = await app.post('assessGoal', body(before.records));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      type: '/problems/validation-failed',
    });
    expect(await app.saved()).toEqual(before);
  });

  describe('that change nothing when sent again', () => {
    it.each([
      [
        'pinFact',
        (r: Records) => ({
          ...reviewing(r),
          pin: { kind: 'goal', id: research },
        }),
      ],
      [
        'unpinFact',
        (r: Records) => ({
          ...reviewing(r),
          pin: { kind: 'goal', id: research },
        }),
      ],
      ['setReflection', (r: Records) => ({ ...reviewing(r), text: '同じ文' })],
      [
        'assessGoal',
        (r: Records) => ({
          ...reviewing(r),
          areaId: research,
          assessment: 'partly',
        }),
      ],
      [
        'decideCriterion',
        (r: Records) => ({ ...reviewing(r), decision: 'continue' }),
      ],
    ] as const)('%s', async (name, body) => {
      const app = await setup('retro-start');
      await app.get('/me');
      const input = body((await app.saved()).records);
      // `unpinFact` has nothing to take off; the others are done once first.
      if (name !== 'unpinFact') await app.run(name, input);
      const before = await app.saved();
      const entries = await app.db.select().from(activity);
      const response = await app.post(name, input);
      expect(response.status).toBe(204);
      expect(await app.saved()).toEqual(before);
      expect(await app.db.select().from(activity)).toEqual(entries);
    });
  });
});

describe('the Retro through the invariants', () => {
  it('F35, F36: a Task chosen for the next Sprint is linked to its carry-over when the Retro starts, and its carry-over stays', async () => {
    const app = await setup('today-morning', undefined, lastDay);
    await app.get('/me');
    const { records } = await app.saved();
    // Unfinished on the last day: it will be carried over.
    const unfinished = activeOf(records).tasks.find(
      (t) => t.outcome === 'planned' && t.occurrenceIds === undefined,
    )!;
    const taskId = unfinished.taskId;
    const carryOf = async () =>
      v.parse(
        contract.vGetBacklogResponse,
        await (await app.get('/backlog')).json(),
      ).view.items[taskId]?.carry;

    const planning = (await (
      await app.run('beginPlanning', undefined)
    ).json()) as {
      sprintId: string;
    };
    await app.run('addSprintTasks', {
      sprintId: planning.sprintId,
      taskIds: [taskId],
    });
    expect(await carryOf()).toBeUndefined();
    const draft = (r: Records) =>
      r.sprints
        .find((s) => s.id === planning.sprintId)!
        .tasks.find((t) => t.taskId === taskId)!;
    expect(draft((await app.saved()).records).carriedFrom).toBeUndefined();

    await app.run('beginRetro', { sprintId: activeOf(records).id });

    const after = await app.saved();
    // F35: the draft is linked to the SprintTask that was carried over.
    expect(draft(after.records)).toMatchObject({
      taskId,
      outcome: 'draft',
      carriedFrom: unfinished.id,
    });
    expect(
      reviewOf(after.records).tasks.find((t) => t.id === unfinished.id)
        ?.outcome,
    ).toBe('carriedOver');
    // The system records it, in the same save as the person's start.
    const entries = (await app.db.select().from(activity)).filter(
      (e) => e.revision === after.revision,
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        actor: 'system',
        kind: 'sprintTaskCarryLinked',
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ actor: 'user', kind: 'sprintReviewStarted' }),
    );
    // F36: the draft does not count as the latest SprintTask, so the
    // carry-over is still shown.
    expect(await carryOf()).toMatchObject({ count: 1 });
  });

  it('F23: the person starts the Retro, and the wrap-up of the week is the system’s', async () => {
    const app = await setup('today-morning', undefined, lastDay);
    await app.get('/me');
    const before = (await app.saved()).records;
    await app.run('beginRetro', { sprintId: activeOf(before).id });
    const { revision } = await app.saved();
    const entries = (await app.db.select().from(activity)).filter(
      (e) => e.revision === revision,
    );
    expect(entries.map((e) => [e.actor, e.kind])).toEqual([
      ['system', 'occurrenceMissed'],
      ['system', 'occurrenceMissed'],
      ['user', 'sprintReviewStarted'],
    ]);
  });

  it('invariant 36, 35: replacing ends the criterion as replaced and the draft becomes the active one', async () => {
    const app = await setup('retro-start');
    await app.get('/me');
    const before = (await app.saved()).records;
    const old = activeCriterion(before);
    await app.run('setImprovement', {
      ...reviewing(before),
      text: '論文は 1本ずつタスクに分ける',
    });
    const made = (await (
      await app.run('draftCriterion', { ...reviewing(before), policy })
    ).json()) as { criterionId: string };
    // Replacing is decided with the draft in hand.
    await app.run('decideCriterion', {
      ...reviewing(before),
      decision: 'replace',
    });
    await app.run('completeRetro', reviewing(before));

    const { records } = await app.saved();
    expect(criterionOf(records, old.id)).toMatchObject({
      state: 'replaced',
      replacedBy: made.criterionId,
    });
    expect(criterionOf(records, made.criterionId)?.state).toBe('active');
    expect(records.criteria.filter((c) => c.state === 'active')).toHaveLength(
      1,
    );
    expect(reviewOf(records)).toBeUndefined();
  });

  it('invariant 35: dropping the draft clears a decision to replace, and the Retro then needs a decision again', async () => {
    const app = await setup('retro-start');
    await app.get('/me');
    const sprint = reviewing((await app.saved()).records);
    await app.run('setImprovement', { ...sprint, text: '1本ずつ' });
    const made = (await (
      await app.run('draftCriterion', { ...sprint, policy })
    ).json()) as { criterionId: string };
    await app.run('decideCriterion', { ...sprint, decision: 'replace' });
    await app.run('dropCriterionDraft', { criterionId: made.criterionId });

    const { records } = await app.saved();
    expect(reviewOf(records).criterionUse?.retroDecision).toBeUndefined();
    const response = await app.post('completeRetro', sprint);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      type: '/problems/invalid-transition',
    });
  });

  it('a closed Sprint’s Retro is read only', async () => {
    const app = await setup('retro-before-complete');
    await app.get('/me');
    const sprint = reviewing((await app.saved()).records);
    await app.run('completeRetro', sprint);
    for (const [name, body] of [
      ['setReflection', { ...sprint, text: 'あとから' }],
      ['pinFact', { ...sprint, pin: { kind: 'availableHours' } }],
      ['assessGoal', { ...sprint, areaId: research, assessment: 'achieved' }],
      ['completeRetro', sprint],
      ['beginRetro', sprint],
    ] as const) {
      const before = await app.saved();
      const response = await app.post(name, body);
      expect(response.status, name).toBe(422);
      expect(await response.json()).toMatchObject({
        type: '/problems/invalid-transition',
      });
      expect(await app.saved()).toEqual(before);
    }
    const read = await app.get(`/sprints/${sprint.sprintId}/retro`);
    expect(read.status).toBe(200);
  });

  it('invariant 40: the facts are derived from the records, not stored in the Retro', async () => {
    const app = await setup('retro-start');
    await app.get('/me');
    const { records } = await app.saved();
    const sprint = reviewing(records);
    const hoursOf = async () =>
      v.parse(
        contract.vGetSprintRetroResponse,
        await (await app.get(`/sprints/${sprint.sprintId}/retro`)).json(),
      ).view!.facts.actualHours;
    const before = await hoursOf();
    const task = oneOffDone(records);
    await app.run('recordActualTime', {
      ...sprint,
      sprintTaskId: task.id,
      date: reviewOf(records).end,
      hours: 1.5,
    });
    expect(await hoursOf()).toBe(before + 1.5);
    // What the Retro stores is what the person wrote.
    expect(
      Object.keys(reviewOf((await app.saved()).records).retro!).toSorted(),
    ).toEqual(['pins', 'reflection', 'startedAt']);
  });

  it('invariant 12: the next Sprint is confirmed only once the Retro is complete', async () => {
    const app = await setup('retro-before-complete');
    await app.get('/me');
    const sprint = reviewing((await app.saved()).records);
    // The next week is planned while the Retro is open (#42).
    const { sprintId } = (await (
      await app.run('beginPlanning', undefined)
    ).json()) as { sprintId: string };
    const confirm = { sprintId, applyCriterion: false };

    const before = await app.saved();
    const refused = await app.post('confirmSprint', confirm);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      type: '/problems/invalid-transition',
    });
    expect(await app.saved()).toEqual(before);

    await app.run('completeRetro', sprint);
    await app.run('confirmSprint', confirm);
    const { records } = await app.saved();
    expect(records.sprints.find((s) => s.id === sprintId)?.state).toBe(
      'active',
    );
  });
});

describe('the Retro read', () => {
  /** What JSON makes of a value: `undefined` fields are gone. */
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

  async function readOn(
    state: Parameters<typeof setup>[0],
    path: (records: Records) => string,
  ) {
    const app = await setup(state);
    // Brought up to the clock's day first (#271), so that the Sprints are
    // as the read finds them.
    await app.get('/me');
    const response = await app.get(path((await app.saved()).records));
    const { records } = await app.saved();
    return { app, response, records, json: await response.json() };
  }

  it.each([
    ['a Sprint in Review', 'retro-reflect', (r: Records) => reviewOf(r).id],
    ['a closed Sprint', 'retro-start', () => ids.sprint.previous],
  ] as const)(
    'answers the Retro of %s as the application gives it on the same records',
    async (_, state, sprintId) => {
      const { response, records, json } = await readOn(
        state,
        (r) => `/sprints/${sprintId(r)}/retro`,
      );
      expect(response.status).toBe(200);
      const body = v.parse(contract.vGetSprintRetroResponse, json);
      expect(body).toEqual({
        clock,
        view: asJson(sprintRetro(records, clock, sprintId(records))),
      });
      expect(body.view?.sprint.id).toBe(sprintId(records));
    },
  );

  it.each([
    ['the running Sprint', 'today-morning', (r: Records) => activeOf(r).id],
    ['a Sprint being planned', 'planning-pick', (r: Records) => draftOf(r).id],
  ] as const)(
    'answers null for %s: its Retro has not started',
    async (_, state, sprintId) => {
      const { response, json } = await readOn(
        state,
        (r) => `/sprints/${sprintId(r)}/retro`,
      );
      expect(response.status).toBe(200);
      expect(json).toEqual({ clock, view: null });
    },
  );

  it('answers 404 for a Sprint the person does not have', async () => {
    const { response, json } = await readOn(
      'retro-start',
      () => `/sprints/${missing('Sprint')}/retro`,
    );
    expect(response.status).toBe(404);
    expect(json).toMatchObject({ type: '/problems/not-found' });
  });

  it('answers 400 to an ID of another kind', async () => {
    const { response, json } = await readOn(
      'retro-start',
      () => `/sprints/${ids.task.paper}/retro`,
    );
    expect(response.status).toBe(400);
    expect(json).toMatchObject({ type: '/problems/validation-failed' });
  });

  it('writes nothing', async () => {
    const app = await setup('retro-start');
    await app.get('/me');
    const before = await app.saved();
    await app.get(`/sprints/${reviewOf(before.records).id}/retro`);
    expect(await app.saved()).toEqual(before);
  });

  it('shows what an operation just changed', async () => {
    const app = await setup('retro-start');
    const sprint = reviewing((await app.saved()).records);
    const read = async () =>
      v.parse(
        contract.vGetSprintRetroResponse,
        await (await app.get(`/sprints/${sprint.sprintId}/retro`)).json(),
      ).view!;
    expect((await read()).reflection).toBe('');
    await app.run('setReflection', { ...sprint, text: '午後が崩れた' });
    await app.run('pinFact', { ...sprint, pin: { kind: 'goal', id: work } });
    const view = await read();
    expect(view.reflection).toBe('午後が崩れた');
    expect(view.pins).toEqual([{ kind: 'goal', id: work }]);
  });

  it('answers null until the Retro starts, then the Retro on the app’s clock', async () => {
    const app = await setup('today-morning', undefined, lastDay);
    await app.get('/me');
    const sprintId = activeOf((await app.saved()).records).id;
    expect(
      v.parse(
        contract.vGetSprintRetroResponse,
        await (await app.get(`/sprints/${sprintId}/retro`)).json(),
      ).view,
    ).toBeNull();
    await app.run('beginRetro', { sprintId });
    const { records } = await app.saved();
    const body = v.parse(
      contract.vGetSprintRetroResponse,
      await (await app.get(`/sprints/${sprintId}/retro`)).json(),
    );
    expect(body).toEqual({
      clock: lastDayClock,
      view: asJson(sprintRetro(records, lastDayClock, sprintId)),
    });
  });

  it('is followed by the candidates of the next Planning, with the Tasks carried over in them', async () => {
    const app = await setup('retro-start');
    await app.get('/me');
    const planning = (await (
      await app.run('beginPlanning', undefined)
    ).json()) as {
      sprintId: string;
    };
    const { records } = await app.saved();
    const view = v.parse(
      contract.vListSprintCandidatesResponse,
      await (await app.get(`/sprints/${planning.sprintId}/candidates`)).json(),
    );
    expect(view).toEqual({
      clock,
      view: asJson(
        sprintCandidates(records, clock, planning.sprintId as never),
      ),
    });
    expect(view.view?.carriedOver.length).toBeGreaterThan(0);
  });
});
