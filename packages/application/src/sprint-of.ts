// The Sprint an operation names (#295): the request's path names it by ID,
// and no operation of the person's picks the Sprint being planned, running
// or in Review by itself any more. The system's own records (the start of a
// day, the end of a Sprint) still find theirs by state.
import type {
  LocalDate,
  Result,
  Sprint,
  SprintId,
  SprintState,
} from '@itera/domain';
import type { ChangeContext } from './record-store';
import type { Records } from './records';

const STATE_WORDS: Readonly<Record<SprintState, string>> = {
  planning: 'being planned',
  active: 'running',
  review: 'in Review',
  closed: 'closed',
};

/**
 * The person's Sprint with this ID, in one of `states`: `notFound` when
 * the person has none with it (404), `invalidTransition` when it is in
 * another state (422: the operation does not apply to it now).
 */
export function sprintIn(
  records: Pick<Records, 'sprints'>,
  sprintId: SprintId,
  states: readonly SprintState[],
): Result<Sprint> {
  const sprint = records.sprints.find((s) => s.id === sprintId);
  if (sprint === undefined) {
    return {
      ok: false,
      error: { code: 'notFound', message: `Sprint ${sprintId}` },
    };
  }
  if (!states.includes(sprint.state)) {
    return {
      ok: false,
      error: {
        code: 'invalidTransition',
        message: `The Sprint is ${STATE_WORDS[sprint.state]}, not ${states
          .map((s) => STATE_WORDS[s])
          .join(' or ')}.`,
      },
    };
  }
  return { ok: true, value: sprint };
}

/**
 * Today's choice is made for the day the request names, which must be
 * today after the system's catch-up (#295 W3): a screen left open across
 * midnight does not choose for the day it showed.
 */
export function onlyToday(
  date: LocalDate,
  ctx: ChangeContext,
): Result<undefined> {
  return date === ctx.today
    ? { ok: true, value: undefined }
    : {
        ok: false,
        error: {
          code: 'invalidInput',
          message: `A choice for today is for ${ctx.today}, not ${date}.`,
        },
      };
}
