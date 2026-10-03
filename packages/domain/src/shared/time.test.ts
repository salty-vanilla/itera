import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  daysBetween,
  instant,
  localDate,
  parseInstant,
  parseLocalDate,
  parseTimeZone,
  timeZone,
  toLocalDate,
} from './time';

describe('LocalDate', () => {
  it('accepts real calendar days only', () => {
    expect(parseLocalDate('2026-09-28').ok).toBe(true);
    expect(parseLocalDate('2028-02-29').ok).toBe(true);
    expect(parseLocalDate('2026-02-29').ok).toBe(false);
    expect(parseLocalDate('2026-9-28').ok).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDays(localDate('2026-09-28'), 6)).toBe('2026-10-04');
    expect(addDays(localDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(localDate('2026-03-01'), -1)).toBe('2026-02-28');
  });

  it('counts the days between two dates', () => {
    const from = localDate('2026-09-28');
    expect(daysBetween(from, from)).toBe(0);
    expect(daysBetween(from, localDate('2026-10-04'))).toBe(6);
    expect(daysBetween(localDate('2026-12-31'), localDate('2027-01-01'))).toBe(
      1,
    );
    expect(daysBetween(localDate('2026-10-04'), from)).toBe(-6);
  });

  it('knows the day of the week', () => {
    expect(dayOfWeek(localDate('2026-09-28'))).toBe(1); // Monday
    expect(dayOfWeek(localDate('2026-10-04'))).toBe(0); // Sunday
  });
});

describe('Instant', () => {
  it('accepts only the canonical UTC form', () => {
    expect(parseInstant('2026-09-28T00:00:00.000Z').ok).toBe(true);
    expect(parseInstant('2026-09-28T00:00:00Z').ok).toBe(false);
    expect(parseInstant('2026-09-28T09:00:00.000+09:00').ok).toBe(false);
    expect(parseInstant('2026-02-30T00:00:00.000Z').ok).toBe(false);
  });

  it('maps to the LocalDate of the user time zone', () => {
    // 23:30 UTC on 9/27 is already 9/28 in Tokyo.
    const at = instant('2026-09-27T23:30:00.000Z');
    expect(toLocalDate(at, timeZone('Asia/Tokyo'))).toBe('2026-09-28');
    expect(toLocalDate(at, timeZone('UTC'))).toBe('2026-09-27');
    expect(toLocalDate(at, timeZone('America/Los_Angeles'))).toBe('2026-09-27');
  });

  it('maps across a daylight saving change', () => {
    // US DST starts 2026-03-08 at 02:00 local; 09:30 UTC is 01:30 PST and
    // 10:30 UTC is 03:30 PDT, the same local day.
    const la = timeZone('America/Los_Angeles');
    expect(toLocalDate(instant('2026-03-08T09:30:00.000Z'), la)).toBe(
      '2026-03-08',
    );
    expect(toLocalDate(instant('2026-03-08T10:30:00.000Z'), la)).toBe(
      '2026-03-08',
    );
    expect(toLocalDate(instant('2026-03-09T06:59:59.999Z'), la)).toBe(
      '2026-03-08',
    );
    expect(toLocalDate(instant('2026-03-09T07:00:00.000Z'), la)).toBe(
      '2026-03-09',
    );
  });
});

describe('TimeZone', () => {
  it('accepts IANA names and returns an error for unknown ones', () => {
    expect(parseTimeZone('Asia/Tokyo').ok).toBe(true);
    expect(parseTimeZone('UTC').ok).toBe(true);
    expect(parseTimeZone('asia/tokyo')).toEqual({
      ok: true,
      value: 'Asia/Tokyo',
    });
    expect(parseTimeZone('Mars/Olympus')).toMatchObject({
      ok: false,
      error: { code: 'invalidInput' },
    });
  });
});
