import { retroFacts, type Instant, type LocalDate } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { fixtureSnapshot, fixtureIds } from './fixtures/states';
import { type StoreSnapshot } from './record-store';
import { memoryStore } from './testing';
import type { Change } from './record-store';
import { undoCompletion, undoSkipping } from './running-changes';
import { reviewEnded } from './system-changes';
import * as today from './today-changes';
import * as task from './task-changes';

const ids = fixtureIds();

const at = (date: string, time = '09:00'): StoreSnapshot['clock'] => ({
  today: date as LocalDate,
  now: `${date}T${time}:00.000Z` as Instant,
});

const active = (store: ReturnType<typeof memoryStore>) => {
  const s = store
    .getSnapshot()
    .records.sprints.find((x) => x.state === 'active');
  if (s === undefined) throw new Error('no active Sprint');
  return s;
};
const selectionOf = (
  store: ReturnType<typeof memoryStore>,
  taskId: string,
  date: string,
) => {
  const s = active(store);
  const st = s.tasks.find((t) => t.taskId === taskId);
  return s.dailySelections.find(
    (d) => d.sprintTaskId === st?.id && d.date === date,
  );
};

/** A past day's undo, as `…/undo-complete` or `…/undo-skip` sends it. */
const undoPastDay =
  (selectionId: string): Change =>
  (records, ctx) => {
    const sprint = records.sprints.find((x) => x.state === 'active')!;
    const selection = sprint.dailySelections.find((d) => d.id === selectionId);
    const undo =
      selection?.resolution === 'skipped' ? undoSkipping : undoCompletion;
    return undo(sprint.id, selectionId as never)(records, ctx);
  };

describe('undoing a past day (#53, F33)', () => {
  it('undoes a past completion; the system leaves that day unresolved', () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const done = selectionOf(store, ids.task.tax, '2026-09-29')!;
    expect(done.resolution).toBe('done');
    expect(store.run(undoPastDay(done.id)).ok).toBe(true);

    expect(selectionOf(store, ids.task.tax, '2026-09-29')?.resolution).toBe(
      'unresolved',
    );
    const records = store.getSnapshot().records;
    expect(records.tasks.find((t) => t.id === ids.task.tax)?.lifecycle).toBe(
      'active',
    );
    expect(
      active(store).tasks.find((t) => t.taskId === ids.task.tax)?.outcome,
    ).toBe('planned');
    // The person's undo, then the system's mark (invariant 24).
    const last = records.activities.slice(-2);
    expect(last.map((a) => [a.kind, a.actor])).toEqual([
      ['todayDoneUndone', 'user'],
      ['todayUnresolved', 'system'],
    ]);
  });

  it('puts a past occurrence back to pending', () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const done = selectionOf(store, ids.task.reading, '2026-09-28')!;
    expect(store.run(undoPastDay(done.id)).ok).toBe(true);
    const occurrence = store
      .getSnapshot()
      .records.occurrences.find((o) => o.id === done.occurrenceId);
    expect(occurrence?.state).toBe('pending');
    expect(selectionOf(store, ids.task.reading, '2026-09-28')?.resolution).toBe(
      'unresolved',
    );
  });

  it('undoes a past skip', () => {
    // 10/1: an occurrence is chosen and skipped; the next day it is undone.
    const first = memoryStore(fixtureSnapshot('today-interrupt'));
    const st = active(first).tasks.find((t) => t.taskId === ids.task.reading)!;
    const occurrenceId = st.occurrenceIds!.find((id) =>
      first
        .getSnapshot()
        .records.occurrences.some(
          (o) => o.id === id && o.scheduledDate === '2026-10-02',
        ),
    )!;
    expect(
      first.run(
        today.choose(
          active(first).id,
          '2026-10-01' as LocalDate,
          st.id,
          occurrenceId,
        ),
      ).ok,
    ).toBe(true);
    const chosen = selectionOf(first, ids.task.reading, '2026-10-01')!;
    expect(first.run(today.skip(active(first).id, chosen.id)).ok).toBe(true);

    const store = memoryStore({
      ...first.getSnapshot(),
      clock: at('2026-10-02'),
    });
    expect(store.run(undoPastDay(chosen.id)).ok).toBe(true);
    expect(selectionOf(store, ids.task.reading, '2026-10-01')?.resolution).toBe(
      'unresolved',
    );
    expect(
      store.getSnapshot().records.occurrences.find((o) => o.id === occurrenceId)
        ?.state,
    ).toBe('pending');
  });

  it('removes a past choice made by a completion from the Backlog (F29)', () => {
    const first = memoryStore(fixtureSnapshot('today-interrupt'));
    expect(first.run(task.complete(ids.task.onboarding as never)).ok).toBe(
      true,
    );
    const made = selectionOf(first, ids.task.onboarding, '2026-10-01')!;
    expect(made.origin).toBe('backlogCompletion');

    const store = memoryStore({
      ...first.getSnapshot(),
      clock: at('2026-10-02'),
    });
    expect(store.run(undoPastDay(made.id)).ok).toBe(true);
    expect(
      selectionOf(store, ids.task.onboarding, '2026-10-01'),
    ).toBeUndefined();
    expect(
      store
        .getSnapshot()
        .records.tasks.find((t) => t.id === ids.task.onboarding)?.lifecycle,
    ).toBe('active');
  });

  it("removes today's choice made by a completion from the Backlog, as the Backlog's undo does (F29, #346)", () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    expect(store.run(task.complete(ids.task.onboarding as never)).ok).toBe(
      true,
    );
    const made = selectionOf(store, ids.task.onboarding, '2026-10-01')!;
    expect(made.origin).toBe('backlogCompletion');
    const before = store.getSnapshot().records.activities.length;

    expect(store.run(undoPastDay(made.id)).ok).toBe(true);
    expect(
      selectionOf(store, ids.task.onboarding, '2026-10-01'),
    ).toBeUndefined();
    expect(
      store
        .getSnapshot()
        .records.tasks.find((t) => t.id === ids.task.onboarding)?.lifecycle,
    ).toBe('active');
    expect(
      active(store).tasks.find((t) => t.taskId === ids.task.onboarding)
        ?.outcome,
    ).toBe('planned');
    // Today's: the person's undo only, and no day is closed.
    const undone = store.getSnapshot().records.activities.slice(before);
    expect(undone.at(-1)?.kind).toBe('todayBacklogCompletionUndone');
    expect(undone.every((a) => a.actor === 'user')).toBe(true);
  });

  it("puts back today's choice that was there before a completion from the Backlog (F29)", () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const sprint = active(store);
    const st = sprint.tasks.find((t) => t.taskId === ids.task.onboarding)!;
    expect(
      store.run(today.choose(sprint.id, '2026-10-01' as LocalDate, st.id)).ok,
    ).toBe(true);
    expect(store.run(task.complete(ids.task.onboarding as never)).ok).toBe(
      true,
    );
    const chosen = selectionOf(store, ids.task.onboarding, '2026-10-01')!;
    expect(chosen).toMatchObject({ origin: 'manual', resolution: 'done' });

    expect(store.run(undoPastDay(chosen.id)).ok).toBe(true);
    expect(selectionOf(store, ids.task.onboarding, '2026-10-01')).toMatchObject(
      { id: chosen.id, resolution: 'selected' },
    );
  });

  it("undoes today's completion as Today does: no day is closed", () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const todays = selectionOf(store, ids.task.apiReview, '2026-10-01')!;
    expect(todays.resolution).toBe('done');
    expect(store.run(undoPastDay(todays.id)).ok).toBe(true);
    expect(
      selectionOf(store, ids.task.apiReview, '2026-10-01')?.resolution,
    ).not.toBe('done');
    expect(store.getSnapshot().records.activities.at(-1)?.actor).toBe('user');
  });

  it('refuses to undo a skip of a past completion', () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const done = selectionOf(store, ids.task.tax, '2026-09-29')!;
    const result = store.run(undoSkipping(active(store).id, done.id));
    expect(!result.ok && result.error.code).toBe('invalidTransition');
  });

  it('leaves the Retro facts as the domain derives them', () => {
    const store = memoryStore(fixtureSnapshot('today-interrupt'));
    const done = selectionOf(store, ids.task.tax, '2026-09-29')!;
    store.run(undoPastDay(done.id));
    // After the end the system moves the Sprint to Review.
    const later = memoryStore({
      ...store.getSnapshot(),
      clock: at('2026-10-05'),
    });
    expect(later.run(reviewEnded(), { actor: 'system' }).ok).toBe(true);
    const { records } = later.getSnapshot();
    const sprint = records.sprints.find((s) => s.state === 'review')!;
    const facts = retroFacts(sprint, {
      tasks: records.tasks,
      areas: records.areas,
      occurrences: records.occurrences,
      sprints: records.sprints,
    });
    expect(facts.completed.map((t) => t.taskId)).not.toContain(ids.task.tax);
    expect(facts.carriedOver.map((t) => t.taskId)).toContain(ids.task.tax);
  });

  it('puts a completion made after closing that day back to how it was closed (F17)', () => {
    // 10/1: the started Task is deferred, then completed the same day.
    const first = memoryStore(fixtureSnapshot('today-interrupt'));
    const chosen = selectionOf(first, ids.task.dataset, '2026-10-01')!;
    expect(first.run(today.defer(active(first).id, chosen.id)).ok).toBe(true);
    expect(first.run(today.complete(active(first).id, chosen.id)).ok).toBe(
      true,
    );
    const done = selectionOf(first, ids.task.dataset, '2026-10-01')!;
    expect(done.closedBefore?.resolution).toBe('deferred');

    const store = memoryStore({
      ...first.getSnapshot(),
      clock: at('2026-10-02'),
    });
    expect(store.run(undoPastDay(done.id)).ok).toBe(true);
    const back = selectionOf(store, ids.task.dataset, '2026-10-01');
    // Deferred again, as it had been: not unresolved.
    expect(back?.resolution).toBe('deferred');
    expect(back?.resolvedAt).toBe(done.closedBefore?.at);
    const marked = store
      .getSnapshot()
      .records.activities.filter(
        (a) =>
          a.kind === 'todayUnresolved' &&
          'selectionId' in a &&
          a.selectionId === done.id,
      );
    expect(marked).toEqual([]);
  });
});
