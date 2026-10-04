import type { Instant, LocalDate } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import type { Records } from './records';
import { retroData } from './retro-view';
import { runningData } from './running-view';
import { tagged } from './testing';

const ids = fixtureIds();

const withActive = (
  records: Records,
  change: (s: Records['sprints'][number]) => Records['sprints'][number],
): Records => ({
  ...records,
  sprints: records.sprints.map((s) => (s.state === 'active' ? change(s) : s)),
});

describe('runningData', () => {
  it('is absent without a running Sprint', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    expect(runningData(tagged(records), clock)).toBeUndefined();
  });

  it('has no day count before the first day', () => {
    const { records } = fixtureSnapshot('today-interrupt');
    const data = runningData(tagged(records), {
      today: '2026-09-27' as LocalDate,
      now: '2026-09-27T12:00:00.000Z' as Instant,
    });
    expect(data?.day).toBeUndefined();
  });

  it('has the planned total and the totals per Area only, with no capacity', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const data = runningData(tagged(records), clock);
    expect(Object.keys(data?.totals ?? {}).toSorted()).toEqual([
      'byArea',
      'total',
    ]);
  });

  it('leaves out Tasks removed from the Sprint, from the list and the total', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const before = runningData(tagged(records), clock);
    const removed = withActive(records, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.taskId === ids.task.interview ? { ...t, outcome: 'removed' } : t,
      ),
    }));
    const data = runningData(tagged(removed), clock);
    const shown = data?.plan.flatMap((p) => p.tasks.map((t) => t.task.id));
    expect(shown).not.toContain(ids.task.interview);
    expect(data?.totals.total.lo).toBeLessThan(before?.totals.total.lo ?? 0);
  });

  it('shows Tasks without an Area last, and no criterion when there was none', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const noArea = {
      ...withActive(records, (s) => {
        const { criterionUse: _unused, ...rest } = s;
        void _unused;
        return rest;
      }),
      tasks: records.tasks.map((t) => {
        if (t.id !== ids.task.tax) return t;
        const { areaId: _a, ...rest } = t;
        void _a;
        return rest;
      }),
    };
    const data = runningData(tagged(noArea), clock);
    expect(data?.plan.at(-1)?.area).toBeUndefined();
    expect(data?.plan.at(-1)?.tasks.map((t) => t.task.id)).toEqual([
      ids.task.tax,
    ]);
    expect(data?.criterion).toBeUndefined();
  });

  it('knows whether the criterion had a planned value to act on (#161, F42)', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    expect(runningData(tagged(records), clock)?.criterion).toMatchObject({
      applied: true,
      noEffect: false,
    });
    // Applied at confirm, but no planned value came from it (the
    // suggestions were points).
    const none = withActive(records, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.planSnapshot === undefined
          ? t
          : {
              ...t,
              planSnapshot: {
                ...t.planSnapshot,
                ...(t.planSnapshot.suggestion === undefined
                  ? {}
                  : {
                      suggestion: {
                        ...t.planSnapshot.suggestion,
                        hi: t.planSnapshot.suggestion.lo,
                      },
                    }),
                value: { ...t.planSnapshot.value, criterionApplied: false },
              },
            },
      ),
    }));
    expect(runningData(tagged(none), clock)?.criterion).toMatchObject({
      applied: true,
      noEffect: true,
    });
    // Switched off by the person with a range it would act on: it stays
    // whole. Without one it is a line, as it is not applied (F42, #162).
    const switchedOff = (from: typeof records, range: boolean) =>
      withActive(from, (s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          const snapshot = t.planSnapshot;
          if (snapshot?.suggestion === undefined) return t;
          if (snapshot.value.base !== 'suggestion') return t;
          // Without a range, the suggestion was a point (invariant 9).
          const { lo, hi } = range
            ? snapshot.suggestion
            : { lo: snapshot.suggestion.lo, hi: snapshot.suggestion.lo };
          return {
            ...t,
            planSnapshot: {
              ...snapshot,
              suggestion: { ...snapshot.suggestion, lo, hi },
              value: { ...snapshot.value, lo, hi, criterionApplied: false },
            },
          };
        }),
        ...(s.criterionUse === undefined
          ? {}
          : { criterionUse: { ...s.criterionUse, appliedAtConfirm: false } }),
      }));
    expect(
      runningData(tagged(switchedOff(records, true)), clock)?.criterion,
    ).toMatchObject({ applied: false, noEffect: false });
    expect(
      runningData(tagged(switchedOff(records, false)), clock)?.criterion,
    ).toMatchObject({ applied: false, noEffect: true });
  });

  it('tells what undoing a past day leaves (F33, F17, F29)', () => {
    const { records } = fixtureSnapshot('today-interrupt');
    const withKinds = withActive(records, (s) => ({
      ...s,
      dailySelections: s.dailySelections.map((d) =>
        d.date === '2026-09-29' && d.resolution === 'done'
          ? {
              ...d,
              closedBefore: {
                resolution: 'deferred' as const,
                at: '2026-09-29T01:00:00.000Z' as Instant,
              },
            }
          : d.date === '2026-09-30' && d.resolution === 'done'
            ? { ...d, origin: 'backlogCompletion' as const }
            : d,
      ),
    }));
    const data = runningData(tagged(withKinds), {
      today: '2026-10-01' as LocalDate,
      now: '2026-10-01T05:00:00.000Z' as Instant,
    });
    const kinds = Object.fromEntries(
      (data?.pastDays ?? []).map((d) => [
        d.date,
        d.records.map((r) => r.after.kind),
      ]),
    );
    expect(kinds).toEqual({
      '2026-09-30': ['gone'],
      '2026-09-29': ['closed'],
      '2026-09-28': ['unresolved'],
    });
  });

  it('shows an ended Sprint by id, read only, with its carried-over Tasks (#90)', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const closed = records.sprints.find((s) => s.state === 'closed')!;
    const data = runningData(tagged(records), clock, closed.id);
    expect(data?.sprint.id).toBe(closed.id);
    // Last week: the Sprint Header says so (#168).
    expect(data?.week).toBe('previous');
    expect(data?.day).toBeUndefined();
    expect(data?.pastDays).toEqual([]);
    const outcomes = data?.plan.flatMap((p) =>
      p.tasks.map((t) => [t.task.id, t.sprintTask.outcome]),
    );
    expect(outcomes).toContainEqual([ids.task.apiReview, 'carriedOver']);
    // The Retro's planned total, carried-over Tasks included.
    const facts = retroData(tagged(records), clock, closed.id)?.facts;
    expect(data?.totals.total).toEqual(facts?.plannedTotal.withAdditions);
    expect(data?.totals.byArea).toEqual([]);
    // Areas with neither a Goal nor Tasks are left out once ended.
    expect(
      data?.plan.every((p) => p.goal !== undefined || p.tasks.length > 0),
    ).toBe(true);
  });

  it('calls the running Sprint 「今週」 and is absent for one being planned', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    const planning = records.sprints.find((s) => s.state === 'planning')!;
    expect(runningData(tagged(records), clock, planning.id)).toBeUndefined();
    const running = fixtureSnapshot('today-daytime');
    expect(runningData(tagged(running.records), running.clock)?.week).toBe(
      'current',
    );
  });
});

describe('retroData (#90)', () => {
  it('opens a closed Sprint’s Retro by id', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const closed = records.sprints.find((s) => s.state === 'closed')!;
    const data = retroData(tagged(records), clock, closed.id);
    expect(data?.number).toBe(1);
    expect(data?.improvement).toBe('研究の見積もりは提案の多めの値で計画する');
    // No Sprint in Review: nothing by default.
    expect(retroData(tagged(records), clock)).toBeUndefined();
  });

  it('is absent for a Sprint whose Retro has not started', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const running = records.sprints.find((s) => s.state === 'active')!;
    expect(retroData(tagged(records), clock, running.id)).toBeUndefined();
  });
});
