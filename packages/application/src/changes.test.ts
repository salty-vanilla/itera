import { describe, expect, it } from 'vitest';
import { fixtureSnapshot } from './fixtures/states';
import { andThen } from './changes';
import { type Change } from './record-store';
import { memoryStore } from './testing';

describe('andThen', () => {
  const snapshot = fixtureSnapshot('today-interrupt');
  const firstOccurrence = snapshot.records.occurrences[0]!;
  const sprint = snapshot.records.sprints.find((s) => s.state === 'active')!;

  // Deletes one occurrence (a record the first step removes).
  const deleteOccurrence: Change = () => ({
    ok: true,
    value: {
      changes: { deleted: { occurrences: [firstOccurrence.id] } },
      activities: [],
    },
  });
  // Sees the first step's result, then writes the Sprint.
  const renameAfter: Change = (records) =>
    records.occurrences.some((o) => o.id === firstOccurrence.id)
      ? { ok: false, error: { code: 'invalidInput', message: 'not applied' } }
      : {
          ok: true,
          value: {
            changes: { sprints: [{ ...sprint, availableHours: 3 }] },
            activities: [],
          },
        };
  const fail: Change = () => ({
    ok: false,
    error: { code: 'invalidInput', message: 'no' },
  });

  it('runs the second on what the first leaves, and writes both', () => {
    const store = memoryStore(snapshot);
    expect(store.run(andThen(deleteOccurrence, renameAfter)).ok).toBe(true);
    const { records } = store.getSnapshot();
    expect(records.occurrences.some((o) => o.id === firstOccurrence.id)).toBe(
      false,
    );
    expect(
      records.sprints.find((s) => s.id === sprint.id)?.availableHours,
    ).toBe(3);
  });

  it('writes nothing when the second fails', () => {
    const store = memoryStore(snapshot);
    const before = store.getSnapshot();
    const result = store.run(andThen(deleteOccurrence, fail));
    expect(result.ok).toBe(false);
    expect(store.getSnapshot()).toBe(before);
  });

  it('runs the second as another actor when asked', () => {
    let seen: string | undefined;
    const spy: Change = (_records, ctx) => {
      seen = ctx.actor;
      return { ok: true, value: { changes: {}, activities: [] } };
    };
    const store = memoryStore(snapshot);
    store.run(andThen(deleteOccurrence, spy, 'system'));
    expect(seen).toBe('system');
  });
});
