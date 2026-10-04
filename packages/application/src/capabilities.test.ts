// The capabilities the reads give (#322 完了条件): in every fixture state,
// for every row of today, record of a past day, interrupt and Backlog
// item's choice for today, each `can…` that is true lets its operation go
// through with example values, and each that is false is refused (422, or
// 404 for a record not found). The rule is the command's own check, so
// the two cannot part.
import {
  addDays,
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
import {
  fixtureSnapshot,
  fixtureStateIds,
  type FixtureStateId,
} from './fixtures/states';
import { operations } from './operations';
import type { Change } from './record-store';
import { dayView } from './resource-views';
import { memoryStore, tagged } from './testing';

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
  readonly kind: `${'today' | 'past' | 'backlog'} ${'selection' | 'interrupt'}`;
  readonly capabilities: object;
  readonly run: (name: string) => Result<unknown>;
}

/** The records with capabilities that the reads give in a state. */
function targetsOf(state: FixtureStateId): Target[] {
  const snapshot = fixtureSnapshot(state);
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
    read: 'today' | 'past' | 'backlog',
    where: string,
    selectionId: OnSelection['selectionId'],
    capabilities: DailySelectionCapabilities,
  ): Target => {
    const sprintId = sprintOf((id) =>
      records.sprints
        .find((s) => s.id === id)!
        .dailySelections.some((s) => s.id === selectionId),
    );
    return {
      where: `${where} ${selectionId}`,
      kind: `${read} selection`,
      capabilities,
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

describe('capabilities agree with the operations (#322)', () => {
  const all = fixtureStateIds.flatMap((state) =>
    targetsOf(state).map((target) => ({ state, target })),
  );

  it.each(fixtureStateIds)('%s', (state) => {
    for (const target of targetsOf(state)) {
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
    expect(new Set(all.map(({ target }) => target.kind))).toEqual(
      new Set([
        'today selection',
        'today interrupt',
        'past selection',
        'past interrupt',
        'backlog selection',
      ]),
    );
    // Both answers come up, so neither side is checked for nothing.
    const answers = all.flatMap(({ target }) =>
      Object.values(target.capabilities),
    );
    expect(answers).toContain(true);
    expect(answers).toContain(false);
  });
});
