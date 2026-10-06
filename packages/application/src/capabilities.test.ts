// The capabilities the reads give (#322 完了条件): in every fixture state,
// for every row of today, record of a past day, interrupt and Backlog
// item's choice for today, each `can…` that is true lets its operation go
// through with example values, and each that is false is refused (422, or
// 404 for a record not found). The rule is the command's own check, so
// the two cannot part.
import {
  addDays,
  instant,
  type DailySelection,
  type DomainErrorCode,
  type Result,
  type SprintId,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { backlogData } from './backlog-view';
import type {
  DailySelectionCapabilities,
  InterruptNoteCapabilities,
} from './capabilities';
import { fixtureSnapshot, fixtureStateIds } from './fixtures/states';
import { operations } from './operations';
import type { Change, StoreSnapshot } from './record-store';
import { dayView } from './resource-views';
import { memoryStore, tagged } from './testing';
import { beginDay } from './today-changes';

type OnSelection = {
  readonly sprintId: SprintId;
  readonly selectionId: Parameters<
    typeof operations.startSelection
  >[0]['selectionId'];
};
type OnInterrupt = {
  readonly sprintId: SprintId;
  readonly interruptNoteId: Parameters<
    typeof operations.deleteInterrupt
  >[0]['interruptNoteId'];
};

/** Each capability's operation, named by it, with example values. */
const SELECTION: {
  readonly [K in keyof DailySelectionCapabilities]: (
    on: OnSelection,
  ) => Change<unknown>;
} = {
  canStart: (on) => operations.startSelection(on),
  canPause: (on) => operations.pauseSelection({ ...on, hours: 1.5 }),
  canDefer: (on) => operations.deferSelection(on),
  canUndoDefer: (on) => operations.undoDeferSelection(on),
  canRemove: (on) => operations.removeFromToday(on),
  canUndoRemove: (on) => operations.undoRemoveFromToday(on),
  canComplete: (on) => operations.completeSelection(on),
  canUndoComplete: (on) => operations.undoCompleteSelection(on),
  canSkip: (on) => operations.skipSelection(on),
  canUndoSkip: (on) => operations.undoSkipSelection(on),
};

const INTERRUPT: {
  readonly [K in keyof InterruptNoteCapabilities]: (
    on: OnInterrupt,
  ) => Change<unknown>;
} = {
  canEdit: (on) =>
    operations.editInterrupt({ ...on, text: 'レビューの依頼', minutes: 20 }),
  canDelete: (on) => operations.deleteInterrupt(on),
};

/** The HTTP status the API answers a domain error with (ADR 0006). */
const STATUS: Readonly<Record<DomainErrorCode, number>> = {
  notFound: 404,
  invalidInput: 422,
  invalidTransition: 422,
  recurringTaskCannotComplete: 422,
};

interface Target {
  readonly where: string;
  /** Which read, and which kind of record. */
  readonly kind: `${'today' | 'rest' | 'past' | 'backlog'} ${'selection' | 'interrupt'}`;
  readonly capabilities: object;
  /** A selection's origin. */
  readonly origin?: DailySelection['origin'];
  readonly run: (name: string) => Result<unknown>;
}

/** The records with capabilities that the reads give in a state. */
function targetsOf(snapshot: StoreSnapshot): Target[] {
  const { records, clock } = snapshot;
  const read = tagged(records);
  // Each operation runs on the state as it is, not after another.
  const fresh = <T>(change: Change<T>) =>
    memoryStore(snapshot).run(change as Change<unknown>);
  const sprintOf = (has: (sprintId: SprintId) => boolean): SprintId => {
    const sprint = records.sprints.find((s) => has(s.id));
    if (sprint === undefined) throw new Error('No Sprint has the record.');
    return sprint.id;
  };
  const selection = (
    read: 'today' | 'rest' | 'past' | 'backlog',
    where: string,
    selectionId: OnSelection['selectionId'],
    capabilities: DailySelectionCapabilities,
  ): Target => {
    const sprintId = sprintOf((id) =>
      records.sprints
        .find((s) => s.id === id)!
        .dailySelections.some((s) => s.id === selectionId),
    );
    const origin = records.sprints
      .flatMap((s) => s.dailySelections)
      .find((s) => s.id === selectionId)?.origin;
    return {
      where: `${where} ${selectionId}`,
      kind: `${read} selection`,
      capabilities,
      ...(origin === undefined ? {} : { origin }),
      run: (name) =>
        fresh(
          SELECTION[name as keyof DailySelectionCapabilities]({
            sprintId,
            selectionId,
          }),
        ),
    };
  };
  const interrupt = (
    read: 'today' | 'past',
    where: string,
    interruptNoteId: OnInterrupt['interruptNoteId'],
    capabilities: InterruptNoteCapabilities,
  ): Target => {
    const sprintId = sprintOf((id) =>
      records.sprints
        .find((s) => s.id === id)!
        .interrupts.some((n) => n.id === interruptNoteId),
    );
    return {
      where: `${where} ${interruptNoteId}`,
      kind: `${read} interrupt`,
      capabilities,
      run: (name) =>
        fresh(
          INTERRUPT[name as keyof InterruptNoteCapabilities]({
            sprintId,
            interruptNoteId,
          }),
        ),
    };
  };

  const targets: Target[] = [];
  const today = dayView(read, clock, clock.today);
  if (today.kind === 'today' && today.today !== undefined) {
    for (const row of [...today.today.rows, ...today.today.closed])
      targets.push(
        selection('today', 'today', row.selection.id, row.capabilities),
      );
    for (const note of today.today.interrupts)
      targets.push(interrupt('today', 'today', note.id, note.capabilities));
    // 今週の残り: a choice put back today, which 今日へ takes back.
    for (const item of today.today.rest)
      if (
        item.removedToday !== undefined &&
        item.removedTodayCapabilities !== undefined
      )
        targets.push(
          selection(
            'rest',
            'rest',
            item.removedToday,
            item.removedTodayCapabilities,
          ),
        );
  }
  // Every past day of every Sprint.
  for (const sprint of records.sprints) {
    for (
      let date = sprint.start;
      date <= sprint.end && date < clock.today;
      date = addDays(date, 1)
    ) {
      const day = dayView(read, clock, date);
      if (day.kind !== 'past') continue;
      for (const record of day.day.records)
        targets.push(
          selection('past', date, record.selection.id, record.capabilities),
        );
      for (const note of day.day.interrupts)
        targets.push(interrupt('past', date, note.id, note.capabilities));
    }
  }
  for (const item of Object.values(backlogData(read, clock, {}).items))
    if (item.today !== undefined)
      targets.push(
        selection(
          'backlog',
          `backlog ${item.task.id}`,
          item.today.selectionId,
          item.today.capabilities,
        ),
      );
  return targets;
}

/**
 * States the fixture does not have, made from `today-interrupt` by the
 * person's operations: a row put back to the week and one deferred today,
 * and, the next day, a past day with a completion from the Backlog (F29,
 * F33) and one from Today, and that day's occurrence skipped.
 */
function madeStates(): [string, StoreSnapshot][] {
  const store = memoryStore(fixtureSnapshot('today-interrupt'));
  const { records, clock } = store.getSnapshot();
  const sprint = records.sprints.find((s) => s.state === 'active')!;
  const open = sprint.dailySelections.filter(
    (s) =>
      s.date === clock.today &&
      s.occurrenceId === undefined &&
      (s.resolution === 'selected' || s.resolution === 'started'),
  );
  const removed = open.find((s) => s.resolution === 'selected');
  const deferred = open.find((s) => s !== removed);
  const unchosen = sprint.tasks.find(
    (t) =>
      t.outcome === 'planned' &&
      t.occurrenceIds === undefined &&
      !sprint.dailySelections.some(
        (s) => s.sprintTaskId === t.id && s.date === clock.today,
      ),
  );
  if (removed === undefined || deferred === undefined || unchosen === undefined)
    throw new Error('today-interrupt has changed.');
  const on = { sprintId: sprint.id };
  const run = (change: Change<unknown>) => {
    const result = store.run(change);
    if (!result.ok) throw new Error(result.error.message);
  };
  run(operations.removeFromToday({ ...on, selectionId: removed.id }));
  run(operations.deferSelection({ ...on, selectionId: deferred.id }));
  run(operations.completeTask({ taskId: unchosen.taskId }));
  const closedToday = store.getSnapshot();
  // The next day, after the system's start of it.
  const next = memoryStore({
    ...closedToday,
    clock: {
      today: addDays(clock.today, 1),
      now: instant(
        new Date(Date.parse(clock.now) + 24 * 60 * 60 * 1000).toISOString(),
      ),
    },
  });
  const begun = next.run(beginDay(), { actor: 'system' });
  if (!begun.ok) throw new Error(begun.error.message);
  const nextMorning = next.getSnapshot();
  // That day's occurrence, which the start of the day chose, skipped.
  const skipped = next
    .getSnapshot()
    .records.sprints.find((s) => s.id === sprint.id)
    ?.dailySelections.find(
      (s) =>
        s.date === addDays(clock.today, 1) &&
        s.occurrenceId !== undefined &&
        s.resolution === 'selected',
    );
  if (skipped === undefined) throw new Error('No occurrence the day after.');
  const skip = next.run(
    operations.skipSelection({ ...on, selectionId: skipped.id }),
  );
  if (!skip.ok) throw new Error(skip.error.message);
  return [
    ['today-interrupt, put back and deferred', closedToday],
    ['the day after, as it starts', nextMorning],
    ['the day after, its occurrence skipped', next.getSnapshot()],
  ];
}

const STATES: [string, StoreSnapshot][] = [
  ...fixtureStateIds.map((state): [string, StoreSnapshot] => [
    state,
    fixtureSnapshot(state),
  ]),
  ...madeStates(),
];

describe('capabilities agree with the operations (#322)', () => {
  const all = STATES.flatMap(([, snapshot]) => targetsOf(snapshot));

  it.each(STATES)('%s', (_, snapshot) => {
    for (const target of targetsOf(snapshot)) {
      for (const [name, can] of Object.entries(target.capabilities)) {
        const result = target.run(name);
        const outcome = result.ok
          ? 'ok'
          : `${STATUS[result.error.code]} ${result.error.code}`;
        expect(
          { where: target.where, name, outcome },
          `${target.where} ${name}`,
        ).toEqual({
          where: target.where,
          name,
          outcome: can
            ? 'ok'
            : expect.stringMatching(/^(404 notFound|422 [a-zA-Z]+)$/),
        });
      }
    }
  });

  it('covers rows, closed rows, past records, interrupts and the Backlog', () => {
    expect(new Set(all.map((target) => target.kind))).toEqual(
      new Set([
        'today selection',
        'rest selection',
        'today interrupt',
        'past selection',
        'past interrupt',
        'backlog selection',
      ]),
    );
    // A completion from the Backlog, today's or a past day's, is undone as
    // the Backlog undoes it (F29, F33, #346).
    for (const kind of ['today selection', 'past selection'])
      expect([
        kind,
        all.some(
          (t) =>
            t.kind === kind &&
            t.origin === 'backlogCompletion' &&
            (t.capabilities as DailySelectionCapabilities).canUndoComplete,
        ),
      ]).toEqual([kind, true]);
  });

  it('answers each `can…` both ways somewhere, so that none is checked for nothing', () => {
    const names = [...Object.keys(SELECTION), ...Object.keys(INTERRUPT)];
    const answers = (name: string) =>
      new Set(
        all.flatMap((t) =>
          name in t.capabilities
            ? [(t.capabilities as Record<string, boolean>)[name]]
            : [],
        ),
      );
    for (const name of names)
      expect([name, answers(name)]).toEqual([name, new Set([true, false])]);
  });
});
