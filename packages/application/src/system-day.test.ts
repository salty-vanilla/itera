// The system's catch-up (reviewEnded, beginDay) runs before every read and
// operation of the API and the browser mock (ADR 0004 操作と読み取りの処
// 理). Once it has run, running it again writes nothing.
import { addDays } from '@itera/domain';
import { describe, expect, it, vi } from 'vitest';
import { fixtureSnapshot, fixtureStateIds } from './fixtures/states';
import { beginDay } from './today-changes';
import { reviewEnded } from './system-changes';
import { memoryStore } from './testing';

describe.each(fixtureStateIds)('the catch-up in %s', (state) => {
  it('writes nothing the second time', () => {
    const store = memoryStore(fixtureSnapshot(state));
    store.run(reviewEnded(), { actor: 'system' });
    store.run(beginDay(), { actor: 'system' });
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    for (const change of [reviewEnded(), beginDay()]) {
      const result = change(before.records, {
        now: before.clock.now,
        today: before.clock.today,
        actor: 'system',
        newId: () => {
          throw new Error('Nothing to make.');
        },
      });
      // With no running Sprint, beginDay has nothing to act on (a failure
      // that changes nothing).
      if (result.ok)
        expect(result.value).toEqual({ changes: {}, activities: [] });
      store.run(change, { actor: 'system' });
    }
    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });
});

it('still starts a new day', () => {
  // The next morning: yesterday's open selections become unresolved.
  const snapshot = fixtureSnapshot('today-daytime');
  const store = memoryStore({
    ...snapshot,
    clock: { ...snapshot.clock, today: addDays(snapshot.clock.today, 1) },
  });
  const before = store.getSnapshot();
  expect(store.run(beginDay(), { actor: 'system' }).ok).toBe(true);
  expect(store.getSnapshot()).not.toBe(before);
  expect(store.getSnapshot().records.activities.length).toBeGreaterThan(
    before.records.activities.length,
  );
});
