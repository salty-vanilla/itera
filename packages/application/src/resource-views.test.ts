import { addDays } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureStateIds } from './fixtures/states';
import { currentSprints } from './resource-views';

describe.each(fixtureStateIds)('the current Sprints of %s', (state) => {
  const { records, clock } = fixtureSnapshot(state);
  const { active, next } = currentSprints(records, clock);

  it('ends the next week 6 days after its start, as a Sprint does', () => {
    expect(next.end).toBe(addDays(next.start, 6));
  });

  it('calls the next week 来週 while a Sprint runs, 今週 when none does (#90)', () => {
    expect(next.week).toBe(active === undefined ? 'current' : 'next');
  });
});
