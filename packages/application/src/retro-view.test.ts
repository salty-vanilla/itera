import type { Occurrence } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureIds, fixtureSnapshot } from './fixtures/states';
import type { Records } from './records';
import { retroData } from './retro-view';
import { tagged } from './testing';

const ids = fixtureIds();

describe('retroData', () => {
  it('counts a recurring Task’s occurrences by state, as the facts list them (F20, #348)', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    const sprint = records.sprints.find((s) => s.state === 'review');
    const reading = sprint?.tasks.find((t) => t.taskId === ids.task.reading);
    const [first, second] = reading?.occurrenceIds ?? [];
    // One left undone, one left out (F14): missed is counted, excluded not.
    const states: Partial<Record<string, Occurrence['state']>> = {
      ...(first === undefined ? {} : { [first]: 'missed' }),
      ...(second === undefined ? {} : { [second]: 'excluded' }),
    };
    const changed: Records = {
      ...records,
      occurrences: records.occurrences.map((o) => {
        const state = states[o.id];
        return state === undefined ? o : { ...o, state };
      }),
    };
    for (const input of [records, changed]) {
      const data = retroData(tagged(input), clock);
      const recurring = data?.facts.tasks.filter((t) => t.recurring) ?? [];
      expect(recurring.length).toBeGreaterThan(0);
      for (const fact of recurring) {
        const count = (list: readonly Occurrence[]) =>
          list.filter((o) => o.taskId === fact.taskId).length;
        const listed = data?.facts.occurrences;
        expect(fact.occurrences).toEqual({
          done: count(listed?.done ?? []),
          skipped: count(listed?.skipped ?? []),
          missed: count(listed?.missed ?? []),
        });
      }
      expect(data?.facts.tasks.find((t) => !t.recurring)?.occurrences).toBe(
        undefined,
      );
    }
    const reread = retroData(tagged(changed), clock);
    expect(
      reread?.facts.tasks.find((t) => t.taskId === ids.task.reading)
        ?.occurrences,
    ).toEqual({ done: 0, skipped: 1, missed: 1 });
  });
});
