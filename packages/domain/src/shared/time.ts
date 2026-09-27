import { err, ok, type Result } from './result';

declare const localDateBrand: unique symbol;
declare const instantBrand: unique symbol;
declare const timeZoneBrand: unique symbol;

/**
 * A calendar day in the user's time zone, as `YYYY-MM-DD`. Sprint days,
 * Today, due dates and occurrence dates are LocalDates.
 */
export type LocalDate = string & { readonly [localDateBrand]: true };

/**
 * A point in time, as an ISO 8601 UTC string with milliseconds
 * (`2026-09-28T00:30:00.000Z`). Ordering by string equals ordering in time.
 */
export type Instant = string & { readonly [instantBrand]: true };

/** A valid IANA time zone name such as `Asia/Tokyo`. */
export type TimeZone = string & { readonly [timeZoneBrand]: true };

/** 0 = Sunday … 6 = Saturday (same as `Date#getUTCDay`). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function parseLocalDate(value: string): Result<LocalDate> {
  const match = LOCAL_DATE.exec(value);
  if (match === null) {
    return err('invalidInput', `Not a YYYY-MM-DD date: ${value}`);
  }
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return err('invalidInput', `No such date: ${value}`);
  }
  return ok(value as LocalDate);
}

export function parseInstant(value: string): Result<Instant> {
  if (!INSTANT.test(value)) {
    return err('invalidInput', `Not an ISO 8601 UTC instant: ${value}`);
  }
  const time = Date.parse(value);
  if (Number.isNaN(time) || new Date(time).toISOString() !== value) {
    return err('invalidInput', `No such instant: ${value}`);
  }
  return ok(value as Instant);
}

export function parseTimeZone(value: string): Result<TimeZone> {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    return err('invalidInput', `Unknown time zone: ${value}`);
  }
  return ok(value as TimeZone);
}

/** For literals in tests and fixtures. Throws on a malformed value. */
export function timeZone(value: string): TimeZone {
  const result = parseTimeZone(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** For literals in tests and fixtures. Throws on a malformed value. */
export function localDate(value: string): LocalDate {
  const result = parseLocalDate(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** For literals in tests and fixtures. Throws on a malformed value. */
export function instant(value: string): Instant {
  const result = parseInstant(value);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function toUtcDate(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10) as LocalDate;
}

export function dayOfWeek(date: LocalDate): DayOfWeek {
  return toUtcDate(date).getUTCDay() as DayOfWeek;
}

/** The calendar day on which `at` falls in `timeZone`. */
export function toLocalDate(at: Instant, timeZone: TimeZone): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}` as LocalDate;
}
