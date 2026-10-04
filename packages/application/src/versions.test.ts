import { id } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { checkCondition } from './conditions';
import { fixtureIds, fixtureSnapshot } from './fixtures/states';
import { operations } from './operations';
import { memoryStore } from './testing';
import { etagOf, tagRecords, versionKey } from './versions';

const ids = fixtureIds();
const slides = id<'Task'>(ids.task.slides);
const expense = id<'Task'>(ids.task.expense);
const research = id<'Area'>(ids.area.research);

/** The etags of the store's records as a read gives them. */
function etags(store: ReturnType<typeof memoryStore>) {
  const { records, versions } = store.getSnapshot();
  return tagRecords(records, versions ?? new Map());
}

function activeSprint(store: ReturnType<typeof memoryStore>) {
  const sprint = etags(store).sprints.find((s) => s.state === 'active');
  if (sprint === undefined) throw new Error('No running Sprint.');
  return sprint;
}

describe('versions of the records (#321)', () => {
  it('tags every record a write can replace, parts of a Sprint too, at version 0 without versions', () => {
    const { records } = fixtureSnapshot('today-interrupt');
    const tagged = tagRecords(records, new Map());
    const sprint = tagged.sprints.find((s) => s.state === 'active');
    expect(sprint?.etag).toBe('"0"');
    expect(sprint?.goals.every((g) => g.etag === '"0"')).toBe(true);
    expect(sprint?.tasks.every((t) => t.etag === '"0"')).toBe(true);
    expect(sprint?.interrupts.length).toBeGreaterThan(0);
    expect(sprint?.interrupts.every((n) => n.etag === '"0"')).toBe(true);
    expect(tagged.tasks.every((t) => t.etag === '"0"')).toBe(true);
    expect(
      tagged.tasks.flatMap((t) => t.subtasks).every((s) => s.etag === '"0"'),
    ).toBe(true);
    expect(tagged.areas.every((a) => a.etag === '"0"')).toBe(true);
  });

  it('raises the version of the record a change replaced, and no other', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const before = etags(store);
    const etagOfTask = (records: typeof before, taskId: string) =>
      records.tasks.find((t) => t.id === taskId)?.etag;
    store.run(
      operations.saveTask({ taskId: slides, update: { title: '発表資料' } }),
    );
    const after = etags(store);
    expect(etagOfTask(after, slides)).not.toBe(etagOfTask(before, slides));
    expect(etagOfTask(after, expense)).toBe(etagOfTask(before, expense));
    expect(after.areas).toEqual(before.areas);
    expect(after.sprints).toEqual(before.sprints);
  });

  it('keeps a Task’s version when another record changes (a renamed Area)', () => {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const before = etags(store).tasks;
    store.run(operations.renameArea({ areaId: research, name: '研究室' }));
    expect(etags(store).tasks).toEqual(before);
    const area = etags(store).areas.find((a) => a.id === research);
    expect(area?.etag).not.toBe('"0"');
  });

  it('keeps the version of a note whose place alone moved when an earlier one was deleted', () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const sprint = activeSprint(store);
    const [first, ...rest] = sprint.interrupts;
    if (first === undefined || rest.length === 0) {
      throw new Error('The fixture has fewer than two notes.');
    }
    const result = store.run(
      operations.deleteInterrupt({
        sprintId: sprint.id,
        interruptNoteId: first.id,
      }),
    );
    expect(result.ok).toBe(true);
    expect(activeSprint(store).interrupts).toEqual(rest);
  });
});

describe('the condition of a write that replaces values (#321)', () => {
  const store = memoryStore(fixtureSnapshot('today-daytime'));
  store.run(
    operations.saveTask({ taskId: slides, update: { title: '発表資料' } }),
  );
  const { records, versions = new Map() } = store.getSnapshot();
  const current = etagOf(versions.get(versionKey.task(slides)) ?? 0);
  const check = (condition: Parameters<typeof checkCondition>[4]) =>
    checkCondition(
      'saveTask',
      { taskId: slides, update: { title: 'x' } },
      records,
      versions,
      condition,
    );

  it('is met by the etag the record has now, or by any', () => {
    expect(check({ ifMatch: [current] })).toBe('met');
    expect(check({ ifMatch: ['"0"', current] })).toBe('met');
    expect(check({ ifMatch: '*' })).toBe('met');
  });

  it('fails with an older etag, a weak one, or when it says there is none', () => {
    expect(check({ ifMatch: ['"0"'] })).toBe('failed');
    expect(check({ ifMatch: [`W/${current}`] })).toBe('failed');
    expect(check({ ifNoneMatch: '*' })).toBe('failed');
  });

  it('is required for a write that replaces values', () => {
    expect(check(undefined)).toBe('required');
  });

  it('leaves a write on a record that is not there to the operation (404)', () => {
    const missing = id<'Task'>('task_missing');
    expect(
      checkCondition(
        'saveTask',
        { taskId: missing, update: { title: 'x' } },
        records,
        versions,
        undefined,
      ),
    ).toBe('met');
  });

  it('is not asked of a state transition', () => {
    expect(
      checkCondition(
        'completeTask',
        { taskId: slides },
        records,
        versions,
        undefined,
      ),
    ).toBe('met');
  });

  it('makes a Goal only when there was none: If-None-Match, not If-Match', () => {
    const sprint = records.sprints.find((s) => s.state === 'active');
    if (sprint === undefined) throw new Error('No running Sprint.');
    const without = records.areas.find(
      (a) => !sprint.goals.some((g) => g.areaId === a.id),
    );
    const withGoal = sprint.goals[0];
    if (without === undefined || withGoal === undefined) {
      throw new Error('The fixture needs an Area with a Goal and one without.');
    }
    const goal = (areaId: typeof without.id, condition?: object) =>
      checkCondition(
        'setGoal',
        { sprintId: sprint.id, areaId, text: '目標' },
        records,
        versions,
        condition as Parameters<typeof checkCondition>[4],
      );
    expect(goal(without.id)).toBe('required');
    expect(goal(without.id, { ifNoneMatch: '*' })).toBe('met');
    expect(goal(without.id, { ifMatch: ['"0"'] })).toBe('failed');
    expect(goal(withGoal.areaId, { ifNoneMatch: '*' })).toBe('failed');
    expect(goal(withGoal.areaId, { ifMatch: ['"0"'] })).toBe('met');
  });
});

describe('the version of a rule (#330)', () => {
  const cleaning = id<'Task'>(ids.task.cleaning);
  const ruleOf = (store: ReturnType<typeof memoryStore>) => {
    const rule = etags(store).rules.find((r) => r.taskId === cleaning);
    if (rule === undefined) throw new Error('No rule of 部屋の掃除.');
    return rule;
  };
  const sunday = { freq: 'weekly', daysOfWeek: [0] } as const;
  const saturdayAndSunday = { freq: 'weekly', daysOfWeek: [6, 0] } as const;

  it('raises the version of the whole rule when a version changes, the days of one too', () => {
    const store = memoryStore(fixtureSnapshot('backlog-recurrence'));
    const before = ruleOf(store).etag;
    // The fixture's rule changes to Sundays from the next Sprint: a change
    // before then replaces that version. A day added, then taken off again.
    expect(
      store.run(
        operations.setRecurrence({
          taskId: cleaning,
          pattern: saturdayAndSunday,
        }),
      ).ok,
    ).toBe(true);
    const twoDays = ruleOf(store).etag;
    expect(twoDays).not.toBe(before);
    expect(
      store.run(operations.setRecurrence({ taskId: cleaning, pattern: sunday }))
        .ok,
    ).toBe(true);
    expect(ruleOf(store).etag).not.toBe(twoDays);
  });

  it('keeps the rule’s version when its Task or another record changes', () => {
    const store = memoryStore(fixtureSnapshot('backlog-recurrence'));
    const before = ruleOf(store).etag;
    store.run(
      operations.saveTask({ taskId: cleaning, update: { title: '掃除' } }),
    );
    store.run(operations.renameArea({ areaId: research, name: '研究室' }));
    expect(ruleOf(store).etag).toBe(before);
  });

  it('is the condition of setRecurrence: If-Match with a rule, If-None-Match: * without', () => {
    const store = memoryStore(fixtureSnapshot('backlog-recurrence'));
    const { records, versions = new Map() } = store.getSnapshot();
    const rule = ruleOf(store);
    const check = (
      taskId: typeof cleaning,
      condition?: Parameters<typeof checkCondition>[4],
    ) =>
      checkCondition(
        'setRecurrence',
        { taskId, pattern: sunday },
        records,
        versions,
        condition,
      );
    expect(check(cleaning)).toBe('required');
    expect(check(cleaning, { ifMatch: [rule.etag] })).toBe('met');
    expect(check(cleaning, { ifMatch: ['"999"'] })).toBe('failed');
    expect(check(cleaning, { ifNoneMatch: '*' })).toBe('failed');
    expect(check(slides)).toBe('required');
    expect(check(slides, { ifNoneMatch: '*' })).toBe('met');
    expect(check(slides, { ifMatch: [rule.etag] })).toBe('failed');
  });

  it('is not asked of endRecurrence, which ends the rule as it is now', () => {
    const { records } = fixtureSnapshot('backlog-recurrence');
    expect(
      checkCondition(
        'endRecurrence',
        { taskId: cleaning },
        records,
        new Map(),
        undefined,
      ),
    ).toBe('met');
  });
});
