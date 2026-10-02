import { describe, expect, it } from 'vitest';
import {
  durationText,
  hoursText,
  readMinutes,
  sameMinutes,
} from './duration-text';
import { formatHours } from './time-format';

const typed = (hours: string, minutes: string) => ({ hours, minutes });

describe('readMinutes', () => {
  it('reads the two fields as minutes, one field left empty as 0', () => {
    expect(readMinutes(typed('1', '30'))).toBe(90);
    expect(readMinutes(typed('2', ''))).toBe(120);
    expect(readMinutes(typed('', '45'))).toBe(45);
    expect(readMinutes(typed('0', '0'))).toBe(0);
    expect(readMinutes(typed(' 3 ', ' 15 '))).toBe(195);
  });

  it('reads both fields empty as nothing', () => {
    expect(readMinutes(typed('', ''))).toBeUndefined();
    expect(readMinutes(typed('  ', ' '))).toBeUndefined();
  });

  it('takes 60 minutes or more and a decimal of hours as typed', () => {
    expect(readMinutes(typed('', '90'))).toBe(90);
    expect(readMinutes(typed('1', '75'))).toBe(135);
    expect(readMinutes(typed('1.5', ''))).toBe(90);
    expect(readMinutes(typed('.25', ''))).toBe(15);
    expect(readMinutes(typed('1.5', '15'))).toBe(105);
  });

  it('reads full-width digits, typed with the Japanese input on', () => {
    expect(readMinutes(typed('１', '３０'))).toBe(90);
    expect(readMinutes(typed('１．５', ''))).toBe(90);
  });

  it('rounds to the minute (#245)', () => {
    expect(readMinutes(typed('1.33', ''))).toBe(80);
    expect(readMinutes(typed('', '29.6'))).toBe(30);
    expect(readMinutes(typed('', '0.4'))).toBe(0);
  });

  it('reads what is not a number of at least 0 as wrong', () => {
    expect(readMinutes(typed('abc', ''))).toBeNull();
    expect(readMinutes(typed('1', 'x'))).toBeNull();
    expect(readMinutes(typed('-1', ''))).toBeNull();
    expect(readMinutes(typed('', '-30'))).toBeNull();
    expect(readMinutes(typed('1:30', ''))).toBeNull();
    expect(readMinutes(typed('.', ''))).toBeNull();
    expect(readMinutes(typed('1e2', ''))).toBeNull();
  });
});

describe('durationText', () => {
  it('fills the fields as the screen writes the time', () => {
    for (const minutes of [30, 60, 90, 120, 135, 1, 59, 600]) {
      const text = durationText(minutes);
      const written = `${text.hours === '' ? '' : `${text.hours}時間`}${
        text.minutes === '' ? '' : `${text.minutes}分`
      }`;
      expect(written).toBe(formatHours(minutes / 60));
    }
  });

  it('writes 0 as 0 hours and nothing as empty fields', () => {
    expect(durationText(0)).toEqual(typed('0', ''));
    expect(durationText(undefined)).toEqual(typed('', ''));
  });

  it('writes back what was typed as it was read', () => {
    expect(durationText(readMinutes(typed('', '90'))!)).toEqual(
      typed('1', '30'),
    );
    expect(durationText(readMinutes(typed('1.5', ''))!)).toEqual(
      typed('1', '30'),
    );
    expect(durationText(readMinutes(typed('0', '45'))!)).toEqual(
      typed('', '45'),
    );
  });
});

describe('hoursText', () => {
  it('fills the fields for a value kept in hours', () => {
    expect(hoursText(1.5)).toEqual(typed('1', '30'));
    expect(hoursText(0.25)).toEqual(typed('', '15'));
    expect(hoursText(18)).toEqual(typed('18', ''));
    expect(hoursText(undefined)).toEqual(typed('', ''));
    // Saved before #245, not to the minute.
    expect(hoursText(1.33)).toEqual(typed('1', '20'));
  });
});

describe('sameMinutes', () => {
  it('compares to the minute, so a value saved before #245 is not saved again', () => {
    expect(sameMinutes(80, 1.33)).toBe(true);
    expect(sameMinutes(90, 1.5)).toBe(true);
    expect(sameMinutes(91, 1.5)).toBe(false);
    expect(sameMinutes(undefined, undefined)).toBe(true);
    expect(sameMinutes(undefined, 1)).toBe(false);
    expect(sameMinutes(60, undefined)).toBe(false);
  });
});
