import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from './fixtures/states';
import type { Clock, Records } from './records';
import { sprintRefs, weekNameOf } from './sprint-choice';

const names = (records: Records, clock: Clock) =>
  sprintRefs(records, clock).map((r) => `${r.number}:${r.week ?? '-'}`);

describe('week names (#90)', () => {
  it('calls the running Sprint 「今週」 and the next week 「来週」', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    expect(names(records, clock)).toEqual([
      '1:previous',
      '2:current',
      '3:next',
    ]);
  });

  it('calls the next to start 「今週」 while the last is in Review', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    expect(names(records, clock)).toEqual(['1:-', '2:previous', '3:current']);
  });

  it('calls the Sprint being planned 「今週」 when none runs', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    expect(names(records, clock)).toEqual(['1:previous', '2:current']);
    const planning = records.sprints.find((s) => s.state === 'planning')!;
    expect(weekNameOf(planning.start, records, clock)).toBe('current');
  });
});
