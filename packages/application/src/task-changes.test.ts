import { createArea, id, localDate } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import { changed } from './record-store';
import { memoryStore } from './testing';
import { backlogData } from './backlog-view';
import { endRule, saveTask } from './task-changes';

const ids = fixtureIds();

describe('saveTask', () => {
  it('F9: moving a Task of the active Sprint to a new Area notes its name in the Sprint', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const hobby = id<'Area'>('area-hobby');
    store.run((records, ctx) =>
      changed(
        createArea(
          {
            id: hobby,
            userId: records.user.id,
            name: '趣味',
            color: 5,
            order: 4,
          },
          ctx,
        ),
        (area) => ({ areas: [area] }),
      ),
    );
    const result = store.run(
      saveTask(id<'Task'>(ids.task.paper), { areaId: hobby }, undefined),
    );
    expect(result.ok).toBe(true);
    const { records } = store.getSnapshot();
    const sprint = records.sprints.find((s) => s.state === 'active');
    expect(sprint?.areaSnapshot.at(-1)).toMatchObject({
      areaId: hobby,
      name: '趣味',
    });
    expect(records.activities.at(-1)).toMatchObject({
      kind: 'areaSnapshotAdded',
    });
  });

  it('leaves the Sprint alone for a Task outside it', () => {
    const initial = fixtureSnapshot('backlog-capture');
    const store = memoryStore(initial);
    store.run(
      saveTask(
        id<'Task'>(ids.task.bookshelf),
        { areaId: id(ids.area.life) },
        2,
      ),
    );
    const { records } = store.getSnapshot();
    expect(records.sprints).toBe(initial.records.sprints);
    expect(
      records.tasks.find((t) => t.id === ids.task.bookshelf),
    ).toMatchObject({
      areaId: ids.area.life,
      estimate: { hours: 2 },
    });
  });
});

describe('endRule (F41)', () => {
  it('the Backlog shows the Task recurring until the rule’s last day, one-off after it', () => {
    const store = memoryStore(fixtureSnapshot('backlog-recurrence'));
    const taskId = id<'Task'>(ids.task.cleaning);
    expect(store.run(endRule(taskId)).ok).toBe(true);
    const { records, clock } = store.getSnapshot();
    expect(records.tasks.find((t) => t.id === taskId)).not.toHaveProperty(
      'recurrenceRuleId',
    );
    const on = (today: string) =>
      backlogData(
        records,
        { ...clock, today: localDate(today) },
        { view: 'recurring' },
      );
    const lastDay = on('2026-10-04');
    expect(lastDay.items[taskId]).toMatchObject({
      recurrence: { endsOn: '2026-10-04' },
      canComplete: false,
      canAddToToday: false,
    });
    expect(lastDay.shown).toContain(taskId);
    const after = on('2026-10-05');
    expect(after.items[taskId]).not.toHaveProperty('recurrence');
    expect(after.items[taskId]?.canComplete).toBe(true);
    expect(after.shown).not.toContain(taskId);
  });
});
