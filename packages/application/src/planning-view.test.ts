import {
  id,
  localDate,
  startPlanning,
  totalPlanningValues,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import { sprintPlanOf } from './planning-view';
import type { Clock, Records } from './records';
import { changed } from './record-store';
import { memoryStore, tagged } from './testing';

const ids = fixtureIds();

/** The plan of the Sprint being planned, if there is one. */
function planOf(
  { records, clock }: { records: Records; clock: Clock },
  options: { applyCriterion: boolean },
) {
  const read = tagged(records);
  const sprint = read.sprints.find((s) => s.state === 'planning');
  return sprint === undefined
    ? undefined
    : sprintPlanOf(read, clock, sprint, options);
}

describe('sprintPlanOf', () => {
  it('can be confirmed once the previous Retro is complete (invariant 12)', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    const data = planOf({ records, clock }, { applyCriterion: true });
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
    const data = planOf({ records: archived, clock }, { applyCriterion: true });
    expect(data?.addAreas.map((a) => a.id)).toEqual(
      rest.toSorted((a, b) => a.order - b.order).map((a) => a.id),
    );
  });

  it('says why 確定 waits while the previous Retro is open (invariant 12)', () => {
    // 10/5: Sprint 2 is in Review; the next week's Planning starts anyway.
    const store = memoryStore(fixtureSnapshot('retro-start'));
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
    const data = planOf({ records, clock }, { applyCriterion: true });
    expect(data?.blockers).toEqual(['previousRetroOpen']);
    expect(data?.number).toBe(3);
  });

  it('values drafts with the criterion only while the Check applies it', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    const on = planOf({ records, clock }, { applyCriterion: true });
    const off = planOf({ records, clock }, { applyCriterion: false });
    const paper = (data: typeof on) =>
      data?.plan
        .flatMap((p) => p.tasks)
        .find((t) => t.task.id === ids.task.paper)?.value;
    expect(paper(on)).toMatchObject({ lo: 5, hi: 5, criterionApplied: true });
    expect(paper(off)).toMatchObject({ lo: 3, hi: 5, criterionApplied: false });
    expect(on?.totals.total).toMatchObject({ lo: 15.25, hi: 17.25 });
  });

  it('lists the chosen Tasks left out of the total, whole or in part, as it counts them (invariant 8, #348)', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    // The review loses its Estimate and has no suggestion: no value at all.
    const unestimated: Records = {
      ...records,
      tasks: records.tasks.map((t) => {
        if (t.id !== ids.task.apiReview) return t;
        const { estimate: _estimate, ...rest } = t;
        void _estimate;
        return { ...rest, suggestions: [] };
      }),
    };
    for (const applyCriterion of [true, false]) {
      const data = planOf({ records: unestimated, clock }, { applyCriterion });
      const rows = data?.plan.flatMap((p) => p.tasks) ?? [];
      const values = (sprintTaskIds: readonly string[]) =>
        rows
          .filter((r) => sprintTaskIds.includes(r.sprintTask.id))
          .map((r) => r.value);
      const taskOf = (sprintTaskId: string) =>
        rows.find((r) => r.sprintTask.id === sprintTaskId)?.task.id;
      // A Task with no value, and one with a subtask without an Estimate.
      expect(data?.notInTotal.map(taskOf)).toEqual([
        ids.task.apiReview,
        ids.task.dataset,
      ]);
      expect(values(data?.notInTotal ?? []).map((v) => v.base)).toEqual([
        'none',
        'subtasks',
      ]);
      // What the total leaves out is all in the list, and only that.
      const inList = totalPlanningValues(values(data?.notInTotal ?? []));
      expect(inList.unestimated).toBe(data?.totals.total.unestimated);
      expect(inList.unestimatedSubtasks).toBe(
        data?.totals.total.unestimatedSubtasks,
      );
      const rest = totalPlanningValues(
        rows
          .filter((r) => !(data?.notInTotal ?? []).includes(r.sprintTask.id))
          .map((r) => r.value),
      );
      expect(rest.unestimated + rest.unestimatedSubtasks).toBe(0);
    }
    // Everything estimated: nothing is listed.
    const pick = fixtureSnapshot('planning-pick');
    expect(planOf(pick, { applyCriterion: true })?.notInTotal).toEqual([]);
  });

  it('knows whether a chosen Task is one the criterion acts on, with the Switch on or off (#161)', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    for (const applyCriterion of [true, false]) {
      const data = planOf({ records, clock }, { applyCriterion });
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
                t.taskId === ids.task.paper
                  ? { ...t, outcome: 'removed' as const }
                  : t,
              ),
            }
          : s,
      ),
    };
    const data = planOf({ records: without, clock }, { applyCriterion: true });
    expect(data?.criterion).toMatchObject({ hasTarget: false });
    expect(data?.criterion?.active).toBeDefined();
  });

  it('says why 確定 waits while a chosen Task is completed or archived, on its row (#349)', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    const archived: Records = {
      ...records,
      tasks: records.tasks.map((t) =>
        t.id === ids.task.paper ? { ...t, lifecycle: 'archived' as const } : t,
      ),
    };
    const data = planOf({ records: archived, clock }, { applyCriterion: true });
    expect(data?.blockers).toEqual(['inactiveTasks']);
    const rows = data?.plan.flatMap((p) => p.tasks) ?? [];
    expect(
      rows.filter((r) => r.inactive !== undefined).map((r) => r.task.id),
    ).toEqual([ids.task.paper]);
    expect(rows.find((r) => r.task.id === ids.task.paper)?.inactive).toBe(
      'archived',
    );
    expect(data?.previous).toBeUndefined();
  });
});
