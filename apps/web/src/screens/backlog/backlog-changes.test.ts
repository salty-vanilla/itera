import { createArea, id } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import { changed, createMemoryStore } from '@/store/record-store';
import { saveTask } from './backlog-changes';

describe('saveTask', () => {
  it('F9: moving a Task of the active Sprint to a new Area notes its name in the Sprint', () => {
    const store = createMemoryStore(fixtureSnapshot('backlog-capture'));
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
      saveTask(id<'Task'>('task-paper'), { areaId: hobby }, undefined),
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
    const store = createMemoryStore(initial);
    store.run(
      saveTask(id<'Task'>('task-bookshelf'), { areaId: id('area-life') }, 2),
    );
    const { records } = store.getSnapshot();
    expect(records.sprints).toBe(initial.records.sprints);
    expect(records.tasks.find((t) => t.id === 'task-bookshelf')).toMatchObject({
      areaId: 'area-life',
      estimate: { hours: 2 },
    });
  });
});
