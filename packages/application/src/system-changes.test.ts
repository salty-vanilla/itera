// The system's catch-up (#271): from the day the records were last brought
// up to, through today. On the fixture's 「today-daytime」 (Thursday 10/1 of
// the Sprint 9/28–10/4, Asia/Tokyo; 英語の多読 recurs on Mon・Wed・Fri).
import { instant, localDate, type LocalDate, type Sprint } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from './fixtures/states';
import { catchUp } from './system-changes';
import { memoryStore } from './testing';

const daytime = fixtureSnapshot('today-daytime');

/** Runs the catch-up at 07:00 (Tokyo) on `today`. */
function caughtUp(
  today: LocalDate,
  caughtUpTo: LocalDate | null,
  records = daytime.records,
) {
  const store = memoryStore({
    records,
    clock: {
      now: instant(new Date(`${today}T07:00:00+09:00`).toISOString()),
      today,
    },
  });
  const result = store.run(catchUp(caughtUpTo), { actor: 'system' });
  expect(result.ok).toBe(true);
  const after = store.getSnapshot().records;
  return {
    sprint: after.sprints.find((s) => s.start === '2026-09-28') as Sprint,
    added: after.activities.slice(records.activities.length),
  };
}

const datesChosen = (sprint: Sprint, origin: string) =>
  sprint.dailySelections.filter((s) => s.origin === origin).map((s) => s.date);

describe('catchUp', () => {
  it('starts every day from the one it was last brought up to', () => {
    const { sprint, added } = caughtUp(
      localDate('2026-10-03'),
      localDate('2026-10-01'),
    );
    // Friday's reading and Saturday's cleaning, as on each day.
    expect(datesChosen(sprint, 'recurringToday')).toEqual([
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(added.every((a) => a.actor === 'system')).toBe(true);
  });

  it('does not start a day before the one it was last brought up to', () => {
    // As if Friday had been started already: its reading is not chosen
    // after the fact.
    const { sprint } = caughtUp(
      localDate('2026-10-03'),
      localDate('2026-10-03'),
    );
    expect(datesChosen(sprint, 'recurringToday')).toEqual([
      '2026-09-28',
      '2026-09-30',
      '2026-10-03',
    ]);
  });

  it('starts only today without the day, or with one after today', () => {
    for (const caughtUpTo of [null, localDate('2026-10-04')]) {
      const { sprint } = caughtUp(localDate('2026-10-03'), caughtUpTo);
      expect(datesChosen(sprint, 'recurringToday')).toEqual([
        '2026-09-28',
        '2026-09-30',
        '2026-10-03',
      ]);
    }
  });

  it('changes nothing when today has started', () => {
    const { added } = caughtUp(daytime.clock.today, daytime.clock.today);
    expect(added).toEqual([]);
  });

  it('changes nothing without a running Sprint', () => {
    const planning = fixtureSnapshot('planning-pick');
    const { added } = caughtUp(
      localDate('2026-09-28'),
      planning.clock.today,
      planning.records,
    );
    expect(added).toEqual([]);
  });
});
