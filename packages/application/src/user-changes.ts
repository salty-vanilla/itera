// The person's settings (ADR 0006「利用者」). Not an operation of
// `operations`: those run on the person's records, and the settings are
// what makes the records possible (「今日」 is told by the time zone), so
// this runs before there are any. The API and the browser mock call it with
// what they have of the person.
import {
  parseTimeZone,
  setUpUser,
  type DayOfWeek,
  type Result,
  type User,
  type UserId,
} from '@itera/domain';
import type { RecordChanges } from './records';

/**
 * The person's settings as a client gives them: the domain's `User` without
 * its ID. The time zone is a name, which is checked here (the contract's
 * schema only knows it is a string).
 */
export interface SettingsInput {
  readonly displayName: string;
  readonly timeZone: string;
  readonly weekStartsOn: DayOfWeek;
}

/**
 * What writing the settings changes: the person's `user` (made, or written
 * again with another display name), or nothing when the same settings are
 * written again. `current` is `null` before the first time; `created` is
 * whether this is it, and `user` is the person after it. The rules are
 * `setUpUser`'s.
 */
export function settingsChange(
  userId: UserId,
  current: User | null,
  input: SettingsInput,
): Result<{
  readonly changes: RecordChanges;
  readonly created: boolean;
  /** The person as they now are: what a first write answers with. */
  readonly user: User;
}> {
  const zone = parseTimeZone(input.timeZone);
  if (!zone.ok) return zone;
  const result = setUpUser(current, {
    id: userId,
    displayName: input.displayName,
    timeZone: zone.value,
    weekStartsOn: input.weekStartsOn,
  });
  if (!result.ok) return result;
  const { user, created } = result.value;
  const written = created || user.displayName !== current?.displayName;
  return {
    ok: true,
    value: { changes: written ? { user } : {}, created, user },
  };
}
