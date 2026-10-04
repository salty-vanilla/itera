import { addDays, instant, type Sprint } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from './fixtures/states';
import { chooseTasks } from './planning-changes';
import { planningCandidatesOf } from './planning-view';
import { memoryStore, tagged } from './testing';
import { beginPlanning } from './retro-changes';
import { reviewEnded } from './system-changes';
import { beginRetro } from './today-changes';

// Issue #89: the next Sprint is planned while this one still runs.
describe('planning the next Sprint mid-week', () => {
  function chooseUnfinished() {
    const store = memoryStore(fixtureSnapshot('today-daytime'));
    const running = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'active') as Sprint;
    const unfinished = running.tasks.find(
      (t) => t.outcome === 'planned' && t.occurrenceIds === undefined,
    );
    if (unfinished === undefined) throw new Error('No unfinished Task.');
    const begun = store.run(beginPlanning());
    if (!begun.ok) throw new Error(begun.error.message);
    expect(
      store.run(chooseTasks(begun.value.sprintId, [unfinished.taskId])).ok,
    ).toBe(true);
    return { store, running, unfinished };
  }

  it('marks a candidate still unfinished in the running Sprint, and it can be chosen', () => {
    const { store, running, unfinished } = chooseUnfinished();
    const { clock } = store.getSnapshot();
    const records = tagged(store.getSnapshot().records);
    const sprint = records.sprints.find((s) => s.state === 'planning');
    if (sprint === undefined) throw new Error('no Sprint being planned');
    const candidates = planningCandidatesOf(records, clock, sprint);
    const rows = [
      ...candidates.carriedOver,
      ...candidates.overdue,
      ...candidates.dueSoon,
      ...candidates.others,
    ];
    const row = rows.find((r) => r.task.id === unfinished.taskId);
    expect(row?.running).toEqual({ sprint: 2 });
    expect(row?.chosen).toBeDefined();
    // Only Tasks still planned in the running Sprint have the mark.
    const planned = new Set(
      running.tasks.filter((t) => t.outcome === 'planned').map((t) => t.taskId),
    );
    for (const r of rows) {
      expect(r.running !== undefined).toBe(planned.has(r.task.id));
    }
  });

  it.each([
    ['the system after the end date', 1, 'system'],
    ['the person starting the Retro on the last day', 0, 'user'],
  ] as const)(
    'links the choice to its carry-over when %s moves the Sprint to Review (F35)',
    (_, days, actor) => {
      const { store, running, unfinished } = chooseUnfinished();
      const { records } = store.getSnapshot();
      const day = addDays(running.end, days);
      const after = memoryStore({
        records,
        clock: { today: day, now: instant(`${day}T00:05:00.000Z`) },
      });
      const change =
        actor === 'system' ? reviewEnded() : beginRetro(running.id);
      expect(after.run(change, { actor }).ok).toBe(true);
      const next = after.getSnapshot();
      const draft = next.records.sprints
        .find((s) => s.state === 'planning')
        ?.tasks.find((t) => t.taskId === unfinished.taskId);
      expect(draft?.carriedFrom).toBe(unfinished.id);
      expect(
        next.records.activities.filter(
          (a) => a.kind === 'sprintTaskCarryLinked',
        ),
      ).toMatchObject([{ actor: 'system', taskId: unfinished.taskId }]);
    },
  );
});
