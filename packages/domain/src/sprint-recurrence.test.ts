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
function setUp(options: { completeOct3?: boolean } = {}) {
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
  const done =
    options.completeOct3 === false
      ? oct3
      : unwrap(completeOccurrence(oct3, ctx));
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
      record: {
        rule,
        effectiveFrom: '2026-10-05',
        discarded: [],
        generated: [],
      },
      activities: [],
    });
  });
});

describe('changeRuleForNextSprint — guards and edges', () => {
  function change(
    input: Partial<Parameters<typeof changeRuleForNextSprint>[0]>,
    base = setUp(),
  ) {
    return changeRuleForNextSprint(
      {
        task: base.task,
        rule: base.rule,
        pattern: sunday,
        user,
        today: d('2026-10-04'),
        sprints: [base.active, base.draft],
        occurrences: base.occurrences,
        newOccurrenceId: base.newOccurrenceId,
        newSprintTaskId: ids('st-new'),
        ...input,
      },
      ctx,
    );
  }

  it('invariant 31: a pending occurrence of the confirmed Sprint is neither discarded nor moved', () => {
    const base = setUp({ completeOct3: false });
    const applied = unwrap(change({}, base));
    expect(base.occurrences[0]).toMatchObject({
      state: 'pending',
      ruleVersion: 1,
    });
    expect(applied.discarded).toEqual(['occ-2']);
    expect(applied.effectiveFrom).toBe('2026-10-05');
  });

  it('leaves a draft alone when it has not generated this rule’s occurrences', () => {
    const base = setUp();
    const noOccurrences = unwrap(
      change({ occurrences: [base.occurrences[0] as Occurrence] }, base),
    );
    expect(noOccurrences).not.toHaveProperty('sprint');
    expect(noOccurrences.generated).toEqual([]);
  });

  it('refuses a rule of another Task or a Task that is not active', () => {
    const base = setUp();
    const other = {
      ...newTask('別', 'task-other'),
      recurrenceRuleId: base.rule.id,
    };
    expect(change({ task: other }, base)).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
    const archived = { ...base.task, lifecycle: 'archived' as const };
    expect(change({ task: archived }, base)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
  });

  it('a rule created for a later Sprint is changed from its own start', () => {
    const { task, rule } = unwrap(
      createRecurrenceRule(
        newTask('読書', 'task-read'),
        {
          id: id('rule-read'),
          pattern: saturday,
          effectiveFrom: d('2026-10-12'),
        },
        ctx,
      ),
    );
    const applied = unwrap(
      changeRuleForNextSprint(
        {
          task,
          rule,
          pattern: sunday,
          user,
          today: d('2026-10-01'),
          sprints: [sprintFixture('2026-09-28', 'active')],
          occurrences: [],
          newOccurrenceId: ids('occ'),
          newSprintTaskId: ids('st'),
        },
        ctx,
      ),
    );
    expect(applied.effectiveFrom).toBe('2026-10-12');
    expect(
      applied.rule.versions.map((v) => [
        v.version,
        v.effectiveFrom,
        v.effectiveTo,
      ]),
    ).toEqual([
      [1, '2026-10-12', '2026-10-11'],
      [2, '2026-10-12', undefined],
    ]);
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
