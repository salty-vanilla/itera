import { describe, expect, it } from 'vitest';
import { completeOccurrence, type Occurrence } from './occurrence';
import { excludeFromPlan, startPlanning } from './planning';
import { createRecurrenceRule } from './recurrence';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import type { Sprint } from './sprint';
import { changeRuleForNextSprint } from './sprint-recurrence';
import { at, ctx, ids, newTask, sprintFixture, unwrap, user } from './testing';

const d = localDate;
const saturday = { freq: 'weekly', daysOfWeek: [6] } as const;
const sunday = { freq: 'weekly', daysOfWeek: [0] } as const;

/**
 * 9/28 week is active with its Saturday done; the 10/5 week is already in
 * Planning (the previous Retro is still open) with its Saturday generated.
 */
function setUp() {
  const { task, rule } = unwrap(
    createRecurrenceRule(
      newTask('部屋の掃除', 'task-clean'),
      { id: id('rule-1'), pattern: saturday, effectiveFrom: d('2026-09-28') },
      ctx,
    ),
  );
  const newOccurrenceId = ids<'Occurrence'>('occ');
  const current = unwrap(
    startPlanning(
      {
        sprintId: id('sprint-2026-09-28'),
        user,
        start: d('2026-09-28'),
        sprints: [],
        recurring: [{ task, rule }],
        occurrences: [],
        newOccurrenceId,
        newSprintTaskId: ids('st-a'),
      },
      ctx,
    ),
  );
  const [oct3] = current.occurrences;
  if (oct3 === undefined) throw new Error('no occurrence');
  const done = unwrap(completeOccurrence(oct3, ctx));
  const active: Sprint = { ...current.sprint, state: 'review' };
  const next = unwrap(
    startPlanning(
      {
        sprintId: id('sprint-2026-10-05'),
        user,
        start: d('2026-10-05'),
        sprints: [active],
        recurring: [{ task, rule }],
        occurrences: [done],
        newOccurrenceId,
        newSprintTaskId: ids('st-b'),
      },
      ctx,
    ),
  );
  const occurrences: Occurrence[] = [done, ...next.occurrences];
  return {
    task,
    rule,
    active,
    draft: next.sprint,
    occurrences,
    newOccurrenceId,
  };
}

describe('changeRuleForNextSprint (F1, F7)', () => {
  it('F7: rebuilds the draft’s occurrences; the confirmed Sprint keeps its own', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    expect(draft.tasks).toMatchObject([
      { occurrenceIds: ['occ-2'], outcome: 'draft' },
    ]);

    const result = changeRuleForNextSprint(
      {
        task,
        rule,
        pattern: sunday,
        user,
        today: d('2026-10-04'),
        sprints: [active, draft],
        occurrences,
        newOccurrenceId,
        newSprintTaskId: ids('st-new'),
      },
      at('2026-10-04T10:00:00.000Z'),
    );
    const applied = unwrap(result);
    expect(applied.rule.versions.at(-1)).toEqual({
      version: 2,
      pattern: sunday,
      effectiveFrom: '2026-10-05',
    });
    expect(applied.discarded).toEqual(['occ-2']);
    expect(
      applied.generated.map((o) => [o.scheduledDate, o.ruleVersion]),
    ).toEqual([['2026-10-11', 2]]);
    expect(applied.sprint?.tasks).toMatchObject([
      { id: 'st-new-1', occurrenceIds: ['occ-3'], outcome: 'draft' },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleChanged',
      'occurrenceDiscarded',
      'occurrenceGenerated',
      'sprintTaskUnselected',
      'sprintTaskAdded',
    ]);
    // The 9/28 week (not in Planning) is untouched: its 10/3 stays done on v1.
    expect(occurrences[0]).toMatchObject({
      scheduledDate: '2026-10-03',
      ruleVersion: 1,
      state: 'done',
    });
  });

  it('F7: occurrences left out in the draft are rebuilt too, included by default', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const [, oct10] = occurrences;
    if (oct10 === undefined) throw new Error('no occurrence');
    const excluded = unwrap(excludeFromPlan(draft, oct10, ctx));
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-10-04'),
          sprints: [active, excluded.sprint],
          occurrences: [occurrences[0] as Occurrence, excluded.occurrence],
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      ),
    );
    expect(applied.discarded).toEqual([oct10.id]);
    expect(applied.sprint?.tasks).toMatchObject([{ outcome: 'draft' }]);
  });

  it('F1: without a draft, the change starts after the active Sprint and nothing is rebuilt', () => {
    const { task, rule, active, occurrences, newOccurrenceId } = setUp();
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-09-30'),
          sprints: [{ ...active, state: 'active' }],
          occurrences: occurrences.slice(0, 1),
          newOccurrenceId,
          newSprintTaskId: ids('st-new'),
        },
        ctx,
      ),
    );
    expect(applied.rule.versions.at(-1)?.effectiveFrom).toBe('2026-10-05');
    expect(applied).not.toHaveProperty('sprint');
    expect(applied.discarded).toEqual([]);
  });

  it('changing to the same pattern changes nothing', () => {
    const { task, rule, active, draft, occurrences, newOccurrenceId } = setUp();
    const result = changeRuleForNextSprint(
      {
        task,
        rule,
        pattern: saturday,
        user,
        today: d('2026-10-04'),
        sprints: [active, draft],
        occurrences,
        newOccurrenceId,
        newSprintTaskId: ids('st-new'),
      },
      ctx,
    );
    expect(result.ok && result.value).toEqual({
      record: { rule, discarded: [], generated: [] },
      activities: [],
    });
  });
});

describe('sprintFixture', () => {
  it('is a one-week period', () => {
    expect(sprintFixture('2026-09-28', 'planning')).toMatchObject({
      start: '2026-09-28',
      end: '2026-10-04',
    });
  });
});
