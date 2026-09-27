import { describe, expect, it } from 'vitest';
import { presentSuggestion, setEstimate } from './estimate';
import type { Occurrence } from './occurrence';
import { capacityDrivers, planningCandidates } from './planning-view';
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
    tasks,
    sprints: [previous, sprint],
    occurrences,
  });
  const ids = (list: readonly Task[]) => list.map((t) => t.id);

  it('puts carried-over Tasks first, chosen again or not (invariant 20)', () => {
    expect(ids(groups.carriedOver)).toEqual(['carried']);
  });

  it('期限が近い: due by the end of the planned Sprint, overdue included', () => {
    expect(ids(groups.dueSoon)).toEqual(['due', 'overdue']);
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
  const tasks = [point, narrow, wide, paper];

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
