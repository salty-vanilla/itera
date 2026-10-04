// Weeks that start on Sunday, and weeks that cross a year (#363). The
// Sprint period follows `User.weekStartsOn` and holds both ends; the
// calendar runs on LocalDate strings, so 12/31 → 1/1 must not break it.
import { describe, expect, it } from 'vitest';
import { dueSoonUntil, inBacklogSlice } from './backlog';
import type { Occurrence } from './occurrence';
import { startPlanning } from './planning';
import { createRecurrenceRule } from './recurrence';
import { enterReview } from './review';
import type { CommandContext } from './shared/command';
import { id } from './shared/ids';
import { instant, localDate } from './shared/time';
import { nextUnconfirmedSprintStart, type Sprint } from './sprint';
import { updateTask } from './task';
import { ctx, ids, newTask, sprintFixture, unwrap, user } from './testing';
import type { User } from './user';

const d = localDate;

/** Sunday-start weeks in Tokyo; `user` starts on Monday. */
const sunday: User = { ...user, weekStartsOn: 0 };

/** A Task that recurs every day, so its occurrences list the whole period. */
function daily() {
  return unwrap(
    createRecurrenceRule(
      newTask('ストレッチ', 'task-stretch'),
      {
        id: id('rule-stretch'),
        pattern: { freq: 'daily' },
        effectiveFrom: d('2026-09-01'),
      },
      ctx,
    ),
  );
}

function plan(start: string, weekUser: User, sprints: readonly Sprint[]) {
  return startPlanning(
    {
      sprintId: id(`sprint-${start}`),
      user: weekUser,
      start: d(start),
      sprints,
      recurring: [daily()],
      occurrences: [],
      newOccurrenceId: ids('occ'),
      newSprintTaskId: ids('st-rec'),
    },
    ctx,
  );
}

/**
 * The week planned by `startPlanning` and confirmed: its drafts planned, plus
 * a non-recurring Task, so a Review has something to carry over.
 */
function activeWeek(
  start: string,
  weekUser: User,
  previous: Sprint,
): { sprint: Sprint; occurrences: readonly Occurrence[] } {
  const { sprint, occurrences } = unwrap(plan(start, weekUser, [previous]));
  return {
    sprint: {
      ...sprint,
      state: 'active',
      tasks: [
        ...sprint.tasks.map((t) => ({ ...t, outcome: 'planned' as const })),
        {
          id: id('st-open'),
          taskId: id('task-open'),
          origin: 'planning',
          addedAt: ctx.now,
          goalLink: 'linked',
          outcome: 'planned',
        },
      ],
    },
    occurrences,
  };
}

/** The system at midnight in Tokyo on `date`. */
function systemOn(date: string): CommandContext {
  const now = new Date(`${date}T00:00:00.000+09:00`).toISOString();
  return { now: instant(now), actor: 'system' };
}

function due(date: string) {
  return unwrap(updateTask(newTask(), { due: d(date) }, ctx));
}

describe('a week that starts on Sunday', () => {
  it('startPlanning makes a Sunday–Saturday Sprint and generates that period', () => {
    const previous = sprintFixture('2026-09-20', 'closed');
    const { sprint, occurrences } = unwrap(
      plan('2026-09-27', sunday, [previous]),
    );
    expect(sprint).toMatchObject({
      start: '2026-09-27',
      end: '2026-10-03',
      previousSprintId: previous.id,
    });
    expect(occurrences.map((o) => o.scheduledDate)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('startPlanning refuses a Monday start for a Sunday-start user', () => {
    expect(plan('2026-09-28', sunday, [])).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });

  it('F1: nextUnconfirmedSprintStart is a Sunday', () => {
    const draft = sprintFixture('2026-10-04', 'planning');
    expect(nextUnconfirmedSprintStart([draft], sunday, d('2026-10-01'))).toBe(
      '2026-10-04',
    );
    const current = sprintFixture('2026-09-27', 'active');
    expect(nextUnconfirmedSprintStart([current], sunday, d('2026-10-01'))).toBe(
      '2026-10-04',
    );
    expect(nextUnconfirmedSprintStart([], sunday, d('2026-10-01'))).toBe(
      '2026-09-27',
    );
    // On a Sunday, this week starts today, not on the Monday before.
    expect(nextUnconfirmedSprintStart([], sunday, d('2026-10-04'))).toBe(
      '2026-10-04',
    );
    expect(nextUnconfirmedSprintStart([], user, d('2026-10-04'))).toBe(
      '2026-09-28',
    );
  });

  it('F28: 期限が近い reaches the Sprint’s Saturday, or this week’s', () => {
    const current = sprintFixture('2026-09-27', 'active');
    const holding = {
      user: sunday,
      today: d('2026-10-01'),
      sprints: [current],
      rules: [],
    };
    expect(dueSoonUntil(holding)).toBe('2026-10-03');
    expect(inBacklogSlice(due('2026-10-03'), 'dueSoon', holding)).toBe(true);
    expect(inBacklogSlice(due('2026-10-04'), 'dueSoon', holding)).toBe(false);

    // The Review day after the Sprint (a Sunday): no Sprint holds today, so
    // the week that starts today counts.
    const reviewDay = {
      user: sunday,
      today: d('2026-10-04'),
      sprints: [{ ...current, state: 'review' as const }],
      rules: [],
    };
    expect(dueSoonUntil(reviewDay)).toBe('2026-10-10');
    expect(inBacklogSlice(due('2026-10-10'), 'dueSoon', reviewDay)).toBe(true);
    expect(dueSoonUntil({ ...reviewDay, user, sprints: [] })).toBe(
      '2026-10-04',
    );
    // Saturday is the last day of a Sunday-start week.
    expect(
      dueSoonUntil({ ...reviewDay, today: d('2026-10-03'), sprints: [] }),
    ).toBe('2026-10-03');
  });

  it('F21: the person may start Retro on Saturday; the system on Sunday', () => {
    const previous = sprintFixture('2026-09-20', 'closed');
    const { sprint } = activeWeek('2026-09-27', sunday, previous);
    const review = (today: string, by: CommandContext) =>
      enterReview(sprint, { today: d(today), occurrences: [] }, by);
    expect(review('2026-10-02', ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(review('2026-10-03', ctx)).toMatchObject({ ok: true });
    expect(review('2026-10-03', systemOn('2026-10-03'))).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(review('2026-10-04', systemOn('2026-10-04'))).toMatchObject({
      ok: true,
    });
  });
});

describe('a week that crosses the year', () => {
  it('startPlanning makes 2026-12-28 – 2027-01-03 (Monday) and 2026-12-27 – 2027-01-02 (Sunday)', () => {
    const monday = unwrap(
      plan('2026-12-28', user, [sprintFixture('2026-12-21', 'closed')]),
    );
    expect(monday.sprint).toMatchObject({
      start: '2026-12-28',
      end: '2027-01-03',
    });
    expect(monday.occurrences.map((o) => o.scheduledDate)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);

    const sundayWeek = unwrap(
      plan('2026-12-27', sunday, [sprintFixture('2026-12-20', 'closed')]),
    );
    expect(sundayWeek.sprint).toMatchObject({
      start: '2026-12-27',
      end: '2027-01-02',
    });
    expect(sundayWeek.occurrences.map((o) => o.scheduledDate)).toEqual([
      '2026-12-27',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('invariant 11: the next Sprint starts in the new year after the one that crosses it', () => {
    const crossing = sprintFixture('2026-12-28', 'active');
    const next = unwrap(plan('2027-01-04', user, [crossing]));
    expect(next.sprint).toMatchObject({
      start: '2027-01-04',
      end: '2027-01-10',
      previousSprintId: crossing.id,
    });
    expect(plan('2026-12-28', user, [crossing])).toMatchObject({
      ok: false,
      error: { message: 'The period overlaps or precedes a Sprint.' },
    });

    const sundayCrossing = sprintFixture('2026-12-27', 'active');
    expect(
      unwrap(plan('2027-01-03', sunday, [sundayCrossing])).sprint,
    ).toMatchObject({
      start: '2027-01-03',
      end: '2027-01-09',
      previousSprintId: sundayCrossing.id,
    });
    expect(plan('2026-12-27', sunday, [sundayCrossing])).toMatchObject({
      ok: false,
      error: { message: 'The period overlaps or precedes a Sprint.' },
    });
  });

  it('F1: nextUnconfirmedSprintStart across the year', () => {
    expect(
      nextUnconfirmedSprintStart(
        [sprintFixture('2026-12-28', 'active')],
        user,
        d('2026-12-31'),
      ),
    ).toBe('2027-01-04');
    expect(
      nextUnconfirmedSprintStart(
        [sprintFixture('2026-12-27', 'active')],
        sunday,
        d('2026-12-31'),
      ),
    ).toBe('2027-01-03');
    // On New Year's Day this week started in the old year.
    expect(nextUnconfirmedSprintStart([], user, d('2027-01-01'))).toBe(
      '2026-12-28',
    );
    expect(nextUnconfirmedSprintStart([], sunday, d('2027-01-01'))).toBe(
      '2026-12-27',
    );
  });

  it('F28: 期限が近い reaches into the new year', () => {
    const crossing = sprintFixture('2026-12-28', 'active');
    const holding = {
      user,
      today: d('2026-12-31'),
      sprints: [crossing],
      rules: [],
    };
    expect(dueSoonUntil(holding)).toBe('2027-01-03');
    expect(inBacklogSlice(due('2027-01-03'), 'dueSoon', holding)).toBe(true);
    expect(inBacklogSlice(due('2027-01-04'), 'dueSoon', holding)).toBe(false);
    expect(inBacklogSlice(due('2026-12-30'), 'overdue', holding)).toBe(true);

    const noSprint = { ...holding, sprints: [] };
    expect(dueSoonUntil(noSprint)).toBe('2027-01-03');
    expect(dueSoonUntil({ ...noSprint, user: sunday })).toBe('2027-01-02');

    // The Review day after the crossing week: this (new) week's end.
    const reviewDay = {
      ...holding,
      today: d('2027-01-04'),
      sprints: [{ ...crossing, state: 'review' as const }],
    };
    expect(dueSoonUntil(reviewDay)).toBe('2027-01-10');

    // A Sunday-start week that crosses the year ends on 2027-01-02.
    const sundayHolding = {
      ...holding,
      user: sunday,
      sprints: [sprintFixture('2026-12-27', 'active')],
    };
    expect(dueSoonUntil(sundayHolding)).toBe('2027-01-02');
    expect(inBacklogSlice(due('2027-01-02'), 'dueSoon', sundayHolding)).toBe(
      true,
    );
    expect(inBacklogSlice(due('2027-01-03'), 'dueSoon', sundayHolding)).toBe(
      false,
    );
  });

  it('F21: Review from 2027-01-03 by the person, from 2027-01-04 by the system', () => {
    const { sprint, occurrences } = activeWeek(
      '2026-12-28',
      user,
      sprintFixture('2026-12-21', 'closed'),
    );
    const review = (today: string, by: CommandContext) =>
      enterReview(sprint, { today: d(today), occurrences }, by);
    expect(review('2027-01-02', ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(review('2027-01-03', ctx)).toMatchObject({ ok: true });
    expect(review('2027-01-03', systemOn('2027-01-03'))).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });

    const result = unwrap(review('2027-01-04', systemOn('2027-01-04')));
    expect(result.sprint.state).toBe('review');
    expect(result.sprint.tasks.map((t) => [t.taskId, t.outcome])).toEqual([
      ['task-stretch', 'done'],
      ['task-open', 'carriedOver'],
    ]);
    // Every day of the week, on both sides of New Year, is wrapped up.
    expect(result.occurrences.map((o) => [o.scheduledDate, o.state])).toEqual([
      ['2026-12-28', 'missed'],
      ['2026-12-29', 'missed'],
      ['2026-12-30', 'missed'],
      ['2026-12-31', 'missed'],
      ['2027-01-01', 'missed'],
      ['2027-01-02', 'missed'],
      ['2027-01-03', 'missed'],
    ]);
  });

  it('F21: a Sunday-start week reviews from 2027-01-02 by the person, from 2027-01-03 by the system', () => {
    const { sprint, occurrences } = activeWeek(
      '2026-12-27',
      sunday,
      sprintFixture('2026-12-20', 'closed'),
    );
    const review = (today: string, by: CommandContext) =>
      enterReview(sprint, { today: d(today), occurrences }, by);
    expect(review('2027-01-01', ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    expect(review('2027-01-02', ctx)).toMatchObject({ ok: true });
    expect(review('2027-01-02', systemOn('2027-01-02'))).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });

    const result = unwrap(review('2027-01-03', systemOn('2027-01-03')));
    expect(result.sprint.state).toBe('review');
    expect(result.occurrences.map((o) => o.scheduledDate)).toEqual([
      '2026-12-27',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});
