import type { Instant, LocalDate, Sprint } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import { dayData } from './day-view';
import type { Records } from './records';

const day = (date: string) => date as LocalDate;
const withSprint = (
  records: Records,
  id: string,
  change: (s: Sprint) => Sprint,
): Records => ({
  ...records,
  sprints: records.sprints.map((s) => (s.id === id ? change(s) : s)),
});
const removing = (taskId: string) => (s: Sprint) => ({
  ...s,
  tasks: s.tasks.map((t) =>
    t.taskId === taskId ? { ...t, outcome: 'removed' as const } : t,
  ),
});

describe('dayData (#90)', () => {
  it('is absent for today, which is the Today screen itself', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    expect(dayData(records, clock, clock.today)).toBeUndefined();
  });

  it('lists a past day’s choices in the order chosen, with how each ended and its hours', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const data = dayData(records, clock, day('2026-09-30'));
    expect(data?.when).toBe('past');
    expect(data?.within).toMatchObject({
      number: 2,
      day: { index: 3, count: 7 },
    });
    expect(
      data?.records.map((r) => [
        r.title,
        r.selection.resolution,
        r.actualHours,
        r.occurrence !== undefined,
      ]),
    ).toEqual([
      ['英語の多読 30分', 'done', 0.5, true],
      ['関連論文を 3本読む', 'paused', 4.5, false],
    ]);
    // Nothing of a future day on a past one.
    expect(data?.occurrences).toEqual([]);
    expect(data?.due).toEqual([]);
  });

  it('keeps a past choice of a Task removed from the Sprint afterwards', () => {
    // Today shows the week as it is now (F13); a past day, what happened.
    const { records, clock } = fixtureSnapshot('today-daytime');
    const removed = withSprint(
      records,
      'sprint-2026-09-28',
      removing('task-paper'),
    );
    const titles = dayData(removed, clock, day('2026-09-30'))?.records.map(
      (r) => r.title,
    );
    expect(titles).toContain('関連論文を 3本読む');
  });

  it('names the Areas of a closed Sprint as at its confirm (F5)', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const renamed = {
      ...records,
      areas: records.areas.map((a) =>
        a.name === '研究' ? { ...a, name: '博士研究' } : a,
      ),
    };
    const data = dayData(renamed, clock, day('2026-09-22'));
    expect(data?.within?.sprint?.state).toBe('closed');
    expect(data?.records.map((r) => r.area?.name)).toEqual(['研究']);
  });

  it('takes the interrupts by the person’s day, not UTC', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    const at = (instant: string) => instant as Instant;
    const moved = withSprint(records, 'sprint-2026-09-28', (s) => ({
      ...s,
      interrupts: [
        // 10/1 00:30 and 9/30 23:30 in Asia/Tokyo.
        { ...s.interrupts[0]!, at: at('2026-09-30T15:30:00.000Z') },
        { ...s.interrupts[1]!, at: at('2026-09-30T14:30:00.000Z') },
      ],
    }));
    const on = (date: string) =>
      dayData(moved, clock, day(date))?.interrupts.map((n) => n.at);
    expect(on('2026-10-01')).toEqual(['2026-09-30T15:30:00.000Z']);
    expect(on('2026-09-30')).toEqual(['2026-09-30T14:30:00.000Z']);
  });

  it('takes a future day’s occurrences from the Sprint being planned, and its deadlines', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    const data = dayData(records, clock, day('2026-09-30'));
    expect(data?.when).toBe('future');
    expect(data?.within?.sprint?.state).toBe('planning');
    expect(data?.occurrences.map((o) => o.title)).toEqual(['英語の多読 30分']);
    expect(data?.due.map((d) => d.task.title)).toEqual(['住民税の支払い']);
    expect(data?.records).toEqual([]);
  });

  it('leaves out the occurrences excluded, and those of a Task removed from the Sprint', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const titles = (r: Records) =>
      dayData(r, clock, day('2026-10-02'))?.occurrences.map((o) => o.title);
    expect(titles(records)).toEqual(['英語の多読 30分']);
    const excluded = {
      ...records,
      occurrences: records.occurrences.map((o) =>
        o.scheduledDate === '2026-10-02'
          ? { ...o, state: 'excluded' as const }
          : o,
      ),
    };
    expect(titles(excluded)).toEqual([]);
    const task = records.occurrences.find(
      (o) => o.scheduledDate === '2026-10-02',
    )?.taskId;
    expect(
      titles(withSprint(records, 'sprint-2026-09-28', removing(task!))),
    ).toEqual([]);
  });

  it('has no Sprint for a day after the one being planned', () => {
    const { records, clock } = fixtureSnapshot('planning-check');
    const data = dayData(records, clock, day('2026-10-06'));
    expect(data?.within).toBeUndefined();
    expect(data?.next).toBeUndefined();
  });

  it('points a day before every Sprint to the first one', () => {
    const { records, clock } = fixtureSnapshot('today-daytime');
    const data = dayData(records, clock, day('2026-09-10'));
    expect(data?.within).toBeUndefined();
    expect(data?.next).toMatchObject({ number: 1, start: '2026-09-21' });
    expect(data?.records).toEqual([]);
  });
});
