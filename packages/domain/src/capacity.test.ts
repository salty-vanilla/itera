import { describe, expect, it } from 'vitest';
import { capacityOf, sprintTotals } from './capacity';
import { presentSuggestion, setEstimate } from './estimate';
import type { ActiveCriterion } from './planning';
import { id, type AreaId } from './shared/ids';
import type { SprintTask } from './sprint';
import { updateTask, type Task } from './task';
import {
  ctx,
  newTask,
  researchId,
  sprintFixture,
  unwrap,
  workId,
} from './testing';

const criterion: ActiveCriterion = {
  id: id('criterion-1'),
  policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
};

function task(
  taskId: string,
  areaId: AreaId | null,
  range?: [number, number],
  estimate?: number,
): Task {
  let t = unwrap(updateTask(newTask(taskId, taskId), { areaId }, ctx));
  if (range !== undefined) {
    t = unwrap(
      presentSuggestion(
        t,
        {
          id: id(`sug-${taskId}`),
          lo: range[0],
          hi: range[1],
          rationale: '',
          uncertainties: [],
        },
        ctx,
      ),
    );
  }
  if (estimate !== undefined) t = unwrap(setEstimate(t, estimate, ctx));
  return t;
}

function draft(taskId: string, extra: Partial<SprintTask> = {}): SprintTask {
  return {
    id: id(`st-${taskId}`),
    taskId: id(taskId),
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'draft',
    ...extra,
  };
}

describe('capacityOf', () => {
  it('within, may exceed, and exceeds', () => {
    expect(capacityOf({ lo: 10, hi: 16 }, 18)).toEqual({
      availableHours: 18,
      remaining: { lo: 2, hi: 8 },
      status: 'within',
    });
    expect(capacityOf({ lo: 16.5, hi: 18.5 }, 18).status).toBe('mayExceed');
    expect(capacityOf({ lo: 21, hi: 23 }, 18)).toEqual({
      availableHours: 18,
      remaining: { lo: -5, hi: -3 },
      status: 'exceeds',
    });
  });
});

describe('sprintTotals', () => {
  const paper = task('paper', researchId, [3, 5]);
  const interview = task('interview', workId, [2, 3]);
  const memo = task('memo', null, undefined, 1);
  const unestimated = task('todo', workId);
  const tasks = [paper, interview, memo, unestimated];

  it('previews drafts with the criterion, per Area and overall, with the unestimated count', () => {
    const sprint = sprintFixture('2026-09-28', 'planning', {
      availableHours: 10,
      tasks: [draft('paper'), draft('interview'), draft('memo'), draft('todo')],
    });
    const totals = sprintTotals(sprint, {
      tasks,
      now: ctx.now,
      previewCriterion: criterion,
    });
    expect(totals.total).toEqual({
      lo: 8,
      hi: 9,
      unestimated: 1,
      unestimatedSubtasks: 0,
    });
    expect(totals.byArea).toEqual([
      {
        areaId: researchId,
        lo: 5,
        hi: 5,
        unestimated: 0,
        unestimatedSubtasks: 0,
      },
      { areaId: workId, lo: 2, hi: 3, unestimated: 1, unestimatedSubtasks: 0 },
      { areaId: null, lo: 1, hi: 1, unestimated: 0, unestimatedSubtasks: 0 },
    ]);
    expect(totals.capacity?.status).toBe('within');
  });

  it('invariant 15: unlinked and mid-Sprint Tasks count; removed and carried-over do not', () => {
    const sprint = sprintFixture('2026-09-28', 'active', {
      availableHours: 4,
      tasks: [
        draft('paper', { outcome: 'planned', goalLink: 'unlinked' }),
        draft('interview', {
          outcome: 'planned',
          origin: 'midSprint',
          goalLink: 'unlinked',
        }),
        draft('memo', { outcome: 'removed' }),
        draft('todo', { outcome: 'carriedOver' }),
      ],
    });
    const totals = sprintTotals(sprint, { tasks, now: ctx.now });
    expect(totals.total).toMatchObject({ lo: 5, hi: 8, unestimated: 0 });
    expect(totals.capacity?.status).toBe('exceeds');
  });

  it('invariant 16: confirmed SprintTasks use their snapshot, not the Task now', () => {
    const snapshot = {
      value: {
        base: 'suggestion' as const,
        lo: 5,
        hi: 5,
        criterionApplied: true,
        computedAt: ctx.now,
      },
      timeBasis: 'task' as const,
    };
    const sprint = sprintFixture('2026-09-28', 'active', {
      tasks: [draft('paper', { outcome: 'planned', planSnapshot: snapshot })],
    });
    const changed = unwrap(setEstimate(paper, 12, ctx));
    expect(
      sprintTotals(sprint, { tasks: [changed], now: ctx.now }).total,
    ).toMatchObject({
      lo: 5,
      hi: 5,
    });
  });

  it('has no capacity without available hours', () => {
    const sprint = sprintFixture('2026-09-28', 'planning', {
      tasks: [draft('memo')],
    });
    expect(sprintTotals(sprint, { tasks, now: ctx.now })).not.toHaveProperty(
      'capacity',
    );
  });
});
