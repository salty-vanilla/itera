// Scenario B of docs/domain/domain-model.md, steps 1–3: adding a Task that
// is not in the Sprint during the Sprint (Backlog の詳細で「今日へ」). The
// DailySelection half of that one operation comes with #23; here is the
// SprintTask half. The Sprint applied 「研究 → 上限」 at confirm.
import { describe, expect, it } from 'vitest';
import { sprintTotals } from './capacity';
import { presentSuggestion } from './estimate';
import { addTaskMidSprint } from './mid-sprint';
import type { ActiveCriterion } from './planning';
import { id, type AreaId } from './shared/ids';
import { updateTask, type Task } from './task';
import {
  ctx,
  newTask,
  research,
  researchId,
  sprintFixture,
  unwrap,
  work,
  workId,
} from './testing';

const criterion: ActiveCriterion = {
  id: id('criterion-research-hi'),
  policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
};

function taskWith(
  taskId: string,
  title: string,
  areaId: AreaId,
  lo: number,
  hi: number,
): Task {
  const task = unwrap(updateTask(newTask(title, taskId), { areaId }, ctx));
  return unwrap(
    presentSuggestion(
      task,
      { id: id(`sug-${taskId}`), lo, hi, rationale: '', uncertainties: [] },
      ctx,
    ),
  );
}

function sprint(appliedAtConfirm: boolean) {
  return sprintFixture('2026-09-28', 'active', {
    availableHours: 1,
    areaSnapshot: [
      { areaId: workId, name: '仕事', order: 0 },
      { areaId: researchId, name: '研究', order: 1 },
    ],
    criterionUse: { criterionId: criterion.id, appliedAtConfirm },
  });
}

function addToToday(target: ReturnType<typeof sprint>, task: Task) {
  return addTaskMidSprint(
    target,
    {
      sprintTaskId: id(`st-${task.id}`),
      task,
      areas: [research, work],
      criterion,
      via: 'backlogToToday',
    },
    ctx,
  );
}

describe('Scenario B — Sprint 外の Task を「今日へ」（SprintTask の側）', () => {
  it('adds 顧客インタビューの設計 as planned, mid-Sprint, unlinked, 2–3h, without a warning', () => {
    const interview = taskWith(
      'task-interview',
      '顧客インタビューの設計',
      workId,
      2,
      3,
    );
    const result = addToToday(sprint(true), interview);
    const added = unwrap(result);
    expect(added.tasks[0]).toMatchObject({
      outcome: 'planned',
      origin: 'midSprint',
      goalLink: 'unlinked',
      // 仕事 is outside the criterion's scope.
      planSnapshot: { value: { lo: 2, hi: 3, criterionApplied: false } },
    });
    expect(result.ok && result.value.activities).toMatchObject([
      { kind: 'sprintTaskAdded', via: 'backlogToToday' },
    ]);
    // Over capacity, and still added: no confirmation, no warning (the
    // totals only report it; Today and Backlog do not show it).
    expect(
      sprintTotals(added, { tasks: [interview], now: ctx.now }).capacity
        ?.status,
    ).toBe('exceeds');
  });

  it('a research Task gets the upper end when the Sprint applied the criterion', () => {
    const paper = taskWith('task-paper', '論文 2', researchId, 3, 5);
    expect(
      unwrap(addToToday(sprint(true), paper)).tasks[0]?.planSnapshot?.value,
    ).toMatchObject({
      lo: 5,
      hi: 5,
      criterionApplied: true,
    });
  });

  it('and keeps the range when the Sprint did not apply it', () => {
    const paper = taskWith('task-paper', '論文 2', researchId, 3, 5);
    expect(
      unwrap(addToToday(sprint(false), paper)).tasks[0]?.planSnapshot?.value,
    ).toMatchObject({
      lo: 3,
      hi: 5,
      criterionApplied: false,
    });
  });
});
