import { createArea, id, instant, localDate } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import { changed } from './record-store';
import { memoryStore, tagged } from './testing';
import { backlogData } from './backlog-view';
import { catchUp } from './system-changes';
import { endRule, saveTask, setRule } from './task-changes';

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
        tagged(records),
        { ...clock, today: localDate(today) },
        { view: 'recurring' },
      );
    const lastDay = on('2026-10-04');
    expect(lastDay.items[taskId]).toMatchObject({
      recurrence: { endsOn: '2026-10-04' },
      capabilities: { canComplete: false, canAddToToday: false },
    });
    expect(lastDay.shown).toContain(taskId);
    // The next day, after the system's catch-up: the Sprint is in Review.
    const next = memoryStore({
      records,
      clock: {
        today: localDate('2026-10-05'),
        now: instant('2026-10-05T00:00:00.000Z'),
      },
    });
    expect(next.run(catchUp(clock.today), { actor: 'system' }).ok).toBe(true);
    const after = backlogData(
      tagged(next.getSnapshot().records),
      next.getSnapshot().clock,
      { view: 'recurring' },
    );
    expect(after.items[taskId]).not.toHaveProperty('recurrence');
    expect(after.items[taskId]?.capabilities.canComplete).toBe(true);
    expect(after.shown).not.toContain(taskId);
  });

  it('#338: made recurring again, the Task shows this week’s occurrence and the new rule as a change', () => {
    const store = memoryStore(fixtureSnapshot('backlog-recurrence'));
    const taskId = id<'Task'>(ids.task.cleaning);
    expect(store.run(endRule(taskId)).ok).toBe(true);
    const before = backlogData(
      tagged(store.getSnapshot().records),
      store.getSnapshot().clock,
      { view: 'recurring' },
    ).items[taskId];
    // 毎週 土 · 次は 10/3 (土) · 10/4 (日) まで
    const saturdays = before?.recurrence?.pattern;
    expect(saturdays).toEqual({ freq: 'weekly', daysOfWeek: [6] });
    const monday = { freq: 'weekly' as const, daysOfWeek: [1 as const] };
    expect(store.run(setRule(taskId, monday)).ok).toBe(true);
    const { records, clock } = store.getSnapshot();
    const item = backlogData(tagged(records), clock, { view: 'recurring' })
      .items[taskId];
    expect(item?.recurrence).toEqual({
      pattern: saturdays,
      next: before?.recurrence?.next,
      upcoming: { pattern: monday, effectiveFrom: '2026-10-05' },
    });
    expect(item?.rule).toMatchObject({ current: saturdays, latest: monday });
    // The same pattern again is no change: it goes on, with no last day.
    expect(store.run(setRule(taskId, saturdays!)).ok).toBe(true);
    const same = backlogData(
      tagged(store.getSnapshot().records),
      store.getSnapshot().clock,
      { view: 'recurring' },
    ).items[taskId];
    expect(same?.recurrence).toEqual({
      pattern: saturdays,
      next: before?.recurrence?.next,
    });
    // Ended again, the new rule has made no occurrence and comes off: the
    // Task is shown by the rule that ends, until its last day.
    expect(store.run(endRule(taskId)).ok).toBe(true);
    const ended = backlogData(
      tagged(store.getSnapshot().records),
      store.getSnapshot().clock,
      { view: 'recurring' },
    ).items[taskId];
    expect(ended?.task).not.toHaveProperty('recurrenceRuleId');
    expect(ended?.recurrence).toEqual(before?.recurrence);
  });
});
