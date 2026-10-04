// Issue #89: planning the next Sprint while this one is still running.
// Choosing a Task for Sprint N+1 in the middle of Sprint N must end with
// the same carry-over as choosing it from 持ち越し after N's Review: the
// link is made when N enters Review (F35), and the draft does not hide the
// count in the meantime (F36).
import { describe, expect, it } from 'vitest';
import { carryOverOf } from './backlog';
import {
  carriedOverFrom,
  carryOverCandidates,
  confirmSprint,
  selectTask,
  startPlanning,
} from './planning';
import { retroFacts } from './retro-facts';
import { completeRetro, enterReview } from './review';
import { id } from './shared/ids';
import { instant, localDate } from './shared/time';
import type { Sprint, SprintTask } from './sprint';
import { at, ids, newTask, sprintFixture, unwrap, user } from './testing';

const task = newTask();
const system = (iso: string) => ({
  now: instant(iso),
  actor: 'system' as const,
});

// Task X was carried over in Sprint N-1 and chosen from 持ち越し for N,
// where it is still unfinished.
const beforePrevious = sprintFixture('2026-09-21', 'closed', {
  tasks: [
    {
      id: id('st-prev'),
      taskId: task.id,
      origin: 'planning',
      addedAt: at('2026-09-20T00:00:00.000Z').now,
      goalLink: 'linked',
      outcome: 'carriedOver',
    },
  ],
});
const running = sprintFixture('2026-09-28', 'active', {
  previousSprintId: beforePrevious.id,
  confirmedAt: at('2026-09-27T00:00:00.000Z').now,
  tasks: [
    {
      id: id('st-n'),
      taskId: task.id,
      origin: 'planning',
      addedAt: at('2026-09-27T00:00:00.000Z').now,
      goalLink: 'linked',
      outcome: 'planned',
      carriedFrom: id('st-prev'),
    },
  ],
});

function planNext(sprints: readonly Sprint[], iso: string): Sprint {
  return unwrap(
    startPlanning(
      {
        sprintId: id('sprint-next'),
        user,
        start: localDate('2026-10-05'),
        sprints,
        recurring: [],
        occurrences: [],
        newOccurrenceId: ids('occ'),
        newSprintTaskId: ids('st-new'),
      },
      at(iso),
    ),
  ).sprint;
}

function choose(sprint: Sprint, iso: string, carriedFrom?: SprintTask): Sprint {
  return unwrap(
    selectTask(
      sprint,
      {
        sprintTaskId: id('st-next'),
        task,
        ...(carriedFrom === undefined ? {} : { carriedFrom }),
      },
      at(iso),
    ),
  );
}

function closeRunning(next?: Sprint) {
  const reviewed = unwrap(
    enterReview(
      running,
      {
        today: localDate('2026-10-05'),
        occurrences: [],
        ...(next === undefined ? {} : { next }),
      },
      system('2026-10-04T15:00:00.000Z'),
    ),
  );
  const closed = unwrap(
    completeRetro(
      reviewed.sprint,
      { criteria: [] },
      at('2026-10-05T01:00:00.000Z'),
    ),
  ).sprint;
  return { closed, next: reviewed.next };
}

/** Confirms N+1 and runs it to its Review with X still unfinished. */
function runNext(closed: Sprint, draft: Sprint) {
  const sprints = [beforePrevious, closed, draft];
  const confirmed = unwrap(
    confirmSprint(
      draft,
      { sprints, tasks: [task], areas: [], applyCriterion: false },
      at('2026-10-05T02:00:00.000Z'),
    ),
  );
  const ended = unwrap(
    enterReview(
      confirmed,
      { today: localDate('2026-10-12'), occurrences: [] },
      system('2026-10-11T15:00:00.000Z'),
    ),
  ).sprint;
  const all = [beforePrevious, closed, ended];
  const fact = retroFacts(ended, {
    tasks: [task],
    areas: [],
    occurrences: [],
    sprints: all,
  }).carriedOver.find((f) => f.taskId === task.id);
  return {
    carriedFrom: ended.tasks[0]?.carriedFrom,
    carryCount: fact?.carryCount,
    carryOver: carryOverOf(task.id, all),
  };
}

describe('Issue #89: choosing for the next Sprint while this one runs', () => {
  it('keeps the carry-over count while the Task is only chosen (F36)', () => {
    const draft = choose(
      planNext([beforePrevious, running], '2026-09-30T03:00:00.000Z'),
      '2026-09-30T03:05:00.000Z',
    );
    expect(draft.tasks[0]?.carriedFrom).toBeUndefined();
    expect(carryOverOf(task.id, [beforePrevious, running, draft])).toEqual({
      count: 1,
      fromSprintId: beforePrevious.id,
    });
  });

  it('ends with the same link and counts as choosing after the Review (F35)', () => {
    // Mid-week: N+1 is planned and X chosen on its own; then N ends.
    const early = choose(
      planNext([beforePrevious, running], '2026-09-30T03:00:00.000Z'),
      '2026-09-30T03:05:00.000Z',
    );
    const midWeek = closeRunning(early);
    const linked = midWeek.next;
    expect(linked?.tasks[0]?.carriedFrom).toBe(id('st-n'));
    expect(
      carryOverCandidates(midWeek.closed, linked ?? early, [task]),
    ).toEqual([]);
    expect(
      carryOverOf(task.id, [beforePrevious, midWeek.closed, linked ?? early]),
    ).toEqual({ count: 2, fromSprintId: beforePrevious.id });

    // After the Review: N ends first; X is chosen from 持ち越し.
    const afterReview = closeRunning();
    const planned = planNext(
      [beforePrevious, afterReview.closed],
      '2026-10-05T01:30:00.000Z',
    );
    const [candidate] = carryOverCandidates(afterReview.closed, planned, [
      task,
    ]);
    const late = choose(planned, '2026-10-05T01:35:00.000Z', candidate);

    const a = runNext(midWeek.closed, linked ?? early);
    const b = runNext(afterReview.closed, late);
    expect(a).toEqual(b);
    expect(a).toEqual({
      carriedFrom: id('st-n'),
      carryCount: 2,
      carryOver: { count: 3, fromSprintId: beforePrevious.id },
    });
  });

  it('carriedOverFrom: nothing while N runs, its carry-over once N enters Review (F35, #349)', () => {
    const next = planNext(
      [beforePrevious, running],
      '2026-09-30T03:00:00.000Z',
    );
    expect(next.previousSprintId).toBe(running.id);
    expect(
      carriedOverFrom(next, task.id, [beforePrevious, running, next]),
    ).toBeUndefined();
    const { closed } = closeRunning();
    expect(
      carriedOverFrom(next, task.id, [beforePrevious, closed, next]),
    ).toEqual(closed.tasks[0]);
    expect(closed.tasks[0]).toMatchObject({
      id: 'st-n',
      outcome: 'carriedOver',
    });
    // Only the previous Sprint's, and only the Task's own.
    expect(
      carriedOverFrom(running, task.id, [beforePrevious, running]),
    ).toEqual(beforePrevious.tasks[0]);
    expect(
      carriedOverFrom(next, id('task-other'), [closed, next]),
    ).toBeUndefined();
  });
});
