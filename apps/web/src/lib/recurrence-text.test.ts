import { describe, expect, it } from 'vitest';
import { formatPattern } from './recurrence-text';

describe('formatPattern', () => {
  it('writes each kind of rule', () => {
    expect(formatPattern({ freq: 'daily' })).toBe('毎日');
    expect(formatPattern({ freq: 'weekdays' })).toBe('平日');
    expect(formatPattern({ freq: 'weekly', daysOfWeek: [6] })).toBe('毎週 土');
    expect(formatPattern({ freq: 'monthly', dayOfMonth: 31 })).toBe(
      '毎月 31日',
    );
  });

  it('lists several days from Monday, joined by 「・」', () => {
    expect(formatPattern({ freq: 'weekly', daysOfWeek: [4, 0, 1] })).toBe(
      '毎週 月・木・日',
    );
  });
});
