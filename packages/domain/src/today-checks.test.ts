// The checks of Today's commands (#322): each says what its command would
// say of the records, apart from the values it is given, so that a read can
// tell what the person can do with a selection or an interrupt from the
// same rule the command keeps (ADR 0007 操作の可否). Against the
// DailySelection state diagram of the domain model and F17, F19, F33, F37,
// F38.
import { describe, expect, it } from 'vitest';
import type { Occurrence, OccurrenceState } from './occurrence';
import type { DomainErrorCode, Result } from './shared/result';
import { id } from './shared/ids';
import { instant, localDate, type LocalDate } from './shared/time';
import type {
  DailyResolution,
  DailySelection,
  InterruptNote,
  Sprint,
  SprintTask,
} from './sprint';
import type { Task, TaskLifecycle } from './task';
import {
  checkCompleteSelection,
  checkDeferSelection,
  checkDeleteInterrupt,
  checkEditInterrupt,
  checkPauseSelection,
  checkRemoveFromToday,
  checkSkipSelection,
  checkStartSelection,
  checkUndoCompleteSelection,
  checkUndoDeferSelection,
  checkUndoRemoveFromToday,
  checkUndoSkipSelection,
  completeSelection,
  deferSelection,
  deleteInterrupt,
  editInterrupt,
  pauseSelection,
  removeFromToday,
  skipSelection,
  startSelection,
  undoCompleteSelection,
  undoDeferSelection,
  undoRemoveFromToday,
  undoSkipSelection,
} from './today';
import { ctx, newTask, sprintFixture } from './testing';

const today = localDate('2026-09-30');
const yesterday = localDate('2026-09-29');
const selectionId = id<'DailySelection'>('sel-1');
const occurrenceId = id<'Occurrence'>('occ-1');

const RESOLUTIONS: readonly DailyResolution[] = [
  'selected',
  'started',
  'paused',
  'deferred',
  'removed',
  'done',
  'skipped',
  'unresolved',
];

type Name =
  | 'start'
  | 'pause'
  | 'defer'
  | 'undoDefer'
  | 'remove'
  | 'undoRemove'
  | 'complete'
  | 'undoComplete'
  | 'skip'
  | 'undoSkip';

interface Case {
  readonly sprint: Sprint;
  readonly today: LocalDate;
  readonly task: Task;
  readonly occurrence?: Occurrence;
}

/** Each command, run with example values, and its check. */
const ACTIONS: Readonly<
  Record<
    Name,
    {
      readonly check: (c: Case) => Result<unknown>;
      readonly run: (c: Case) => Result<unknown>;
    }
  >
> = {
  start: {
    check: (c) => checkStartSelection(c.sprint, { selectionId }),
    run: (c) => startSelection(c.sprint, { selectionId }, ctx),
  },
  pause: {
    check: (c) => checkPauseSelection(c.sprint, { selectionId }),
    run: (c) => pauseSelection(c.sprint, { selectionId, actualHours: 1 }, ctx),
  },
  defer: {
    check: (c) => checkDeferSelection(c.sprint, { selectionId }),
    run: (c) => deferSelection(c.sprint, { selectionId }, ctx),
  },
  undoDefer: {
    check: (c) =>
      checkUndoDeferSelection(c.sprint, { selectionId, today: c.today }),
    run: (c) =>
      undoDeferSelection(c.sprint, { selectionId, today: c.today }, ctx),
  },
  remove: {
    check: (c) => checkRemoveFromToday(c.sprint, { selectionId }),
    run: (c) => removeFromToday(c.sprint, { selectionId }, ctx),
  },
  undoRemove: {
    check: (c) =>
      checkUndoRemoveFromToday(c.sprint, { selectionId, today: c.today }),
    run: (c) =>
      undoRemoveFromToday(c.sprint, { selectionId, today: c.today }, ctx),
  },
  complete: {
    check: (c) => checkCompleteSelection(c.sprint, subject(c)),
    run: (c) =>
      completeSelection(c.sprint, { ...subject(c), actualHours: 1 }, ctx),
  },
  undoComplete: {
    check: (c) => checkUndoCompleteSelection(c.sprint, subject(c)),
    run: (c) => undoCompleteSelection(c.sprint, subject(c), ctx),
  },
  skip: {
    check: (c) => checkSkipSelection(c.sprint, subject(c)),
    run: (c) =>
      c.occurrence === undefined
        ? checkSkipSelection(c.sprint, subject(c))
        : skipSelection(
            c.sprint,
            { selectionId, occurrence: c.occurrence },
            ctx,
          ),
  },
  undoSkip: {
    check: (c) => checkUndoSkipSelection(c.sprint, subject(c)),
    run: (c) =>
      c.occurrence === undefined
        ? checkUndoSkipSelection(c.sprint, subject(c))
        : undoSkipSelection(
            c.sprint,
            { selectionId, occurrence: c.occurrence },
            ctx,
          ),
  },
};

/** What a completion, an undo or a skip is given: the selection's record. */
function subject(c: Case) {
  return {
    selectionId,
    today: c.today,
    ...(c.occurrence === undefined
      ? { task: c.task }
      : { occurrence: c.occurrence }),
  };
}

/**
 * A Sprint with one selection in `resolution` on `date`, and its Task or
 * occurrence as that resolution leaves them.
 */
function caseOf(options: {
  readonly resolution: DailyResolution;
  readonly recurring: boolean;
  readonly date?: LocalDate;
  readonly state?: Sprint['state'];
  readonly lifecycle?: TaskLifecycle;
  readonly occurrenceState?: OccurrenceState;
}): Case {
  const { resolution, recurring, date = today, state = 'active' } = options;
  const done = resolution === 'done';
  const sprintTask: SprintTask = {
    id: id('st-1'),
    taskId: id('task-1'),
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: done && !recurring ? 'done' : 'planned',
    ...(recurring ? { occurrenceIds: [occurrenceId] } : {}),
  };
  const selection: DailySelection = {
    id: selectionId,
    date,
    sprintTaskId: sprintTask.id,
    ...(recurring ? { occurrenceId } : {}),
    origin: 'manual',
    resolution,
    selectedAt: ctx.now,
    ...(resolution === 'started' ? { startedAt: ctx.now } : {}),
    ...(resolution === 'selected' || resolution === 'started'
      ? {}
      : { resolvedAt: ctx.now }),
  };
  const task: Task = {
    ...newTask('x', 'task-1'),
    ...(recurring ? { recurrenceRuleId: id('rule-1') } : {}),
    lifecycle:
      options.lifecycle ?? (done && !recurring ? 'completed' : 'active'),
  };
  const occurrence: Occurrence | undefined = recurring
    ? {
        id: occurrenceId,
        taskId: task.id,
        ruleId: id('rule-1'),
        scheduledDate: date,
        ruleVersion: 1,
        materializedAt: ctx.now,
        state:
          options.occurrenceState ??
          (done ? 'done' : resolution === 'skipped' ? 'skipped' : 'pending'),
        stateChangedAt: ctx.now,
      }
    : undefined;
  return {
    sprint: sprintFixture('2026-09-28', state, {
      tasks: [sprintTask],
      dailySelections: [selection],
    }),
    today,
    task,
    ...(occurrence === undefined ? {} : { occurrence }),
  };
}

function allowed(c: Case): Name[] {
  return (Object.keys(ACTIONS) as Name[]).filter(
    (name) => ACTIONS[name].check(c).ok,
  );
}

function codeOf(result: Result<unknown>): DomainErrorCode | 'ok' {
  return result.ok ? 'ok' : result.error.code;
}

describe('a check says what its command says of the records (#322)', () => {
  const cases: [string, Case][] = [];
  for (const recurring of [false, true])
    for (const resolution of RESOLUTIONS)
      for (const date of [today, yesterday])
        for (const state of ['active', 'review'] as const)
          cases.push([
            `${recurring ? 'recurring' : 'one-off'} ${resolution} of ${date} in ${state}`,
            caseOf({ resolution, recurring, date, state }),
          ]);
  // Records the selection does not agree with: the Task archived, the
  // occurrence done some other way.
  for (const resolution of RESOLUTIONS) {
    cases.push([
      `one-off ${resolution}, Task archived`,
      caseOf({ resolution, recurring: false, lifecycle: 'archived' }),
    ]);
    cases.push([
      `recurring ${resolution}, occurrence missed`,
      caseOf({ resolution, recurring: true, occurrenceState: 'missed' }),
    ]);
  }

  it.each(cases)('%s', (_, c) => {
    for (const { check, run } of Object.values(ACTIONS)) {
      expect(codeOf(check(c))).toBe(codeOf(run(c)));
    }
  });
});

describe("the selection's state diagram, today (domain model DailySelection)", () => {
  it.each([
    ['selected', ['start', 'defer', 'remove', 'complete']],
    ['started', ['pause', 'defer', 'complete']],
    // F17: closed today, still completable today; F37: undone today.
    ['paused', ['complete']],
    ['deferred', ['undoDefer', 'complete']],
    ['removed', ['undoRemove', 'complete']],
    ['done', ['undoComplete']],
    ['skipped', []],
    ['unresolved', []],
  ] as const)('a one-off %s selection: %j', (resolution, names) => {
    expect(allowed(caseOf({ resolution, recurring: false }))).toEqual(
      Object.keys(ACTIONS).filter((n) =>
        (names as readonly string[]).includes(n),
      ),
    );
  });

  it.each([
    // Only an occurrence is skipped; F19 undoes it.
    ['selected', ['start', 'defer', 'remove', 'complete', 'skip']],
    ['started', ['pause', 'defer', 'complete']],
    ['done', ['undoComplete']],
    ['skipped', ['undoSkip']],
  ] as const)('a recurring %s selection: %j', (resolution, names) => {
    expect(allowed(caseOf({ resolution, recurring: true }))).toEqual(
      Object.keys(ACTIONS).filter((n) =>
        (names as readonly string[]).includes(n),
      ),
    );
  });

  it('closes nothing of a past day but undoes its completion or skip while the Sprint runs (F17, F33, F37)', () => {
    for (const resolution of ['paused', 'deferred', 'removed'] as const)
      expect(
        allowed(caseOf({ resolution, recurring: false, date: yesterday })),
      ).toEqual([]);
    expect(
      allowed(
        caseOf({ resolution: 'done', recurring: false, date: yesterday }),
      ),
    ).toEqual(['undoComplete']);
    expect(
      allowed(
        caseOf({ resolution: 'skipped', recurring: true, date: yesterday }),
      ),
    ).toEqual(['undoSkip']);
  });

  it('takes nothing once the Sprint is in Review (F33)', () => {
    for (const resolution of RESOLUTIONS)
      expect(
        allowed(caseOf({ resolution, recurring: true, state: 'review' })),
      ).toEqual([]);
  });

  it('does not check the values the command is given', () => {
    const c = caseOf({ resolution: 'started', recurring: false });
    expect(checkPauseSelection(c.sprint, { selectionId }).ok).toBe(true);
    expect(
      pauseSelection(c.sprint, { selectionId, actualHours: 0 }, ctx).ok,
    ).toBe(false);
  });
});

describe('the checks of the interrupts (F38)', () => {
  const note: InterruptNote = {
    id: id('note-1'),
    at: instant('2026-09-30T01:00:00.000Z'),
    text: 'Slack',
  };
  const noteId = { id: note.id };
  const other = { id: id<'InterruptNote'>('note-2') };
  const of = (state: Sprint['state']) =>
    sprintFixture('2026-09-28', state, { interrupts: [note] });

  it('takes a note of the running Sprint, and says what the command says', () => {
    for (const state of ['active', 'review', 'closed'] as const) {
      const sprint = of(state);
      for (const target of [noteId, other]) {
        expect(codeOf(checkEditInterrupt(sprint, target))).toBe(
          codeOf(editInterrupt(sprint, { ...target, text: 'メール' }, ctx)),
        );
        expect(codeOf(checkDeleteInterrupt(sprint, target))).toBe(
          codeOf(deleteInterrupt(sprint, target, ctx)),
        );
      }
    }
    expect(checkEditInterrupt(of('active'), noteId).ok).toBe(true);
    expect(checkDeleteInterrupt(of('active'), noteId).ok).toBe(true);
    expect(checkEditInterrupt(of('review'), noteId).ok).toBe(false);
    expect(codeOf(checkDeleteInterrupt(of('active'), other))).toBe('notFound');
  });

  it('does not check the text it is given', () => {
    expect(checkEditInterrupt(of('active'), noteId).ok).toBe(true);
    expect(editInterrupt(of('active'), { ...noteId, text: ' ' }, ctx).ok).toBe(
      false,
    );
  });
});
