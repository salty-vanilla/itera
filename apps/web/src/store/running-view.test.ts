import type { Instant, LocalDate } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from '@/fixtures/states';
import type { Records } from './records';
import { runningData } from './running-view';

const withActive = (
  records: Records,
  change: (s: Records['sprints'][number]) => Records['sprints'][number],
): Records => ({
  ...records,
  sprints: records.sprints.map((s) => (s.state === 'active' ? change(s) : s)),
});

describe('runningData', () => {
  it('is absent without a running Sprint', () => {
    const { records, clock } = fixtureSnapshot('retro-start');
    expect(runningData(records, clock)).toBeUndefined();
  });

  it('has no day count before the first day', () => {
    const { records } = fixtureSnapshot('today-interrupt');
    const data = runningData(records, {
      today: '2026-09-27' as LocalDate,
      now: '2026-09-27T12:00:00.000Z' as Instant,
    });
    expect(data?.day).toBeUndefined();
  });

  it('leaves out Tasks removed from the Sprint, from the list and the total', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const before = runningData(records, clock);
    const removed = withActive(records, (s) => ({
      ...s,
      tasks: s.tasks.map((t) =>
        t.taskId === 'task-interview' ? { ...t, outcome: 'removed' } : t,
      ),
    }));
    const data = runningData(removed, clock);
    const ids = data?.plan.flatMap((p) => p.tasks.map((t) => t.task.id));
    expect(ids).not.toContain('task-interview');
    expect(data?.totals.total.lo).toBeLessThan(before?.totals.total.lo ?? 0);
  });

  it('shows Tasks without an Area last, and no criterion when there was none', () => {
    const { records, clock } = fixtureSnapshot('today-interrupt');
    const noArea = {
      ...withActive(records, (s) => {
        const { criterionUse: _unused, ...rest } = s;
        void _unused;
        return rest;
      }),
      tasks: records.tasks.map((t) => {
        if (t.id !== 'task-tax') return t;
        const { areaId: _a, ...rest } = t;
        void _a;
        return rest;
      }),
    };
    const data = runningData(noArea, clock);
    expect(data?.plan.at(-1)?.area.name).toBe('領域なし');
    expect(data?.plan.at(-1)?.tasks.map((t) => t.task.id)).toEqual([
      'task-tax',
    ]);
    expect(data?.criterion).toBeUndefined();
  });
});
