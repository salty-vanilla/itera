import { instant, localDate, timeZone } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatDate,
  formatDateHeading,
  formatDateTime,
  formatDateRange,
  formatTime,
} from './date-format';

describe('date format', () => {
  it('writes a date with its day of the week', () => {
    expect(formatDate(localDate('2026-09-28'))).toBe('9/28 (月)');
    expect(formatDate(localDate('2026-10-04'))).toBe('10/4 (日)');
  });

  it('writes a heading date with full-width brackets', () => {
    expect(formatDateHeading(localDate('2026-09-29'))).toBe('9月29日（火）');
  });

  it('writes a range of dates with spaces around the en dash', () => {
    expect(
      formatDateRange(localDate('2026-09-28'), localDate('2026-10-04')),
    ).toBe('9/28 (月) – 10/4 (日)');
  });

  it('writes a time in 24 hours in the user’s time zone', () => {
    const tokyo = timeZone('Asia/Tokyo');
    expect(formatTime(instant('2026-10-01T05:02:00.000Z'), tokyo)).toBe(
      '14:02',
    );
    expect(formatTime(instant('2026-09-30T15:05:00.000Z'), tokyo)).toBe(
      '00:05',
    );
  });

  it('writes the day with the time, by the user’s time zone (#108)', () => {
    const tokyo = timeZone('Asia/Tokyo');
    expect(formatDateTime(instant('2026-09-30T05:02:00.000Z'), tokyo)).toBe(
      '9/30 (水) 14:02',
    );
    // 00:05 in Tokyo is still the day before in UTC.
    expect(formatDateTime(instant('2026-09-30T15:05:00.000Z'), tokyo)).toBe(
      '10/1 (木) 00:05',
    );
  });
});

describe('daysBetween', () => {
  it('counts whole days, negative into the past', () => {
    expect(daysBetween(localDate('2026-09-29'), localDate('2026-10-01'))).toBe(
      2,
    );
    expect(daysBetween(localDate('2026-09-29'), localDate('2026-09-25'))).toBe(
      -4,
    );
    expect(daysBetween(localDate('2026-09-29'), localDate('2026-09-29'))).toBe(
      0,
    );
  });
});
