import type { UserId } from './shared/ids';
import type { DayOfWeek, TimeZone } from './shared/time';

/** The person using Itera. Owns every permanent record. */
export interface User {
  readonly id: UserId;
  readonly displayName: string;
  /** Decides which LocalDate "today" is. */
  readonly timeZone: TimeZone;
  /** The first day of a Sprint week. */
  readonly weekStartsOn: DayOfWeek;
}
