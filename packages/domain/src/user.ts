import { err, ok, type Result } from './shared/result';
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

/**
 * The person's settings, made or written again. The first time makes them
 * (`created`); after that the display name can be written again, and the
 * same settings again change nothing. The time zone and the week's first
 * day are fixed once made: 「今日」 follows the zone and a Sprint's dates
 * follow the first day, so changing them under Sprints that are already
 * made would move those Sprints, and how they should follow is not
 * decided. A different one is refused (`invalidInput`) until it is.
 */
export function setUpUser(
  current: User | null,
  input: User,
): Result<{ readonly user: User; readonly created: boolean }> {
  const displayName = input.displayName.trim();
  if (displayName === '') return err('invalidInput', 'Display name is empty.');
  const user: User = { ...input, displayName };
  if (current === null) return ok({ user, created: true });
  if (user.timeZone !== current.timeZone) {
    return err(
      'invalidInput',
      'The time zone is fixed once the settings are made.',
    );
  }
  if (user.weekStartsOn !== current.weekStartsOn) {
    return err(
      'invalidInput',
      'The first day of the week is fixed once the settings are made.',
    );
  }
  return ok({ user: { ...current, displayName }, created: false });
}
