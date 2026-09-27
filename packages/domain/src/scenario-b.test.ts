// Scenario B of docs/domain/domain-model.md, steps 1–4: adding a Task that
// is not in the Sprint during the Sprint (Backlog の詳細で「今日へ」, one
// operation making the SprintTask and the DailySelection), then completing
// it in Today. The Sprint applied 「研究 → 上限」 at confirm.
import { describe, expect, it } from 'vitest';
import { sprintTotals } from './capacity';
import { presentSuggestion } from './estimate';
import { addToToday as addToTodayCommand, completeSelection } from './today';
import type { ActiveCriterion } from './planning';
import { id, type AreaId } from './shared/ids';
import { localDate } from './shared/time';
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
  return addToTodayCommand(
    target,
    {
      sprintTaskId: id(`st-${task.id}`),
      selectionId: id(`sel-${task.id}`),
      date: localDate('2026-09-30'),
      task,
      areas: [research, work],
      criterion,
      via: 'backlogToToday',
    },
    ctx,
  );
}

describe('Scenario B — Sprint 外の Task を「今日へ」', () => {
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
    // 1–3. Both halves at once (invariant 26).
    expect(added.dailySelections).toMatchObject([
      {
        sprintTaskId: 'st-task-interview',
        origin: 'midSprint',
        resolution: 'selected',
      },
    ]);
    expect(result.ok && result.value.activities).toMatchObject([
      { kind: 'sprintTaskAdded', via: 'backlogToToday' },
      { kind: 'todaySelected' },
    ]);
    // Over capacity, and still added: no confirmation, no warning (the
    // totals only report it; Today and Backlog do not show it).
    expect(
      sprintTotals(added, { tasks: [interview], now: ctx.now }).capacity
        ?.status,
    ).toBe('exceeds');

    // 4. Today で完了: selection, SprintTask and Task done together; actual
    //    time is optional.
    const done = unwrap(
      completeSelection(
        added,
        { selectionId: id('sel-task-interview'), task: interview },
        ctx,
      ),
    );
    expect(done.sprint.dailySelections[0]?.resolution).toBe('done');
    expect(done.sprint.tasks[0]?.outcome).toBe('done');
    expect(done.task?.lifecycle).toBe('completed');
    expect(done.sprint.actualTimes).toEqual([]);
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
