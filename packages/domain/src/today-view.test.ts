import { describe, expect, it } from 'vitest';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type {
  DailyResolution,
  DailySelection,
  Sprint,
  SprintTask,
} from './sprint';
import {
  deferralStreak,
  todayRemaining,
  weekProgress,
  yesterdaysContinuation,
} from './today-view';
import type { Occurrence, OccurrenceState } from './occurrence';
import { ctx, sprintFixture } from './testing';

const taskId = id<'Task'>('task-1');

function sprintTask(
  stId = 'st-1',
  extra: Partial<SprintTask> = {},
): SprintTask {
  return {
    id: id(stId),
    taskId,
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'planned',
    ...extra,
  };
}

function selection(
  date: string,
  resolution: DailyResolution,
  stId = 'st-1',
): DailySelection {
  return {
    id: id(`sel-${date}-${stId}`),
    date: localDate(date),
    sprintTaskId: id(stId),
    origin: 'manual',
    resolution,
    selectedAt: ctx.now,
  };
}

function withSelections(
  resolutions: readonly [string, DailyResolution][],
  start = '2026-09-28',
  st = sprintTask(),
): Sprint {
  return sprintFixture(start, 'active', {
    tasks: [st],
    dailySelections: resolutions.map(([date, r]) => selection(date, r, st.id)),
  });
}

describe('deferralStreak (F4, F8)', () => {
  it('invariant 23: counts deferrals in a row over the days the Task was chosen', () => {
    const sprint = withSelections([
      ['2026-09-28', 'deferred'],
      // 9/29 not chosen: ignored.
      ['2026-09-30', 'deferred'],
    ]);
    expect(deferralStreak([sprint], taskId)).toBe(2);
  });

  it('F8: Deferred → Unresolved → Deferred is 2 (unresolved is ignored)', () => {
    const sprint = withSelections([
      ['2026-09-28', 'deferred'],
      ['2026-09-29', 'unresolved'],
      ['2026-09-30', 'deferred'],
    ]);
    expect(deferralStreak([sprint], taskId)).toBe(2);
  });

  it('F8: Deferred → Skipped → Deferred is 1 (skipped breaks it)', () => {
    const sprint = withSelections([
      ['2026-09-28', 'deferred'],
      ['2026-09-29', 'skipped'],
      ['2026-09-30', 'deferred'],
    ]);
    expect(deferralStreak([sprint], taskId)).toBe(1);
  });

  it.each(['paused', 'done', 'removed'] as const)(
    'invariant 23: %s breaks the run',
    (breaker) => {
      const sprint = withSelections([
        ['2026-09-28', 'deferred'],
        ['2026-09-29', breaker],
        ['2026-09-30', 'deferred'],
      ]);
      expect(deferralStreak([sprint], taskId)).toBe(1);
    },
  );

  it('ends at the latest resolved choice; an open one today does not reset it', () => {
    const sprint = withSelections([
      ['2026-09-28', 'deferred'],
      ['2026-09-29', 'deferred'],
      ['2026-09-30', 'selected'],
    ]);
    expect(deferralStreak([sprint], taskId)).toBe(2);
    expect(
      deferralStreak([withSelections([['2026-09-28', 'paused']])], taskId),
    ).toBe(0);
  });

  it('continues across Sprints for a carried-over Task', () => {
    const last = sprintFixture('2026-09-21', 'closed', {
      tasks: [sprintTask('st-old', { outcome: 'carriedOver' })],
      dailySelections: [selection('2026-09-27', 'deferred', 'st-old')],
    });
    const now = withSelections(
      [['2026-09-28', 'deferred']],
      '2026-09-28',
      sprintTask('st-new'),
    );
    expect(deferralStreak([last, now], taskId)).toBe(2);
  });
});

describe('yesterdaysContinuation (F6)', () => {
  it('lists planned SprintTasks paused yesterday, until chosen again', () => {
    const sprint = withSelections([['2026-09-30', 'paused']]);
    expect(
      yesterdaysContinuation(sprint, [sprint], localDate('2026-10-01')).map(
        (c) => c.sprintTask.id,
      ),
    ).toEqual(['st-1']);
    // Not the day after.
    expect(
      yesterdaysContinuation(sprint, [sprint], localDate('2026-10-02')),
    ).toEqual([]);
    // Chosen again today: no longer a candidate on top.
    const chosen: Sprint = {
      ...sprint,
      dailySelections: [
        ...sprint.dailySelections,
        selection('2026-10-01', 'selected'),
      ],
    };
    expect(
      yesterdaysContinuation(chosen, [chosen], localDate('2026-10-01')),
    ).toEqual([]);
  });

  it('only while the SprintTask is still planned', () => {
    const done = withSelections(
      [['2026-09-30', 'paused']],
      '2026-09-28',
      sprintTask('st-1', { outcome: 'done' }),
    );
    expect(
      yesterdaysContinuation(done, [done], localDate('2026-10-01')),
    ).toEqual([]);
  });

  it('across the week boundary, for the carried-over Task in the new Sprint', () => {
    const last = sprintFixture('2026-09-21', 'review', {
      tasks: [sprintTask('st-old', { outcome: 'carriedOver' })],
      dailySelections: [selection('2026-09-27', 'paused', 'st-old')],
    });
    const now = sprintFixture('2026-09-28', 'active', {
      tasks: [sprintTask('st-new', { carriedFrom: id('st-old') })],
    });
    expect(
      yesterdaysContinuation(now, [last, now], localDate('2026-09-28')).map(
        (c) => c.sprintTask.id,
      ),
    ).toEqual(['st-new']);
  });
});

describe('todayRemaining', () => {
  it('counts open choices of the day and their planned hours, per occurrence', () => {
    const snapshot = (lo: number, hi: number, count?: number) => ({
      value: {
        base: 'suggestion' as const,
        lo,
        hi,
        criterionApplied: false,
        computedAt: ctx.now,
      },
      timeBasis: 'task' as const,
      ...(count === undefined ? {} : { occurrenceCount: count }),
    });
    const sprint = sprintFixture('2026-09-28', 'active', {
      tasks: [
        sprintTask('st-a', { planSnapshot: snapshot(2, 3) }),
        sprintTask('st-b', { planSnapshot: snapshot(3, 3, 3) }),
        sprintTask('st-c'),
        sprintTask('st-d', { planSnapshot: snapshot(1, 1) }),
      ],
      dailySelections: [
        selection('2026-09-29', 'selected', 'st-a'),
        selection('2026-09-29', 'started', 'st-b'),
        selection('2026-09-29', 'selected', 'st-c'),
        selection('2026-09-29', 'done', 'st-d'),
        selection('2026-09-28', 'selected', 'st-d'),
      ],
    });
    expect(todayRemaining(sprint, localDate('2026-09-29'))).toEqual({
      count: 3,
      lo: 3,
      hi: 4,
      unestimated: 1,
    });
  });
});

describe('weekProgress (F32)', () => {
  function occurrence(n: number, state: OccurrenceState): Occurrence {
    return {
      id: id(`occ-${n}`),
      taskId: id('task-r'),
      ruleId: id('rule-r'),
      scheduledDate: localDate(`2026-09-2${8 + (n % 2)}`),
      ruleVersion: 1,
      materializedAt: ctx.now,
      state,
      stateChangedAt: ctx.now,
    };
  }

  it('counts a Task once and a recurring Task per occurrence', () => {
    const occurrences = [
      occurrence(1, 'done'),
      occurrence(2, 'pending'),
      occurrence(3, 'missed'),
      occurrence(4, 'skipped'),
      occurrence(5, 'excluded'),
    ];
    const sprint = sprintFixture('2026-09-28', 'active', {
      tasks: [
        sprintTask('st-1', { outcome: 'done' }),
        sprintTask('st-2'),
        sprintTask('st-3', { outcome: 'removed' }),
        sprintTask('st-4', {
          taskId: id('task-r'),
          occurrenceIds: occurrences.map((o) => o.id),
        }),
      ],
    });
    // 2 Tasks (removed not counted) + 3 occurrences (skipped and excluded
    // not counted); done: 1 Task + 1 occurrence.
    expect(weekProgress(sprint, occurrences)).toEqual({ done: 2, total: 5 });
  });

  it('is empty for an empty week', () => {
    expect(weekProgress(sprintFixture('2026-09-28', 'active', {}), [])).toEqual(
      { done: 0, total: 0 },
    );
  });
});
