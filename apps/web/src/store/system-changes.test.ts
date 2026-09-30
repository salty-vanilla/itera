import { addDays, instant, type Sprint } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import { chooseTasks } from './planning-changes';
import { planningData } from './planning-view';
import { createMemoryStore } from './record-store';
import { beginPlanning } from './retro-changes';
import { reviewEnded } from './system-changes';

// Issue #89: the next Sprint is planned while this one still runs.
describe('planning the next Sprint mid-week', () => {
  function chooseUnfinished() {
    const store = createMemoryStore(fixtureSnapshot('today-daytime'));
    const running = store
      .getSnapshot()
      .records.sprints.find((s) => s.state === 'active') as Sprint;
    const unfinished = running.tasks.find(
      (t) => t.outcome === 'planned' && t.occurrenceIds === undefined,
    );
    if (unfinished === undefined) throw new Error('No unfinished Task.');
    expect(store.run(beginPlanning()).ok).toBe(true);
    expect(store.run(chooseTasks([unfinished.taskId])).ok).toBe(true);
    return { store, running, unfinished };
  }

  it('marks a candidate still unfinished in the running Sprint, and it can be chosen', () => {
    const { store, running, unfinished } = chooseUnfinished();
    const { records, clock } = store.getSnapshot();
    const data = planningData(records, clock, { applyCriterion: false });
    const rows = [
      ...(data?.candidates.carriedOver ?? []),
      ...(data?.candidates.dueSoon ?? []),
      ...(data?.candidates.others ?? []),
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

  it('links the choice to its carry-over when the running Sprint enters Review (F35)', () => {
    const { store, running, unfinished } = chooseUnfinished();
    const { records } = store.getSnapshot();
    const after = createMemoryStore({
      records,
      clock: {
        today: addDays(running.end, 1),
        now: instant(`${addDays(running.end, 1)}T00:05:00.000Z`),
      },
    });
    expect(after.run(reviewEnded(), { actor: 'system' }).ok).toBe(true);
    const next = after.getSnapshot();
    const draft = next.records.sprints
      .find((s) => s.state === 'planning')
      ?.tasks.find((t) => t.taskId === unfinished.taskId);
    expect(draft?.carriedFrom).toBe(unfinished.id);
    expect(
      next.records.activities.filter((a) => a.kind === 'sprintTaskCarryLinked'),
    ).toMatchObject([{ actor: 'system', taskId: unfinished.taskId }]);
  });
});
