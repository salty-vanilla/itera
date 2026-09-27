import { describe, expect, it } from 'vitest';
import { backlogView } from './backlog';
import { generateOccurrences, type Occurrence } from './occurrence';
import {
  changeRecurrenceRule,
  createRecurrenceRule,
  recurrenceSummary,
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
      { freq: 'monthly', dayOfMonth: 0 },
      { freq: 'monthly', dayOfMonth: 32 },
    ] as const) {
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
      { freq: 'weekly', daysOfWeek: [0] },
      d('2026-08-24'),
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

  it('a second change for the same day supersedes the first, which stays as history', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-03');
    const once = unwrap(
      changeRecurrenceRule(rule, { freq: 'weekdays' }, d('2026-08-24'), ctx),
    );
    const twice = unwrap(
      changeRecurrenceRule(
        once,
        { freq: 'weekly', daysOfWeek: [3] },
        d('2026-08-24'),
        ctx,
      ),
    );
    expect(
      twice.versions.map((v) => [v.version, v.effectiveFrom, v.effectiveTo]),
    ).toEqual([
      [1, '2026-08-03', '2026-08-23'],
      [2, '2026-08-24', '2026-08-23'],
      [3, '2026-08-24', undefined],
    ]);
    expect(versionOn(twice, d('2026-08-24'))?.version).toBe(3);
  });

  it('rejects a version that would start before the latest one', () => {
    const { rule } = recurring({ freq: 'daily' }, '2026-08-24');
    expect(
      changeRecurrenceRule(rule, { freq: 'weekdays' }, d('2026-08-17'), ctx),
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
        { freq: 'weekly', daysOfWeek: [0] },
        d('2026-09-07'),
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
});
