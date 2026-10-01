import { describe, expect, it } from 'vitest';
import {
  backlogView,
  carryOriginOf,
  carryOverOf,
  dueSoonUntil,
  inBacklogSlice,
} from './backlog';
import type { SprintTask } from './sprint';
import { id, type AreaId } from './shared/ids';
import { archiveTask, completeTask, createTask, updateTask } from './task';
import { localDate } from './shared/time';
import { at, ctx, sprintFixture, unwrap, user, userId } from './testing';

const research = id('area-research') as AreaId;

function task(taskId: string, createdAt: string) {
  return unwrap(
    createTask(
      { id: id(taskId), userId, title: taskId, via: 'backlog' },
      at(createdAt),
    ),
  );
}

describe('backlogView', () => {
  it('invariant 2: shows only active Tasks', () => {
    const active = task('a', '2026-09-28T00:00:00.000Z');
    const completed = unwrap(
      completeTask(task('b', '2026-09-28T00:01:00.000Z'), ctx),
    );
    const archived = unwrap(
      archiveTask(task('c', '2026-09-28T00:02:00.000Z'), ctx),
    );
    expect(backlogView([completed, archived, active]).map((t) => t.id)).toEqual(
      ['a'],
    );
  });

  it('invariant 5: priority is not the default order; creation order is', () => {
    const low = unwrap(
      updateTask(
        task('first', '2026-09-28T00:00:00.000Z'),
        { priority: 'low' },
        ctx,
      ),
    );
    const high = unwrap(
      updateTask(
        task('second', '2026-09-28T00:05:00.000Z'),
        { priority: 'high' },
        ctx,
      ),
    );
    expect(backlogView([high, low]).map((t) => t.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('filters by Area and by "no Area"', () => {
    const inResearch = unwrap(
      updateTask(
        task('r', '2026-09-28T00:00:00.000Z'),
        { areaId: research },
        ctx,
      ),
    );
    const noArea = task('n', '2026-09-28T00:01:00.000Z');
    expect(
      backlogView([inResearch, noArea], { area: research }).map((t) => t.id),
    ).toEqual(['r']);
    expect(
      backlogView([inResearch, noArea], { area: 'none' }).map((t) => t.id),
    ).toEqual(['n']);
  });

  it('does not reorder the array it is given', () => {
    const tasks = Object.freeze([
      task('b', '2026-09-28T00:01:00.000Z'),
      task('a', '2026-09-28T00:00:00.000Z'),
    ]);
    backlogView(tasks);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('carryOverOf (F26)', () => {
  const taskId = id<'Task'>('task-1');
  const st = (
    stId: string,
    outcome: SprintTask['outcome'],
    carriedFrom?: string,
  ): SprintTask => ({
    id: id(stId),
    taskId,
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome,
    ...(carriedFrom === undefined ? {} : { carriedFrom: id(carriedFrom) }),
  });

  it('has none for a Task never carried over', () => {
    expect(carryOverOf(taskId, [])).toBeUndefined();
    const s = sprintFixture('2026-09-21', 'active', {
      tasks: [st('st-1', 'planned')],
    });
    expect(carryOverOf(taskId, [s])).toBeUndefined();
  });

  it('counts the latest SprintTask when it was carried over', () => {
    const s1 = sprintFixture('2026-09-21', 'closed', {
      tasks: [st('st-1', 'carriedOver')],
    });
    expect(carryOverOf(taskId, [s1])).toEqual({
      count: 1,
      fromSprintId: s1.id,
    });
  });

  it('keeps the count while the Task is chosen again, and adds each carry-over', () => {
    const s1 = sprintFixture('2026-09-14', 'closed', {
      tasks: [st('st-1', 'carriedOver')],
    });
    const s2 = sprintFixture('2026-09-21', 'closed', {
      tasks: [st('st-2', 'carriedOver', 'st-1')],
    });
    const s3 = sprintFixture('2026-09-28', 'active', {
      tasks: [st('st-3', 'planned', 'st-2')],
    });
    expect(carryOverOf(taskId, [s3, s1, s2])).toEqual({
      count: 2,
      fromSprintId: s1.id,
    });
    expect(carryOverOf(taskId, [s1, s2])).toEqual({
      count: 2,
      fromSprintId: s1.id,
    });
  });

  it('starts over when the Task is chosen without the carry-over', () => {
    const s1 = sprintFixture('2026-09-21', 'closed', {
      tasks: [st('st-1', 'carriedOver')],
    });
    const s2 = sprintFixture('2026-09-28', 'active', {
      tasks: [st('st-2', 'planned')],
    });
    expect(carryOverOf(taskId, [s1, s2])).toBeUndefined();
  });

  it('F36: a draft of the next Sprint does not count until it is confirmed', () => {
    const s1 = sprintFixture('2026-09-21', 'closed', {
      tasks: [st('st-1', 'carriedOver')],
    });
    const s2 = sprintFixture('2026-09-28', 'active', {
      tasks: [st('st-2', 'planned', 'st-1')],
    });
    const s3 = sprintFixture('2026-10-05', 'planning', {
      tasks: [st('st-3', 'draft')],
    });
    expect(carryOverOf(taskId, [s1, s2, s3])).toEqual({
      count: 1,
      fromSprintId: s1.id,
    });
    const onlyDraft = sprintFixture('2026-10-05', 'planning', {
      tasks: [st('st-9', 'draft')],
    });
    expect(carryOverOf(taskId, [onlyDraft])).toBeUndefined();
  });
  it('carryOriginOf: where the run behind a SprintTask began, not counting itself', () => {
    const s1 = sprintFixture('2026-09-14', 'closed', {
      tasks: [st('st-1', 'carriedOver')],
    });
    const s2 = sprintFixture('2026-09-21', 'closed', {
      tasks: [st('st-2', 'carriedOver', 'st-1')],
    });
    const third = st('st-3', 'done', 'st-2');
    const s3 = sprintFixture('2026-09-28', 'active', { tasks: [third] });
    expect(carryOriginOf(third, [s1, s2, s3])).toEqual({
      count: 2,
      fromSprintId: s1.id,
    });
    // Carried over itself, with nothing behind it.
    expect(carryOriginOf(s1.tasks[0]!, [s1, s2, s3])).toBeUndefined();
  });
});

describe('inBacklogSlice', () => {
  const sprint = sprintFixture('2026-09-28', 'active');
  const context = {
    user,
    today: localDate('2026-09-29'),
    sprints: [sprint],
  };
  const due = (date: string) =>
    unwrap(
      updateTask(
        task('t', '2026-09-20T00:00:00.000Z'),
        { due: localDate(date) },
        ctx,
      ),
    );

  it('期限が近い: from today to the end of the current Sprint (#39)', () => {
    expect(dueSoonUntil(context)).toBe('2026-10-04');
    expect(inBacklogSlice(due('2026-09-29'), 'dueSoon', context)).toBe(true);
    expect(inBacklogSlice(due('2026-10-04'), 'dueSoon', context)).toBe(true);
    expect(inBacklogSlice(due('2026-10-05'), 'dueSoon', context)).toBe(false);
    expect(inBacklogSlice(due('2026-09-28'), 'dueSoon', context)).toBe(false);
  });

  it('期限が近い: to the end of this week when no Sprint holds today', () => {
    expect(dueSoonUntil({ ...context, sprints: [] })).toBe('2026-10-04');
    // A Sprint that holds today wins over the calendar week.
    const holding = sprintFixture('2026-09-24', 'active');
    expect(dueSoonUntil({ ...context, sprints: [holding] })).toBe('2026-09-30');
  });

  it('期限超過: before today', () => {
    expect(inBacklogSlice(due('2026-09-28'), 'overdue', context)).toBe(true);
    expect(inBacklogSlice(due('2026-09-29'), 'overdue', context)).toBe(false);
  });

  it('a Task without a due date or an Area', () => {
    const plain = task('p', '2026-09-20T00:00:00.000Z');
    expect(inBacklogSlice(plain, 'dueSoon', context)).toBe(false);
    expect(inBacklogSlice(plain, 'overdue', context)).toBe(false);
    expect(inBacklogSlice(plain, 'noArea', context)).toBe(true);
    expect(inBacklogSlice(plain, 'recurring', context)).toBe(false);
    expect(inBacklogSlice(plain, 'carriedOver', context)).toBe(false);
  });
});
