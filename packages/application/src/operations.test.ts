import type { Result } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureIds, fixtureSnapshot } from './fixtures/states';
import { operations } from './operations';
import { memoryStore } from './testing';

const ids = fixtureIds();

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('operations return what they made (ADR 0005 2026-10-03)', () => {
  it('createArea: the Area, last in the order and in the next color', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const before = store.getSnapshot().records.areas;
    const { areaId } = value(
      store.run(operations.createArea({ name: '就活' })),
    );
    const made = store.getSnapshot().records.areas.find((a) => a.id === areaId);
    expect(made).toMatchObject({
      name: '就活',
      color: before.length + 1,
      order: Math.max(...before.map((a) => a.order)) + 1,
    });
  });

  it('createTask: the Task, in its Area', () => {
    const store = memoryStore(fixtureSnapshot('backlog-capture'));
    const { taskId } = value(
      store.run(
        operations.createTask({ title: '書類を出す', areaId: ids.area.work }),
      ),
    );
    expect(
      store.getSnapshot().records.tasks.find((t) => t.id === taskId),
    ).toMatchObject({ title: '書類を出す', areaId: ids.area.work });
  });

  it('createAndChooseTask: the Task and its draft in the week', () => {
    const store = memoryStore(fixtureSnapshot('planning-pick'));
    const made = value(
      store.run(operations.createAndChooseTask({ title: '書類を出す' })),
    );
    const planning = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'planning');
    expect(
      planning?.tasks.find((t) => t.id === made.sprintTaskId),
    ).toMatchObject({ taskId: made.taskId, outcome: 'draft' });
  });

  it('chooseTasks: the drafts, in the order of the Tasks', () => {
    const store = memoryStore(fixtureSnapshot('planning-pick'));
    const taskIds = [ids.task.bookshelf, ids.task.typescript];
    const { sprintTaskIds } = value(
      store.run(operations.chooseTasks({ taskIds })),
    );
    const planning = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'planning');
    expect(
      sprintTaskIds.map(
        (id) => planning?.tasks.find((t) => t.id === id)?.taskId,
      ),
    ).toEqual(taskIds);
  });

  it('createTaskForToday and addTaskToToday: the SprintTask and the day’s choice', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const created = value(
      store.run(operations.createTaskForToday({ title: '電話する' })),
    );
    const added = value(
      store.run(operations.addTaskToToday({ taskId: ids.task.bookshelf })),
    );
    const sprint = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'active');
    for (const made of [created, added]) {
      expect(
        sprint?.dailySelections.find((d) => d.id === made.selectionId),
      ).toMatchObject({ sprintTaskId: made.sprintTaskId });
    }
    expect(
      sprint?.tasks.find((t) => t.id === created.sprintTaskId)?.taskId,
    ).toBe(created.taskId);
  });

  it('chooseForToday, noteInterrupt and addSubtask: the records they made', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const sprint = () =>
      store.getSnapshot().records.sprints.find((s) => s.state === 'active');
    const paper = sprint()?.tasks.find((t) => t.taskId === ids.task.paper);
    const { selectionId } = value(
      store.run(operations.chooseForToday({ sprintTaskId: paper!.id })),
    );
    expect(sprint()?.dailySelections.at(-1)?.id).toBe(selectionId);
    const { interruptNoteId } = value(
      store.run(operations.noteInterrupt({ text: '来客', minutes: 10 })),
    );
    expect(sprint()?.interrupts.at(-1)?.id).toBe(interruptNoteId);
    const { subtaskId } = value(
      store.run(
        operations.addSubtask({ taskId: ids.task.bookshelf, title: '上の段' }),
      ),
    );
    expect(
      store
        .getSnapshot()
        .records.tasks.find((t) => t.id === ids.task.bookshelf)
        ?.subtasks.at(-1)?.id,
    ).toBe(subtaskId);
  });

  it('draftCriterion and beginPlanning: the criterion and the Sprint', () => {
    const store = memoryStore(fixtureSnapshot('retro-before-complete'));
    const { criterionId } = value(
      store.run(
        operations.draftCriterion({
          policy: { scope: { kind: 'all' }, rangePolicy: 'mid' },
        }),
      ),
    );
    expect(
      store.getSnapshot().records.criteria.find((c) => c.id === criterionId)
        ?.state,
    ).toBe('draft');
    store.run(operations.dropCriterionDraft());
    expect(store.run(operations.completeRetro()).ok).toBe(true);
    const { sprintId } = value(store.run(operations.beginPlanning()));
    expect(
      store.getSnapshot().records.sprints.find((s) => s.id === sprintId)?.state,
    ).toBe('planning');
  });

  it('setRecurrence: the day the change takes effect, none when nothing changes', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const pattern = { freq: 'weekly', daysOfWeek: [2] } as const;
    const set = value(
      store.run(
        operations.setRecurrence({ taskId: ids.task.bookshelf, pattern }),
      ),
    );
    // The next Sprint not confirmed yet starts on 10/5 (F1).
    expect(set).toEqual({ effectiveFrom: '2026-10-05' });
    expect(
      value(
        store.run(
          operations.setRecurrence({ taskId: ids.task.bookshelf, pattern }),
        ),
      ),
    ).toEqual({});
  });

  it('endRecurrence: whether the rule was taken off (F41)', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    store.run(
      operations.setRecurrence({
        taskId: ids.task.bookshelf,
        pattern: { freq: 'weekly', daysOfWeek: [2] },
      }),
    );
    // No occurrence made yet: the rule goes.
    expect(
      value(
        store.run(operations.endRecurrence({ taskId: ids.task.bookshelf })),
      ),
    ).toEqual({ removed: true });
    // This one has made occurrences: it ends instead.
    expect(
      value(store.run(operations.endRecurrence({ taskId: ids.task.reading }))),
    ).toEqual({ removed: false });
  });
});

describe('includeOccurrences (invariant 33)', () => {
  const planning = () => {
    const store = memoryStore(fixtureSnapshot('planning-pick'));
    const reading = store
      .getSnapshot()
      .records.occurrences.filter(
        (o) => o.taskId === ids.task.reading && o.scheduledDate >= '2026-09-28',
      );
    for (const o of reading) {
      store.run(
        operations.setOccurrenceIncluded({
          occurrenceId: o.id,
          included: false,
        }),
      );
    }
    return { store, reading: reading.map((o) => o.id) };
  };
  const states = (store: ReturnType<typeof memoryStore>, of: string[]) =>
    store
      .getSnapshot()
      .records.occurrences.filter((o) => of.includes(o.id))
      .map((o) => o.state);

  it('puts back every occurrence in one operation', () => {
    const { store, reading } = planning();
    expect(reading.length).toBeGreaterThan(1);
    expect(states(store, reading).every((s) => s === 'excluded')).toBe(true);
    expect(
      store.run(operations.includeOccurrences({ occurrenceIds: reading })).ok,
    ).toBe(true);
    expect(states(store, reading).every((s) => s === 'pending')).toBe(true);
  });

  it('changes nothing when one of them cannot be put back', () => {
    const { store, reading } = planning();
    const before = store.getSnapshot();
    const missing =
      'occurrence_01h455vb4pex5vsknk084sn02q' as (typeof reading)[number];
    expect(
      store.run(
        operations.includeOccurrences({
          occurrenceIds: [...reading, missing],
        }),
      ).ok,
    ).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });
});
