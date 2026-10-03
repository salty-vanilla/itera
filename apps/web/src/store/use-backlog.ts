import { backlogData, type BacklogFilter } from '@itera/application';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';
import { backlogScreenData } from './views';

/** The Backlog screen's data (ADR 0005: screens read through hooks). */
export function useBacklog(filter: BacklogFilter) {
  const { records, clock } = useStoreSnapshot();
  const { view, area } = filter;
  return useMemo(
    () => backlogScreenData(backlogData(records, clock, { view, area })),
    [records, clock, view, area],
  );
}
