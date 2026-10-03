import type { ListSprintsResponse, SprintItem } from '@itera/api-contract';
import { listSprintsOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient } from '@/api/api-provider';
import { useRead, type Read } from '@/api/read-state';

/**
 * The Sprint the Retro screen shows, and those before and after it. No
 * `current` before the first Sprint: the next week has no Retro to open.
 */
export interface RetroChoice {
  readonly current?: SprintItem;
  readonly previous?: SprintItem;
  readonly next?: SprintItem;
}

/**
 * The Sprint the Retro screen opens (#90): the one asked for by its number
 * in the URL, else the one in Review, else the running one (its Retro
 * starts on its last day, F21), else the last closed.
 *
 * It comes from the person's Sprints in order (`listSprints`, ADR 0006
 * 読み取り); the server names each one's week, this only picks among them.
 */
export function useRetroChoice(asked?: number): Read<RetroChoice> {
  const query = useQuery(listSprintsOptions({ client: useApiClient() }));
  // Kept between renders while `asked` is: `useRead` makes the data from it
  // only when an answer or it changes.
  const view = useCallback(
    ({ view: sprints }: ListSprintsResponse) => choiceOf(sprints, asked),
    [asked],
  );
  return useRead(query, view);
}

export function choiceOf(
  sprints: readonly SprintItem[],
  asked: number | undefined,
): RetroChoice {
  const current =
    sprints.find((s) => s.number === asked) ??
    sprints.find((s) => s.state === 'review') ??
    sprints.find((s) => s.state === 'active') ??
    sprints.findLast((s) => s.state === 'closed') ??
    // Only Sprints still being planned: the last of them.
    sprints.at(-1);
  if (current === undefined) return {};
  const index = sprints.indexOf(current);
  const previous = sprints[index - 1];
  const next = sprints[index + 1];
  return {
    current,
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
}
