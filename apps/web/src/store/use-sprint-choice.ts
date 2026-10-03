import { sprintChoice, type SprintChoice } from '@itera/application';
import { useMemo } from 'react';
import { useStoreSnapshot } from './store-provider';

/**
 * The Sprint the Sprint or Retro screen opens (#90): the one asked for by
 * its number in the URL, else the current one.
 */
export function useSprintChoice(screen: 'sprint', asked?: number): SprintChoice;
export function useSprintChoice(
  screen: 'retro',
  asked?: number,
): SprintChoice | undefined;
export function useSprintChoice(
  screen: 'sprint' | 'retro',
  asked?: number,
): SprintChoice | undefined {
  const { records, clock } = useStoreSnapshot();
  return useMemo(
    () =>
      screen === 'sprint'
        ? sprintChoice(records, clock, screen, asked)
        : sprintChoice(records, clock, screen, asked),
    [records, clock, screen, asked],
  );
}
