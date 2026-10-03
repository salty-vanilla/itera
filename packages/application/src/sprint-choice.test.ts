import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from './fixtures/states';
import type { Clock, Records } from './records';
import { sprintChoice, sprintRefs, weekNameOf } from './sprint-choice';

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

describe('sprintChoice (#90)', () => {
  it('opens the running Sprint on Sprint, with the next week after it', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const choice = sprintChoice(records, clock, 'sprint');
    expect(choice.current.number).toBe(2);
    expect(choice.previous?.number).toBe(1);
    expect(choice.next?.number).toBe(3);
    expect(choice.next?.sprint).toBeUndefined();
  });

  it('opens the one being planned when none runs, before the one in Review', () => {
    const { records, clock } = fixtureSnapshot('planning-pick');
    expect(sprintChoice(records, clock, 'sprint').current.number).toBe(2);
  });

  it('opens the one in Review on Retro, and has no next week there', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    const choice = sprintChoice(records, clock, 'retro');
    expect(choice?.current.number).toBe(2);
    expect(choice?.next).toBeUndefined();
  });

  it('opens a Sprint asked for by number, and the default for none', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    expect(sprintChoice(records, clock, 'retro', 1)?.current.number).toBe(1);
    expect(sprintChoice(records, clock, 'retro', 3)?.current.number).toBe(2);
    expect(sprintChoice(records, clock, 'sprint', 3).current.number).toBe(3);
    expect(sprintChoice(records, clock, 'sprint', 4).current.number).toBe(2);
  });

  it('has no Retro before the first Sprint', () => {
    const { records, clock } = fixtureSnapshot('backlog-capture');
    const none: Records = { ...records, sprints: [] };
    expect(sprintChoice(none, clock, 'retro')).toBeUndefined();
    expect(sprintChoice(none, clock, 'sprint').current).toMatchObject({
      number: 1,
      week: 'current',
    });
  });
});
