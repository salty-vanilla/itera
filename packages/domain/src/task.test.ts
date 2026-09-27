import { describe, expect, expectTypeOf, it } from 'vitest';
import * as domain from './index';
import { id, type AreaId, type RecurrenceRuleId } from './shared/ids';
import { localDate } from './shared/time';
import {
  addSubtask,
  archiveTask,
  completeTask,
  createTask,
  restoreTask,
  setSubtaskDone,
  setSubtaskEstimate,
  undoTaskCompletion,
  updateTask,
  type Task,
} from './task';
import { at, ctx, newTask, unwrap, userId } from './testing';

describe('Task', () => {
  it('invariant 1: a title alone makes an active Task with no Area, due, Estimate or recurrence', () => {
    const result = createTask(
      { id: id('task-1'), userId, title: '  論文を読む ', via: 'backlog' },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const task = result.value.record;
    expect(task).toEqual({
      id: 'task-1',
      userId,
      title: '論文を読む',
      description: '',
      priority: 'normal',
      lifecycle: 'active',
      timeBasis: 'task',
      subtasks: [],
      suggestions: [],
      createdAt: ctx.now,
      createdVia: 'backlog',
    });
    expect(result.value.activities).toEqual([
      {
        kind: 'taskCreated',
        at: ctx.now,
        actor: 'user',
        taskId: 'task-1',
        via: 'backlog',
      },
    ]);
  });

  it('invariant 1: there is no "unorganized" lifecycle', () => {
    expectTypeOf<Task['lifecycle']>().toEqualTypeOf<
      'active' | 'completed' | 'archived'
    >();
  });

  it('rejects an empty title', () => {
    const result = createTask(
      { id: id('task-1'), userId, title: '   ', via: 'today' },
      ctx,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });

  it('records where the Task was created from', () => {
    const task = unwrap(
      createTask({ id: id('t'), userId, title: 'x', via: 'agent' }, ctx),
    );
    expect(task.createdVia).toBe('agent');
  });

  it('invariant 3: archiving keeps the record and can be undone', () => {
    const task = newTask();
    const archived = unwrap(archiveTask(task, at('2026-09-29T00:00:00.000Z')));
    expect(archived).toMatchObject({
      id: task.id,
      title: task.title,
      lifecycle: 'archived',
      archivedAt: '2026-09-29T00:00:00.000Z',
    });
    const restored = unwrap(restoreTask(archived, ctx));
    expect(restored.lifecycle).toBe('active');
    expect(restored).not.toHaveProperty('archivedAt');
  });

  it('invariant 3: the package offers no way to delete a Task', () => {
    const names = Object.keys(domain);
    expect(
      names.filter((n) => /delete|remove/i.test(n) && /task/i.test(n)),
    ).toEqual([]);
  });

  it('invariant 4: a Task has no Goal', () => {
    expectTypeOf<Task>().not.toHaveProperty('goal');
    expectTypeOf<Task>().not.toHaveProperty('goalId');
    expectTypeOf<Task>().not.toHaveProperty('goalLink');
  });

  it('invariant 2: Sprint and Today membership are not Task attributes', () => {
    expectTypeOf<Task>().not.toHaveProperty('today');
    expectTypeOf<Task>().not.toHaveProperty('sprintId');
    expectTypeOf<Task>().not.toHaveProperty('inSprint');
  });

  it('restoring a Task archived from completed makes it active again', () => {
    const completed = unwrap(completeTask(newTask(), ctx));
    const archived = unwrap(archiveTask(completed, ctx));
    const restored = unwrap(restoreTask(archived, ctx));
    expect(restored.lifecycle).toBe('active');
    expect(restored).not.toHaveProperty('completedAt');
    expect(restored).not.toHaveProperty('archivedAt');
  });

  it('records subtask estimate changes as Activity', () => {
    const subtaskId = id<'Subtask'>('sub-1');
    const task = unwrap(
      addSubtask(newTask(), { id: subtaskId, title: 'a' }, ctx),
    );
    const set = setSubtaskEstimate(task, subtaskId, 2, ctx);
    expect(set.ok && set.value.activities).toEqual([
      {
        kind: 'subtaskEstimateChanged',
        at: ctx.now,
        actor: 'user',
        taskId: task.id,
        subtaskId,
        from: null,
        to: 2,
      },
    ]);
    const same = setSubtaskEstimate(unwrap(set), subtaskId, 2, ctx);
    expect(same.ok && same.value.activities).toEqual([]);
  });

  it('marking a subtask with its current state changes nothing', () => {
    const subtaskId = id<'Subtask'>('sub-1');
    const task = unwrap(
      addSubtask(newTask(), { id: subtaskId, title: 'a' }, ctx),
    );
    expect(setSubtaskDone(task, subtaskId, false, ctx)).toEqual({
      ok: true,
      value: { record: task, activities: [] },
    });
  });

  it('completes, undoes completion and archives from completed', () => {
    const task = newTask();
    const completed = unwrap(completeTask(task, ctx));
    expect(completed).toMatchObject({
      lifecycle: 'completed',
      completedAt: ctx.now,
    });

    const reopened = unwrap(undoTaskCompletion(completed, ctx));
    expect(reopened.lifecycle).toBe('active');
    expect(reopened).not.toHaveProperty('completedAt');

    const archived = unwrap(archiveTask(completed, ctx));
    expect(archived.lifecycle).toBe('archived');
  });

  it('rejects transitions the state diagram does not have', () => {
    const task = newTask();
    expect(undoTaskCompletion(task, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(restoreTask(task, ctx)).toMatchObject({ ok: false });
    const archived = unwrap(archiveTask(task, ctx));
    expect(completeTask(archived, ctx)).toMatchObject({ ok: false });
    expect(archiveTask(archived, ctx)).toMatchObject({ ok: false });
  });

  it('a recurring Task never becomes completed', () => {
    const task: Task = {
      ...newTask('部屋の掃除'),
      recurrenceRuleId: id('rule-1') as RecurrenceRuleId,
    };
    expect(completeTask(task, ctx)).toMatchObject({
      ok: false,
      error: { code: 'recurringTaskCannotComplete' },
    });
  });

  it('records attribute changes and clears optional attributes with null', () => {
    const research = id('area-research') as AreaId;
    const task = newTask();
    const first = updateTask(
      task,
      { areaId: research, due: localDate('2026-10-04'), priority: 'high' },
      ctx,
    );
    expect(first.ok && first.value.activities).toEqual([
      {
        kind: 'taskUpdated',
        at: ctx.now,
        actor: 'user',
        taskId: task.id,
        changes: [
          { field: 'areaId', from: null, to: research },
          { field: 'due', from: null, to: '2026-10-04' },
          { field: 'priority', from: 'normal', to: 'high' },
        ],
      },
    ]);

    const updated = unwrap(first);
    const cleared = unwrap(
      updateTask(updated, { areaId: null, due: null }, ctx),
    );
    expect(cleared).not.toHaveProperty('areaId');
    expect(cleared).not.toHaveProperty('due');
  });

  it('an update that changes nothing appends no Activity', () => {
    const task = newTask();
    const result = updateTask(
      task,
      { title: task.title, priority: 'normal' },
      ctx,
    );
    expect(result).toEqual({
      ok: true,
      value: { record: task, activities: [] },
    });
  });

  it('adds subtasks, estimates them and marks them done', () => {
    const subtaskId = id<'Subtask'>('sub-1');
    let task = unwrap(
      addSubtask(newTask(), { id: subtaskId, title: '1 本目' }, ctx),
    );
    task = unwrap(setSubtaskEstimate(task, subtaskId, 1.5, ctx));
    expect(task.subtasks[0]).toEqual({
      id: subtaskId,
      title: '1 本目',
      estimate: 1.5,
      done: false,
    });

    const done = setSubtaskDone(task, subtaskId, true, ctx);
    expect(done.ok && done.value.activities[0]?.kind).toBe('subtaskDone');
    task = unwrap(done);
    expect(task.subtasks[0]).toMatchObject({ done: true, doneAt: ctx.now });

    task = unwrap(setSubtaskDone(task, subtaskId, false, ctx));
    expect(task.subtasks[0]).not.toHaveProperty('doneAt');

    task = unwrap(setSubtaskEstimate(task, subtaskId, null, ctx));
    expect(task.subtasks[0]).not.toHaveProperty('estimate');
  });

  it('rejects invalid subtask input', () => {
    const task = newTask();
    expect(addSubtask(task, { id: id('s'), title: '' }, ctx)).toMatchObject({
      ok: false,
    });
    expect(
      addSubtask(task, { id: id('s'), title: 'x', estimate: 0 }, ctx),
    ).toMatchObject({ ok: false });
    expect(setSubtaskEstimate(task, id('missing'), 1, ctx)).toMatchObject({
      ok: false,
      error: { code: 'notFound' },
    });
  });

  it('never mutates the Task it is given', () => {
    const task = Object.freeze(newTask());
    expect(() => unwrap(completeTask(task, ctx))).not.toThrow();
    expect(task.lifecycle).toBe('active');
  });
});
