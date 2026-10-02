import {
  backlogView,
  deferralStreak,
  projectFrom,
  recurrenceSummary,
  retroFacts,
  sprintTotals,
  toLocalDate,
  yesterdaysContinuation,
  type Sprint,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureStates, type FixtureStateId } from './states';
import { sprintIds } from './timeline';

function currentSprint(state: FixtureStateId): Sprint {
  const sprint = fixtureSnapshot(state).records.sprints.find(
    (s) => s.id === sprintIds.current,
  );
  if (sprint === undefined) throw new Error('no current Sprint');
  return sprint;
}

describe('fixture states', () => {
  it('has a snapshot for every state of PRD §12', () => {
    expect(fixtureStates.map((s) => s.id)).toHaveLength(12);
    for (const { id } of fixtureStates) {
      expect(() => fixtureSnapshot(id)).not.toThrow();
    }
  });

  it('keeps 「今日」 on the user’s calendar day of the current time', () => {
    for (const { id } of fixtureStates) {
      const { clock, records } = fixtureSnapshot(id);
      expect(clock.today).toBe(toLocalDate(clock.now, records.user.timeZone));
    }
  });

  it('holds no Activity later than the clock', () => {
    for (const { id } of fixtureStates) {
      const { clock, records } = fixtureSnapshot(id);
      expect(records.activities.every((a) => a.at <= clock.now)).toBe(true);
    }
  });

  it('appends Activity in the order of time', () => {
    for (const { id } of fixtureStates) {
      const { activities } = fixtureSnapshot(id).records;
      const times = activities.map((a) => a.at);
      expect(times).toEqual(times.toSorted());
    }
  });

  it('has the Sprint in Planning through Pick, Shape and Check', () => {
    expect(currentSprint('planning-pick').state).toBe('planning');
    expect(currentSprint('planning-pick').goals).toEqual([]);
    expect(currentSprint('planning-shape').goals).toHaveLength(2);
    const check = fixtureSnapshot('planning-check');
    const totals = sprintTotals(currentSprint('planning-check'), {
      tasks: check.records.tasks,
      now: check.clock.now,
    });
    // Near the available hours, so the Check has something to show.
    expect(totals.total).toMatchObject({ lo: 13.25, hi: 17.25 });
    expect(totals.capacity?.status).toBe('mayExceed');
  });

  it('reproduces Scenario A in Today (derived, not stored)', () => {
    const morning = fixtureSnapshot('today-morning');
    const sprint = currentSprint('today-morning');
    expect(sprint.state).toBe('active');
    expect(morning.clock.today).toBe('2026-10-01');
    expect(
      yesterdaysContinuation(
        sprint,
        morning.records.sprints,
        morning.clock.today,
      ).length,
    ).toBe(1);
    const daytime = fixtureSnapshot('today-daytime');
    expect(
      currentSprint('today-daytime').dailySelections.filter(
        (s) => s.date === daytime.clock.today,
      ).length,
    ).toBeGreaterThan(1);
    expect(currentSprint('today-interrupt').interrupts).toHaveLength(2);
    // Scenario B: 「今日へ」 from the Backlog adds a mid-Sprint Task.
    expect(
      currentSprint('today-interrupt').tasks.some(
        (t) => t.origin === 'midSprint',
      ),
    ).toBe(true);
  });

  it('shows the paper Task deferred twice before 9/30', () => {
    const capture = fixtureSnapshot('backlog-capture');
    const paper = capture.records.tasks.find((t) => t.id === 'task-paper');
    if (paper === undefined) throw new Error('no paper Task');
    // One deferral by the capture time (9/29 noon), the second that evening.
    expect(deferralStreak(capture.records.sprints, paper.id)).toBe(1);
  });

  it('has Backlog states with captured, detailed and recurring Tasks', () => {
    const capture = fixtureSnapshot('backlog-capture');
    expect(backlogView(capture.records.tasks).length).toBeGreaterThanOrEqual(
      10,
    );
    const recurrence = fixtureSnapshot('backlog-recurrence');
    const rule = recurrence.records.rules.find(
      (r) => r.taskId === 'task-cleaning',
    );
    if (rule === undefined) throw new Error('no rule');
    expect(rule.versions).toHaveLength(2);
    expect(rule.versions[1]?.effectiveFrom).toBe('2026-10-05');
    const summary = recurrenceSummary(rule, recurrence.records.occurrences, {
      today: recurrence.clock.today,
      projectFrom: projectFrom(
        recurrence.records.sprints,
        recurrence.clock.today,
      ),
    });
    // This Sprint's Saturday stays; the change is upcoming.
    expect(summary.next?.scheduledDate).toBe('2026-10-03');
    expect(summary.upcoming).toBeDefined();
  });

  it('opens the Retro in Review, and is ready to complete at the end', () => {
    const start = fixtureSnapshot('retro-start');
    const sprint = currentSprint('retro-start');
    expect(sprint.state).toBe('review');
    expect(sprint.retro).toMatchObject({ pins: [], reflection: '' });
    expect(sprint.retro).not.toHaveProperty('improvement');
    const facts = retroFacts(sprint, {
      tasks: start.records.tasks,
      areas: start.records.areas,
      occurrences: start.records.occurrences,
      sprints: start.records.sprints,
    });
    // Scenario A step 13: 提案 3〜5時間 · 計画値 5時間 · 実績 4時間30分、2回続けて見送り
    // （9/28・9/29）、9/30 は「中断」.
    expect(
      facts.carriedOver.find((t) => t.taskId === 'task-paper'),
    ).toMatchObject({
      plan: {
        suggestion: { lo: 3, hi: 5 },
        value: { lo: 5, hi: 5, criterionApplied: true },
      },
      actualHours: 4.5,
      longestDeferralRun: ['2026-09-28', '2026-09-29'],
      pausedDates: ['2026-09-30'],
    });
    expect(currentSprint('retro-reflect').retro?.reflection).toBeDefined();
    const ready = currentSprint('retro-before-complete');
    expect(ready.retro?.improvement).toBeDefined();
    expect(ready.criterionUse?.retroDecision).toBe('continue');
  });
});
