import { localDate, type Instant, type Sprint } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import type { Records } from './records';
import { backlogData } from './backlog-view';
import { todayData } from './today-view';

const ids = fixtureIds();

const withSprint = (records: Records, change: (s: Sprint) => Sprint) => ({
  ...records,
  sprints: records.sprints.map((s) => (s.state === 'active' ? change(s) : s)),
});

describe('todayData', () => {
  it('is absent without an active Sprint', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    expect(todayData(records, clock)).toBeUndefined();
  });

  it('lists the Tasks of the week first, then occurrences by date (F18)', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const rest = todayData(records, clock)?.rest ?? [];
    const kinds = rest.map((r) => r.occurrence?.scheduledDate ?? 'task');
    expect(kinds).toEqual(['task', '2026-10-02', '2026-10-03']);
    // 昨日の続き is not repeated in the rest.
    expect(rest.some((r) => r.task.id === ids.task.paper)).toBe(false);
  });

  it('keeps 昨日の続き and today’s choices in the plan, which is the week before its first day (#156)', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const data = todayData(records, clock);
    const plan = data?.plan ?? [];
    // The plan is every planned Task and pending occurrence; the rest is the
    // plan less what is chosen today or continued from yesterday.
    expect(plan.some((p) => p.task.id === ids.task.paper)).toBe(true);
    expect(plan.length).toBeGreaterThan(data?.rest.length ?? 0);
    expect(plan.filter((p) => data?.rest.includes(p))).toEqual(data?.rest);
    const planned = plan.map((p) => p.sprintTask.id);
    expect(
      data?.continuation.every((c) => planned.includes(c.sprintTask.id)),
    ).toBe(true);
  });

  it('hides a SprintTask removed from the Sprint, with its selection (F13)', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const removed = withSprint(records, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.taskId === ids.task.interview ? { ...t, outcome: 'removed' } : t,
      ),
    }));
    const data = todayData(removed, clock);
    const titles = [...(data?.rows ?? []), ...(data?.rest ?? [])].map(
      (r) => r.task.id,
    );
    expect(titles).not.toContain(ids.task.interview);
    expect(data?.remaining.count).toBe(1);
  });

  it('puts a choice put back today in 今週の残り, not in 今日はもうやらない (#233)', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    let id: string | undefined;
    const putBack = withSprint(records, (s) => ({
      ...s,
      dailySelections: s.dailySelections.map((d) => {
        if (
          d.date !== clock.today ||
          s.tasks.find((t) => t.id === d.sprintTaskId)?.taskId !==
            ids.task.interview
        )
          return d;
        id = d.id;
        return { ...d, resolution: 'removed' as const };
      }),
    }));
    const data = todayData(putBack, clock);
    expect(data?.closed).toEqual([]);
    expect(data?.rows.some((r) => r.task.id === ids.task.interview)).toBe(
      false,
    );
    const item = data?.rest.find((r) => r.task.id === ids.task.interview);
    expect(item?.removedToday).toBe(id);
    // The others in the rest were not chosen today.
    expect(data?.rest.filter((r) => r.removedToday !== undefined)).toHaveLength(
      1,
    );
  });

  it('puts the Backlog’s completions last in 今日やる', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const early = withSprint(records, (s) => ({
      ...s,
      dailySelections: s.dailySelections.map((d) =>
        d.date === clock.today &&
        s.tasks.find((t) => t.id === d.sprintTaskId)?.taskId ===
          ids.task.apiReview
          ? {
              ...d,
              origin: 'backlogCompletion',
              selectedAt: '2026-09-30T00:00:00.000Z' as Instant,
            }
          : d,
      ),
    }));
    const rows = todayData(early, clock)?.rows ?? [];
    expect(rows.at(-1)?.task.id).toBe(ids.task.apiReview);
  });

  it('shows only today’s interrupts, by the user’s date', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const withEarlier = withSprint(records, (s) => ({
      ...s,
      interrupts: [
        // 9/30 23:30 in Tokyo.
        {
          id: 'note-yesterday' as never,
          at: '2026-09-30T14:30:00.000Z' as Instant,
          text: '昨日の',
        },
        ...s.interrupts,
      ],
    }));
    const texts = todayData(withEarlier, clock)?.interrupts.map((n) => n.text);
    expect(texts).toEqual(['障害の問い合わせに対応', '急ぎのレビュー依頼']);
  });
});

// Only the Sprint's end date is its last day, whichever screen asks: Today
// and the Backlog give the same answer, and no Sprint is not a last day (#314).
describe('lastDay', () => {
  const { records, clock } = fixtureSnapshot('today-interrupt');
  const end = records.sprints.find((s) => s.state === 'active')?.end;
  const on = (today: string) => ({ ...clock, today: localDate(today) });

  it('is true only on the active Sprint’s end date, in Today and the Backlog', () => {
    expect(end).toBe('2026-10-04');
    const answers = ['2026-10-01', '2026-10-03', '2026-10-04'].map((day) => ({
      day,
      today: todayData(records, on(day))?.lastDay,
      backlog: backlogData(records, on(day), {}).lastDay,
    }));
    expect(answers).toEqual([
      { day: '2026-10-01', today: false, backlog: false },
      { day: '2026-10-03', today: false, backlog: false },
      { day: '2026-10-04', today: true, backlog: true },
    ]);
  });

  it('is false in the Backlog when no Sprint is active', () => {
    const planning = fixtureSnapshot('planning-pick');
    expect(planning.records.sprints.some((s) => s.state === 'active')).toBe(
      false,
    );
    expect(backlogData(planning.records, planning.clock, {}).lastDay).toBe(
      false,
    );
  });
});
