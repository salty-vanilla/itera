import { appOverview } from '@itera/application';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';

/**
 * What the shell and the plain screens show: the clock, counts and the
 * Sprints by state (running, in Review, being planned).
 */
export function useAppOverview() {
  const { records, clock } = useStoreSnapshot();
  return useMemo(() => appOverview(records, clock), [records, clock]);
}
