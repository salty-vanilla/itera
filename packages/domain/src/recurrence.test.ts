import { describe, expect, it } from 'vitest';
import { backlogView } from './backlog';
import {
  excludeOccurrence,
  generateOccurrences,
  type Occurrence,
} from './occurrence';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  endRecurrenceRule,
  endingRuleOf,
  nextOccurrence,
  recurrenceOf,
  recurrenceSummary,
  renewedRecurrenceSummary,
  scheduledDates,
  versionOn,
  type RecurrencePattern,
  type RecurrenceRule,
} from './recurrence';
import { id } from './shared/ids';
import { localDate } from './shared/time';
import { archiveTask, completeTask, type Task } from './task';
import { ctx, newTask, unwrap } from './testing';

const d = localDate;

function recurring(
  pattern: RecurrencePattern,
  effectiveFrom = '2026-01-01',
): { task: Task; rule: RecurrenceRule } {
  return unwrap(
    createRecurrenceRule(
      newTask('部屋の掃除'),
      { id: id('rule-1'), pattern, effectiveFrom: d(effectiveFrom) },
      ctx,
    ),
  );
}

function dates(rule: RecurrenceRule, start: string, end: string): string[] {
  return scheduledDates(rule, d(start), d(end)).map((s) => s.scheduledDate);
}

let nextId = 0;
const newOccurrenceId = () => id<'Occurrence'>(`occ-${++nextId}`);

describe('RecurrenceRule', () => {
  it('makes a Task recurring without generating any occurrence (invariant 32)', () => {
    const result = createRecurrenceRule(
      newTask(),
      {
        id: id('rule-1'),
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: d('2026-08-03'),
      },
      ctx,
    );
    const { task, rule } = unwrap(result);
    expect(task.recurrenceRuleId).toBe('rule-1');
    expect(rule.versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: '2026-08-03',
      },
    ]);
    expect(result.ok && result.value.activities.map((a) => a.kind)).toEqual([
      'recurrenceRuleCreated',
    ]);
  });

  it('a recurring Task never completes; its occurrences do', () => {
    const { task } = recurring({ freq: 'daily' });
    expect(completeTask(task, ctx)).toMatchObject({
      ok: false,
      error: { code: 'recurringTaskCannotComplete' },
    });
  });

  it('rejects a second rule, a non-active Task and invalid patterns', () => {
    const { task } = recurring({ freq: 'daily' });
    const input = {
      id: id<'RecurrenceRule'>('rule-2'),
      pattern: { freq: 'daily' } as const,
      effectiveFrom: d('2026-01-01'),
    };
    expect(createRecurrenceRule(task, input, ctx)).toMatchObject({ ok: false });
    const archived = unwrap(archiveTask(newTask(), ctx));
    expect(createRecurrenceRule(archived, input, ctx)).toMatchObject({
      ok: false,
      error: { code: 'invalidTransition' },
    });
    for (const pattern of [
      { freq: 'weekly', daysOfWeek: [] },
      { freq: 'weekly', daysOfWeek: [1, 1] },
      { freq: 'weekly', daysOfWeek: [7] },
      { freq: 'weekly', daysOfWeek: [1.5] },
      { freq: 'monthly', dayOfMonth: 0 },
      { freq: 'monthly', dayOfMonth: 32 },
      // Values the type forbids but untyped input (JSON, forms) can carry.
    ] as unknown as RecurrencePattern[]) {
      expect(
        createRecurrenceRule(newTask(), { ...input, pattern }, ctx),
      ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
    }
  });

  it('daily, weekdays and weekly patterns', () => {
    // 2026-09-28 is a Monday.
    expect(
      dates(recurring({ freq: 'daily' }).rule, '2026-09-28', '2026-09-30'),
    ).toEqual(['2026-09-28', '2026-09-29', '2026-09-30']);
    expect(
      dates(recurring({ freq: 'weekdays' }).rule, '2026-09-26', '2026-10-05'),
    ).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-05',
    ]);
    expect(
      dates(
        recurring({ freq: 'weekly', daysOfWeek: [2, 4] }).rule,
        '2026-09-28',
        '2026-10-04',
      ),
    ).toEqual(['2026-09-29', '2026-10-01']);
  });

  it('a weekly rule does not depend on the day the week starts', () => {
    const { rule } = recurring({ freq: 'weekly', daysOfWeek: [0, 6] });
    // A Monday-start week and a Sunday-start week over the same weekend.
    expect(dates(rule, '2026-09-28', '2026-10-04')).toEqual([
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(dates(rule, '2026-09-27', '2026-10-03')).toEqual([
      '2026-09-27',
      '2026-10-03',
    ]);
  });

  it('monthly on the 29th–31st falls on the last day of shorter months', () => {
    const on31 = recurring({ freq: 'monthly', dayOfMonth: 31 }).rule;
    expect(dates(on31, '2026-01-01', '2026-06-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
    const on29 = recurring({ freq: 'monthly', dayOfMonth: 29 }).rule;
    expect(dates(on29, '2028-02-01', '2028-03-31')).toEqual([
      '2028-02-29',
      '2028-03-29',
    ]);
    expect(dates(on29, '2027-02-01', '2027-02-28')).toEqual(['2027-02-28']);
    const on30 = recurring({ freq: 'monthly', dayOfMonth: 30 }).rule;
    expect(dates(on30, '2026-12-01', '2027-01-31')).toEqual([
      '2026-12-30',
      '2027-01-30',
    ]);
  });

  it('a change ends the latest version the day before the new one starts', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-08-03',
    );
    const result = changeRecurrenceRule(
      rule,
      {
        pattern: { freq: 'weekly', daysOfWeek: [0] },
        effectiveFrom: d('2026-08-24'),
      },
      ctx,
    );
    const changed = unwrap(result);
    expect(changed.versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: '2026-08-03',
        effectiveTo: '2026-08-23',
      },
      {
        version: 2,
        pattern: { freq: 'weekly', daysOfWeek: [0] },
        effectiveFrom: '2026-08-24',
      },
    ]);
    // The boundary: 8/23 (Sun) is still v1 (Saturdays), 8/24 onwards is v2.
    expect(versionOn(changed, d('2026-08-23'))?.version).toBe(1);
    expect(versionOn(changed, d('2026-08-24'))?.version).toBe(2);
    expect(scheduledDates(changed, d('2026-08-22'), d('2026-08-30'))).toEqual([
      { scheduledDate: '2026-08-22', ruleVersion: 1 },
      { scheduledDate: '2026-08-30', ruleVersion: 2 },
    ]);
    expect(result.ok && result.value.activities[0]).toMatchObject({
      kind: 'recurrenceRuleChanged',
      version: 2,
      effectiveFrom: '2026-08-24',
    });
  });

  it('F39: changes for the same day replace the version not in effect yet', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const change = (from: RecurrenceRule, pattern: RecurrencePattern) =>
      changeRecurrenceRule(
        from,
        { pattern, effectiveFrom: d('2026-08-24') },
        ctx,
      );
    const once = unwrap(change(rule, { freq: 'weekly', daysOfWeek: [1] }));
    const twice = change(once, { freq: 'weekly', daysOfWeek: [1, 3] });
    const thrice = unwrap(change(unwrap(twice), { freq: 'weekdays' }));
    expect(thrice.versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'daily' },
        effectiveFrom: '2026-08-03',
        effectiveTo: '2026-08-23',
      },
      {
        version: 2,
        pattern: { freq: 'weekdays' },
        effectiveFrom: '2026-08-24',
      },
    ]);
    expect(versionOn(thrice, d('2026-08-23'))?.version).toBe(1);
    // The replacement is still a change of the rule in the Activity.
    expect(twice.ok && twice.value.activities).toEqual([
      expect.objectContaining({
        kind: 'recurrenceRuleChanged',
        version: 2,
        effectiveFrom: '2026-08-24',
      }),
    ]);
  });

  it('F39: going back to the previous pattern drops the version not in effect yet', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const once = unwrap(
      changeRecurrenceRule(
        rule,
        { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-08-24') },
        ctx,
      ),
    );
    const back = changeRecurrenceRule(
      once,
      { pattern: { freq: 'daily' }, effectiveFrom: d('2026-08-24') },
      ctx,
    );
    expect(unwrap(back)).toEqual(rule);
    expect(back.ok && back.value.activities).toEqual([
      expect.objectContaining({
        kind: 'recurrenceRuleChanged',
        version: 1,
        effectiveFrom: '2026-08-24',
      }),
    ]);
    // A later change adds one version again.
    const again = unwrap(
      changeRecurrenceRule(
        unwrap(back),
        {
          pattern: { freq: 'weekly', daysOfWeek: [3] },
          effectiveFrom: d('2026-08-24'),
        },
        ctx,
      ),
    );
    expect(again.versions.map((v) => v.version)).toEqual([1, 2]);
  });

  it('F39: the first version is replaced while it has not taken effect', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-24');
    const result = changeRecurrenceRule(
      rule,
      { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-08-24') },
      ctx,
    );
    expect(unwrap(result).versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'weekdays' },
        effectiveFrom: '2026-08-24',
      },
    ]);
    expect(result.ok && result.value.activities).toEqual([
      expect.objectContaining({ kind: 'recurrenceRuleChanged', version: 1 }),
    ]);
  });

  it('invariant 31 / F39: a version in effect before the new day is never replaced', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const once = unwrap(
      changeRecurrenceRule(
        rule,
        { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-08-24') },
        ctx,
      ),
    );
    // A week later the 8/24 version has taken effect: the next change adds
    // a version, and going back to daily does not drop the 8/24 one.
    const later = unwrap(
      changeRecurrenceRule(
        once,
        { pattern: { freq: 'daily' }, effectiveFrom: d('2026-08-31') },
        ctx,
      ),
    );
    expect(
      later.versions.map((v) => [
        v.version,
        v.pattern.freq,
        v.effectiveFrom,
        v.effectiveTo,
      ]),
    ).toEqual([
      [1, 'daily', '2026-08-03', '2026-08-23'],
      [2, 'weekdays', '2026-08-24', '2026-08-30'],
      [3, 'daily', '2026-08-31', undefined],
    ]);
  });

  it('rejects a version that would start before the latest one', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-24');
    expect(
      changeRecurrenceRule(
        rule,
        { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-08-17') },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('invariant 34: the Backlog has one row per rule and no future occurrences', () => {
    const { task, rule } = recurring({ freq: 'daily' }, '2026-09-28');
    const occurrences = unwrap(
      generateOccurrences(
        rule,
        {
          start: d('2026-09-28'),
          end: d('2026-10-04'),
          existing: [],
          newOccurrenceId,
        },
        ctx,
      ),
    );
    expect(occurrences).toHaveLength(7);
    expect(backlogView([task]).map((t) => t.id)).toEqual([task.id]);
    const summary = recurrenceSummary(rule, occurrences, {
      today: d('2026-09-29'),
      projectFrom: d('2026-10-05'),
    });
    expect(summary).toEqual({
      pattern: { freq: 'daily' },
      next: { scheduledDate: '2026-09-29', ruleVersion: 1, generated: true },
    });
  });

  it('summarises a change that takes effect later', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-08-03',
    );
    const changed = unwrap(
      changeRecurrenceRule(
        rule,
        {
          pattern: { freq: 'weekly', daysOfWeek: [0] },
          effectiveFrom: d('2026-09-07'),
        },
        ctx,
      ),
    );
    const none: Occurrence[] = [];
    expect(
      recurrenceSummary(changed, none, {
        today: d('2026-09-02'),
        projectFrom: d('2026-09-07'),
      }),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      upcoming: {
        pattern: { freq: 'weekly', daysOfWeek: [0] },
        effectiveFrom: '2026-09-07',
      },
      next: { scheduledDate: '2026-09-13', ruleVersion: 2, generated: false },
    });
  });

  it('changing to the pattern already in place adds no version and no Activity', () => {
    const { rule } = recurring({ freq: 'weekly', daysOfWeek: [6, 0] });
    const result = changeRecurrenceRule(
      rule,
      {
        pattern: { freq: 'weekly', daysOfWeek: [0, 6] },
        effectiveFrom: d('2026-09-07'),
      },
      ctx,
    );
    expect(result).toEqual({
      ok: true,
      value: { record: rule, activities: [] },
    });
  });

  it('never projects a day that already has an occurrence, even from an early projectFrom', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [0] },
      '2026-08-31',
    );
    const [sep6] = unwrap(
      generateOccurrences(
        rule,
        {
          start: d('2026-08-31'),
          end: d('2026-09-06'),
          existing: [],
          newOccurrenceId,
        },
        ctx,
      ),
    );
    if (sep6 === undefined) throw new Error('no occurrence');
    const excluded = unwrap(excludeOccurrence(sep6, ctx));
    expect(
      nextOccurrence(rule, [excluded], {
        today: d('2026-09-02'),
        projectFrom: d('2026-09-02'),
      }),
    ).toEqual({
      scheduledDate: '2026-09-13',
      ruleVersion: 1,
      generated: false,
    });
  });

  it('a pending occurrence before today is not "next"', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [1] },
      '2026-09-28',
    );
    const occurrences = unwrap(
      generateOccurrences(
        rule,
        {
          start: d('2026-09-28'),
          end: d('2026-10-04'),
          existing: [],
          newOccurrenceId,
        },
        ctx,
      ),
    );
    expect(
      nextOccurrence(rule, occurrences, {
        today: d('2026-09-30'),
        projectFrom: d('2026-10-05'),
      }),
    ).toEqual({
      scheduledDate: '2026-10-05',
      ruleVersion: 1,
      generated: false,
    });
  });

  it('before the rule starts, the summary shows the first version and a later change', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-09-07',
    );
    const changed = unwrap(
      changeRecurrenceRule(
        rule,
        {
          pattern: { freq: 'weekly', daysOfWeek: [0] },
          effectiveFrom: d('2026-09-14'),
        },
        ctx,
      ),
    );
    expect(
      recurrenceSummary(changed, [], {
        today: d('2026-09-06'),
        projectFrom: d('2026-09-07'),
      }),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      upcoming: {
        pattern: { freq: 'weekly', daysOfWeek: [0] },
        effectiveFrom: '2026-09-14',
      },
      next: { scheduledDate: '2026-09-12', ruleVersion: 1, generated: false },
    });
  });
});

describe('endRecurrenceRule (F41)', () => {
  it('ends the latest version the day before; earlier days keep their version', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-08-03',
    );
    const result = endRecurrenceRule(rule, { endFrom: d('2026-10-05') }, ctx);
    const ended = unwrap(result);
    expect(ended.versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: '2026-08-03',
        effectiveTo: '2026-10-04',
      },
    ]);
    expect(dates(ended, '2026-09-28', '2026-10-18')).toEqual(['2026-10-03']);
    expect(result.ok && result.value.activities).toEqual([
      expect.objectContaining({
        kind: 'recurrenceRuleEnded',
        version: 1,
        effectiveTo: '2026-10-04',
      }),
    ]);
  });

  it('F39: a version not in effect by then is dropped, and the one before ends', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const changed = unwrap(
      changeRecurrenceRule(
        rule,
        { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-10-05') },
        ctx,
      ),
    );
    const result = endRecurrenceRule(
      changed,
      { endFrom: d('2026-10-05') },
      ctx,
    );
    expect(unwrap(result).versions).toEqual([
      {
        version: 1,
        pattern: { freq: 'daily' },
        effectiveFrom: '2026-08-03',
        effectiveTo: '2026-10-04',
      },
    ]);
    expect(result.ok && result.value.activities[0]).toMatchObject({
      version: 1,
    });
  });

  it('an ended rule is neither ended again nor changed', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const ended = unwrap(
      endRecurrenceRule(rule, { endFrom: d('2026-10-05') }, ctx),
    );
    expect(
      endRecurrenceRule(ended, { endFrom: d('2026-10-12') }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
    expect(
      changeRecurrenceRule(
        ended,
        { pattern: { freq: 'weekdays' }, effectiveFrom: d('2026-10-12') },
        ctx,
      ),
    ).toMatchObject({ ok: false, error: { code: 'invalidTransition' } });
  });

  it('refuses a rule with no version in effect before the day', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-10-05');
    expect(
      endRecurrenceRule(rule, { endFrom: d('2026-10-05') }, ctx),
    ).toMatchObject({ ok: false, error: { code: 'invalidInput' } });
  });

  it('the Backlog summary has the last day and no projection after it', () => {
    const { rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-08-03',
    );
    const ended = unwrap(
      endRecurrenceRule(rule, { endFrom: d('2026-10-05') }, ctx),
    );
    expect(
      recurrenceSummary(ended, [], {
        today: d('2026-10-01'),
        projectFrom: d('2026-10-01'),
      }),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      next: { scheduledDate: '2026-10-03', ruleVersion: 1, generated: false },
      endsOn: '2026-10-04',
    });
    expect(
      recurrenceSummary(ended, [], {
        today: d('2026-10-05'),
        projectFrom: d('2026-10-05'),
      }),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      endsOn: '2026-10-04',
    });
  });
});

describe('renewedRecurrenceSummary (F41, invariant 34, #338)', () => {
  // 部屋の掃除 repeats on Saturdays and is ended from 10/5; before that day
  // it is made recurring again, from the next Sprint (#323).
  function renewed(pattern: RecurrencePattern) {
    const { task, rule } = recurring(
      { freq: 'weekly', daysOfWeek: [6] },
      '2026-08-03',
    );
    const ending = unwrap(
      endRecurrenceRule(rule, { endFrom: d('2026-10-05') }, ctx),
    );
    // Ended, the rule comes off the Task (endRuleForNextSprint does this):
    // the same Task, one-off again.
    const oneOff = newTask(task.title, task.id);
    const again = unwrap(
      createRecurrenceRule(
        oneOff,
        { id: id('rule-2'), pattern, effectiveFrom: d('2026-10-05') },
        ctx,
      ),
    );
    return { task: again.task, ending, rule: again.rule };
  }
  const options = { today: d('2026-10-01'), projectFrom: d('2026-10-05') };
  // This week's Sprint has made the 10/3 occurrence of the rule that ends.
  function week(ending: RecurrenceRule): readonly Occurrence[] {
    return unwrap(
      generateOccurrences(
        ending,
        {
          start: d('2026-09-28'),
          end: d('2026-10-04'),
          existing: [],
          newOccurrenceId,
        },
        ctx,
      ),
    );
  }

  it('the Task’s own rule comes first; the ended one is found until its last day', () => {
    const { task, ending, rule } = renewed({ freq: 'weekly', daysOfWeek: [1] });
    const rules = [ending, rule];
    expect(recurrenceOf(task, rules, d('2026-10-01'))).toBe(rule);
    expect(endingRuleOf(task, rules, d('2026-10-04'))).toBe(ending);
    expect(endingRuleOf(task, rules, d('2026-10-05'))).toBeUndefined();
  });

  it('this week by the rule that ends, then the new rule as a change', () => {
    const { ending, rule } = renewed({ freq: 'weekly', daysOfWeek: [1] });
    expect(
      renewedRecurrenceSummary(ending, rule, week(ending), options),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      next: { scheduledDate: '2026-10-03', ruleVersion: 1, generated: true },
      upcoming: {
        pattern: { freq: 'weekly', daysOfWeek: [1] },
        effectiveFrom: '2026-10-05',
      },
    });
  });

  it('with this week’s occurrences done, the next is by the new rule', () => {
    const { ending, rule } = renewed({ freq: 'weekly', daysOfWeek: [1] });
    expect(
      renewedRecurrenceSummary(
        ending,
        rule,
        week(ending).map((o) => ({ ...o, state: 'done' as const })),
        options,
      ).next,
    ).toEqual({
      scheduledDate: '2026-10-05',
      ruleVersion: 1,
      generated: false,
    });
  });

  it('the same pattern again is no change and has no last day', () => {
    const { ending, rule } = renewed({ freq: 'weekly', daysOfWeek: [6] });
    expect(
      renewedRecurrenceSummary(ending, rule, week(ending), options),
    ).toEqual({
      pattern: { freq: 'weekly', daysOfWeek: [6] },
      next: { scheduledDate: '2026-10-03', ruleVersion: 1, generated: true },
    });
  });
});
