import { describe, expect, it } from 'vitest';
import {
  activeCriterion,
  criterionView,
  setDraftPolicy,
  type PlanningCriterion,
} from './criterion';
import { presentSuggestion, setEstimate } from './estimate';
import type { CriterionPolicy } from './planning-value';
import { id, type AreaId } from './shared/ids';
import { updateTask, type Task } from './task';
import { ctx, newTask, researchId, unwrap, userId, workId } from './testing';

const policy: CriterionPolicy = {
  scope: { kind: 'area', areaId: researchId },
  rangePolicy: 'hi',
};

function criterion(
  state: PlanningCriterion['state'],
  cid = 'crit-1',
): PlanningCriterion {
  return {
    id: id(cid),
    userId,
    policy,
    sourceSprintId: id('sprint-1'),
    state,
    createdAt: ctx.now,
  };
}

function withRange(
  taskId: string,
  areaId: AreaId,
  lo: number,
  hi: number,
): Task {
  return unwrap(
    presentSuggestion(
      unwrap(updateTask(newTask(taskId, taskId), { areaId }, ctx)),
      { id: id(`sug-${taskId}`), lo, hi, rationale: '', uncertainties: [] },
      ctx,
    ),
  );
}

describe('PlanningCriterion', () => {
  it('invariant 35: at most one is active', () => {
    const criteria = [
      criterion('ended', 'c0'),
      criterion('active', 'c1'),
      criterion('draft', 'c2'),
    ];
    expect(activeCriterion(criteria)?.id).toBe('c1');
    expect(activeCriterion([criterion('draft')])).toBeUndefined();
  });

  it('only a draft’s setting can be changed', () => {
    const mid = { ...policy, rangePolicy: 'mid' as const };
    expect(unwrap(setDraftPolicy(criterion('draft'), mid, ctx)).policy).toEqual(
      mid,
    );
    expect(setDraftPolicy(criterion('active'), mid, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });
});

describe('criterionView (invariant 39)', () => {
  const tasks = [
    withRange('paper', researchId, 3, 5),
    withRange('interview', workId, 2, 3), // outside the scope
    unwrap(setEstimate(withRange('fixed', researchId, 1, 2), 1.5, ctx)), // point Estimate
    newTask('none', 'none'),
  ];

  it('the setting, its effect and the preview come from the same single value', () => {
    const view = criterionView(policy, tasks, ctx.now);
    expect(view).toEqual({
      policy,
      effect: { bound: 'hi', scope: { kind: 'area', areaId: researchId } },
      preview: [{ taskId: 'paper', from: { lo: 3, hi: 5 }, to: 5 }],
    });
  });

  it('changing the value changes all three together', () => {
    const lo = { ...policy, rangePolicy: 'lo' as const };
    const view = criterionView(lo, tasks, ctx.now);
    expect(view.policy).toBe(lo);
    expect(view.effect.bound).toBe('lo');
    expect(view.preview).toEqual([
      { taskId: 'paper', from: { lo: 3, hi: 5 }, to: 3 },
    ]);
    const all = criterionView(
      { scope: { kind: 'all' }, rangePolicy: 'mid' },
      tasks,
      ctx.now,
    );
    expect(all.preview.map((r) => [r.taskId, r.to])).toEqual([
      ['paper', 4],
      ['interview', 2.5],
    ]);
  });
});
