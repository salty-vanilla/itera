import type { Result } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureIds, fixtureSnapshot } from './fixtures/states';
import { operations } from './operations';
import { memoryStore } from './testing';

const ids = fixtureIds();

/** The ID of the store's Sprint in that state. */
function sprintIdOf(
  store: ReturnType<typeof memoryStore>,
  state: 'planning' | 'active' | 'review',
) {
  const sprint = store
    .getSnapshot()
    .records.sprints.find((s) => s.state === state);
  if (sprint === undefined) throw new Error(`No Sprint ${state}.`);
  return sprint.id;
}

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
      store.run(
        operations.createAndChooseTask({
          sprintId: sprintIdOf(store, 'planning'),
          title: '書類を出す',
        }),
      ),
    );
    const planning = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'planning');
    expect(
      planning?.tasks.find((t) => t.id === made.sprintTaskIds[0]),
    ).toMatchObject({ taskId: made.taskId, outcome: 'draft' });
  });

  it('addSprintTasks: the drafts, in the order of the Tasks', () => {
    const store = memoryStore(fixtureSnapshot('planning-pick'));
    const taskIds = [ids.task.bookshelf, ids.task.typescript];
    const { sprintTaskIds } = value(
      store.run(
        operations.addSprintTasks({
          sprintId: sprintIdOf(store, 'planning'),
          taskIds,
        }),
      ),
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
    const sprintId = sprintIdOf(store, 'active');
    const date = store.getSnapshot().clock.today;
    const created = value(
      store.run(
        operations.createTaskForToday({ sprintId, date, title: '電話する' }),
      ),
    );
    const added = value(
      store.run(
        operations.addTaskToToday({
          sprintId,
          date,
          taskId: ids.task.bookshelf,
        }),
      ),
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
    const sprintId = sprintIdOf(store, 'active');
    const { selectionId } = value(
      store.run(
        operations.chooseForToday({
          sprintId,
          date: store.getSnapshot().clock.today,
          sprintTaskId: paper!.id,
        }),
      ),
    );
    expect(sprint()?.dailySelections.at(-1)?.id).toBe(selectionId);
    const { interruptNoteId } = value(
      store.run(
        operations.noteInterrupt({ sprintId, text: '来客', minutes: 10 }),
      ),
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
    const sprintId = sprintIdOf(store, 'review');
    const { criterionId } = value(
      store.run(
        operations.draftCriterion({
          sprintId,
          policy: { scope: { kind: 'all' }, rangePolicy: 'mid' },
        }),
      ),
    );
    expect(
      store.getSnapshot().records.criteria.find((c) => c.id === criterionId)
        ?.state,
    ).toBe('draft');
    store.run(operations.dropCriterionDraft({ criterionId }));
    expect(store.run(operations.completeRetro({ sprintId })).ok).toBe(true);
    const made = value(store.run(operations.beginPlanning()));
    expect(
      store.getSnapshot().records.sprints.find((s) => s.id === made.sprintId)
        ?.state,
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
          sprintId: sprintIdOf(store, 'planning'),
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
      store.run(
        operations.includeOccurrences({
          sprintId: sprintIdOf(store, 'planning'),
          occurrenceIds: reading,
        }),
      ).ok,
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
          sprintId: sprintIdOf(store, 'planning'),
          occurrenceIds: [...reading, missing],
        }),
      ).ok,
    ).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });
});

describe('the Sprint an operation names (#295)', () => {
  it('is refused when it is in another state, and not found when it is not the person’s', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const running = sprintIdOf(store, 'active');
    const wrong = store.run(
      operations.confirmSprint({ sprintId: running, applyCriterion: false }),
    );
    expect(!wrong.ok && wrong.error.code).toBe('invalidTransition');
    const none = store.run(
      operations.setAvailableHours({
        sprintId: 'sprint_01h455vb4pex5vsknk084sn02q' as typeof running,
        hours: 10,
      }),
    );
    expect(!none.ok && none.error.code).toBe('notFound');
  });

  it('sets a Goal and the hours while planned and while running', () => {
    for (const [state, fixture] of [
      ['planning', 'planning-pick'],
      ['active', 'today-daytime'],
    ] as const) {
      const store = memoryStore(fixtureSnapshot(fixture));
      const sprintId = sprintIdOf(store, state);
      expect(
        store.run(
          operations.setGoal({ sprintId, areaId: ids.area.work, text: '出す' }),
        ).ok,
      ).toBe(true);
      expect(
        store.run(operations.setAvailableHours({ sprintId, hours: 12 })).ok,
      ).toBe(true);
      const sprint = store
        .getSnapshot()
        .records.sprints.find((s) => s.id === sprintId);
      expect(sprint?.availableHours).toBe(12);
      expect(sprint?.goals.find((g) => g.areaId === ids.area.work)?.text).toBe(
        '出す',
      );
    }
  });

  it('adds Tasks to a running Sprint as additions, and takes them back all or none', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const sprintId = sprintIdOf(store, 'active');
    const { sprintTaskIds } = value(
      store.run(
        operations.addSprintTasks({
          sprintId,
          taskIds: [ids.task.bookshelf],
        }),
      ),
    );
    const sprint = () =>
      store.getSnapshot().records.sprints.find((s) => s.id === sprintId);
    expect(sprint()?.tasks.find((t) => t.id === sprintTaskIds[0])?.origin).toBe(
      'midSprint',
    );
    const before = store.getSnapshot();
    const missing =
      'sprinttask_01h455vb4pex5vsknk084sn02q' as (typeof sprintTaskIds)[number];
    expect(
      store.run(
        operations.removeSprintTasks({
          sprintId,
          sprintTaskIds: [...sprintTaskIds, missing],
        }),
      ).ok,
    ).toBe(false);
    expect(store.getSnapshot()).toBe(before);
    expect(
      store.run(operations.removeSprintTasks({ sprintId, sprintTaskIds })).ok,
    ).toBe(true);
    expect(sprint()?.tasks.some((t) => t.id === sprintTaskIds[0])).toBe(false);
  });

  it('refuses a choice for a day that is not today (W3)', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const result = store.run(
      operations.addTaskToToday({
        sprintId: sprintIdOf(store, 'active'),
        date: '2026-09-30' as never,
        taskId: ids.task.bookshelf,
      }),
    );
    expect(!result.ok && result.error.code).toBe('invalidInput');
  });
});
