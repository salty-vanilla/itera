import { instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  formatEstimate,
  formatHours,
  formatPlanningTotal,
  formatPlanningValue,
  formatRange,
} from './time-format';

const computedAt = instant('2026-09-28T00:00:00.000Z');

describe('formatHours', () => {
  it('writes hours and minutes in words', () => {
    expect(formatHours(0.5)).toBe('30分');
    expect(formatHours(0.25)).toBe('15分');
    expect(formatHours(1)).toBe('1時間');
    expect(formatHours(1.5)).toBe('1時間30分');
    expect(formatHours(2.25)).toBe('2時間15分');
    expect(formatHours(26)).toBe('26時間');
  });

  it('rounds to the minute', () => {
    expect(formatHours(0.999)).toBe('1時間');
    expect(formatHours(1 / 3 + 1)).toBe('1時間20分');
    expect(formatHours(17.25 + 0.1 + 0.2)).toBe('17時間33分');
  });

  it('rounds a sum once, after adding (#244)', () => {
    // Interrupts of 45分 and 20分.
    expect(formatHours((45 + 20) / 60)).toBe('1時間5分');
    // Actual hours typed as decimals on whole minutes: the rows and their
    // sum agree.
    const rows = [0.25, 1.5, 0.1, 2.75, 0.4];
    const rowMinutes = rows.map((h) => Math.round(h * 60));
    expect(formatHours(rows.reduce((a, b) => a + b, 0))).toBe(
      formatHours(rowMinutes.reduce((a, b) => a + b, 0) / 60),
    );
  });

  it('writes zero as 0時間', () => {
    expect(formatHours(0)).toBe('0時間');
  });

  it('uses the minus sign for a negative value', () => {
    expect(formatHours(-1.5)).toBe('−1時間30分');
  });
});

describe('formatRange', () => {
  it('joins the ends with 〜 and no spaces', () => {
    expect(formatRange(2, 4)).toBe('2〜4時間');
    expect(formatRange(3, 5)).toBe('3〜5時間');
  });

  it('writes the unit once when both ends are in minutes', () => {
    expect(formatRange(0.5, 0.75)).toBe('30〜45分');
  });

  it('writes the unit on each end when the ends differ', () => {
    expect(formatRange(0.5, 1.5)).toBe('30分〜1時間30分');
    expect(formatRange(1.5, 3)).toBe('1時間30分〜3時間');
    expect(formatRange(1.25, 2.75)).toBe('1時間15分〜2時間45分');
    expect(formatRange(0.5, 0.999)).toBe('30分〜1時間');
  });

  it('writes zero at the lower end as any other value', () => {
    expect(formatRange(0, 0.5)).toBe('0〜30分');
    expect(formatRange(0, 2)).toBe('0〜2時間');
    expect(formatRange(0, 1.5)).toBe('0時間〜1時間30分');
  });

  it('writes ends that round to the same minute as one value', () => {
    expect(formatRange(5, 5)).toBe('5時間');
    expect(formatRange(1, 1.001)).toBe('1時間');
  });

  it('writes a negative end with the minus sign and its unit', () => {
    expect(formatRange(-1, 1)).toBe('−1時間〜1時間');
    expect(formatRange(-5, -3)).toBe('−5時間〜−3時間');
  });
});

describe('formatEstimate', () => {
  it('writes 「見積もりなし」 instead of 0時間', () => {
    expect(formatEstimate(undefined)).toBe('見積もりなし');
  });

  it('writes a point or a range', () => {
    expect(formatEstimate(3)).toBe('3時間');
    expect(formatEstimate({ lo: 2, hi: 3 })).toBe('2〜3時間');
  });
});

describe('formatPlanningValue', () => {
  it('writes an unestimated value as 「見積もりなし」', () => {
    expect(
      formatPlanningValue({
        base: 'none',
        criterionApplied: false,
        computedAt,
      }),
    ).toBe('見積もりなし');
  });

  it('counts the subtasks left out of a subtask sum', () => {
    expect(
      formatPlanningValue({
        base: 'subtasks',
        lo: 2.5,
        hi: 2.5,
        unestimatedSubtasks: 1,
        criterionApplied: false,
        computedAt,
      }),
    ).toBe('2時間30分（サブタスク 1件は見積もりなし）');
    // Beside 「サブタスクの合計」, 「サブタスク」 is not said twice (#162).
    expect(
      formatPlanningValue(
        {
          base: 'subtasks',
          lo: 2.5,
          hi: 2.5,
          unestimatedSubtasks: 1,
          criterionApplied: false,
          computedAt,
        },
        { subtasksNamed: true },
      ),
    ).toBe('2時間30分（1件は見積もりなし）');
  });

  it('writes a suggestion range as it is', () => {
    expect(
      formatPlanningValue({
        base: 'suggestion',
        lo: 3,
        hi: 5,
        criterionApplied: false,
        computedAt,
      }),
    ).toBe('3〜5時間');
  });
});

describe('formatPlanningTotal', () => {
  it('writes the sum and counts what is left out', () => {
    expect(
      formatPlanningTotal({
        lo: 12,
        hi: 16,
        unestimated: 2,
        unestimatedSubtasks: 0,
      }),
    ).toBe('12〜16時間（ほかに見積もりなし 2件）');
    expect(
      formatPlanningTotal({
        lo: 0.5,
        hi: 0.5,
        unestimated: 0,
        unestimatedSubtasks: 0,
      }),
    ).toBe('30分');
  });

  it('writes 「見積もりなし」 when nothing is estimated', () => {
    expect(
      formatPlanningTotal({
        lo: 0,
        hi: 0,
        unestimated: 3,
        unestimatedSubtasks: 0,
      }),
    ).toBe('見積もりなし 3件');
  });
});
