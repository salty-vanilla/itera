import { describe, expect, it } from 'vitest';
import { presentSuggestion } from './estimate';
import { generateOccurrences, type Occurrence } from './occurrence';
import { createRecurrenceRule } from './recurrence';
import { id } from './shared/ids';
import { instant, localDate, timeZone } from './shared/time';
import type { Sprint, SprintTask } from './sprint';
import {
  addToToday,
  completeFromBacklog,
  undoCompleteFromBacklog,
  completeSelection,
  deferSelection,
  deleteInterrupt,
  editInterrupt,
  noteInterrupt,
  pauseSelection,
  recordActualTime,
  removeFromToday,
  restoreInterrupt,
  selectForToday,
  skipSelection,
  startDay,
  startSelection,
  undoCompleteSelection,
} from './today';
import { retroFacts } from './retro-facts';
import { updateTask, type Task } from './task';
import {
  at,
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

function chosen(
  sprint = active(),
  date = '2026-09-28',
  selId = 'sel-1',
): Sprint {
  return unwrap(
    selectForToday(
      sprint,
      { selectionId: id(selId), date: d(date), sprintTaskId: id('st-task-1') },
      ctx,
    ),
  );
}

const sel = { selectionId: id<'DailySelection'>('sel-1') };

describe('choosing for today', () => {
  it('invariant 21: one selection per day and SprintTask; another day is a new one', () => {
    const sprint = chosen();
    expect(sprint.dailySelections).toEqual([
      {
        id: 'sel-1',
        date: '2026-09-28',
        sprintTaskId: 'st-task-1',
        origin: 'manual',
        resolution: 'selected',
        selectedAt: ctx.now,
      },
    ]);
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
    expect(chosen(sprint, '2026-09-29', 'sel-2').dailySelections).toHaveLength(
      2,
    );
  });

  it('only planned SprintTasks, on days of the active Sprint', () => {
    const done = active([planned('task-1', { outcome: 'done' })]);
    expect(
      selectForToday(
        done,
        {
          selectionId: id('s'),
          date: d('2026-09-28'),
          sprintTaskId: id('st-task-1'),
        },
        ctx,
      ),
    ).toMatchObject({ ok: false });
    expect(
      selectForToday(
        active(),
        {
          selectionId: id('s'),
          date: d('2026-10-05'),
          sprintTaskId: id('st-task-1'),
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});

describe('the day’s actions', () => {
  it('start, then 今日はここまで with optional actual time', () => {
    let sprint = unwrap(
      startSelection(chosen(), sel, at('2026-09-28T01:00:00.000Z')),
    );
    expect(sprint.dailySelections[0]).toMatchObject({
      resolution: 'started',
      startedAt: '2026-09-28T01:00:00.000Z',
    });
    const paused = pauseSelection(
      sprint,
      { ...sel, actualHours: 4.5 },
      at('2026-09-28T06:00:00.000Z'),
    );
    sprint = unwrap(paused);
    expect(sprint.dailySelections[0]).toMatchObject({
      resolution: 'paused',
      startedAt: '2026-09-28T01:00:00.000Z',
      resolvedAt: '2026-09-28T06:00:00.000Z',
    });
    expect(sprint.actualTimes).toEqual([
      {
        sprintTaskId: 'st-task-1',
        hours: 4.5,
        date: '2026-09-28',
        via: 'pause',
        recordedAt: '2026-09-28T06:00:00.000Z',
      },
    ]);
    expect(paused.ok && paused.value.activities.map((a) => a.kind)).toEqual([
      'todayPaused',
      'actualTimeRecorded',
    ]);
  });

  it('invariant 22: paused, deferred and removed leave the SprintTask planned', () => {
    const paused = unwrap(
      pauseSelection(unwrap(startSelection(chosen(), sel, ctx)), sel, ctx),
    );
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    const removed = unwrap(removeFromToday(chosen(), sel, ctx));
    for (const sprint of [paused, deferred, removed]) {
      expect(sprint.tasks[0]?.outcome).toBe('planned');
    }
    expect(deferred.dailySelections[0]?.resolution).toBe('deferred');
    expect(removed.dailySelections[0]?.resolution).toBe('removed');
  });

  it('rejects transitions the state diagram does not have', () => {
    const started = unwrap(startSelection(chosen(), sel, ctx));
    expect(removeFromToday(started, sel, ctx)).toMatchObject({ ok: false }); // Started → Removed
    expect(pauseSelection(chosen(), sel, ctx)).toMatchObject({ ok: false }); // Selected → Paused
    const deferred = unwrap(deferSelection(chosen(), sel, ctx));
    expect(startSelection(deferred, sel, ctx)).toMatchObject({ ok: false });
    expect(
      skipSelection(chosen(), { ...sel, occurrence: {} as Occurrence }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } }); // not recurring
  });

  it('invariant 28: actual time is optional and never a condition', () => {
    const task = newTask('x', 'task-1');
    const result = unwrap(
      completeSelection(
        chosen(),
        { ...sel, task, today: d('2026-09-28') },
        ctx,
      ),
    );
    expect(result.sprint.actualTimes).toEqual([]);
    expect(
      pauseSelection(unwrap(startSelection(chosen(), sel, ctx)), sel, ctx),
    ).toMatchObject({
      ok: true,
    });
    expect(
      pauseSelection(
        unwrap(startSelection(chosen(), sel, ctx)),
        { ...sel, actualHours: 0 },
        ctx,
      ),
    ).toMatchObject({
      ok: false,
    });
  });

  it('completing a non-recurring Task completes it and its SprintTask; undo returns both', () => {
    const task = newTask('x', 'task-1');
    const done = completeSelection(
      chosen(),
      { ...sel, task, actualHours: 1, today: d('2026-09-28') },
      ctx,
    );
    const record = unwrap(done);
    expect(record.task?.lifecycle).toBe('completed');
    expect(record.sprint.tasks[0]?.outcome).toBe('done');
    expect(record.sprint.dailySelections[0]?.resolution).toBe('done');
    expect(record.sprint.actualTimes[0]?.via).toBe('completion');
    expect(done.ok && done.value.activities.map((a) => a.kind)).toEqual([
      'taskCompleted',
      'sprintTaskDone',
      'todayDone',
      'actualTimeRecorded',
    ]);

    const undone = unwrap(
      undoCompleteSelection(
        record.sprint,
        { ...sel, task: record.task as Task },
        ctx,
      ),
    );
    expect(undone.task?.lifecycle).toBe('active');
    expect(undone.sprint.tasks[0]?.outcome).toBe('planned');
    expect(undone.sprint.dailySelections[0]).not.toHaveProperty('resolvedAt');
    expect(undone.sprint.dailySelections[0]?.resolution).toBe('selected');
    expect(undone.sprint.actualTimes).toHaveLength(1);
  });
});

describe('recurring occurrences in Today', () => {
  function recurringSprint() {
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
    // 9/30 was left out in Planning.
    const included = occurrences.filter(
      (o) => o.scheduledDate !== '2026-09-30',
    );
    const sprint = active([
      planned('task-stretch', {
        goalLink: 'unlinked',
        occurrenceIds: included.map((o) => o.id),
      }),
    ]);
    return { task, sprint, occurrences: included };
  }

  it('startDay: today’s included occurrences appear in Today, by the system only', () => {
    const { sprint, occurrences } = recurringSprint();
    expect(
      startDay(
        sprint,
        { today: d('2026-09-29'), occurrences, newSelectionId: ids('sel') },
        ctx,
      ),
    ).toMatchObject({ ok: false });
    const started = startDay(
      sprint,
      { today: d('2026-09-29'), occurrences, newSelectionId: ids('sel') },
      system,
    );
    const next = unwrap(started);
    expect(next.dailySelections).toEqual([
      {
        id: 'sel-1',
        date: '2026-09-29',
        sprintTaskId: 'st-task-stretch',
        occurrenceId: 'occ-2',
        origin: 'recurringToday',
        resolution: 'selected',
        selectedAt: system.now,
      },
    ]);
    expect(started.ok && started.value.activities[0]?.actor).toBe('system');
    // Repeating it changes nothing.
    const again = startDay(
      next,
      { today: d('2026-09-29'), occurrences, newSelectionId: ids('x') },
      system,
    );
    expect(unwrap(again)).toEqual(next);
    // 9/30 was excluded in Planning, so nothing appears that day.
    const sep30 = unwrap(
      startDay(
        next,
        { today: d('2026-09-30'), occurrences, newSelectionId: ids('y') },
        system,
      ),
    );
    expect(
      sep30.dailySelections.filter((s) => s.date === '2026-09-30'),
    ).toEqual([]);
  });

  it('invariants 24 and 22: at the next day the open selection becomes unresolved; nothing else is chosen', () => {
    const { sprint, occurrences } = recurringSprint();
    const day1 = unwrap(
      startDay(
        sprint,
        { today: d('2026-09-28'), occurrences, newSelectionId: ids('a') },
        system,
      ),
    );
    const day2 = unwrap(
      startDay(
        day1,
        { today: d('2026-09-29'), occurrences, newSelectionId: ids('b') },
        system,
      ),
    );
    expect(
      day2.dailySelections.map((s) => [s.date, s.resolution, s.origin]),
    ).toEqual([
      ['2026-09-28', 'unresolved', 'recurringToday'],
      ['2026-09-29', 'selected', 'recurringToday'],
    ]);
  });

  it('invariant 30: completing and skipping go to the occurrence; the SprintTask stays planned', () => {
    const { sprint, occurrences } = recurringSprint();
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
        { ...sel, occurrence: first, today: d('2026-09-28') },
        ctx,
      ),
    );
    expect(done.occurrence?.state).toBe('done');
    expect(done.sprint.tasks[0]?.outcome).toBe('planned');
    expect(done).not.toHaveProperty('task');

    const skipped = unwrap(
      skipSelection(today, { ...sel, occurrence: first }, ctx),
    );
    expect(skipped.occurrence?.state).toBe('skipped');
    expect(skipped.sprint.dailySelections[0]?.resolution).toBe('skipped');
  });

  it('a recurring SprintTask needs an occurrence to be chosen', () => {
    const { sprint } = recurringSprint();
    expect(
      selectForToday(
        sprint,
        {
          selectionId: id('s'),
          date: d('2026-09-28'),
          sprintTaskId: id('st-task-stretch'),
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });
});

describe('invariant 26: adding a Task from outside the Sprint to today', () => {
  function interview(): Task {
    const task = unwrap(
      updateTask(
        newTask('顧客インタビューの設計', 'task-interview'),
        { areaId: workId },
        ctx,
      ),
    );
    return unwrap(
      presentSuggestion(
        task,
        { id: id('sug-i'), lo: 2, hi: 3, rationale: '', uncertainties: [] },
        ctx,
      ),
    );
  }

  it('creates the SprintTask and the selection together', () => {
    const result = addToToday(
      active([]),
      {
        sprintTaskId: id('st-interview'),
        selectionId: id('sel-i'),
        date: d('2026-09-30'),
        task: interview(),
        areas: [research, work],
        via: 'backlogToToday',
      },
      ctx,
    );
    const sprint = unwrap(result);
    expect(sprint.tasks).toMatchObject([
      {
        id: 'st-interview',
        origin: 'midSprint',
        goalLink: 'unlinked',
        outcome: 'planned',
      },
    ]);
    expect(sprint.dailySelections).toMatchObject([
      {
        id: 'sel-i',
        sprintTaskId: 'st-interview',
        origin: 'midSprint',
        resolution: 'selected',
      },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'sprintTaskAdded',
      'todaySelected',
    ]);
  });

  it('when either half fails, nothing is added', () => {
    const outOfPeriod = addToToday(
      active([]),
      {
        sprintTaskId: id('st-interview'),
        selectionId: id('sel-i'),
        date: d('2026-10-05'),
        task: interview(),
        areas: [research, work],
        via: 'today',
      },
      ctx,
    );
    expect(outOfPeriod).toMatchObject({ ok: false });
  });
});

describe('invariant 27: completing from the Backlog', () => {
  const task = () => newTask('x', 'task-1');
  const input = {
    date: d('2026-09-28'),
    selectionId: id<'DailySelection'>('sel-b'),
  };

  it('completes Task, SprintTask and a done selection together', () => {
    const result = completeFromBacklog(
      active(),
      { ...input, task: task() },
      ctx,
    );
    const { sprint, task: completed } = unwrap(result);
    expect(completed.lifecycle).toBe('completed');
    expect(sprint.tasks[0]?.outcome).toBe('done');
    expect(sprint.dailySelections).toEqual([
      {
        id: 'sel-b',
        date: '2026-09-28',
        sprintTaskId: 'st-task-1',
        origin: 'backlogCompletion',
        resolution: 'done',
        selectedAt: ctx.now,
        resolvedAt: ctx.now,
      },
    ]);
  });

  it('completes today’s open selection instead of adding a second one', () => {
    const { sprint } = unwrap(
      completeFromBacklog(chosen(), { ...input, task: task() }, ctx),
    );
    expect(sprint.dailySelections).toMatchObject([
      { id: 'sel-1', origin: 'manual', resolution: 'done' },
    ]);
  });

  it('before the first day, completes Task and SprintTask without a selection (F34)', () => {
    const sunday = { ...input, date: d('2026-09-27') };
    const { sprint, task: completed } = unwrap(
      completeFromBacklog(active(), { ...sunday, task: task() }, ctx),
    );
    expect(completed.lifecycle).toBe('completed');
    expect(sprint.tasks[0]?.outcome).toBe('done');
    expect(sprint.dailySelections).toEqual([]);

    // Undone right after, as the Backlog does (F29): back to planned.
    const undone = unwrap(
      undoCompleteFromBacklog(
        sprint,
        { task: completed, date: d('2026-09-27') },
        ctx,
      ),
    );
    expect(undone.task.lifecycle).toBe('active');
    expect(undone.sprint?.tasks[0]?.outcome).toBe('planned');
    expect(undone.sprint?.dailySelections).toEqual([]);
  });

  it('a Task outside the Sprint only completes', () => {
    const outside = newTask('y', 'task-outside');
    const result = unwrap(
      completeFromBacklog(active(), { ...input, task: outside }, ctx),
    );
    expect(result.task.lifecycle).toBe('completed');
    expect(result.sprint).toEqual(active());
  });
});

describe('records', () => {
  it('actual time can be added later, append-only', () => {
    const sprint = unwrap(
      recordActualTime(
        active(),
        { sprintTaskId: id('st-task-1'), hours: 2, date: d('2026-09-29') },
        ctx,
      ),
    );
    expect(sprint.actualTimes).toMatchObject([{ hours: 2, via: 'later' }]);
  });

  it('invariant 29: an interrupt is a note, not a Task or an addition', () => {
    const result = noteInterrupt(
      active(),
      { id: id('int-1'), text: '急な会議', minutes: 30 },
      ctx,
    );
    const sprint = unwrap(result);
    expect(sprint.interrupts).toEqual([
      { id: 'int-1', at: ctx.now, text: '急な会議', minutes: 30 },
    ]);
    expect(sprint.tasks).toEqual(active().tasks);
    expect(
      noteInterrupt(active(), { id: id('int-2'), text: ' ' }, ctx),
    ).toMatchObject({ ok: false });
  });
});

describe('F38: interrupts can be edited and deleted while the Sprint runs', () => {
  const noted = (): Sprint =>
    unwrap(
      noteInterrupt(
        unwrap(
          noteInterrupt(
            active(),
            { id: id('int-1'), text: '急な会議', minutes: 30 },
            at('2026-09-28T01:00:00.000Z'),
          ),
        ),
        { id: id('int-2'), text: '問い合わせ' },
        at('2026-09-28T03:00:00.000Z'),
      ),
    );
  const later = at('2026-09-28T05:00:00.000Z');
  const review = (sprint: Sprint): Sprint => ({ ...sprint, state: 'review' });
  /** What a restore knows of the person: no other Sprint's notes, Tokyo. */
  const person = { otherNoteIds: [], timeZone: timeZone('Asia/Tokyo') };

  it('edits the note and minutes, keeps the time, and leaves an Activity', () => {
    const result = editInterrupt(
      noted(),
      { id: id('int-2'), text: ' 障害の問い合わせ ', minutes: 45 },
      later,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        activities: [
          {
            kind: 'interruptEdited',
            at: later.now,
            actor: 'user',
            interruptId: 'int-2',
          },
        ],
      },
    });
    expect(unwrap(result).interrupts).toEqual([
      {
        id: 'int-1',
        at: instant('2026-09-28T01:00:00.000Z'),
        text: '急な会議',
        minutes: 30,
      },
      {
        id: 'int-2',
        at: instant('2026-09-28T03:00:00.000Z'),
        text: '障害の問い合わせ',
        minutes: 45,
      },
    ]);
  });

  it('clears the minutes when none are given', () => {
    const sprint = unwrap(
      editInterrupt(noted(), { id: id('int-1'), text: '急な会議' }, later),
    );
    expect(sprint.interrupts[0]).toEqual({
      id: 'int-1',
      at: instant('2026-09-28T01:00:00.000Z'),
      text: '急な会議',
    });
  });

  it('records nothing when nothing changed', () => {
    const result = editInterrupt(
      noted(),
      { id: id('int-1'), text: '急な会議', minutes: 30 },
      later,
    );
    expect(result).toMatchObject({ ok: true, value: { activities: [] } });
  });

  it('rejects an empty note, non-positive minutes and an unknown note', () => {
    expect(
      editInterrupt(noted(), { id: id('int-1'), text: ' ' }, later),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    expect(
      editInterrupt(noted(), { id: id('int-1'), text: 'x', minutes: 0 }, later),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    expect(
      editInterrupt(noted(), { id: id('int-9'), text: 'x' }, later),
    ).toMatchObject({ ok: false, error: { code: 'notFound' } });
    expect(deleteInterrupt(noted(), { id: id('int-9') }, later)).toMatchObject({
      ok: false,
      error: { code: 'notFound' },
    });
  });

  it('deletes a note, leaving an Activity, and it leaves the Retro facts', () => {
    const result = deleteInterrupt(noted(), { id: id('int-1') }, later);
    expect(result).toMatchObject({
      ok: true,
      value: {
        activities: [
          { kind: 'interruptDeleted', at: later.now, interruptId: 'int-1' },
        ],
      },
    });
    const sprint = unwrap(result);
    expect(sprint.interrupts.map((n) => n.id)).toEqual(['int-2']);
    const facts = retroFacts(review(sprint), {
      tasks: [newTask()],
      areas: [research, work],
      occurrences: [],
      sprints: [],
    });
    expect(facts.interrupts.map((n) => n.id)).toEqual(['int-2']);
  });

  it('an edit shows in the Retro facts', () => {
    const sprint = unwrap(
      editInterrupt(noted(), { id: id('int-1'), text: '臨時の会議' }, later),
    );
    const facts = retroFacts(review(sprint), {
      tasks: [newTask()],
      areas: [research, work],
      occurrences: [],
      sprints: [],
    });
    expect(facts.interrupts[0]).toMatchObject({ text: '臨時の会議' });
  });

  it('restores a deleted note in its place with its time', () => {
    const before = noted();
    const note = before.interrupts[0];
    if (note === undefined) throw new Error('no note');
    const deleted = unwrap(deleteInterrupt(before, { id: note.id }, later));
    const result = restoreInterrupt(deleted, { note, ...person }, later);
    expect(result).toMatchObject({
      ok: true,
      value: {
        activities: [{ kind: 'interruptRestored', interruptId: 'int-1' }],
      },
    });
    expect(unwrap(result).interrupts).toEqual(before.interrupts);
    expect(restoreInterrupt(before, { note, ...person }, later)).toMatchObject({
      ok: false,
    });
    expect(
      restoreInterrupt(
        deleted,
        {
          note: { ...note, at: instant('2026-09-28T06:00:00.000Z') },
          ...person,
        },
        later,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('does not restore a note whose ID is another Sprint’s note', () => {
    const before = noted();
    const note = before.interrupts[0];
    if (note === undefined) throw new Error('no note');
    const deleted = unwrap(deleteInterrupt(before, { id: note.id }, later));
    expect(
      restoreInterrupt(
        deleted,
        { note, ...person, otherNoteIds: [id('int-9'), note.id] },
        later,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    expect(
      restoreInterrupt(
        deleted,
        { note, ...person, otherNoteIds: [id('int-9')] },
        later,
      ),
    ).toMatchObject({ ok: true });
  });

  it('restores a note only if it was noted on a day of the Sprint, in the person’s time zone', () => {
    const before = noted();
    const note = before.interrupts[0];
    if (note === undefined) throw new Error('no note');
    const deleted = unwrap(deleteInterrupt(before, { id: note.id }, later));
    const end = at('2026-10-10T00:00:00.000Z');
    const restoredAt = (when: string, now = later) =>
      restoreInterrupt(
        deleted,
        { note: { ...note, at: instant(when) }, ...person },
        now,
      );
    const refused = { ok: false, error: { code: 'invalidInput' } };
    // The Sprint is 9/28–10/4 (Tokyo): its first and last minutes are in.
    expect(restoredAt('2026-09-27T14:59:59.999Z')).toMatchObject(refused);
    expect(restoredAt('2026-09-27T15:00:00.000Z')).toMatchObject({ ok: true });
    expect(restoredAt('2026-10-04T14:59:59.999Z', end)).toMatchObject({
      ok: true,
    });
    expect(restoredAt('2026-10-04T15:00:00.000Z', end)).toMatchObject(refused);
    // 9/27 20:00 UTC is 9/28 in Tokyo, and 9/27 in UTC.
    const utc = restoreInterrupt(
      deleted,
      {
        note: { ...note, at: instant('2026-09-27T20:00:00.000Z') },
        ...person,
        timeZone: timeZone('UTC'),
      },
      later,
    );
    expect(utc).toMatchObject(refused);
    expect(restoredAt('2026-09-27T20:00:00.000Z')).toMatchObject({ ok: true });
  });

  it('invariant 40: after the Review starts the notes are fixed', () => {
    const fixed = review(noted());
    const note = fixed.interrupts[0];
    if (note === undefined) throw new Error('no note');
    for (const result of [
      editInterrupt(fixed, { id: note.id, text: 'x' }, later),
      deleteInterrupt(fixed, { id: note.id }, later),
      restoreInterrupt(
        { ...fixed, interrupts: fixed.interrupts.slice(1) },
        { note, ...person },
        later,
      ),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'invalidTransition' },
      });
    }
  });
});

describe('invariant 25: Today never changes Goals, criterion or available hours', () => {
  it('holds across the day’s commands', () => {
    const before = active();
    const pick = (s: Sprint) => ({
      goals: s.goals,
      criterionUse: s.criterionUse,
      availableHours: s.availableHours,
      plannedAvailableHours: s.plannedAvailableHours,
    });
    let sprint = chosen(before);
    sprint = unwrap(startSelection(sprint, sel, ctx));
    sprint = unwrap(pauseSelection(sprint, { ...sel, actualHours: 1 }, ctx));
    sprint = unwrap(noteInterrupt(sprint, { id: id('i'), text: 'x' }, ctx));
    expect(pick(sprint)).toEqual(pick(before));
  });
});
