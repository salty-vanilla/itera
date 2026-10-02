import { describe, expect, it } from 'vitest';
import { readActualHours } from './actual-hours';
import { formatHours } from './time-format';

const typed = (hours: string, minutes = '') => ({ hours, minutes });

describe('readActualHours', () => {
  it('reads empty fields as nothing, and what is not a minute or more as wrong', () => {
    expect(readActualHours(typed('  ', ''))).toBeUndefined();
    expect(readActualHours(typed('abc'))).toBeNull();
    expect(readActualHours(typed('0', '0'))).toBeNull();
    expect(readActualHours(typed('-1'))).toBeNull();
    // Under half a minute rounds to 0分.
    expect(readActualHours(typed('', '0.4'))).toBeNull();
  });

  it('rounds to the minute, so that the rows add up to their total (#245)', () => {
    const rows = ['1.33', '1.33', '1.33'].map((t) =>
      readActualHours(typed(t))!,
    );
    expect(rows.map((h) => formatHours(h))).toEqual([
      '1時間20分',
      '1時間20分',
      '1時間20分',
    ]);
    // Not 3時間59分, the 3.99 hours typed.
    expect(formatHours(rows.reduce((sum, h) => sum + h, 0))).toBe('4時間');
    expect(readActualHours(typed('1', '30'))).toBe(1.5);
    expect(readActualHours(typed('', '15'))).toBe(0.25);
  });
});
