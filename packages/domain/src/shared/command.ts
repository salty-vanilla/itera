import type { Activity, Actor } from './activity';
import { ok, type Result } from './result';
import type { Instant } from './time';

/** What every command receives besides its own input. */
export interface CommandContext {
  /** The current time, supplied by the caller. The domain never reads a clock. */
  readonly now: Instant;
  readonly actor: Actor;
}

/** The new record plus the Activity entries to append. */
export interface Applied<T> {
  readonly record: T;
  readonly activities: readonly Activity[];
}

export type CommandResult<T> = Result<Applied<T>>;

export function applied<T>(
  record: T,
  activities: readonly Activity[],
): CommandResult<T> {
  return ok({ record, activities });
}
