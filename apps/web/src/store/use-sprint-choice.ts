import type {
  CurrentSprints,
  GetMeResponse,
  ListSprintsResponse,
  LocalDate,
  SprintItem,
  SprintWeek,
} from '@itera/api-contract';
import { listSprintsOptions } from '@itera/api-contract/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient } from '@/api/api-provider';
import { useMe } from '@/api/use-me';
import { useRead2, type Read } from '@/api/read-state';

/** A Sprint the Sprint screen can open, or the next week before its Planning. */
export interface SprintRef {
  /** 「Sprint 3」 (F25). */
  readonly number: number;
  readonly start: LocalDate;
  readonly end: LocalDate;
  /** Absent for the next week, whose Planning has not started. */
  readonly sprint?: SprintItem;
  readonly week?: SprintWeek;
}

/** The Sprint the screen shows, and those before and after it. */
export interface SprintChoice {
  readonly current: SprintRef;
  readonly previous?: SprintRef;
  readonly next?: SprintRef;
}

/**
 * The Sprint the Sprint screen opens (#90): the one asked for by its number
 * in the URL, else the running one, else the one being planned, else the one
 * in Review, else the next week (its Planning starts there).
 *
 * It comes from two reads of the contract (ADR 0006 読み取り): the person's
 * Sprints in order (`listSprints`) and, while none is being planned, the next
 * week where one would start (`getMe`). The server names each Sprint's week
 * and the next week's; this only picks among them.
 */
export function useSprintChoice(asked?: number): Read<SprintChoice> {
  const client = useApiClient();
  const me = useMe();
  const sprints = useQuery(listSprintsOptions({ client }));
  // Kept between renders while `asked` is: `useRead2` makes the data from it
  // only when an answer or it changes.
  const view = useCallback(
    (person: GetMeResponse, list: ListSprintsResponse) =>
      person.sprints === undefined
        ? undefined
        : choiceOf(list.view, person.sprints.next, asked),
    [asked],
  );
  const read = useRead2(me, sprints, view);
  // The person's settings are not made yet: there are no Sprints to open.
  if (
    read.status === 'pending' &&
    me.data !== undefined &&
    me.data.sprints === undefined
  )
    return { status: 'failed', retry: () => void me.refetch() };
  return read;
}

export function choiceOf(
  items: readonly SprintItem[],
  next: CurrentSprints['next'],
  asked: number | undefined,
): SprintChoice | undefined {
  const refs: SprintRef[] = items.map((sprint) => ({
    number: sprint.number,
    start: sprint.start,
    end: sprint.end,
    sprint,
    ...(sprint.week === undefined ? {} : { week: sprint.week }),
  }));
  if (!items.some((s) => s.state === 'planning')) {
    refs.push({
      number: next.number,
      start: next.start,
      end: next.end,
      ...(next.week === undefined ? {} : { week: next.week }),
    });
  }
  const inState = (state: SprintItem['state']) =>
    refs.find((r) => r.sprint?.state === state);
  const current =
    refs.find((r) => r.number === asked) ??
    inState('active') ??
    inState('planning') ??
    inState('review') ??
    // The next week, or the Sprint being planned: the last of them.
    refs.at(-1);
  if (current === undefined) return undefined;
  const index = refs.indexOf(current);
  const previous = refs[index - 1];
  const following = refs[index + 1];
  return {
    current,
    ...(previous === undefined ? {} : { previous }),
    ...(following === undefined ? {} : { next: following }),
  };
}
