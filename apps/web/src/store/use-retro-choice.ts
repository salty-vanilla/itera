// The Sprint the Retro screen opens, still from the RecordStore until the
// Retro moves to the contract (#276; ADR 0005). The Sprint screen's own
// choice is use-sprint-choice.ts, which reads the contract (#274).
import { sprintChoice, type SprintChoice } from '@itera/application';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';

/**
 * The Sprint the Retro screen opens (#90): the one asked for by its number
 * in the URL, else the one in Review, else the running one, else the last
 * closed. `undefined` before the first Sprint.
 */
export function useRetroChoice(asked?: number): SprintChoice | undefined {
  const { records, clock } = useStoreSnapshot();
  return useMemo(
    () => sprintChoice(records, clock, 'retro', asked),
    [records, clock, asked],
  );
}
