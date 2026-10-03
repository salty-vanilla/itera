import { id, localDate, startPlanning } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import { planningData } from './planning-view';
import type { Records } from './records';
import { changed, createMemoryStore } from './record-store';

describe('planningData', () => {
  it('is absent when no Sprint is being planned', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    expect(
      planningData(records, clock, { applyCriterion: true }),
    ).toBeUndefined();
  });

  it('can be confirmed once the previous Retro is complete (invariant 12)', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    const data = planningData(records, clock, { applyCriterion: true });
    expect(data?.blockers).toEqual([]);
    expect(data?.number).toBe(2);
  });

  it('offers the Quick Add only the Areas that are not archived (#92)', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    const [first, ...rest] = records.areas;
    if (first === undefined) throw new Error('no Area');
    const archived = {
      ...records,
      areas: [{ ...first, archived: true }, ...rest],
    };
    const data = planningData(archived, clock, { applyCriterion: true });
    expect(data?.addAreas.map((a) => a.id)).toEqual(
      rest.toSorted((a, b) => a.order - b.order).map((a) => a.id),
    );
  });

  it('says why 確定 waits while the previous Retro is open (invariant 12)', () => {
    // 10/5: Sprint 2 is in Review; the next week's Planning starts anyway.
    const store = createMemoryStore(fixtureSnapshot('retro-start'));
    const result = store.run((records, ctx) =>
      changed(
        startPlanning(
          {
            sprintId: id('sprint-2026-10-05'),
            user: records.user,
            start: localDate('2026-10-05'),
            sprints: records.sprints,
            recurring: [],
            occurrences: records.occurrences,
            newOccurrenceId: () => ctx.newId('Occurrence'),
            newSprintTaskId: () => ctx.newId('SprintTask'),
          },
          ctx,
        ),
        ({ sprint, occurrences }) => ({ sprints: [sprint], occurrences }),
      ),
    );
    expect(result.ok).toBe(true);
    const { records, clock } = store.getSnapshot();
    const data = planningData(records, clock, { applyCriterion: true });
    expect(data?.blockers).toEqual(['previousRetroOpen']);
    expect(data?.number).toBe(3);
  });

  it('values drafts with the criterion only while the Check applies it', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    const on = planningData(records, clock, { applyCriterion: true });
    const off = planningData(records, clock, { applyCriterion: false });
    const paper = (data: typeof on) =>
      data?.plan.flatMap((p) => p.tasks).find((t) => t.task.id === 'task-paper')
        ?.value;
    expect(paper(on)).toMatchObject({ lo: 5, hi: 5, criterionApplied: true });
    expect(paper(off)).toMatchObject({ lo: 3, hi: 5, criterionApplied: false });
    expect(on?.totals.total).toMatchObject({ lo: 15.25, hi: 17.25 });
  });

  it('knows whether a chosen Task is one the criterion acts on, with the Switch on or off (#161)', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    for (const applyCriterion of [true, false]) {
      const data = planningData(records, clock, { applyCriterion });
      expect(data?.criterion).toMatchObject({ hasTarget: true });
      expect(data?.criterion?.effect.count).toBe(1);
    }
    // The research Task with a range leaves the week: nothing is left to act on.
    const without: Records = {
      ...records,
      sprints: records.sprints.map((s) =>
        s.state === 'planning'
          ? {
              ...s,
              tasks: s.tasks.map((t) =>
                t.taskId === 'task-paper'
                  ? { ...t, outcome: 'removed' as const }
                  : t,
              ),
            }
          : s,
      ),
    };
    const data = planningData(without, clock, { applyCriterion: true });
    expect(data?.criterion).toMatchObject({ hasTarget: false });
    expect(data?.criterion?.active).toBeDefined();
  });
});
