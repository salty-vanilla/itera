import { addDays } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureStateIds } from './fixtures/states';
import { currentSprints, sprintCandidates, sprintView } from './resource-views';
import { tagged } from './testing';

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

describe.each(fixtureStateIds)('a Sprint of %s', (state) => {
  const { records, clock } = fixtureSnapshot(state);

  it.each(records.sprints.map((s) => [s.state, s.id] as const))(
    'offers candidates only while planned, and a plan or a running view by state (%s)',
    (sprintState, sprintId) => {
      const candidates = sprintCandidates(tagged(records), clock, sprintId);
      const view = sprintView(tagged(records), clock, sprintId, {
        applyCriterion: false,
      });
      expect(candidates !== undefined).toBe(sprintState === 'planning');
      expect(view?.state).toBe(sprintState);
      expect(view !== undefined && 'plan' in view).toBe(
        sprintState === 'planning',
      );
      expect(view !== undefined && 'running' in view).toBe(
        sprintState !== 'planning',
      );
    },
  );

  it('has no view of a Sprint the person does not have', () => {
    const unknown = records.sprints[0]?.id.replace(/.$/, 'x') ?? 'none';
    const id = unknown as (typeof records.sprints)[number]['id'];
    expect(sprintCandidates(tagged(records), clock, id)).toBeUndefined();
    expect(
      sprintView(tagged(records), clock, id, { applyCriterion: false }),
    ).toBeUndefined();
  });
});
