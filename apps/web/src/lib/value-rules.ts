// The rules for a value that the screens check before sending it (#351).
// The server decides: each rule here is a copy of a rule of `packages/domain`
// (answered as 422 when it is broken, ADR 0006), kept so that the screen can
// say so while the person is typing. Until iOS starts, Web may do it (ADR
// 0007 依存の向き, the exception for 値の規則); this file is the entry for
// the list of previews that replaces it. Every function names the rule it
// copies. A rule changed in the domain is changed here, and the other way
// round is not done.
//
// This module does not import `packages/domain` (ADR 0005 import の境界):
// `value-rules.test.ts` holds the same inputs against the domain.

/**
 * Spaces around a text are not part of it: what is sent is what the domain
 * keeps. The base of the readers below.
 */
export function trimText(text: string): string {
  return text.trim();
}

/** Nothing but spaces, or nothing. */
export function isBlank(text: string): boolean {
  return trimText(text) === '';
}

/** Two texts are the same words, whatever spaces are around them. */
export function sameWords(a: string, b: string): boolean {
  return trimText(a) === trimText(b);
}

/**
 * The words to send, or `undefined` when there are none (a title or a name
 * that must not be empty).
 */
function nonEmpty(text: string): string | undefined {
  const words = trimText(text);
  return words === '' ? undefined : words;
}

/** A Task's title. `createTask`, `updateTask` in `task.ts`. */
export function readTaskTitle(text: string): string | undefined {
  return nonEmpty(text);
}

/** A Subtask's title. `addSubtask` in `task.ts`. */
export function readSubtaskTitle(text: string): string | undefined {
  return nonEmpty(text);
}

/** An Area's name. `createArea`, `renameArea` in `area.ts`. */
export function readAreaName(text: string): string | undefined {
  return nonEmpty(text);
}

/** The note of an interrupt. `noteInterrupt`, `editInterrupt` in `today.ts`. */
export function readInterruptText(text: string): string | undefined {
  return nonEmpty(text);
}

/** The display name. `setUpUser` in `user.ts`. */
export function readDisplayName(text: string): string | undefined {
  return nonEmpty(text);
}

/**
 * A Goal's text. Empty is a Goal taken away (`''`, in a Sprint that is
 * still planning). `setGoalText` in `planning.ts`.
 */
export function readGoalText(text: string): string {
  return trimText(text);
}

/**
 * The text of 次に試すこと. Empty is it taken away (`''`). `setImprovement`
 * in `review.ts`.
 */
export function readImprovementText(text: string): string {
  return trimText(text);
}

/**
 * Taking away 次に試すこと that a criterion was made from: refused until
 * the criterion is dropped. `setImprovement` in `review.ts`.
 */
export function improvementHoldsCriterion(
  text: string,
  hasCriterion: boolean,
): boolean {
  return hasCriterion && isBlank(text);
}

/**
 * The minutes read from the fields (`readMinutes`) as a time the domain
 * takes: positive. `undefined` stays (nothing typed), a time of no minute
 * and what was not a number are `null`. `isPositiveHours` in `task.ts`,
 * which an Estimate (`estimate.ts`), `addSubtask`, `setSubtaskEstimate`,
 * `noteInterrupt`, `editInterrupt` and the actual time of a day use.
 */
export function positiveMinutes(
  minutes: number | undefined | null,
): number | undefined | null {
  if (minutes === undefined) return undefined;
  return minutes !== null && Number.isFinite(minutes) && minutes > 0
    ? minutes
    : null;
}

/**
 * A weekly rule that has no weekday yet. `validatePattern` in
 * `recurrence.ts`.
 */
export function weeklyNeedsADay(
  freq: string,
  daysOfWeek: readonly unknown[],
): boolean {
  return freq === 'weekly' && daysOfWeek.length === 0;
}
