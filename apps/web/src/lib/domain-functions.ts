// The only module of the screens that imports packages/domain (ADR 0005 プ
// レビューの例外, D2): the previews computed without a request, and the
// date functions. The screens take everything else from the contract.
// Until iOS starts, the web app runs the domain's own functions rather than
// its own copy of them (PRD §14). ESLint keeps every other screen file off
// packages/domain (eslint.config.js).
//
// The screens' values are the contract's (`LocalDate`, `Instant` and the
// IDs are plain strings there), so the date functions take the contract's
// types: the domain's brand is a mark in its types only, and the contract
// checks the shape of every date and time it carries. What they give back
// is the domain's value, which is also a string for the screens.
import {
  addDays as addDaysOf,
  dayOfWeek as dayOfWeekOf,
  toLocalDate as toLocalDateOf,
  type Instant as DomainInstant,
  type LocalDate as DomainLocalDate,
  type TimeZone as DomainTimeZone,
} from '@itera/domain';
import type { Instant, LocalDate, TimeZone } from '@itera/api-contract';

export { boundValue, parseLocalDate } from '@itera/domain';

export function addDays(date: LocalDate, days: number) {
  return addDaysOf(date as DomainLocalDate, days);
}

export function dayOfWeek(date: LocalDate) {
  return dayOfWeekOf(date as DomainLocalDate);
}

export function toLocalDate(at: Instant, timeZone: TimeZone) {
  return toLocalDateOf(at as DomainInstant, timeZone as DomainTimeZone);
}
