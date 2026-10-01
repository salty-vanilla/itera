import { describe, expect, it } from 'vitest';
import { presentSuggestion, setEstimate } from './estimate';
import type { Occurrence } from './occurrence';
import {
  capacityDrivers,
  criterionEffect,
  planningCandidates,
} from './planning-view';
import { carryOverCandidates, goalLinkAtConfirm } from './planning';
import { id } from './shared/ids';
import { instant, localDate } from './shared/time';
import type { SprintTask } from './sprint';
import { updateTask, type Task } from './task';
import { at, ctx, newTask, researchId, sprintFixture, unwrap } from './testing';

const st = (taskId: string, extra: Partial<SprintTask> = {}): SprintTask => ({
  id: id(`st-${taskId}`),
  taskId: id(taskId),
  origin: 'planning',
  addedAt: ctx.now,
  goalLink: 'linked',
  outcome: 'draft',
  ...extra,
});

function task(taskId: string, created: string, due?: string): Task {
  const t = unwrap(updateTask(newTask(taskId, taskId), {}, at(created)));
  const base = { ...t, createdAt: instant(created) };
  return due === undefined ? base : { ...base, due: localDate(due) };
}

function occurrence(
  occId: string,
  taskId: string,
  date: string,
  state: Occurrence['state'],
): Occurrence {
  return {
    id: id(occId),
    ruleId: id(`rule-${taskId}`),
    taskId: id(taskId),
    scheduledDate: localDate(date),
    ruleVersion: 1,
    state,
    materializedAt: ctx.now,
    stateChangedAt: ctx.now,
  };
}

describe('planningCandidates', () => {
  const previous = sprintFixture('2026-09-21', 'closed', {
    tasks: [
      st('carried', { outcome: 'carriedOver' }),
      st('done-before', { outcome: 'done' }),
    ],
  });
  const sprint = sprintFixture('2026-09-28', 'planning', {
    previousSprintId: previous.id,
    tasks: [st('carried', { carriedFrom: id('st-carried') })],
  });
  const recurringTask: Task = {
    ...task('cleaning', '2026-09-01T00:00:00.000Z'),
    recurrenceRuleId: id('rule-cleaning'),
  };
  const tasks = [
    task('other-b', '2026-09-20T00:00:00.000Z'),
    task('carried', '2026-09-10T00:00:00.000Z', '2026-09-30'),
    task('due', '2026-09-15T00:00:00.000Z', '2026-10-04'),
    task('due-later', '2026-09-16T00:00:00.000Z', '2026-10-05'),
    task('overdue', '2026-09-17T00:00:00.000Z', '2026-09-20'),
    task('other-a', '2026-09-18T00:00:00.000Z'),
    recurringTask,
  ];
  const occurrences = [
    occurrence('o-3', 'cleaning', '2026-10-03', 'pending'),
    occurrence('o-2', 'cleaning', '2026-09-29', 'excluded'),
    occurrence('o-old', 'cleaning', '2026-09-26', 'done'),
  ];
  const groups = planningCandidates(sprint, {
    today: localDate('2026-09-29'),
    tasks,
    sprints: [previous, sprint],
    occurrences,
  });
  const ids = (list: readonly Task[]) => list.map((t) => t.id);

  it('puts carried-over Tasks first, chosen again or not (invariant 20)', () => {
    expect(ids(groups.carriedOver)).toEqual(['carried']);
  });

  it('期限超過: due before today, apart from 期限が近い', () => {
    expect(ids(groups.overdue)).toEqual(['overdue']);
  });

  it('期限が近い: from today to the end of the planned Sprint', () => {
    expect(ids(groups.dueSoon)).toEqual(['due']);
  });

  it('期限が近い: a Task due today is not overdue; one due after the Sprint is neither', () => {
    const today = localDate('2026-10-02');
    const edge = planningCandidates(sprint, {
      today,
      tasks: [
        task('on-today', '2026-09-10T00:00:00.000Z', '2026-10-02'),
        task('on-end', '2026-09-11T00:00:00.000Z', '2026-10-04'),
        task('day-before', '2026-09-12T00:00:00.000Z', '2026-10-01'),
        task('after', '2026-09-13T00:00:00.000Z', '2026-10-05'),
      ],
      sprints: [previous, sprint],
      occurrences: [],
    });
    expect(ids(edge.overdue)).toEqual(['day-before']);
    expect(ids(edge.dueSoon)).toEqual(['on-today', 'on-end']);
    expect(ids(edge.others)).toEqual(['after']);
  });

  it('a carried-over Task stays in 持ち越し when it is overdue (each Task in one group)', () => {
    const late = planningCandidates(sprint, {
      today: localDate('2026-10-02'),
      tasks,
      sprints: [previous, sprint],
      occurrences,
    });
    expect(ids(late.carriedOver)).toEqual(['carried']);
    expect(ids(late.overdue)).not.toContain('carried');
  });

  it('今週発生する繰り返し: this period’s pending and excluded occurrences', () => {
    expect(
      groups.recurring.map((r) => [r.task.id, r.occurrences.map((o) => o.id)]),
    ).toEqual([['cleaning', ['o-2', 'o-3']]]);
  });

  it('そのほか: the rest, in creation order (invariant 5)', () => {
    expect(ids(groups.others)).toEqual(['due-later', 'other-a', 'other-b']);
  });
});

describe('capacityDrivers', () => {
  const now = ctx.now;
  const criterion = {
    id: id<'PlanningCriterion'>('crit'),
    policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
  } as const;
  const suggested = (taskId: string, lo: number, hi: number, area = true) => {
    const t = unwrap(
      presentSuggestion(
        newTask(taskId, taskId),
        { id: id(`sug-${taskId}`), lo, hi, rationale: '', uncertainties: [] },
        ctx,
      ),
    );
    return area ? unwrap(updateTask(t, { areaId: researchId }, ctx)) : t;
  };
  const point = unwrap(setEstimate(newTask('point', 'point'), 2, ctx));
  const narrow = suggested('narrow', 1, 2, false);
  const wide = suggested('wide', 2, 6, false);
  const paper = suggested('paper', 3, 5);
  const sprint = sprintFixture('2026-09-28', 'planning', {
    tasks: [
      st('point'),
      st('narrow'),
      st('wide'),
      st('paper'),
      st('gone', { outcome: 'removed' }),
    ],
  });
  // 'gone' has a range too; it is left out because it was removed.
  const tasks = [point, narrow, wide, paper, suggested('gone', 1, 9, false)];

  it('lists the ranges, widest first, and leaves points out', () => {
    const drivers = capacityDrivers(sprint, { tasks, now });
    expect(drivers.map((d) => [d.task.id, d.spread])).toEqual([
      ['wide', 4],
      ['paper', 2],
      ['narrow', 1],
    ]);
  });

  it('keeps a criterion’s point with the range it came from', () => {
    const drivers = capacityDrivers(sprint, {
      tasks,
      now,
      previewCriterion: criterion,
    });
    const paperDriver = drivers.find((d) => d.task.id === 'paper');
    expect(paperDriver).toMatchObject({
      value: { lo: 5, hi: 5, criterionApplied: true },
      fromRange: { lo: 3, hi: 5 },
      spread: 2,
    });
  });

  it('uses the plan snapshot once the Sprint is confirmed (invariant 16)', () => {
    const confirmed = sprintFixture('2026-09-28', 'active', {
      tasks: [
        st('paper', {
          outcome: 'planned',
          planSnapshot: {
            value: {
              base: 'suggestion',
              lo: 5,
              hi: 5,
              criterionApplied: true,
              computedAt: now,
            },
            timeBasis: 'task',
            suggestion: { id: id('sug-paper'), lo: 3, hi: 5 },
          },
        }),
      ],
    });
    // The Task's suggestion changed after confirm; the snapshot still speaks.
    const changed = suggested('paper', 1, 1);
    const drivers = capacityDrivers(confirmed, { tasks: [changed], now });
    expect(drivers[0]).toMatchObject({
      fromRange: { lo: 3, hi: 5 },
      spread: 2,
    });
  });
});

describe('criterionEffect (invariant 39)', () => {
  const now = ctx.now;
  const hi = {
    id: id<'PlanningCriterion'>('crit'),
    policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
  } as const;
  const lo = { ...hi, policy: { ...hi.policy, rangePolicy: 'lo' } } as const;
  const suggested = (taskId: string, from: number, to: number) =>
    unwrap(
      updateTask(
        unwrap(
          presentSuggestion(
            newTask(taskId, taskId),
            {
              id: id(`sug-${taskId}`),
              lo: from,
              hi: to,
              rationale: '',
              uncertainties: [],
            },
            ctx,
          ),
        ),
        { areaId: researchId },
        ctx,
      ),
    );
  const paper = suggested('paper', 3, 5);
  const recurring: Task = {
    ...suggested('reading', 0.5, 1),
    recurrenceRuleId: id('rule-reading'),
  };
  const sprint = sprintFixture('2026-09-28', 'planning', {
    tasks: [
      st('paper'),
      st('reading', {
        occurrenceIds: [id('o1'), id('o2'), id('o3')],
        goalLink: 'unlinked',
      }),
    ],
  });

  it('counts recurring Tasks with their occurrences', () => {
    const effect = criterionEffect(sprint, {
      tasks: [paper, recurring],
      now,
      criterion: hi,
    });
    // paper 3–5 → 5 (+2 on the lower end); reading 1.5–3 → 3 (+1.5).
    expect(effect).toEqual({ count: 2, delta: { lo: 3.5, hi: 0 } });
  });

  it('a criterion on the lower end lowers the upper end of the total', () => {
    const effect = criterionEffect(sprint, {
      tasks: [paper, recurring],
      now,
      criterion: lo,
    });
    expect(effect).toEqual({ count: 2, delta: { lo: 0, hi: -3.5 } });
  });
});

describe('goalLinkAtConfirm (the same rule confirmSprint uses)', () => {
  const inResearch = unwrap(
    updateTask(newTask('t', 't'), { areaId: researchId }, ctx),
  );
  const noArea = newTask('n', 'n');
  const linked = st('t');
  it('stays linked only when the Area has a Goal', () => {
    const withGoal = sprintFixture('2026-09-28', 'planning', {
      goals: [{ areaId: researchId, text: 'g' }],
    });
    const withoutGoal = sprintFixture('2026-09-28', 'planning');
    expect(goalLinkAtConfirm(withGoal, linked, inResearch)).toBe('linked');
    expect(goalLinkAtConfirm(withoutGoal, linked, inResearch)).toBe('unlinked');
    expect(goalLinkAtConfirm(withGoal, linked, noArea)).toBe('unlinked');
    expect(
      goalLinkAtConfirm(
        withGoal,
        st('t', { goalLink: 'unlinked' }),
        inResearch,
      ),
    ).toBe('unlinked');
  });
});

describe('planningCandidates and carryOverCandidates agree (invariant 20)', () => {
  it('the carried-over group holds the candidates and the ones chosen again', () => {
    const previous = sprintFixture('2026-09-21', 'closed', {
      tasks: [
        st('a', { outcome: 'carriedOver' }),
        st('b', { outcome: 'carriedOver' }),
      ],
    });
    const sprint = sprintFixture('2026-09-28', 'planning', {
      previousSprintId: previous.id,
      tasks: [st('a', { carriedFrom: id('st-a') })],
    });
    const tasks = [newTask('a', 'a'), newTask('b', 'b')];
    const candidates = carryOverCandidates(previous, sprint, tasks).map(
      (t) => t.taskId,
    );
    const group = planningCandidates(sprint, {
      today: localDate('2026-09-29'),
      tasks,
      sprints: [previous, sprint],
      occurrences: [],
    }).carriedOver.map((t) => t.id);
    expect(candidates).toEqual(['b']);
    expect(group).toEqual(['a', 'b']);
  });
});
