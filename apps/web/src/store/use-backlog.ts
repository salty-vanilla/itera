import type {
  BacklogData,
  BacklogItem,
  BacklogSlice,
} from '@itera/api-contract';
import { getBacklogOptions } from '@itera/api-contract/react-query';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';

/** What narrows the Backlog: a 切り口 and an Area. Both optional. */
export interface BacklogFilter {
  readonly view?: BacklogSlice | undefined;
  readonly area?: string | undefined;
}

/**
 * The Backlog as the screens use it: the contract's answer, with the Tasks
 * shown in their order and a lookup by ID.
 */
export type BacklogView = Omit<BacklogData, 'shown' | 'items'> & {
  /** The Tasks shown, in order. */
  readonly items: readonly BacklogItem[];
  /** Any active Task by ID, for the detail (even when filtered out). */
  readonly item: (taskId: string) => BacklogItem | undefined;
};

function backlogView(data: { view: BacklogData }): BacklogView {
  const { shown, items, ...rest } = data.view;
  const byId: Readonly<Record<string, BacklogItem>> = items;
  return {
    ...rest,
    items: shown.flatMap((taskId) => byId[taskId] ?? []),
    item: (taskId) => byId[taskId],
  };
}

/**
 * The Backlog screen's data: `getBacklog` through the contract's client
 * (ADR 0005). Changing the filter keeps the last answer on screen until the
 * new one is back.
 */
export function useBacklog(filter: BacklogFilter): Read<BacklogView> {
  const { view, area } = filter;
  const query = useQuery({
    ...getBacklogOptions({
      client: useApiClient(),
      query: {
        ...(view === undefined ? {} : { view }),
        ...(area === undefined ? {} : { area }),
      },
    }),
    placeholderData: keepPreviousData,
  });
  return useRead(query, backlogView);
}
