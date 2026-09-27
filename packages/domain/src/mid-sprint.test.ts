import { describe, expect, it } from 'vitest';
import { renameArea } from './area';
import { presentSuggestion } from './estimate';
import {
  addOccurrenceMidSprint,
  addTaskMidSprint,
  noteAreaInSprint,
  removeFromSprint,
  restoreToSprint,
} from './mid-sprint';
import {
  completeOccurrence,
  excludeOccurrence,
  generateOccurrences,
} from './occurrence';
import type { ActiveCriterion } from './planning';
import { createRecurrenceRule } from './recurrence';
import { id, type AreaId } from './shared/ids';
import { localDate } from './shared/time';
import { sprintAreaName, type Sprint, type SprintTask } from './sprint';
import { updateTask, type Task } from './task';
import {
  ctx,
  ids,
  newTask,
  research,
  researchId,
  sprintFixture,
  unwrap,
  userId,
  work,
  workId,
} from './testing';

const d = localDate;
const criterion: ActiveCriterion = {
  id: id('criterion-1'),
  policy: { scope: { kind: 'area', areaId: researchId }, rangePolicy: 'hi' },
};

function withSuggestion(
  areaId: AreaId,
  lo: number,
  hi: number,
  taskId: string,
): Task {
  const task = unwrap(updateTask(newTask(taskId, taskId), { areaId }, ctx));
  return unwrap(
    presentSuggestion(
      task,
      { id: id(`sug-${taskId}`), lo, hi, rationale: '', uncertainties: [] },
      ctx,
    ),
  );
}

function activeSprint(appliedAtConfirm: boolean): Sprint {
  return sprintFixture('2026-09-28', 'active', {
    confirmedAt: ctx.now,
    areaSnapshot: [
      { areaId: workId, name: '仕事', order: 0 },
      { areaId: researchId, name: '研究', order: 1 },
    ],
    criterionUse: { criterionId: criterion.id, appliedAtConfirm },
  });
}

function add(
  sprint: Sprint,
  task: Task,
  extra: { criterion?: ActiveCriterion } = {},
) {
  return addTaskMidSprint(
    sprint,
    {
      sprintTaskId: id(`st-${task.id}`),
      task,
      areas: [research, work],
      via: 'backlogToToday',
      ...extra,
    },
    ctx,
  );
}

describe('addTaskMidSprint', () => {
  it('invariants 15–17: planned at once, unlinked, origin midSprint, snapshot at addition', () => {
    const task = withSuggestion(workId, 2, 3, 'task-interview');
    const result = add(activeSprint(true), task, { criterion });
    expect(unwrap(result).tasks).toEqual([
      {
        id: 'st-task-interview',
        taskId: 'task-interview',
        origin: 'midSprint',
        addedAt: ctx.now,
        goalLink: 'unlinked',
        outcome: 'planned',
        planSnapshot: {
          value: {
            base: 'suggestion',
            lo: 2,
            hi: 3,
            criterionApplied: false,
            computedAt: ctx.now,
          },
          timeBasis: 'task',
          suggestion: { id: 'sug-task-interview', lo: 2, hi: 3 },
        },
      },
    ]);
    expect(result.ok && result.value.activities[0]).toMatchObject({
      kind: 'sprintTaskAdded',
      via: 'backlogToToday',
    });
  });

  it('F3: the criterion applies to an addition only if the Sprint applied it at confirm', () => {
    const paper = withSuggestion(researchId, 3, 5, 'task-paper');
    const applied = unwrap(add(activeSprint(true), paper, { criterion }));
    expect(applied.tasks[0]?.planSnapshot?.value).toMatchObject({
      lo: 5,
      hi: 5,
      criterionApplied: true,
    });
    const notApplied = unwrap(add(activeSprint(false), paper, { criterion }));
    expect(notApplied.tasks[0]?.planSnapshot?.value).toMatchObject({
      lo: 3,
      hi: 5,
      criterionApplied: false,
    });
    // An applied Sprint needs its criterion to value the addition.
    expect(add(activeSprint(true), paper)).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });

  it('invariant 14: a Task already in the Sprint (even removed) is not added again', () => {
    const task = withSuggestion(workId, 2, 3, 'task-interview');
    const added = unwrap(add(activeSprint(false), task));
    expect(add(added, task)).toMatchObject({ ok: false });
    const removed = unwrap(
      removeFromSprint(
        added,
        { sprintTaskId: id('st-task-interview'), occurrences: [] },
        ctx,
      ),
    ).sprint;
    // A removed Task comes back with restoreToSprint (F13), not as a second one.
    expect(add(removed, task)).toMatchObject({ ok: false });
  });

  it('needs an active Sprint', () => {
    const task = withSuggestion(workId, 2, 3, 'task-interview');
    expect(add(sprintFixture('2026-09-28', 'planning'), task)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });
});

describe('removeFromSprint and restoreToSprint', () => {
  it('planned → removed → planned (F13): the same record, origin and snapshot', () => {
    const task = withSuggestion(workId, 2, 3, 'task-interview');
    const sprint = unwrap(add(activeSprint(false), task));
    const input = {
      sprintTaskId: id<'SprintTask'>('st-task-interview'),
      occurrences: [],
    };
    const removed = removeFromSprint(sprint, input, ctx);
    expect(unwrap(removed).sprint.tasks.map((t) => t.outcome)).toEqual([
      'removed',
    ]);
    expect(removed.ok && removed.value.activities[0]?.kind).toBe(
      'sprintTaskRemoved',
    );
    expect(removeFromSprint(unwrap(removed).sprint, input, ctx)).toMatchObject({
      ok: false,
    });

    const restored = restoreToSprint(unwrap(removed).sprint, input, ctx);
    const back = unwrap(restored).sprint.tasks[0];
    expect(back).toEqual({ ...sprint.tasks[0], outcome: 'planned' });
    expect(restored.ok && restored.value.activities[0]?.kind).toBe(
      'sprintTaskRestored',
    );
    expect(restoreToSprint(sprint, input, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('F14: removing a recurring Task excludes its pending occurrences; restoring brings them back', () => {
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
    const generated = unwrap(
      generateOccurrences(
        rule,
        {
          start: d('2026-09-28'),
          end: d('2026-09-30'),
          existing: [],
          newOccurrenceId: ids('occ'),
        },
        ctx,
      ),
    );
    const [first, ...rest] = generated;
    if (first === undefined) throw new Error('no occurrence');
    const done = unwrap(completeOccurrence(first, ctx));
    const sprint = sprintFixture('2026-09-28', 'active', {
      tasks: [
        {
          id: id('st-stretch'),
          taskId: task.id,
          occurrenceIds: generated.map((o) => o.id),
          origin: 'planning',
          addedAt: ctx.now,
          goalLink: 'unlinked',
          outcome: 'planned',
        },
      ],
    });
    const occurrences = [done, ...rest];
    const removed = unwrap(
      removeFromSprint(
        sprint,
        { sprintTaskId: id('st-stretch'), occurrences },
        ctx,
      ),
    );
    // The done one stays done; only the pending ones are left out.
    expect(removed.occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-09-29', 'excluded'],
      ['2026-09-30', 'excluded'],
    ]);

    const restored = unwrap(
      restoreToSprint(
        removed.sprint,
        {
          sprintTaskId: id('st-stretch'),
          occurrences: [done, ...removed.occurrences],
        },
        ctx,
      ),
    );
    expect(restored.occurrences.map((o) => o.state)).toEqual([
      'pending',
      'pending',
    ]);
    expect(restored.sprint.tasks[0]?.outcome).toBe('planned');
  });
});

describe('F9: an Area new to a confirmed Sprint', () => {
  const hobby = {
    id: id<'Area'>('area-hobby'),
    userId,
    name: '趣味',
    color: 3 as const,
    order: 2,
    archived: false,
  };

  it('is appended with its name at that moment, then fixed', () => {
    const task = unwrap(
      updateTask(newTask('ギター', 'task-guitar'), { areaId: hobby.id }, ctx),
    );
    const result = addTaskMidSprint(
      activeSprint(false),
      {
        sprintTaskId: id('st-guitar'),
        task,
        areas: [research, work, hobby],
        via: 'backlog',
      },
      ctx,
    );
    const sprint = unwrap(result);
    expect(sprint.areaSnapshot.at(-1)).toEqual({
      areaId: 'area-hobby',
      name: '趣味',
      order: 3,
    });
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'sprintTaskAdded',
      'areaSnapshotAdded',
    ]);
    const renamed = unwrap(renameArea(hobby, '音楽', ctx));
    expect(sprintAreaName(sprint, hobby.id, [renamed])).toBe('趣味');
  });

  it('only while the Sprint is active, and only for a known Area', () => {
    const inReview = { ...activeSprint(false), state: 'review' as const };
    const result = noteAreaInSprint(inReview, hobby.id, [hobby], ctx);
    expect(unwrap(result)).toBe(inReview);
    expect(
      noteAreaInSprint(activeSprint(false), hobby.id, [], ctx),
    ).toMatchObject({
      ok: false,
      error: { code: 'notFound' },
    });
  });

  it('also when a Task in the Sprint moves to a new Area', () => {
    const noted = noteAreaInSprint(activeSprint(false), hobby.id, [hobby], ctx);
    expect(unwrap(noted).areaSnapshot.map((e) => e.name)).toEqual([
      '仕事',
      '研究',
      '趣味',
    ]);
    const again = noteAreaInSprint(unwrap(noted), hobby.id, [hobby], ctx);
    expect(again.ok && again.value.activities).toEqual([]);
  });
});

describe('addOccurrenceMidSprint', () => {
  it('brings an excluded occurrence back in its own mid-Sprint SprintTask', () => {
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
    const [occurrence] = unwrap(
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
    if (occurrence === undefined) throw new Error('no occurrence');
    const excluded = unwrap(excludeOccurrence(occurrence, ctx));
    const result = unwrap(
      addOccurrenceMidSprint(
        activeSprint(false),
        {
          sprintTaskId: id('st-clean'),
          task,
          occurrence: excluded,
          areas: [research, work],
        },
        ctx,
      ),
    );
    expect(result.occurrence.state).toBe('pending');
    expect(result.sprint.tasks[0]).toMatchObject<Partial<SprintTask>>({
      occurrenceIds: [occurrence.id],
      origin: 'midSprint',
      goalLink: 'unlinked',
      outcome: 'planned',
    });
    expect(result.sprint.tasks[0]?.planSnapshot?.occurrenceCount).toBe(1);
  });
});
