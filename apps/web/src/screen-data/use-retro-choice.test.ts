import type { SprintItem } from '@itera/api-contract';
import { describe, expect, it } from 'vitest';
import { choiceOf } from './use-retro-choice';

const sprint = (number: number, state: SprintItem['state']): SprintItem => {
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
  };
};

describe('the Sprint the Retro screen opens', () => {
  it('opens the one in Review, with the closed one before it', () => {
    const choice = choiceOf(
      [sprint(1, 'closed'), sprint(2, 'review'), sprint(3, 'planning')],
      undefined,
    );
    expect(choice.current?.number).toBe(2);
    expect(choice.previous?.number).toBe(1);
    expect(choice.next?.number).toBe(3);
  });

  it('opens the running Sprint when none is in Review (its Retro starts on its last day)', () => {
    const choice = choiceOf(
      [sprint(1, 'closed'), sprint(2, 'active')],
      undefined,
    );
    expect(choice.current?.number).toBe(2);
    expect(choice.next).toBeUndefined();
  });

  it('opens the last closed Sprint when none runs or is in Review', () => {
    const choice = choiceOf(
      [sprint(1, 'closed'), sprint(2, 'closed')],
      undefined,
    );
    expect(choice.current?.number).toBe(2);
    expect(choice.previous?.number).toBe(1);
  });

  it('opens the one asked for by its number, in any state', () => {
    const sprints = [sprint(1, 'closed'), sprint(2, 'review')];
    expect(choiceOf(sprints, 1).current?.number).toBe(1);
    expect(choiceOf(sprints, 1).next?.number).toBe(2);
  });

  it('opens the usual one for a number no Sprint has', () => {
    expect(
      choiceOf([sprint(1, 'closed'), sprint(2, 'review')], 9).current?.number,
    ).toBe(2);
  });

  it('opens the last Sprint when all are still being planned', () => {
    expect(choiceOf([sprint(1, 'planning')], undefined).current?.number).toBe(
      1,
    );
  });

  it('has nothing to open before the first Sprint', () => {
    expect(choiceOf([], undefined)).toEqual({});
  });
});
