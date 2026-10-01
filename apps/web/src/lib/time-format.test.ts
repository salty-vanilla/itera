import { instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  formatDifference,
  formatEstimate,
  formatHours,
  formatPlanningTotal,
  formatPlanningValue,
  formatRange,
  spokenHours,
} from './time-format';

const computedAt = instant('2026-09-28T00:00:00.000Z');

describe('formatHours', () => {
  it('writes under 1h in minutes and 1h or more in hours', () => {
    expect(formatHours(0.5)).toBe('30m');
    expect(formatHours(0.25)).toBe('15m');
    expect(formatHours(1)).toBe('1h');
    expect(formatHours(1.5)).toBe('1.5h');
    expect(formatHours(4.5)).toBe('4.5h');
  });

  it('writes a value that rounds to 60 minutes as 1h', () => {
    expect(formatHours(0.999)).toBe('1h');
    expect(formatRange(0.5, 0.999)).toBe('30m–1h');
  });

  it('writes a total in hours even under 1h', () => {
    expect(formatHours(0.5, { total: true })).toBe('0.5h');
    expect(formatHours(0, { total: true })).toBe('0h');
  });

  it('keeps at most two decimals', () => {
    expect(formatHours(1.25)).toBe('1.25h');
    expect(formatHours(1 / 3 + 1)).toBe('1.33h');
  });

  it('uses the minus sign for a negative value', () => {
    expect(formatHours(-1)).toBe('−1h');
  });
});

describe('formatRange', () => {
  it('joins the ends with an en dash and no spaces', () => {
    expect(formatRange(2, 4)).toBe('2–4h');
    expect(formatRange(3, 5)).toBe('3–5h');
  });

  it('writes the unit once when both ends are in minutes', () => {
    expect(formatRange(0.5, 0.75)).toBe('30–45m');
  });

  it('writes both units when the ends differ', () => {
    expect(formatRange(0.5, 1.5)).toBe('30m–1.5h');
  });

  it('writes a total range in hours', () => {
    expect(formatRange(0.5, 1, { total: true })).toBe('0.5–1h');
  });

  it('writes equal ends as one value', () => {
    expect(formatRange(5, 5)).toBe('5h');
  });

  it('uses 〜 with spaces when the range includes a negative value', () => {
    expect(formatRange(-1, 1)).toBe('−1 〜 1h');
    expect(formatRange(-5, -3)).toBe('−5 〜 −3h');
  });
});

describe('formatEstimate', () => {
  it('writes 「見積もりなし」 instead of 0h', () => {
    expect(formatEstimate(undefined)).toBe('見積もりなし');
  });

  it('writes a point or a range', () => {
    expect(formatEstimate(3)).toBe('3h');
    expect(formatEstimate({ lo: 2, hi: 3 })).toBe('2–3h');
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
    ).toBe('2.5h（サブタスク 1件は見積もりなし）');
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
    ).toBe('2.5h（1件は見積もりなし）');
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
    ).toBe('3–5h');
  });
});

describe('formatPlanningTotal', () => {
  it('writes the sum in hours and counts what is left out', () => {
    expect(
      formatPlanningTotal({
        lo: 12,
        hi: 16,
        unestimated: 2,
        unestimatedSubtasks: 0,
      }),
    ).toBe('12–16h（ほかに見積もりなし 2件）');
    expect(
      formatPlanningTotal({
        lo: 0.5,
        hi: 0.5,
        unestimated: 0,
        unestimatedSubtasks: 0,
      }),
    ).toBe('0.5h');
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

describe('spokenHours', () => {
  it('spells the unit and the range as words', () => {
    expect(spokenHours(3)).toBe('3時間');
    expect(spokenHours(0.5)).toBe('30分');
    expect(spokenHours(2, 4)).toBe('2〜4時間');
    expect(spokenHours(0.5, 1.5)).toBe('30分〜1時間30分');
    expect(spokenHours(1.25)).toBe('1時間15分');
    expect(spokenHours(1.25, 2)).toBe('1時間15分〜2時間');
  });
});

describe('formatDifference', () => {
  it('always uses 〜 for a difference from the available hours', () => {
    expect(formatDifference(1, 3)).toBe('1 〜 3h');
    expect(formatDifference(-1, 1)).toBe('−1 〜 1h');
    expect(formatDifference(3, 5)).toBe('3 〜 5h');
  });

  it('writes an exact difference in hours, even under 1h', () => {
    expect(formatDifference(0.5, 0.5)).toBe('0.5h');
    expect(formatDifference(2, 2)).toBe('2h');
  });
});
