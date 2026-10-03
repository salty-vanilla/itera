import type {
  CurrentSprints,
  GetMeResponse,
  LocalDate,
  SprintId,
} from '@itera/api-contract';
import { getMeOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import { useApiClient } from './api-provider';
import { useRead, type Read } from './read-state';
import { SAVE_FAILED } from './save-failed';
import type { Outcome } from './use-operation';

/**
 * The signed-in person (`getMe`): their settings and, once they are made,
 * the clock and the Sprints they have now by what each is (#295 R1). An
 * operation on the running Sprint names it from here. `data` is absent
 * until the first answer.
 */
export function useMe() {
  return useQuery(getMeOptions({ client: useApiClient() }));
}

/** The running Sprint and today, as the operations of today name them. */
export interface RunningDay {
  readonly sprintId: SprintId;
  readonly date: LocalDate;
}

/**
 * The running Sprint and today, as the operations of today name them
 * (#295 W3); absent until `/me` has answered, or with no Sprint running.
 */
export function useRunningDay(): RunningDay | undefined {
  const me = useMe().data;
  const sprintId = me?.sprints?.active?.id;
  const today = me?.clock?.today;
  return sprintId === undefined || today === undefined
    ? undefined
    : { sprintId, date: today };
}

/**
 * Sends an operation on the running Sprint and today (`useRunningDay`) and
 * gives back its outcome (useOperation). With no Sprint running there is
 * nothing to send it to: the refusal's Toast (SAVE_FAILED), as the API
 * would answer it, and the operation did not go through.
 */
export function useOnRunningDay() {
  const day = useRunningDay();
  const toast = useToast();
  return async <T>(
    send: (day: RunningDay) => Promise<Outcome<T>>,
  ): Promise<Outcome<T>> => {
    if (day === undefined) {
      toast.show(SAVE_FAILED);
      return { ok: false };
    }
    return send(day);
  };
}

/** What a screen needs to ask for a day: today, and the Sprints now. */
export interface Now {
  readonly today: LocalDate;
  readonly sprints: CurrentSprints;
}

function nowOf(me: GetMeResponse): Now | undefined {
  const { clock, sprints } = me;
  return clock === undefined || sprints === undefined
    ? undefined
    : { today: clock.today, sprints };
}

/**
 * Today's date as the server decided it (ADR 0005 時計) and the Sprints now,
 * from `getMe`. Without the person's settings there is no clock: `failed`.
 */
export function useNow(): Read<Now> {
  return useRead(useMe(), nowOf);
}
