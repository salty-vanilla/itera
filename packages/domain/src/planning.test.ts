import { describe, expect, expectTypeOf, it } from 'vitest';
import * as domain from './index';
import { sprintTotals } from './capacity';
import { presentSuggestion, setEstimate } from './estimate';
import type { Occurrence } from './occurrence';
import {
  carryOverCandidates,
  carryOverPlaces,
  carryOverTasks,
  confirmSprint,
  excludeFromPlan,
  includeInPlan,
  selectTask,
  setAvailableHours,
  setGoalLink,
  setGoalText,
  startPlanning,
  unselectTask,
  type ActiveCriterion,
} from './planning';
import { createRecurrenceRule } from './recurrence';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type { Sprint, SprintGoal, SprintTask } from './sprint';
import { archiveTask, updateTask, type Task } from './task';
import {
  at,
  ctx,
  ids,
  newTask,
  research,
  researchId,
  sprintFixture,
  unwrap,
  user,
  work,
  workId,
} from './testing';

const d = localDate;
const criterion: ActiveCriterion = {
  id: id('criterion-1'),
  policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
};

/** Scenario A's Task: research, suggestion 3–5h, no Estimate. */
function paperTask(taskId = 'task-paper'): Task {
  const task = unwrap(
    updateTask(
      newTask('関連論文を 3 本読む', taskId),
      { areaId: researchId },
      ctx,
    ),
  );
  return unwrap(
    presentSuggestion(
      task,
      {
        id: id(`sug-${taskId}`),
        lo: 3,
        hi: 5,
        rationale: '',
        uncertainties: [],
      },
      ctx,
    ),
  );
}

const closedPrevious = sprintFixture('2026-09-21', 'closed');

function plan(
  sprints: readonly Sprint[] = [closedPrevious],
  recurring: Parameters<typeof startPlanning>[0]['recurring'] = [],
  occurrences: readonly Occurrence[] = [],
) {
  return unwrap(
    startPlanning(
      {
        sprintId: id('sprint-2026-09-28'),
        user,
        start: d('2026-09-28'),
        sprints,
        recurring,
        occurrences,
        newOccurrenceId: ids('occ'),
        newSprintTaskId: ids('st-rec'),
      },
      ctx,
    ),
  );
}

function withTask(sprint: Sprint, task: Task, stId = 'st-1'): Sprint {
  return unwrap(selectTask(sprint, { sprintTaskId: id(stId), task }, ctx));
}

describe('startPlanning', () => {
  it('starts a one-week draft after the previous Sprint', () => {
    const result = startPlanning(
      {
        sprintId: id('s'),
        user,
        start: d('2026-09-28'),
        sprints: [closedPrevious],
        recurring: [],
        occurrences: [],
        newOccurrenceId: ids('occ'),
        newSprintTaskId: ids('st'),
      },
      ctx,
    );
    expect(unwrap(result).sprint).toMatchObject({
      start: '2026-09-28',
      end: '2026-10-04',
      state: 'planning',
      previousSprintId: closedPrevious.id,
      tasks: [],
      goals: [],
      areaSnapshot: [],
    });
    expect(result.ok && result.value.activities[0]?.kind).toBe(
      'sprintPlanningStarted',
    );
  });

  it('can start while the previous Retro is not finished (invariant 12)', () => {
    const inReview = sprintFixture('2026-09-21', 'review');
    expect(plan([inReview]).sprint.state).toBe('planning');
  });

  it('starts on the first day of the user week only', () => {
    const result = startPlanning(
      {
        sprintId: id('s'),
        user,
        start: d('2026-09-29'),
        sprints: [],
        recurring: [],
        occurrences: [],
        newOccurrenceId: ids('occ'),
        newSprintTaskId: ids('st'),
      },
      ctx,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });

  it('invariant 11: Sprint periods never overlap, and one draft at a time', () => {
    const overlapping = sprintFixture('2026-09-28', 'active');
    const input = {
      sprintId: id<'Sprint'>('s'),
      user,
      start: d('2026-09-28'),
      recurring: [],
      occurrences: [],
      newOccurrenceId: ids<'Occurrence'>('occ'),
      newSprintTaskId: ids<'SprintTask'>('st'),
    };
    expect(
      startPlanning({ ...input, sprints: [overlapping] }, ctx),
    ).toMatchObject({
      ok: false,
    });
    const draft = sprintFixture('2026-09-21', 'planning');
    expect(startPlanning({ ...input, sprints: [draft] }, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('invariants 32–33: generates the period’s occurrences and includes them by default', () => {
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('部屋の掃除', 'task-clean'),
        {
          id: id('rule-1'),
          pattern: { freq: 'weekly', daysOfWeek: [6] },
          effectiveFrom: d('2026-09-28'),
        },
        ctx,
      ),
    );
    const { sprint, occurrences } = plan([closedPrevious], [{ task, rule }]);
    expect(occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-10-03', 'pending'],
    ]);
    expect(sprint.tasks).toEqual([
      {
        id: 'st-rec-1',
        taskId: 'task-clean',
        occurrenceIds: ['occ-1'],
        origin: 'planning',
        addedAt: ctx.now,
        goalLink: 'unlinked',
        outcome: 'draft',
      },
    ]);
  });

  it('invariant 20: carried-over Tasks are only candidates, never added automatically', () => {
    const carried: SprintTask = {
      id: id('st-old'),
      taskId: id('task-paper'),
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    };
    const previous = sprintFixture('2026-09-21', 'closed', {
      tasks: [carried],
    });
    const { sprint } = plan([previous]);
    expect(sprint.tasks).toEqual([]);
    expect(carryOverCandidates(previous, sprint, [paperTask()])).toEqual([
      carried,
    ]);

    const chosen = unwrap(
      selectTask(
        sprint,
        { sprintTaskId: id('st-new'), task: paperTask(), carriedFrom: carried },
        ctx,
      ),
    );
    expect(chosen.tasks[0]).toMatchObject({
      carriedFrom: 'st-old',
      outcome: 'draft',
    });
    expect(carryOverCandidates(previous, chosen, [paperTask()])).toEqual([]);
  });

  it('invariant 20: counts where the carry-overs are, without moving them (F35)', () => {
    const carried = (n: number): SprintTask => ({
      id: id(`st-old-${n}`),
      taskId: id(`task-paper-${n}`),
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    });
    const previous = sprintFixture('2026-09-21', 'review', {
      tasks: [carried(1), carried(2), carried(3), carried(4)],
    });
    const tasks = [
      paperTask('task-paper-1'),
      paperTask('task-paper-2'),
      unwrap(domain.completeTask(paperTask('task-paper-3'), ctx)),
      unwrap(archiveTask(paperTask('task-paper-4'), ctx)),
    ];
    // Before the next Planning: all still open ones are candidates.
    expect(carryOverPlaces(previous, undefined, tasks)).toEqual({
      total: 4,
      inNext: 0,
      candidates: 2,
      completed: 1,
      archived: 1,
    });
    // Per Task, in the Sprint's order, with the same places.
    expect(carryOverTasks(previous, undefined, tasks)).toEqual([
      { taskId: 'task-paper-1', place: 'candidate' },
      { taskId: 'task-paper-2', place: 'candidate' },
      { taskId: 'task-paper-3', place: 'completed' },
      { taskId: 'task-paper-4', place: 'archived' },
    ]);
    // The next Sprint chose one before Review (F35).
    const { sprint } = plan([previous]);
    const chosen = unwrap(
      selectTask(sprint, { sprintTaskId: id('st-new'), task: tasks[0]! }, ctx),
    );
    expect(carryOverPlaces(previous, chosen, tasks)).toMatchObject({
      inNext: 1,
      candidates: 1,
    });
    expect(carryOverCandidates(previous, chosen, tasks)).toEqual([carried(2)]);
    // A Sprint that does not follow it takes none in.
    expect(
      carryOverPlaces(
        previous,
        { ...chosen, previousSprintId: id('sprint-other') },
        tasks,
      ).inNext,
    ).toBe(0);
  });
});

describe('selecting Tasks in Planning', () => {
  it('a selected non-recurring Task is a draft linked to its Area Goal', () => {
    const result = selectTask(
      plan().sprint,
      { sprintTaskId: id('st-1'), task: paperTask() },
      ctx,
    );
    expect(unwrap(result).tasks).toEqual([
      {
        id: 'st-1',
        taskId: 'task-paper',
        origin: 'planning',
        addedAt: ctx.now,
        goalLink: 'linked',
        outcome: 'draft',
      },
    ]);
    expect(result.ok && result.value.activities[0]).toMatchObject({
      kind: 'sprintTaskAdded',
      via: 'planning',
    });
  });

  it('invariant 14: a non-recurring Task joins a Sprint once at most', () => {
    const sprint = withTask(plan().sprint, paperTask());
    expect(
      selectTask(sprint, { sprintTaskId: id('st-2'), task: paperTask() }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('rejects recurring and non-active Tasks', () => {
    const { sprint } = plan();
    const recurring: Task = { ...paperTask(), recurrenceRuleId: id('rule-x') };
    expect(
      selectTask(sprint, { sprintTaskId: id('st'), task: recurring }, ctx),
    ).toMatchObject({ ok: false });
    const archived = unwrap(archiveTask(paperTask(), ctx));
    expect(
      selectTask(sprint, { sprintTaskId: id('st'), task: archived }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('unselecting a draft leaves no SprintTask behind', () => {
    const sprint = withTask(plan().sprint, paperTask());
    const result = unselectTask(sprint, id('st-1'), ctx);
    expect(unwrap(result).tasks).toEqual([]);
    expect(result.ok && result.value.activities[0]?.kind).toBe(
      'sprintTaskUnselected',
    );
  });

  it('invariant 33: excluding an occurrence keeps it as a record; the empty draft leaves', () => {
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('部屋の掃除', 'task-clean'),
        {
          id: id('rule-1'),
          pattern: { freq: 'weekly', daysOfWeek: [6] },
          effectiveFrom: d('2026-09-28'),
        },
        ctx,
      ),
    );
    const planned = plan([closedPrevious], [{ task, rule }]);
    const [occurrence] = planned.occurrences;
    if (occurrence === undefined) throw new Error('no occurrence');

    const excluded = unwrap(excludeFromPlan(planned.sprint, occurrence, ctx));
    expect(excluded.occurrence.state).toBe('excluded');
    expect(excluded.sprint.tasks).toEqual([]);

    const back = unwrap(
      includeInPlan(
        excluded.sprint,
        { occurrence: excluded.occurrence, task, sprintTaskId: id('st-back') },
        ctx,
      ),
    );
    expect(back.occurrence.state).toBe('pending');
    expect(back.sprint.tasks).toMatchObject([
      { id: 'st-back', occurrenceIds: [occurrence.id], outcome: 'draft' },
    ]);
  });
});

describe('Goals and available hours', () => {
  it('invariant 13: one Goal per Area and no Sprint-wide Goal', () => {
    let sprint = plan().sprint;
    sprint = unwrap(
      setGoalText(
        sprint,
        { areaId: researchId, text: '先行研究を押さえる' },
        ctx,
      ),
    );
    sprint = unwrap(
      setGoalText(
        sprint,
        { areaId: researchId, text: '先行研究を整理する' },
        ctx,
      ),
    );
    sprint = unwrap(
      setGoalText(sprint, { areaId: workId, text: '面談を設計する' }, ctx),
    );
    expect(sprint.goals).toEqual([
      { areaId: researchId, text: '先行研究を整理する' },
      { areaId: workId, text: '面談を設計する' },
    ]);
    expectTypeOf<Sprint>().not.toHaveProperty('goal');
    // In Planning an empty text removes the Goal.
    sprint = unwrap(setGoalText(sprint, { areaId: workId, text: ' ' }, ctx));
    expect(sprint.goals.map((g) => g.areaId)).toEqual([researchId]);
  });

  it('invariant 19: nothing judges a Goal', () => {
    expectTypeOf<SprintGoal>().not.toHaveProperty('achieved');
    expect(Object.keys(domain).filter((n) => /judge|achiev/i.test(n))).toEqual(
      [],
    );
  });

  it('rejects negative available hours', () => {
    expect(setAvailableHours(plan().sprint, { hours: -1 }, ctx)).toMatchObject({
      ok: false,
    });
  });
});

describe('confirmSprint', () => {
  function readySprint(): Sprint {
    let sprint = withTask(plan().sprint, paperTask());
    sprint = unwrap(
      setGoalText(
        sprint,
        { areaId: researchId, text: '先行研究を押さえる' },
        ctx,
      ),
    );
    return unwrap(setAvailableHours(sprint, { hours: 18 }, ctx));
  }

  function confirm(
    sprint: Sprint,
    extra: Partial<Parameters<typeof confirmSprint>[1]> = {},
  ) {
    return confirmSprint(
      sprint,
      {
        sprints: [closedPrevious, sprint],
        tasks: [paperTask()],
        areas: [research, work],
        criterion,
        applyCriterion: true,
        ...extra,
      },
      at('2026-09-28T01:00:00.000Z'),
    );
  }

  it('invariant 12: waits until the previous Sprint is closed', () => {
    const inReview = sprintFixture('2026-09-21', 'review');
    expect(confirm(readySprint(), { sprints: [inReview] })).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('invariant 11: only one Sprint is active', () => {
    const active = sprintFixture('2026-09-14', 'active');
    expect(
      confirm(readySprint(), { sprints: [closedPrevious, active] }),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('invariants 16 and 18: copies the plan, Goal text, hours and Area names', () => {
    const confirmed = unwrap(confirm(readySprint()));
    expect(confirmed).toMatchObject({
      state: 'active',
      confirmedAt: '2026-09-28T01:00:00.000Z',
      availableHours: 18,
      plannedAvailableHours: 18,
      goals: [
        {
          areaId: researchId,
          text: '先行研究を押さえる',
          plannedText: '先行研究を押さえる',
        },
      ],
      areaSnapshot: [
        { areaId: workId, name: '仕事', order: 0 },
        { areaId: researchId, name: '研究', order: 1 },
      ],
    });
    expect(confirmed.tasks[0]).toEqual({
      id: 'st-1',
      taskId: 'task-paper',
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'planned',
      planSnapshot: {
        value: {
          base: 'suggestion',
          lo: 5,
          hi: 5,
          criterionApplied: true,
          computedAt: '2026-09-28T01:00:00.000Z',
        },
        timeBasis: 'task',
        suggestion: { id: 'sug-task-paper', lo: 3, hi: 5 },
      },
    });
  });

  it('invariant 16: a later Estimate change does not change the planned total', () => {
    const confirmed = unwrap(confirm(readySprint()));
    const estimated = unwrap(setEstimate(paperTask(), 8, ctx));
    expect(
      sprintTotals(confirmed, { tasks: [estimated], now: ctx.now }).total,
    ).toMatchObject({ lo: 5, hi: 5 });
  });

  it('refuses a draft whose Task was completed or archived during Planning', () => {
    const archived = unwrap(archiveTask(paperTask(), ctx));
    expect(confirm(readySprint(), { tasks: [archived] })).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('a recurring Task is planned as one occurrence’s value × the count', () => {
    const created = unwrap(
      createRecurrenceRule(
        newTask('ジム', 'task-gym'),
        {
          id: id('rule-gym'),
          pattern: { freq: 'weekly', daysOfWeek: [2, 4] },
          effectiveFrom: d('2026-09-28'),
        },
        ctx,
      ),
    );
    const gym = unwrap(setEstimate(created.task, 1.5, ctx));
    const { sprint } = plan(
      [closedPrevious],
      [{ task: gym, rule: created.rule }],
    );
    const confirmed = unwrap(
      confirmSprint(
        sprint,
        {
          sprints: [closedPrevious],
          tasks: [gym],
          areas: [],
          applyCriterion: false,
        },
        ctx,
      ),
    );
    expect(confirmed.tasks[0]?.planSnapshot).toMatchObject({
      value: { base: 'estimate', lo: 3, hi: 3 },
      estimateHours: 1.5,
      occurrenceCount: 2,
    });
  });

  it('F16: a Goal written after confirm has no planned text', () => {
    const confirmed = unwrap(confirm(readySprint()));
    const added = unwrap(
      setGoalText(confirmed, { areaId: workId, text: '面談を設計する' }, ctx),
    );
    expect(added.goals.find((g) => g.areaId === workId)).toEqual({
      areaId: workId,
      text: '面談を設計する',
    });
  });

  it('Goal に紐づく / 紐づかない can be switched, with history', () => {
    const planning = readySprint();
    const unlinked = setGoalLink(
      planning,
      { sprintTaskId: id('st-1'), task: paperTask(), goalLink: 'unlinked' },
      ctx,
    );
    expect(unwrap(unlinked).tasks[0]?.goalLink).toBe('unlinked');
    expect(unlinked.ok && unlinked.value.activities[0]).toMatchObject({
      kind: 'goalLinkChanged',
      from: 'linked',
      to: 'unlinked',
    });

    // During the Sprint, linking needs a Goal for the Task's Area.
    const active = unwrap(confirm(unwrap(unlinked)));
    const relinked = setGoalLink(
      active,
      { sprintTaskId: id('st-1'), task: paperTask(), goalLink: 'linked' },
      ctx,
    );
    expect(unwrap(relinked).tasks[0]?.goalLink).toBe('linked');
    const noGoal = unwrap(
      confirm(
        unwrap(
          setGoalText(unwrap(unlinked), { areaId: researchId, text: '' }, ctx),
        ),
      ),
    );
    expect(
      setGoalLink(
        noGoal,
        { sprintTaskId: id('st-1'), task: paperTask(), goalLink: 'linked' },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('invariant 18: Goal text and hours change later, the confirmed copies stay', () => {
    let sprint = unwrap(confirm(readySprint()));
    const changed = setGoalText(
      sprint,
      { areaId: researchId, text: '2 本だけ読む' },
      ctx,
    );
    sprint = unwrap(changed);
    sprint = unwrap(setAvailableHours(sprint, { hours: 12 }, ctx));
    expect(sprint.goals[0]).toEqual({
      areaId: researchId,
      text: '2 本だけ読む',
      plannedText: '先行研究を押さえる',
    });
    expect(sprint).toMatchObject({
      availableHours: 12,
      plannedAvailableHours: 18,
    });
    expect(changed.ok && changed.value.activities[0]).toMatchObject({
      kind: 'goalTextChanged',
      from: '先行研究を押さえる',
      to: '2 本だけ読む',
    });
    expect(
      setGoalText(sprint, { areaId: researchId, text: '' }, ctx),
    ).toMatchObject({
      ok: false,
    });
  });

  it('a linked SprintTask whose Area has no Goal becomes unlinked', () => {
    const noGoal = unwrap(
      setGoalText(readySprint(), { areaId: researchId, text: '' }, ctx),
    );
    expect(unwrap(confirm(noGoal)).tasks[0]?.goalLink).toBe('unlinked');
  });

  it('invariant 36: an active criterion leaves exactly one CriterionUse, applied or not', () => {
    const applied = confirm(readySprint());
    expect(unwrap(applied).criterionUse).toEqual({
      criterionId: 'criterion-1',
      appliedAtConfirm: true,
    });
    expect(applied.ok && applied.value.activities[0]).toMatchObject({
      kind: 'sprintConfirmed',
      criterion: { criterionId: 'criterion-1', appliedAtConfirm: true },
    });

    const notApplied = unwrap(
      confirm(readySprint(), { applyCriterion: false }),
    );
    expect(notApplied.criterionUse).toEqual({
      criterionId: 'criterion-1',
      appliedAtConfirm: false,
    });
    expect(notApplied.tasks[0]?.planSnapshot?.value).toMatchObject({
      lo: 3,
      hi: 5,
      criterionApplied: false,
    });

    const none = unwrap(
      confirmSprint(
        readySprint(),
        {
          sprints: [closedPrevious],
          tasks: [paperTask()],
          areas: [research],
          applyCriterion: false,
        },
        ctx,
      ),
    );
    expect(none).not.toHaveProperty('criterionUse');
  });

  it('F42: a criterion that acts on no planned value is not applied', () => {
    // Only a work Task: the research criterion covers nothing.
    const job = unwrap(
      updateTask(newTask('面談の設計', 'task-job'), { areaId: workId }, ctx),
    );
    const workOnly = unwrap(
      confirm(withTask(plan().sprint, job), { tasks: [job] }),
    );
    expect(workOnly.criterionUse).toEqual({
      criterionId: 'criterion-1',
      appliedAtConfirm: false,
    });

    // A research Task with an Estimate has no range for it to act on.
    const estimated = unwrap(setEstimate(paperTask(), 4, ctx));
    const pointOnly = confirm(withTask(plan().sprint, estimated), {
      tasks: [estimated],
    });
    expect(unwrap(pointOnly).criterionUse?.appliedAtConfirm).toBe(false);
    expect(pointOnly.ok && pointOnly.value.activities[0]).toMatchObject({
      kind: 'sprintConfirmed',
      criterion: { criterionId: 'criterion-1', appliedAtConfirm: false },
    });
  });

  it('cannot apply a criterion when none is active', () => {
    expect(
      confirmSprint(
        readySprint(),
        {
          sprints: [closedPrevious],
          tasks: [paperTask()],
          areas: [research],
          applyCriterion: true,
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('invariant 37: nothing changes the criterion use after confirm', () => {
    const names = Object.keys(domain).filter((n) => /criterion/i.test(n));
    expect(names.filter((n) => /set|change|update|toggle/i.test(n))).toEqual(
      [],
    );
  });

  it('invariant 17: confirm keeps the origin of every SprintTask', () => {
    const confirmed = unwrap(confirm(readySprint()));
    expect(confirmed.tasks.map((t) => t.origin)).toEqual(['planning']);
    expectTypeOf<SprintTask['origin']>().toEqualTypeOf<
      'planning' | 'midSprint'
    >();
  });

  it('snapshots every non-archived Area, plus archived ones in use', () => {
    const archivedWork = { ...work, archived: true };
    const confirmed = unwrap(
      confirm(readySprint(), { areas: [research, archivedWork] }),
    );
    expect(confirmed.areaSnapshot.map((e) => e.name)).toEqual(['研究']);
  });
});

describe('guards', () => {
  it('selectTask refuses a carriedFrom of another Task or not carried over', () => {
    const other: SprintTask = {
      id: id('st-old'),
      taskId: id('task-other'),
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    };
    const input = { sprintTaskId: id<'SprintTask'>('st'), task: paperTask() };
    expect(
      selectTask(plan().sprint, { ...input, carriedFrom: other }, ctx),
    ).toMatchObject({
      ok: false,
    });
    expect(
      selectTask(
        plan().sprint,
        {
          ...input,
          carriedFrom: { ...other, taskId: id('task-paper'), outcome: 'done' },
        },
        ctx,
      ),
    ).toMatchObject({ ok: false });
  });

  it('carryOverCandidates only lists the previous Sprint’s active, non-recurring Tasks', () => {
    const carried = (taskId: string): SprintTask => ({
      id: id(`st-${taskId}`),
      taskId: id(taskId),
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    });
    const previous = sprintFixture('2026-09-21', 'closed', {
      tasks: [
        carried('task-paper'),
        carried('task-gone'),
        carried('task-clean'),
      ],
    });
    const { sprint } = plan([previous]);
    const gone = unwrap(archiveTask(newTask('x', 'task-gone'), ctx));
    const clean: Task = {
      ...newTask('y', 'task-clean'),
      recurrenceRuleId: id('r'),
    };
    expect(
      carryOverCandidates(previous, sprint, [paperTask(), gone, clean]).map(
        (t) => t.taskId,
      ),
    ).toEqual(['task-paper']);
    const unrelated = sprintFixture('2026-09-14', 'closed', {
      tasks: [carried('task-paper')],
    });
    expect(carryOverCandidates(unrelated, sprint, [paperTask()])).toEqual([]);
  });

  it('includeInPlan refuses an occurrence outside the Sprint period', () => {
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('部屋の掃除', 'task-clean'),
        {
          id: id('rule-1'),
          pattern: { freq: 'daily' },
          effectiveFrom: d('2026-09-28'),
        },
        ctx,
      ),
    );
    const outside: Occurrence = {
      id: id('occ-x'),
      taskId: task.id,
      ruleId: rule.id,
      scheduledDate: d('2026-10-05'),
      ruleVersion: 1,
      materializedAt: ctx.now,
      state: 'excluded',
      stateChangedAt: ctx.now,
    };
    expect(
      includeInPlan(
        plan().sprint,
        { occurrence: outside, task, sprintTaskId: id('st') },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});
