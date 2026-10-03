import type { SprintItem } from '@itera/api-contract';
import { useMe } from '@/api/use-me';
import { useOperation } from '@/api/use-operation';

/**
 * Where the next week's Planning is: the Sprint being planned, or the number
 * of the one that would start (`getMe`, ADR 0006). `undefined` until the
 * person's Sprints have been read.
 */
export function useNextPlanning():
  { readonly planning?: SprintItem; readonly number: number } | undefined {
  const sprints = useMe().data?.sprints;
  if (sprints === undefined) return undefined;
  return {
    ...(sprints.planning === undefined ? {} : { planning: sprints.planning }),
    number: sprints.planning?.number ?? sprints.next.number,
  };
}

/**
 * 「Sprint N の計画を始める」: the Sprint's ID, or `undefined` when it did
 * not go through (a Toast says so, useOperation).
 */
export function useBeginPlanning() {
  const begin = useOperation('beginPlanning');
  return {
    beginPlanning: async (): Promise<string | undefined> => {
      const outcome = await begin.run();
      return outcome.ok ? outcome.value.sprintId : undefined;
    },
    loading: begin.loading,
  };
}
