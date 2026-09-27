import {
  completeFromBacklog,
  createTask,
  id,
  instant,
  localDate,
  setEstimate,
  timeZone,
  updateTask,
} from '@itera/domain';
import { describe, expect, it, vi } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import { find, onTask } from './changes';
import { changed, createMemoryStore, type StoreSnapshot } from './record-store';

const empty: StoreSnapshot = {
  records: {
    user: {
      id: id('user-1'),
      displayName: 'わたし',
      timeZone: timeZone('Asia/Tokyo'),
      weekStartsOn: 1,
    },
    areas: [],
    tasks: [],
    rules: [],
    occurrences: [],
    sprints: [],
    criteria: [],
    activities: [],
  },
  clock: {
    today: localDate('2026-09-28'),
    now: instant('2026-09-28T00:00:00.000Z'),
  },
};

describe('createMemoryStore', () => {
  it('replaces the records and appends the Activity when a command succeeds', () => {
    const store = createMemoryStore(empty);
    const listener = vi.fn();
    store.subscribe(listener);

    const result = store.run((records, ctx) =>
      changed(
        createTask(
          {
            id: ctx.newId('Task'),
            userId: records.user.id,
            title: '関連論文を 3 本読む',
            via: 'backlog',
          },
          ctx,
        ),
        (task) => ({ tasks: [task] }),
      ),
    );

    expect(result.ok).toBe(true);
    const { records } = store.getSnapshot();
    expect(records.tasks.map((t) => t.title)).toEqual(['関連論文を 3 本読む']);
    expect(records.activities).toEqual([
      expect.objectContaining({
        kind: 'taskCreated',
        at: empty.clock.now,
        actor: 'user',
      }),
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changes nothing and returns the domain error when a command fails', () => {
    const store = createMemoryStore(fixtureSnapshot('today-daytime'));
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);

    // A recurring Task is never completed from the Backlog.
    const result = store.run((records, ctx) => {
      const sprint = records.sprints.find((s) => s.state === 'active');
      const task = find(records.tasks, 'task-reading', 'Task');
      if (sprint === undefined || !task.ok) throw new Error('fixture');
      return changed(
        completeFromBacklog(
          sprint,
          {
            task: task.value,
            date: ctx.today,
            selectionId: ctx.newId('DailySelection'),
          },
          ctx,
        ),
        (next) => ({ sprints: [next.sprint], tasks: [next.task] }),
      );
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'recurringTaskCannotComplete' }),
    });
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns notFound for a record that is not there, without changes', () => {
    const store = createMemoryStore(empty);
    const before = store.getSnapshot();
    const result = store.run(
      onTask(id<'Task'>('task-missing'), (task, ctx) =>
        setEstimate(task, 3, ctx),
      ),
    );
    expect(result.ok || result.error.code).toBe('notFound');
    expect(store.getSnapshot()).toBe(before);
  });

  it('keeps the other records and appends Activity after the existing log', () => {
    const initial = fixtureSnapshot('backlog-capture');
    const store = createMemoryStore(initial);
    const result = store.run(
      onTask(id<'Task'>('task-bookshelf'), (task, ctx) =>
        updateTask(task, { title: '本棚を片づける' }, ctx),
      ),
    );
    expect(result.ok).toBe(true);
    const { records } = store.getSnapshot();
    expect(records.tasks).toHaveLength(initial.records.tasks.length);
    expect(records.tasks.find((t) => t.id === 'task-bookshelf')?.title).toBe(
      '本棚を片づける',
    );
    expect(records.sprints).toBe(initial.records.sprints);
    expect(records.activities.slice(0, -1)).toEqual(initial.records.activities);
    expect(records.activities.at(-1)).toMatchObject({
      kind: 'taskUpdated',
      taskId: 'task-bookshelf',
    });
    // The fixture's snapshot itself is never changed.
    expect(fixtureSnapshot('backlog-capture')).toBe(initial);
  });

  it('appends no Activity for a change that changes nothing', () => {
    const store = createMemoryStore(fixtureSnapshot('backlog-capture'));
    const before = store.getSnapshot().records.activities;
    // The same title again: the domain returns no Activity.
    store.run(
      onTask(id<'Task'>('task-bookshelf'), (task, ctx) =>
        updateTask(task, { title: task.title }, ctx),
      ),
    );
    expect(store.getSnapshot().records.activities).toBe(before);
  });

  it('makes IDs in creation order that do not meet the fixture’s', () => {
    const store = createMemoryStore(empty);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      store.run((_, ctx) => {
        ids.push(ctx.newId('Task'));
        return { ok: true, value: { changes: {}, activities: [] } };
      });
    }
    expect(ids[0]).toBe('local-Task-0001');
    expect(ids.toSorted()).toEqual(ids);
  });
});
