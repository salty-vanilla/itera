import type { SprintItem } from '@itera/api-contract';
import { describe, expect, it } from 'vitest';
import { choiceOf } from './use-sprint-choice';

const sprint = (
  number: number,
  state: SprintItem['state'],
  week?: SprintItem['week'],
): SprintItem => {
  const day = String(number * 7).padStart(2, '0');
  return {
    id: `sprint_${number}`,
    number,
    start: `2026-01-${day}`,
    end: `2026-01-${day}`,
    state,
    capabilities: {
      canSetAvailableHours: false,
      canConfirm: false,
      canBeginRetro: false,
    },
    ...(week === undefined ? {} : { week }),
  };
};
const next = (number: number, week?: 'current' | 'next') => ({
  start: '2026-02-01',
  end: '2026-02-07',
  number,
  ...(week === undefined ? {} : { week }),
});

describe('the Sprint the Sprint screen opens', () => {
  it('opens the running Sprint, with the one before and the next week around it', () => {
    const choice = choiceOf(
      [sprint(1, 'closed', 'previous'), sprint(2, 'active', 'current')],
      next(3, 'next'),
      undefined,
    );
    expect(choice?.current.number).toBe(2);
    expect(choice?.previous?.number).toBe(1);
    // After the last Sprint comes the next week, where its Planning starts:
    // no Sprint yet, and its place next to now is the server's.
    expect(choice?.next).toMatchObject({ number: 3, week: 'next' });
    expect(choice?.next?.sprint).toBeUndefined();
  });

  it('prefers running, then planning, then Review', () => {
    const planning = sprint(3, 'planning', 'next');
    expect(
      choiceOf(
        [sprint(1, 'review'), sprint(2, 'active'), planning],
        next(3),
        undefined,
      )?.current.number,
    ).toBe(2);
    expect(
      choiceOf([sprint(1, 'review'), planning], next(3), undefined)?.current
        .number,
    ).toBe(3);
    expect(
      choiceOf([sprint(1, 'closed'), sprint(2, 'review')], next(3), undefined)
        ?.current.number,
    ).toBe(2);
  });

  it('adds the next week only while no Sprint is being planned', () => {
    const items = [sprint(1, 'active'), sprint(2, 'planning', 'next')];
    const choice = choiceOf(items, next(2, 'next'), 2);
    expect(choice?.current.sprint?.id).toBe('sprint_2');
    expect(choice?.next).toBeUndefined();
  });

  it('opens the next week when every Sprint is closed', () => {
    const choice = choiceOf(
      [sprint(1, 'closed'), sprint(2, 'closed')],
      next(3, 'current'),
      undefined,
    );
    expect(choice?.current).toMatchObject({ number: 3, week: 'current' });
    expect(choice?.current.sprint).toBeUndefined();
    expect(choice?.previous?.number).toBe(2);
  });

  it('opens the one asked for by its number, else the usual one', () => {
    const items = [sprint(1, 'closed'), sprint(2, 'active')];
    expect(choiceOf(items, next(3), 1)?.current.number).toBe(1);
    expect(choiceOf(items, next(3), 3)?.current.number).toBe(3);
    expect(choiceOf(items, next(3), 9)?.current.number).toBe(2);
  });

  it('opens the next week when the person has no Sprint yet', () => {
    const choice = choiceOf([], next(1, 'current'), undefined);
    expect(choice?.current).toMatchObject({ number: 1, week: 'current' });
    expect(choice?.previous).toBeUndefined();
    expect(choice?.next).toBeUndefined();
  });
});
