// Boundaries of Today's commands found in acceptance (#23): removed
// SprintTasks, Sprints no longer active, same-day completion of a closed
// selection (F17), occurrences of other days (F18), and all-or-nothing
// failures.
import { describe, expect, it } from 'vitest';
import { presentSuggestion } from './estimate';
import { removeFromSprint, restoreToSprint } from './mid-sprint';
import { generateOccurrences, type Occurrence } from './occurrence';
import { createRecurrenceRule } from './recurrence';
import { id } from './shared/ids';
import { instant, localDate } from './shared/time';
import type { Sprint, SprintTask } from './sprint';
import { completeTask, updateTask, type Task } from './task';
import {
  addToToday,
  completeFromBacklog,
  completeSelection,
  deferSelection,
  pauseSelection,
  recordActualTime,
  removeFromToday,
  selectForToday,
  skipSelection,
  startDay,
  startSelection,
  undoCompleteFromBacklog,
  undoCompleteSelection,
  undoDeferSelection,
  undoRemoveFromToday,
  undoSkipSelection,
} from './today';
import {
  deferralStreak,
  todayRemaining,
  yesterdaysContinuation,
} from './today-view';
import {
  ctx,
  ids,
  newTask,
  research,
  sprintFixture,
  unwrap,
  work,
  workId,
} from './testing';

const d = localDate;
const sel = { selectionId: id<'DailySelection'>('sel-1') };
const system = {
  now: instant('2026-09-29T15:00:00.000Z'),
  actor: 'system' as const,
};

function planned(taskId: string, extra: Partial<SprintTask> = {}): SprintTask {
  return {
    id: id(`st-${taskId}`),
    taskId: id(taskId),
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'planned',
    ...extra,
  };
}

function active(tasks: readonly SprintTask[] = [planned('task-1')]): Sprint {
  return sprintFixture('2026-09-28', 'active', {
    tasks,
    availableHours: 18,
    plannedAvailableHours: 18,
    goals: [{ areaId: workId, text: 'g', plannedText: 'g' }],
    areaSnapshot: [
      { areaId: workId, name: '仕事', order: 0 },
      { areaId: research.id, name: '研究', order: 1 },
    ],
    criterionUse: { criterionId: id('criterion-1'), appliedAtConfirm: false },
  });
}

function chosen(sprint = active(), date = '2026-09-28'): Sprint {
  return unwrap(
    selectForToday(
      sprint,
      {
        selectionId: sel.selectionId,
        date: d(date),
        sprintTaskId: id('st-task-1'),
      },
      ctx,
    ),
  );
}

const task1 = () => newTask('x', 'task-1');
const complete = (sprint: Sprint, today = '2026-09-28') =>
  completeSelection(sprint, { ...sel, task: task1(), today: d(today) }, ctx);

function recurring() {
  const { task, rule } = unwrap(
    createRecurrenceRule(
      newTask('ストレッチ', 'task-stretch'),
      {
        id: id('rule-s'),
        pattern: { freq: 'daily' },
        effectiveFrom: d('2026-09-28'),
      },
      ctx,
    ),
  );
  const occurrences = unwrap(
    generateOccurrences(
      rule,
      {
        start: d('2026-09-28'),
        end: d('2026-10-04'),
        existing: [],
        newOccurrenceId: ids('occ'),
      },
      ctx,
    ),
  );
  const sprint = active([
    planned('task-stretch', {
      goalLink: 'unlinked',
      occurrenceIds: occurrences.map((o) => o.id),
    }),
  ]);
  return { task, occurrences, sprint };
}

describe('Today leaves a SprintTask removed from the Sprint alone (F13, F14)', () => {
  function removedWithOpenSelection(): Sprint {
    return unwrap(
      removeFromSprint(
        chosen(),
        { sprintTaskId: id('st-task-1'), occurrences: [] },
        ctx,
      ),
    ).sprint;
  }

  it('its open selection cannot be completed, started or deferred (no removed → done)', () => {
    const sprint = removedWithOpenSelection();
    expect(complete(sprint)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(startSelection(sprint, sel, ctx)).toMatchObject({ ok: false });
    expect(deferSelection(sprint, sel, ctx)).toMatchObject({ ok: false });
    expect(sprint.tasks[0]?.outcome).toBe('removed');
  });

  it('it is not counted in today’s remaining', () => {
    expect(
      todayRemaining(removedWithOpenSelection(), d('2026-09-28')).count,
    ).toBe(0);
  });

  it('after restoring, the same selection can be completed', () => {
    const restored = unwrap(
      restoreToSprint(
        removedWithOpenSelection(),
        { sprintTaskId: id('st-task-1'), occurrences: [] },
        ctx,
      ),
    ).sprint;
    const done = unwrap(complete(restored));
    expect(done.sprint.tasks[0]?.outcome).toBe('done');
  });

  it('the next day the system marks it unresolved like any open selection', () => {
    const next = unwrap(
      startDay(
        removedWithOpenSelection(),
        { today: d('2026-09-29'), occurrences: [], newSelectionId: ids('x') },
        system,
      ),
    );
    expect(next.dailySelections[0]?.resolution).toBe('unresolved');
  });
});

describe('Today works on the active Sprint only', () => {
  it('rejects every action in review, and undo cannot rewrite the outcome', () => {
    const done = unwrap(complete(chosen())).sprint;
    const review: Sprint = { ...done, state: 'review' };
    expect(
      undoCompleteSelection(review, { ...sel, task: completeTaskOf() }, ctx),
    ).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    const open: Sprint = { ...chosen(), state: 'review' };
    expect(complete(open)).toMatchObject({ ok: false });
    expect(startSelection(open, sel, ctx)).toMatchObject({ ok: false });
    expect(removeFromToday(open, sel, ctx)).toMatchObject({ ok: false });
  });

  function completeTaskOf(): Task {
    return unwrap(completeTask(task1(), ctx));
  }
});

describe('F17: a selection closed earlier the same day can still be completed that day', () => {
  it.each([
    [
      'paused',
      (s: Sprint) =>
        unwrap(pauseSelection(unwrap(startSelection(s, sel, ctx)), sel, ctx)),
    ],
    ['deferred', (s: Sprint) => unwrap(deferSelection(s, sel, ctx))],
    ['removed', (s: Sprint) => unwrap(removeFromToday(s, sel, ctx))],
  ] as const)('%s → done the same day, not the next', (_, close) => {
    const closed = close(chosen());
    const done = unwrap(complete(closed, '2026-09-28'));
    expect(done.sprint.dailySelections[0]?.resolution).toBe('done');
    expect(done.task?.lifecycle).toBe('completed');
    expect(complete(close(chosen()), '2026-09-29')).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('from the Backlog too: the day’s closed selection becomes done (no second one)', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const result = completeFromBacklog(
      deferred,
      { task: task1(), date: d('2026-09-28'), selectionId: id('sel-b') },
      ctx,
    );
    const { sprint, task } = unwrap(result);
    expect(task.lifecycle).toBe('completed');
    expect(sprint.tasks[0]?.outcome).toBe('done');
    expect(sprint.dailySelections).toMatchObject([
      { id: 'sel-1', origin: 'manual', resolution: 'done' },
    ]);
  });

  it('a deferral completed that day no longer counts toward the run', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const done = unwrap(complete(deferred)).sprint;
    expect(deferralStreak([done], id('task-1'))).toBe(0);
  });
});

describe('F37: a deferral or removal can be undone the same day', () => {
  const today = { ...sel, today: d('2026-09-28') };

  it.each([
    [
      'deferred',
      deferSelection,
      undoDeferSelection,
      'todayDeferUndone',
    ] as const,
    [
      'removed',
      removeFromToday,
      undoRemoveFromToday,
      'todayRemoveUndone',
    ] as const,
  ])(
    'invariant 21: %s → selected, the same selection (no second one)',
    (_, close, undo, kind) => {
      const closed = unwrap(close(chosen(), sel, ctx));
      const result = undo(closed, today, ctx);
      const sprint = unwrap(result);
      expect(sprint.dailySelections).toHaveLength(1);
      expect(sprint.dailySelections[0]).toMatchObject({
        id: 'sel-1',
        resolution: 'selected',
      });
      expect(sprint.dailySelections[0]).not.toHaveProperty('resolvedAt');
      expect(result.ok && result.value.activities).toMatchObject([
        { kind, actor: 'user', selectionId: 'sel-1', date: '2026-09-28' },
      ]);
      // Still one per day: it cannot be chosen again beside it.
      expect(
        selectForToday(
          sprint,
          {
            selectionId: id('sel-2'),
            date: d('2026-09-28'),
            sprintTaskId: id('st-task-1'),
          },
          ctx,
        ),
      ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    },
  );

  it('a deferral after starting goes back to started, keeping its time', () => {
    const started = unwrap(startSelection(chosen(), sel, ctx));
    const deferred = unwrap(deferSelection(started, sel, ctx));
    const undone = unwrap(undoDeferSelection(deferred, today, ctx));
    expect(undone.dailySelections[0]).toMatchObject({
      resolution: 'started',
      startedAt: ctx.now,
    });
    expect(undone.dailySelections[0]).not.toHaveProperty('resolvedAt');
  });

  it('not the next day', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const removed = unwrap(removeFromToday(chosen(), sel, ctx));
    const tomorrow = { ...sel, today: d('2026-09-29') };
    expect(undoDeferSelection(deferred, tomorrow, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(undoRemoveFromToday(removed, tomorrow, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('only from its own state', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const paused = unwrap(
      pauseSelection(unwrap(startSelection(chosen(), sel, ctx)), sel, ctx),
    );
    for (const sprint of [chosen(), paused]) {
      expect(undoDeferSelection(sprint, today, ctx)).toMatchObject({
        ok: false,
        error: { code: 'invalidTransition' },
      });
      expect(undoRemoveFromToday(sprint, today, ctx)).toMatchObject({
        ok: false,
        error: { code: 'invalidTransition' },
      });
    }
    expect(undoRemoveFromToday(deferred, today, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('invariant 23: the run counts the state after the undo', () => {
    const monday = unwrap(deferSelection(chosen(), sel, ctx));
    const sel2 = { selectionId: id<'DailySelection'>('sel-2') };
    const tuesday = unwrap(
      deferSelection(
        unwrap(
          selectForToday(
            monday,
            {
              ...sel2,
              date: d('2026-09-29'),
              sprintTaskId: id('st-task-1'),
            },
            ctx,
          ),
        ),
        sel2,
        ctx,
      ),
    );
    expect(deferralStreak([tuesday], id('task-1'))).toBe(2);
    const undone = unwrap(
      undoDeferSelection(tuesday, { ...sel2, today: d('2026-09-29') }, ctx),
    );
    expect(deferralStreak([undone], id('task-1'))).toBe(1);
    // Monday's deferral is a past day's and stays.
    expect(
      undoDeferSelection(undone, { ...sel, today: d('2026-09-29') }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('after a completion is undone back to the deferral (F17), the deferral can be undone too', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const done = unwrap(complete(deferred));
    const back = unwrap(
      undoCompleteSelection(
        done.sprint,
        { ...sel, task: done.task as Task },
        ctx,
      ),
    );
    const undone = unwrap(undoDeferSelection(back.sprint, today, ctx));
    expect(undone.dailySelections[0]?.resolution).toBe('selected');
  });

  it('not in review', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    expect(
      undoDeferSelection({ ...deferred, state: 'review' }, today, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });
});

describe('invariant 27: a failed Backlog completion changes nothing', () => {
  it('a Task already completed, a day outside the Sprint, a recurring Task', () => {
    const sprint = active();
    const completed = unwrap(completeTask(task1(), ctx));
    expect(
      completeFromBacklog(
        sprint,
        { task: completed, date: d('2026-09-28'), selectionId: id('s') },
        ctx,
      ),
    ).toMatchObject({ ok: false });
    expect(
      completeFromBacklog(
        sprint,
        { task: task1(), date: d('2026-10-05'), selectionId: id('s') },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    const { task } = recurring();
    expect(
      completeFromBacklog(
        sprint,
        { task, date: d('2026-09-28'), selectionId: id('s') },
        ctx,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'recurringTaskCannotComplete' },
    });
  });
});

describe('invariant 26: a failed addition adds nothing', () => {
  it('a Task already in the Sprint is not added to today again', () => {
    const task = unwrap(updateTask(task1(), { areaId: workId }, ctx));
    expect(
      addToToday(
        active(),
        {
          sprintTaskId: id('st-other'),
          selectionId: id('sel-x'),
          date: d('2026-09-28'),
          task,
          areas: [research, work],
          via: 'today',
        },
        ctx,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('invariant 25 across the other commands', () => {
  it('complete, add, Backlog completion, startDay and skip leave Goals, criterion and hours', () => {
    const pick = (s: Sprint) => ({
      goals: s.goals,
      criterionUse: s.criterionUse,
      availableHours: s.availableHours,
      plannedAvailableHours: s.plannedAvailableHours,
    });
    const before = pick(active());
    const interview = unwrap(
      presentSuggestion(
        unwrap(updateTask(newTask('i', 'task-i'), { areaId: workId }, ctx)),
        { id: id('sug'), lo: 1, hi: 2, rationale: '', uncertainties: [] },
        ctx,
      ),
    );
    let sprint = unwrap(complete(chosen())).sprint;
    sprint = unwrap(
      addToToday(
        sprint,
        {
          sprintTaskId: id('st-i'),
          selectionId: id('sel-i'),
          date: d('2026-09-28'),
          task: interview,
          areas: [research, work],
          via: 'today',
        },
        ctx,
      ),
    );
    sprint = unwrap(
      completeFromBacklog(
        sprint,
        { task: interview, date: d('2026-09-28'), selectionId: id('sel-z') },
        ctx,
      ),
    ).sprint;
    expect(pick(sprint)).toEqual(before);

    const r = recurring();
    let rs = unwrap(
      startDay(
        r.sprint,
        {
          today: d('2026-09-28'),
          occurrences: r.occurrences,
          newSelectionId: ids('sel'),
        },
        system,
      ),
    );
    const [first] = r.occurrences;
    if (first === undefined) throw new Error('no occurrence');
    rs = unwrap(
      skipSelection(rs, { selectionId: id('sel-1'), occurrence: first }, ctx),
    ).sprint;
    expect(pick(rs)).toEqual(before);
  });
});

describe('recurring details', () => {
  it('F18: an occurrence of another day of the Sprint can be chosen (done early)', () => {
    const { sprint, occurrences } = recurring();
    const saturday = occurrences.find(
      (o) => o.scheduledDate === '2026-10-03',
    ) as Occurrence;
    const early = unwrap(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-early'),
          date: d('2026-10-02'),
          sprintTaskId: id('st-task-stretch'),
          occurrence: saturday,
        },
        ctx,
      ),
    );
    const done = unwrap(
      completeSelection(
        early,
        {
          selectionId: id('sel-early'),
          occurrence: saturday,
          today: d('2026-10-02'),
        },
        ctx,
      ),
    );
    // On Saturday it is already done, so it does not appear again.
    const sat = unwrap(
      startDay(
        done.sprint,
        {
          today: d('2026-10-03'),
          occurrences: occurrences.map((o) =>
            o.id === saturday.id ? (done.occurrence as Occurrence) : o,
          ),
          newSelectionId: ids('s'),
        },
        system,
      ),
    );
    expect(sat.dailySelections.filter((s) => s.date === '2026-10-03')).toEqual(
      [],
    );
  });

  it('undoing a recurring completion reopens the occurrence; the SprintTask stays planned', () => {
    const { sprint, occurrences } = recurring();
    const today = unwrap(
      startDay(
        sprint,
        { today: d('2026-09-28'), occurrences, newSelectionId: ids('sel') },
        system,
      ),
    );
    const [first] = occurrences;
    if (first === undefined) throw new Error('no occurrence');
    const done = unwrap(
      completeSelection(
        today,
        { selectionId: id('sel-1'), occurrence: first, today: d('2026-09-28') },
        ctx,
      ),
    );
    const undone = unwrap(
      undoCompleteSelection(
        done.sprint,
        { selectionId: id('sel-1'), occurrence: done.occurrence as Occurrence },
        ctx,
      ),
    );
    expect(undone.occurrence?.state).toBe('pending');
    expect(undone.sprint.tasks[0]?.outcome).toBe('planned');
    expect(undone.sprint.dailySelections[0]?.resolution).toBe('selected');
  });

  it('昨日の続き of a recurring Task names the paused occurrence', () => {
    const { sprint, occurrences } = recurring();
    const [first] = occurrences;
    if (first === undefined) throw new Error('no occurrence');
    let s = unwrap(
      selectForToday(
        sprint,
        {
          selectionId: id('sel-p'),
          date: d('2026-09-28'),
          sprintTaskId: id('st-task-stretch'),
          occurrence: first,
        },
        ctx,
      ),
    );
    s = unwrap(startSelection(s, { selectionId: id('sel-p') }, ctx));
    s = unwrap(pauseSelection(s, { selectionId: id('sel-p') }, ctx));
    expect(yesterdaysContinuation(s, [s], d('2026-09-29'))).toEqual([
      { sprintTask: s.tasks[0], occurrenceId: first.id },
    ]);
  });
});

describe('recordActualTime guards', () => {
  it('needs an active (or, F22, reviewed) Sprint, a day in it, and the right occurrence', () => {
    const input = {
      sprintTaskId: id<'SprintTask'>('st-task-1'),
      hours: 1,
      date: d('2026-09-29'),
    };
    expect(
      recordActualTime({ ...active(), state: 'closed' }, input, ctx),
    ).toMatchObject({ ok: false });
    expect(
      recordActualTime(active(), { ...input, date: d('2026-10-05') }, ctx),
    ).toMatchObject({ ok: false });
    expect(
      recordActualTime(active(), { ...input, occurrenceId: id('occ-x') }, ctx),
    ).toMatchObject({ ok: false });
    const { sprint } = recurring();
    expect(
      recordActualTime(
        sprint,
        {
          sprintTaskId: id('st-task-stretch'),
          hours: 1,
          date: d('2026-09-29'),
        },
        ctx,
      ),
    ).toMatchObject({ ok: false });
  });
});

describe('deferralStreak ordering', () => {
  it('orders selections of the same day and time by id', () => {
    const task = planned('task-1');
    const sprint = sprintFixture('2026-09-28', 'active', {
      tasks: [task],
      dailySelections: (['b-paused', 'a-deferred'] as const).map((name) => ({
        id: id<'DailySelection'>(name),
        date: d('2026-09-28'),
        sprintTaskId: task.id,
        occurrenceId: id<'Occurrence'>(`occ-${name}`),
        origin: 'manual' as const,
        resolution:
          name === 'b-paused' ? ('paused' as const) : ('deferred' as const),
        selectedAt: ctx.now,
      })),
    });
    // a-deferred comes first, b-paused last → the run is broken.
    expect(deferralStreak([sprint], id('task-1'))).toBe(0);
  });
});

describe('undo returns to where it was (F17, F19)', () => {
  it('F17: undoing a completion made after a deferral returns to the deferral', () => {
    const deferredAt = {
      now: instant('2026-09-28T01:00:00.000Z'),
      actor: 'user' as const,
    };
    const deferred = unwrap(deferSelection(chosen(), sel, deferredAt));
    const done = unwrap(complete(deferred));
    expect(done.sprint.dailySelections[0]).toMatchObject({
      resolution: 'done',
      closedBefore: { resolution: 'deferred', at: '2026-09-28T01:00:00.000Z' },
    });
    const undone = unwrap(
      undoCompleteSelection(
        done.sprint,
        { ...sel, task: done.task as Task },
        ctx,
      ),
    );
    const selection = undone.sprint.dailySelections[0];
    expect(selection).toMatchObject({
      resolution: 'deferred',
      resolvedAt: '2026-09-28T01:00:00.000Z',
    });
    expect(selection).not.toHaveProperty('closedBefore');
    expect(undone.task?.lifecycle).toBe('active');
    expect(undone.sprint.tasks[0]?.outcome).toBe('planned');
    // The deferral counts again.
    expect(deferralStreak([undone.sprint], id('task-1'))).toBe(1);
  });

  it('F19: undoing a skip returns the selection to selected and the occurrence to pending', () => {
    const { sprint, occurrences } = recurring();
    const today = unwrap(
      startDay(
        sprint,
        { today: d('2026-09-28'), occurrences, newSelectionId: ids('sel') },
        system,
      ),
    );
    const [first] = occurrences;
    if (first === undefined) throw new Error('no occurrence');
    const skipped = unwrap(
      skipSelection(
        today,
        { selectionId: id('sel-1'), occurrence: first },
        ctx,
      ),
    );
    const result = undoSkipSelection(
      skipped.sprint,
      {
        selectionId: id('sel-1'),
        occurrence: skipped.occurrence as Occurrence,
      },
      ctx,
    );
    const undone = unwrap(result);
    expect(undone.occurrence?.state).toBe('pending');
    expect(undone.sprint.dailySelections[0]?.resolution).toBe('selected');
    expect(undone.sprint.dailySelections[0]).not.toHaveProperty('resolvedAt');
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'occurrenceReopened',
      'todaySkipUndone',
    ]);
    // Only a skipped selection can be restored.
    expect(
      undoSkipSelection(
        undone.sprint,
        {
          selectionId: id('sel-1'),
          occurrence: undone.occurrence as Occurrence,
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });
});

describe('invariant 27 / F29: undoing a completion from the Backlog', () => {
  const date = d('2026-09-28');

  it('removes the selection the completion made, and reopens the Task and SprintTask', () => {
    const before = active();
    const done = unwrap(
      completeFromBacklog(
        before,
        { task: task1(), date, selectionId: id('sel-b') },
        ctx,
      ),
    );
    const result = undoCompleteFromBacklog(
      done.sprint,
      { task: done.task, date },
      ctx,
    );
    const undone = unwrap(result);
    expect(undone.task.lifecycle).toBe('active');
    expect(undone.sprint?.tasks[0]?.outcome).toBe('planned');
    expect(undone.sprint?.dailySelections).toEqual([]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'taskCompletionUndone',
      'sprintTaskDoneUndone',
      'todayBacklogCompletionUndone',
    ]);
  });

  it('puts a selection that was there before back as it was (F17)', () => {
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const done = unwrap(
      completeFromBacklog(
        deferred,
        { task: task1(), date, selectionId: id('sel-b') },
        ctx,
      ),
    );
    const undone = unwrap(
      undoCompleteFromBacklog(done.sprint, { task: done.task, date }, ctx),
    );
    expect(undone.task.lifecycle).toBe('active');
    expect(undone.sprint?.dailySelections).toMatchObject([
      { id: 'sel-1', origin: 'manual', resolution: 'deferred' },
    ]);
  });

  it('puts a selection chosen before back to selected', () => {
    const done = unwrap(
      completeFromBacklog(
        chosen(),
        { task: task1(), date, selectionId: id('sel-b') },
        ctx,
      ),
    );
    const result = undoCompleteFromBacklog(
      done.sprint,
      { task: done.task, date },
      ctx,
    );
    const undone = unwrap(result);
    expect(undone.sprint?.tasks[0]?.outcome).toBe('planned');
    expect(undone.sprint?.dailySelections).toMatchObject([
      { id: 'sel-1', origin: 'manual', resolution: 'selected' },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'taskCompletionUndone',
      'sprintTaskDoneUndone',
      'todayDoneUndone',
    ]);
  });

  it('reopens a Task outside the Sprint, and leaves the Sprint alone', () => {
    const sprint = active([]);
    const done = unwrap(
      completeFromBacklog(
        sprint,
        { task: task1(), date, selectionId: id('sel-b') },
        ctx,
      ),
    );
    const undone = unwrap(
      undoCompleteFromBacklog(done.sprint, { task: done.task, date }, ctx),
    );
    expect(undone.task.lifecycle).toBe('active');
    expect(undone.sprint).toBe(done.sprint);
    const noSprint = unwrap(
      undoCompleteFromBacklog(undefined, { task: done.task, date }, ctx),
    );
    expect(noSprint).not.toHaveProperty('sprint');
  });

  it('refuses a Task that is not completed, and a day with no completion', () => {
    expect(
      undoCompleteFromBacklog(undefined, { task: task1(), date }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
    const done = unwrap(
      completeFromBacklog(
        active(),
        { task: task1(), date, selectionId: id('sel-b') },
        ctx,
      ),
    );
    expect(
      undoCompleteFromBacklog(
        done.sprint,
        { task: done.task, date: d('2026-09-29') },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });
});
