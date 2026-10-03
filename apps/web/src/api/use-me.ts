import { getMeOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './api-provider';

/**
 * The signed-in person (`getMe`): their settings and, once they are made,
 * the clock and the Sprints they have now by what each is (#295 R1). An
 * operation on the running Sprint names it from here. `data` is absent
 * until the first answer.
 */
export function useMe() {
  return useQuery(getMeOptions({ client: useApiClient() }));
}

/**
 * The running Sprint and today, as the operations of today name them
 * (#295 W3); absent until `/me` has answered, or with no Sprint running.
 */
export function useRunningDay() {
  const me = useMe().data;
  const sprintId = me?.sprints?.active?.id;
  const today = me?.clock?.today;
  return sprintId === undefined || today === undefined
    ? undefined
    : { sprintId, date: today };
}
