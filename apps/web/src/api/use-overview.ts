import { getOverviewOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './api-provider';

/**
 * The read every screen's frame shows (`getOverview`): the clock, the
 * navigation's counts and the Sprints by state. `data` is absent until the
 * first answer.
 */
export function useOverview() {
  return useQuery(getOverviewOptions({ client: useApiClient() }));
}
