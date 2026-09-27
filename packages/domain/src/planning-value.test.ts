import { describe, expect, it } from 'vitest';
import {
  adoptSuggestion,
  presentSuggestion,
  presentedSuggestion,
  rejectSuggestion,
  setEstimate,
} from './estimate';
import {
  planningValueOf,
  totalPlanningValues,
  type CriterionPolicy,
} from './planning-value';
import { id, type AreaId } from './shared/ids';
import { addSubtask, updateTask, type Task } from './task';
import { ctx, newTask, unwrap } from './testing';

const research = id('area-research') as AreaId;
const work = id('area-work') as AreaId;
const researchToHi: CriterionPolicy = {
  scope: { kind: 'area', areaId: research },
  rangePolicy: 'hi',
};

/** Scenario A: a research Task with a 3–5h suggestion and no Estimate. */
function withSuggestion(areaId: AreaId = research): Task {
  const task = unwrap(updateTask(newTask(), { areaId }, ctx));
  return unwrap(
    presentSuggestion(
      task,
      {
        id: id('sug-1'),
        lo: 3,
        hi: 5,
        rationale: '1 本 1–1.5h',
        uncertainties: ['論文の長さ'],
      },
      ctx,
    ),
  );
}

describe('Estimate and suggestions', () => {
  it('invariant 6: presenting a suggestion leaves the Estimate empty', () => {
    const task = withSuggestion();
    expect(task).not.toHaveProperty('estimate');
    expect(presentedSuggestion(task)).toMatchObject({
      lo: 3,
      hi: 5,
      state: 'presented',
    });
  });

  it('invariant 6: adopting (採用) makes the chosen end the Estimate and records its source', () => {
    const task = withSuggestion();
    const result = adoptSuggestion(task, id('sug-1'), 'hi', ctx);
    const adopted = unwrap(result);
    expect(adopted.estimate).toEqual({
      hours: 5,
      setAt: ctx.now,
      source: { kind: 'adopted', suggestionId: 'sug-1', bound: 'hi' },
    });
    expect(adopted.suggestions[0]?.state).toBe('adopted');
    expect(result.ok && result.value.activities).toEqual([
      {
        kind: 'estimateChanged',
        at: ctx.now,
        actor: 'user',
        taskId: task.id,
        from: null,
        to: 5,
        adoptedFrom: { suggestionId: 'sug-1', bound: 'hi' },
      },
    ]);
  });

  it('invariant 6: adopting the middle uses the midpoint', () => {
    const adopted = unwrap(
      adoptSuggestion(withSuggestion(), id('sug-1'), 'mid', ctx),
    );
    expect(adopted.estimate?.hours).toBe(4);
  });

  it('a newer suggestion replaces the one on show; only a presented one can be adopted', () => {
    const task = unwrap(
      presentSuggestion(
        withSuggestion(),
        { id: id('sug-2'), lo: 2, hi: 4, rationale: '', uncertainties: [] },
        ctx,
      ),
    );
    expect(task.suggestions.map((s) => s.state)).toEqual([
      'replaced',
      'presented',
    ]);
    expect(adoptSuggestion(task, id('sug-1'), 'lo', ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('rejecting keeps the suggestion as a record', () => {
    const result = rejectSuggestion(withSuggestion(), id('sug-1'), ctx);
    const task = unwrap(result);
    expect(task.suggestions).toHaveLength(1);
    expect(task.suggestions[0]?.state).toBe('rejected');
    expect(presentedSuggestion(task)).toBeUndefined();
    expect(result.ok && result.value.activities[0]?.kind).toBe(
      'suggestionRejected',
    );
  });

  it('rejects an invalid suggestion range and non-positive Estimates', () => {
    const task = newTask();
    expect(
      presentSuggestion(
        task,
        { id: id('s'), lo: 5, hi: 3, rationale: '', uncertainties: [] },
        ctx,
      ),
    ).toMatchObject({ ok: false });
    expect(setEstimate(task, 0, ctx)).toMatchObject({ ok: false });
    expect(setEstimate(task, Number.NaN, ctx)).toMatchObject({ ok: false });
  });

  it('records manual Estimate changes, including clearing', () => {
    const set = setEstimate(newTask(), 2, ctx);
    const task = unwrap(set);
    expect(task.estimate).toEqual({
      hours: 2,
      setAt: ctx.now,
      source: { kind: 'manual' },
    });
    const cleared = setEstimate(task, null, ctx);
    expect(unwrap(cleared)).not.toHaveProperty('estimate');
    expect(cleared.ok && cleared.value.activities[0]).toMatchObject({
      kind: 'estimateChanged',
      from: 2,
      to: null,
    });
  });
});

describe('PlanningValue', () => {
  it('invariant 7: applying (適用) a criterion changes neither the Estimate nor the suggestion', () => {
    const task = Object.freeze(withSuggestion());
    const before = JSON.parse(JSON.stringify(task)) as unknown;
    const value = planningValueOf(task, {
      now: ctx.now,
      criterion: researchToHi,
    });
    expect(value).toEqual({
      base: 'suggestion',
      lo: 5,
      hi: 5,
      criterionApplied: true,
      computedAt: ctx.now,
    });
    expect(task).toEqual(before);
    expect(task).not.toHaveProperty('estimate');
  });

  it('invariant 8: Estimate comes before the suggestion', () => {
    const task = unwrap(setEstimate(withSuggestion(), 4, ctx));
    expect(planningValueOf(task, { now: ctx.now })).toMatchObject({
      base: 'estimate',
      lo: 4,
      hi: 4,
    });
  });

  it('invariant 8: without an Estimate the presented suggestion range is used', () => {
    expect(planningValueOf(withSuggestion(), { now: ctx.now })).toEqual({
      base: 'suggestion',
      lo: 3,
      hi: 5,
      criterionApplied: false,
      computedAt: ctx.now,
    });
  });

  it('invariant 8: a rejected suggestion is not a source; the Task is unestimated', () => {
    const task = unwrap(rejectSuggestion(withSuggestion(), id('sug-1'), ctx));
    expect(planningValueOf(task, { now: ctx.now })).toEqual({
      base: 'none',
      criterionApplied: false,
      computedAt: ctx.now,
    });
  });

  it('invariant 8: unestimated values are counted, not added to the total', () => {
    const values = [
      planningValueOf(withSuggestion(), { now: ctx.now }),
      planningValueOf(unwrap(setEstimate(newTask(), 2, ctx)), { now: ctx.now }),
      planningValueOf(newTask(), { now: ctx.now }),
    ];
    expect(totalPlanningValues(values)).toEqual({
      lo: 5,
      hi: 7,
      unestimated: 1,
    });
  });

  it('invariant 9: a criterion does not act on a point Estimate', () => {
    const task = unwrap(setEstimate(withSuggestion(), 4, ctx));
    const value = planningValueOf(task, {
      now: ctx.now,
      criterion: researchToHi,
    });
    expect(value).toMatchObject({
      base: 'estimate',
      lo: 4,
      hi: 4,
      criterionApplied: false,
    });
  });

  it('invariant 9: a criterion scoped to another Area leaves the range as it is', () => {
    const value = planningValueOf(withSuggestion(work), {
      now: ctx.now,
      criterion: researchToHi,
    });
    expect(value).toMatchObject({ lo: 3, hi: 5, criterionApplied: false });
  });

  it('invariant 9: a criterion for all Areas covers Tasks without an Area', () => {
    const task = unwrap(updateTask(withSuggestion(), { areaId: null }, ctx));
    const value = planningValueOf(task, {
      now: ctx.now,
      criterion: { scope: { kind: 'all' }, rangePolicy: 'lo' },
    });
    expect(value).toMatchObject({ lo: 3, hi: 3, criterionApplied: true });
  });

  it('invariant 10: with timeBasis = subtasks only the subtask sum counts', () => {
    let task = unwrap(setEstimate(newTask(), 10, ctx));
    task = unwrap(
      addSubtask(task, { id: id('s1'), title: 'a', estimate: 1.5 }, ctx),
    );
    task = unwrap(
      addSubtask(task, { id: id('s2'), title: 'b', estimate: 2 }, ctx),
    );
    task = unwrap(addSubtask(task, { id: id('s3'), title: 'c' }, ctx));

    expect(planningValueOf(task, { now: ctx.now })).toMatchObject({
      base: 'estimate',
      lo: 10,
      hi: 10,
    });

    const bySubtasks = unwrap(updateTask(task, { timeBasis: 'subtasks' }, ctx));
    expect(planningValueOf(bySubtasks, { now: ctx.now })).toEqual({
      base: 'subtasks',
      lo: 3.5,
      hi: 3.5,
      criterionApplied: false,
      computedAt: ctx.now,
    });
  });

  it('invariant 10: subtasks without estimates leave the Task unestimated', () => {
    let task = unwrap(addSubtask(newTask(), { id: id('s1'), title: 'a' }, ctx));
    task = unwrap(updateTask(task, { timeBasis: 'subtasks' }, ctx));
    expect(planningValueOf(task, { now: ctx.now }).base).toBe('none');
  });
});
