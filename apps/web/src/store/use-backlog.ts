import { useMemo } from 'react';
import { backlogData, type BacklogFilter } from './backlog-view';
import { useStoreSnapshot } from './store-provider';

/** The Backlog screen's data (ADR 0005: screens read through hooks). */
export function useBacklog(filter: BacklogFilter) {
  const { records, clock } = useStoreSnapshot();
  const { view, area } = filter;
  return useMemo(
    () => backlogData(records, clock, { view, area }),
    [records, clock, view, area],
  );
}
