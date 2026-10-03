// Today, through the app (#269, #295): each operation succeeds and is
// refused as the domain says (operation-cases.ts), on the Sprint the request
// names; the invariants and decisions of Today hold through the API, and the
// read of a day answers what the application's function gives on the same
// records and the same clock.
import * as contract from '@itera/api-contract';
import {
  dayView,
  parseId,
  type OperationName,
  type Records,
} from '@itera/application';
import { fixtureIds, fixtureSnapshot } from '@itera/application/fixtures';
import { addDays, instant, localDate } from '@itera/domain';
import * as v from 'valibot';
import { afterEach, describe, expect, it } from 'vitest';
import { activity } from '../db/schema';
import {
  closeFixtureApps,
  describeOperations,
  fixtureClock as clock,
  missing,
  setupFixtureApp as setup,
  type Failure,
  type Step,
  type Success,
} from './operation-cases';

const ids = fixtureIds();

afterEach(closeFixtureApps);

/** The day the app's clock reads: 2026-10-03, a Saturday of Sprint 2. */
const today = clock.today;
const yesterday = addDays(today, -1);

const { paper, cleaning, reading } = ids.task;
const { work } = ids.area;

const activeOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'active')!;
const reviewOf = (records: Records) =>
  records.sprints.find((s) => s.state === 'review')!;
const sprintTaskOf = (records: Records, taskId: string) =>
  activeOf(records).tasks.find((t) => t.taskId === taskId)!;
const task = (records: Records, taskId: string) =>
  records.tasks.find((t) => t.id === taskId)!;
const occurrence = (records: Records, id: string | undefined) =>
  records.occurrences.find((o) => o.id === id)!;
/** The Task's selection on a day (the recurring ones have one a day). */
const selectionOf = (records: Records, taskId: string, date: string) => {
  const sprint = activeOf(records);
  const sprintTaskId = sprintTaskOf(records, taskId).id;
  return sprint.dailySelections.find(
    (s) => s.sprintTaskId === sprintTaskId && s.date === date,
  )!;
};
/** The reading Task's occurrence of 10/2, which no one did: still pending. */
const pendingOccurrence = (records: Records) =>
  records.occurrences.find(
    (o) => o.taskId === reading && o.state === 'pending',
  )!;
const interruptsOf = (records: Records) => activeOf(records).interrupts;

/** The Sprint a request names. */
const running = (records: Records) => ({ sprintId: activeOf(records).id });
/** The selection of today's 掃除 (a recurring Task: the system made it). */
const cleaningToday = (records: Records) => ({
  ...running(records),
  selectionId: selectionOf(records, cleaning, today).id,
});
/** A selection of a past day, closed or left open. */
const pastSelection = (records: Records, taskId: string, date: string) => ({
  ...running(records),
  selectionId: selectionOf(records, taskId, date).id,
});

const chooseTask = (taskId: string): Step => [
  'chooseForToday',
  (r) => ({
    ...running(r),
    date: today,
    sprintTaskId: sprintTaskOf(r, taskId).id,
  }),
];
const onCleaning = (name: OperationName): Step => [name, cleaningToday];
/** The interrupts the fixture's day has, in time order: the notes to edit. */
const fixtureNotes = () =>
  activeOf(fixtureSnapshot('today-interrupt').records).interrupts;
const firstNote = () => fixtureNotes()[0]!;
const onNote = (note: { readonly id: string }) => (r: Records) => ({
  ...running(r),
  interruptNoteId: note.id,
});

const successes: readonly Success[] = [
  {
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, paper).id,
    }),
    check: (after, before, response) => {
      expect(selectionOf(before, paper, today)).toBeUndefined();
      const { selectionId } = response as { selectionId: string };
      expect(selectionOf(after, paper, today)).toMatchObject({
        id: selectionId,
        origin: 'manual',
        resolution: 'selected',
      });
    },
  },
  {
    // A recurring Task is chosen by one of its occurrences (F18).
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, reading).id,
      occurrenceId: pendingOccurrence(r).id,
    }),
    check: (after, before, response) => {
      const { selectionId } = response as { selectionId: string };
      expect(
        activeOf(after).dailySelections.find((s) => s.id === selectionId),
      ).toMatchObject({
        sprintTaskId: sprintTaskOf(after, reading).id,
        occurrenceId: pendingOccurrence(before).id,
        date: today,
        resolution: 'selected',
      });
    },
  },
  {
    name: 'createTaskForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      title: '請求書を送る',
      areaId: work,
    }),
    check: (after, before, response) => {
      const { taskId, sprintTaskId, selectionId } = response as {
        taskId: string;
        sprintTaskId: string;
        selectionId: string;
      };
      expect(before.tasks.some((t) => t.id === taskId)).toBe(false);
      expect(task(after, taskId)).toMatchObject({
        title: '請求書を送る',
        areaId: work,
      });
      expect(
        activeOf(after).tasks.find((t) => t.id === sprintTaskId),
      ).toMatchObject({ taskId });
      expect(
        activeOf(after).dailySelections.find((s) => s.id === selectionId),
      ).toMatchObject({ sprintTaskId, date: today, resolution: 'selected' });
    },
  },
  {
    name: 'startSelection',
    body: cleaningToday,
    check: (after) =>
      expect(selectionOf(after, cleaning, today)).toMatchObject({
        resolution: 'started',
        startedAt: expect.any(String),
      }),
  },
  {
    name: 'pauseSelection',
    prepare: [onCleaning('startSelection')],
    body: (r) => ({ ...cleaningToday(r), hours: 1.5 }),
    check: (after, before) => {
      expect(selectionOf(after, cleaning, today).resolution).toBe('paused');
      expect(activeOf(after).actualTimes).toHaveLength(
        activeOf(before).actualTimes.length + 1,
      );
      expect(activeOf(after).actualTimes.at(-1)).toMatchObject({
        sprintTaskId: sprintTaskOf(after, cleaning).id,
        hours: 1.5,
        date: today,
        via: 'pause',
      });
    },
  },
  {
    name: 'pauseSelection',
    prepare: [onCleaning('startSelection')],
    body: cleaningToday,
    check: (after, before) => {
      expect(selectionOf(after, cleaning, today).resolution).toBe('paused');
      expect(activeOf(after).actualTimes).toEqual(activeOf(before).actualTimes);
    },
  },
  {
    name: 'deferSelection',
    body: cleaningToday,
    check: (after) =>
      expect(selectionOf(after, cleaning, today).resolution).toBe('deferred'),
  },
  {
    name: 'undoDeferSelection',
    prepare: [onCleaning('deferSelection')],
    body: cleaningToday,
    check: (after) =>
      expect(selectionOf(after, cleaning, today).resolution).toBe('selected'),
  },
  {
    name: 'removeFromToday',
    body: cleaningToday,
    check: (after) =>
      expect(selectionOf(after, cleaning, today).resolution).toBe('removed'),
  },
  {
    name: 'undoRemoveFromToday',
    prepare: [onCleaning('removeFromToday')],
    body: cleaningToday,
    check: (after) =>
      expect(selectionOf(after, cleaning, today).resolution).toBe('selected'),
  },
  {
    // A recurring Task: the day's occurrence is done, the Task goes on.
    name: 'completeSelection',
    body: cleaningToday,
    check: (after, before) => {
      const selection = selectionOf(after, cleaning, today);
      expect(selection.resolution).toBe('done');
      expect(occurrence(before, selection.occurrenceId).state).toBe('pending');
      expect(occurrence(after, selection.occurrenceId).state).toBe('done');
      expect(task(after, cleaning).lifecycle).toBe('active');
    },
  },
  {
    // A single Task: it is done with its selection.
    name: 'completeSelection',
    prepare: [chooseTask(paper)],
    body: (r) => ({
      ...running(r),
      selectionId: selectionOf(r, paper, today).id,
    }),
    check: (after) => {
      expect(selectionOf(after, paper, today).resolution).toBe('done');
      expect(task(after, paper).lifecycle).toBe('completed');
      expect(sprintTaskOf(after, paper).outcome).toBe('done');
    },
  },
  {
    name: 'undoCompleteSelection',
    prepare: [onCleaning('completeSelection')],
    body: cleaningToday,
    check: (after) => {
      const selection = selectionOf(after, cleaning, today);
      expect(selection.resolution).toBe('selected');
      expect(occurrence(after, selection.occurrenceId).state).toBe('pending');
    },
  },
  {
    name: 'skipSelection',
    body: cleaningToday,
    check: (after, before) => {
      const selection = selectionOf(after, cleaning, today);
      expect(selection.resolution).toBe('skipped');
      expect(occurrence(before, selection.occurrenceId).state).toBe('pending');
      expect(occurrence(after, selection.occurrenceId).state).toBe('skipped');
    },
  },
  {
    name: 'undoSkipSelection',
    prepare: [onCleaning('skipSelection')],
    body: cleaningToday,
    check: (after) => {
      const selection = selectionOf(after, cleaning, today);
      expect(selection.resolution).toBe('selected');
      expect(occurrence(after, selection.occurrenceId).state).toBe('pending');
    },
  },
  {
    name: 'recordActualTime',
    prepare: [chooseTask(paper)],
    body: (r) => ({
      ...running(r),
      sprintTaskId: sprintTaskOf(r, paper).id,
      date: today,
      hours: 2,
    }),
    check: (after, before) => {
      expect(activeOf(after).actualTimes).toHaveLength(
        activeOf(before).actualTimes.length + 1,
      );
      expect(activeOf(after).actualTimes.at(-1)).toMatchObject({
        sprintTaskId: sprintTaskOf(after, paper).id,
        hours: 2,
        date: today,
        via: 'later',
      });
    },
  },
  {
    name: 'noteInterrupt',
    body: (r) => ({ ...running(r), text: '電話対応', minutes: 15 }),
    check: (after, before, response) => {
      const { interruptNoteId } = response as { interruptNoteId: string };
      expect(interruptsOf(after)).toHaveLength(interruptsOf(before).length + 1);
      expect(interruptsOf(after).find((n) => n.id === interruptNoteId)).toEqual(
        {
          id: interruptNoteId,
          at: clock.now,
          text: '電話対応',
          minutes: 15,
        },
      );
      // Invariant 29: a note is not a Task, and Today stays as it was.
      expect(activeOf(after).tasks).toEqual(activeOf(before).tasks);
      expect(activeOf(after).dailySelections).toEqual(
        activeOf(before).dailySelections,
      );
    },
  },
  {
    name: 'noteInterrupt',
    body: (r) => ({ ...running(r), text: '急ぎの質問' }),
    check: (after, before, response) => {
      const { interruptNoteId } = response as { interruptNoteId: string };
      const note = interruptsOf(after).find((n) => n.id === interruptNoteId);
      expect(note).toMatchObject({ text: '急ぎの質問' });
      expect(note).not.toHaveProperty('minutes');
      expect(interruptsOf(after)).toHaveLength(interruptsOf(before).length + 1);
    },
  },
  {
    name: 'editInterrupt',
    state: 'today-interrupt',
    body: (r) => ({
      ...onNote(firstNote())(r),
      text: '障害の問い合わせに対応（原因の調査）',
      minutes: 60,
    }),
    check: (after, before) => {
      const note = firstNote();
      expect(interruptsOf(before).find((n) => n.id === note.id)).toEqual(note);
      // The time stays (F38).
      expect(interruptsOf(after).find((n) => n.id === note.id)).toEqual({
        ...note,
        text: '障害の問い合わせに対応（原因の調査）',
        minutes: 60,
      });
    },
  },
  {
    name: 'editInterrupt',
    state: 'today-interrupt',
    body: (r) => ({
      ...onNote(firstNote())(r),
      text: '障害対応',
    }),
    check: (after) => {
      const note = interruptsOf(after).find((n) => n.id === firstNote().id)!;
      expect(note).toMatchObject({ text: '障害対応', at: firstNote().at });
      expect(note).not.toHaveProperty('minutes');
    },
  },
  {
    name: 'deleteInterrupt',
    state: 'today-interrupt',
    body: onNote(firstNote()),
    check: (after, before) => {
      expect(interruptsOf(after).map((n) => n.id)).toEqual(
        interruptsOf(before)
          .filter((n) => n.id !== firstNote().id)
          .map((n) => n.id),
      );
    },
  },
  {
    name: 'restoreInterrupt',
    state: 'today-interrupt',
    prepare: [['deleteInterrupt', onNote(firstNote())]],
    body: (r) => ({ ...running(r), note: firstNote() }),
    check: (after, before) => {
      expect(interruptsOf(before).some((n) => n.id === firstNote().id)).toBe(
        false,
      );
      // The same note, in its place by time (F38).
      expect(interruptsOf(after)).toEqual(fixtureNotes());
    },
  },
];

const failures: readonly Failure[] = [
  {
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: yesterday,
      sprintTaskId: sprintTaskOf(r, paper).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: missing('SprintTask'),
    }),
    status: 404,
    code: 'notFound',
  },
  {
    // Once a day (F17): the selection is there already.
    name: 'chooseForToday',
    prepare: [chooseTask(paper)],
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, paper).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    // Done already: only a planned SprintTask is chosen.
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, ids.task.tax).id,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    // A recurring Task is chosen by its occurrence.
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, reading).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, paper).id,
      occurrenceId: pendingOccurrence(r).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    // An occurrence of another SprintTask.
    name: 'chooseForToday',
    body: (r) => ({
      ...running(r),
      date: today,
      sprintTaskId: sprintTaskOf(r, cleaning).id,
      occurrenceId: pendingOccurrence(r).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    // A day done already is not chosen again.
    name: 'chooseForToday',
    body: (r) => {
      const done = r.occurrences.find(
        (o) => o.taskId === reading && o.state === 'done',
      )!;
      return {
        ...running(r),
        date: today,
        sprintTaskId: sprintTaskOf(r, reading).id,
        occurrenceId: done.id,
      };
    },
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'chooseForToday',
    state: 'planning-pick',
    body: (r) => {
      const draft = r.sprints.find((s) => s.state === 'planning')!;
      return {
        sprintId: draft.id,
        date: today,
        sprintTaskId: draft.tasks[0]!.id,
      };
    },
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'chooseForToday',
    body: (r) => ({
      sprintId: missing('Sprint'),
      date: today,
      sprintTaskId: sprintTaskOf(r, paper).id,
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'createTaskForToday',
    body: (r) => ({ ...running(r), date: today, title: '   ' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'createTaskForToday',
    body: (r) => ({ ...running(r), date: yesterday, title: '請求書を送る' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'startSelection',
    prepare: [onCleaning('completeSelection')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'startSelection',
    body: (r) => ({ ...running(r), selectionId: missing('DailySelection') }),
    status: 404,
    code: 'notFound',
  },
  {
    // The Sprint is in Review: Today is over.
    name: 'startSelection',
    state: 'retro-start',
    body: (r) => ({
      sprintId: reviewOf(r).id,
      selectionId: reviewOf(r).dailySelections[0]!.id,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'pauseSelection',
    prepare: [onCleaning('startSelection')],
    body: (r) => ({ ...cleaningToday(r), hours: -1 }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'pauseSelection',
    prepare: [onCleaning('deferSelection')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'deferSelection',
    prepare: [onCleaning('deferSelection')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    // F37: a deferral of an earlier day is not taken back.
    name: 'undoDeferSelection',
    body: (r) => pastSelection(r, paper, '2026-09-29'),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoDeferSelection',
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'removeFromToday',
    prepare: [onCleaning('removeFromToday')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoRemoveFromToday',
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoRemoveFromToday',
    body: (r) => ({
      ...running(r),
      selectionId: missing('DailySelection'),
    }),
    status: 404,
    code: 'notFound',
  },
  {
    // An earlier day's open choice was closed by the system, not completed.
    name: 'completeSelection',
    body: (r) => pastSelection(r, reading, '2026-10-02'),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'completeSelection',
    prepare: [onCleaning('completeSelection')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoCompleteSelection',
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'skipSelection',
    prepare: [chooseTask(paper)],
    body: (r) => ({
      ...running(r),
      selectionId: selectionOf(r, paper, today).id,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'skipSelection',
    prepare: [onCleaning('skipSelection')],
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'undoSkipSelection',
    body: cleaningToday,
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'recordActualTime',
    prepare: [chooseTask(paper)],
    body: (r) => ({
      ...running(r),
      sprintTaskId: sprintTaskOf(r, paper).id,
      date: today,
      hours: -2,
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'recordActualTime',
    body: (r) => ({
      ...running(r),
      sprintTaskId: missing('SprintTask'),
      date: today,
      hours: 2,
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'noteInterrupt',
    body: (r) => ({ ...running(r), text: '  ' }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'noteInterrupt',
    body: (r) => ({ ...running(r), text: '電話対応', minutes: 0 }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'noteInterrupt',
    state: 'retro-start',
    body: (r) => ({ sprintId: reviewOf(r).id, text: '電話対応' }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'editInterrupt',
    state: 'today-interrupt',
    body: (r) => ({
      ...onNote(firstNote())(r),
      text: '',
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'editInterrupt',
    body: (r) => ({
      ...running(r),
      interruptNoteId: missing('InterruptNote'),
      text: '電話対応',
    }),
    status: 404,
    code: 'notFound',
  },
  {
    // Invariant 40: after the Review starts the notes are fixed.
    name: 'editInterrupt',
    state: 'retro-start',
    body: (r) => ({
      sprintId: reviewOf(r).id,
      interruptNoteId: reviewOf(r).interrupts[0]!.id,
      text: '直す',
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    name: 'deleteInterrupt',
    body: (r) => ({
      ...running(r),
      interruptNoteId: missing('InterruptNote'),
    }),
    status: 404,
    code: 'notFound',
  },
  {
    name: 'deleteInterrupt',
    state: 'retro-start',
    body: (r) => ({
      sprintId: reviewOf(r).id,
      interruptNoteId: reviewOf(r).interrupts[0]!.id,
    }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    // The note is still there.
    name: 'restoreInterrupt',
    state: 'today-interrupt',
    body: (r) => ({ ...running(r), note: firstNote() }),
    status: 422,
    code: 'invalidTransition',
  },
  {
    // A note is restored, not made: it was noted before now.
    name: 'restoreInterrupt',
    body: (r) => ({
      ...running(r),
      note: {
        id: missing('InterruptNote'),
        at: '2026-10-03T00:31:00.000Z',
        text: '電話対応',
      },
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    // Noted before the Sprint began (9/28, Tokyo).
    name: 'restoreInterrupt',
    body: (r) => ({
      ...running(r),
      note: {
        id: missing('InterruptNote'),
        at: '2026-09-27T14:59:00.000Z',
        text: '前の週のメモ',
      },
    }),
    status: 422,
    code: 'invalidInput',
  },
  {
    name: 'restoreInterrupt',
    body: (r) => ({
      ...running(r),
      note: {
        id: missing('InterruptNote'),
        at: '2026-10-03T00:00:00.000Z',
        text: ' ',
      },
    }),
    status: 422,
    code: 'invalidInput',
  },
];

describe('the Today routes', () => {
  const answered = [
    'chooseForToday',
    'createTaskForToday',
    'startSelection',
    'pauseSelection',
    'deferSelection',
    'undoDeferSelection',
    'removeFromToday',
    'undoRemoveFromToday',
    'completeSelection',
    'undoCompleteSelection',
    'skipSelection',
    'undoSkipSelection',
    'recordActualTime',
    'noteInterrupt',
    'editInterrupt',
    'deleteInterrupt',
    'restoreInterrupt',
  ].toSorted();

  it('are each tested for a success and a refusal', () => {
    expect([...new Set(successes.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
    expect([...new Set(failures.map((c) => c.name))].toSorted()).toEqual(
      answered,
    );
  });

  it.each([
    [
      'a Task’s ID as the selection',
      (r: Records) => ({ ...running(r), selectionId: paper }),
    ],
    [
      'a selection’s ID as the Sprint',
      (r: Records) => ({
        sprintId: cleaningToday(r).selectionId,
        selectionId: cleaningToday(r).selectionId,
      }),
    ],
  ])('answers 400 to %s, writing nothing', async (_, body) => {
    const app = await setup('today-morning');
    await app.get('/me');
    const before = await app.saved();
    const response = await app.post('startSelection', body(before.records));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validationFailed' });
    expect(await app.saved()).toEqual(before);
  });

  it('answers 400 to a day that does not exist, writing nothing', async () => {
    const app = await setup('today-morning');
    await app.get('/me');
    const before = await app.saved();
    const response = await app.post('chooseForToday', {
      ...running(before.records),
      date: '2026-02-30',
      sprintTaskId: sprintTaskOf(before.records, paper).id,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validationFailed' });
    expect(await app.saved()).toEqual(before);
  });
});

describeOperations('the Today operations answer', {
  state: 'today-morning',
  successes,
  failures,
});

describe('the decisions of Today, through the API', () => {
  /** The Sprint's selections of one Task on a day. */
  const selectionsOf = (records: Records, taskId: string, date: string) =>
    activeOf(records).dailySelections.filter(
      (s) =>
        s.sprintTaskId === sprintTaskOf(records, taskId).id && s.date === date,
    );

  it('F17: a deferred choice can be completed the same day, and undoing goes back to deferred', async () => {
    const app = await setup('today-morning');
    await app.run('chooseForToday', {
      ...running((await app.saved()).records),
      date: today,
      sprintTaskId: sprintTaskOf((await app.saved()).records, paper).id,
    });
    const body = (r: Records) => ({
      ...running(r),
      selectionId: selectionOf(r, paper, today).id,
    });
    await app.run('deferSelection', body((await app.saved()).records));
    await app.run('completeSelection', body((await app.saved()).records));
    let { records } = await app.saved();
    expect(selectionsOf(records, paper, today)).toHaveLength(1);
    expect(selectionOf(records, paper, today)).toMatchObject({
      resolution: 'done',
      closedBefore: { resolution: 'deferred' },
    });
    await app.run('undoCompleteSelection', body(records));
    ({ records } = await app.saved());
    expect(selectionOf(records, paper, today).resolution).toBe('deferred');
    // The day does not take a second choice of it (F17, F37).
    const again = await app.post('chooseForToday', {
      ...running(records),
      date: today,
      sprintTaskId: sprintTaskOf(records, paper).id,
    });
    expect(again.status).toBe(422);
  });

  it('F37: a choice put back to this week is taken back to selected, and does not make a second one', async () => {
    const app = await setup('today-morning');
    await app.run('chooseForToday', {
      ...running((await app.saved()).records),
      date: today,
      sprintTaskId: sprintTaskOf((await app.saved()).records, paper).id,
    });
    const body = (r: Records) => ({
      ...running(r),
      selectionId: selectionOf(r, paper, today).id,
    });
    await app.run('removeFromToday', body((await app.saved()).records));
    await app.run('undoRemoveFromToday', body((await app.saved()).records));
    const { records } = await app.saved();
    expect(selectionsOf(records, paper, today)).toHaveLength(1);
    expect(selectionOf(records, paper, today).resolution).toBe('selected');
  });

  it('F37: a deferral after starting is taken back to started, and keeps the start time', async () => {
    const app = await setup('today-morning');
    await app.get('/me');
    await app.run('startSelection', cleaningToday((await app.saved()).records));
    const startedAt = selectionOf(
      (await app.saved()).records,
      cleaning,
      today,
    ).startedAt;
    expect(startedAt).toBeDefined();
    await app.run('deferSelection', cleaningToday((await app.saved()).records));
    await app.run(
      'undoDeferSelection',
      cleaningToday((await app.saved()).records),
    );
    expect(
      selectionOf((await app.saved()).records, cleaning, today),
    ).toMatchObject({ resolution: 'started', startedAt });
  });

  it('a recurring Task’s occurrence is skipped and done as the day’s choice is (F19)', async () => {
    const app = await setup('today-morning');
    await app.get('/me');
    await app.run('skipSelection', cleaningToday((await app.saved()).records));
    let { records } = await app.saved();
    const selection = selectionOf(records, cleaning, today);
    expect(occurrence(records, selection.occurrenceId).state).toBe('skipped');
    await app.run(
      'undoSkipSelection',
      cleaningToday((await app.saved()).records),
    );
    await app.run(
      'completeSelection',
      cleaningToday((await app.saved()).records),
    );
    ({ records } = await app.saved());
    expect(occurrence(records, selection.occurrenceId).state).toBe('done');
    // The next occurrence is untouched: the Task goes on.
    expect(task(records, cleaning).lifecycle).toBe('active');
  });

  it('F38: edit, delete and restore leave the time, and each is in the Activity', async () => {
    const app = await setup('today-interrupt');
    const note = firstNote();
    await app.run('editInterrupt', {
      ...onNote(note)((await app.saved()).records),
      text: '直した',
    });
    await app.run('deleteInterrupt', onNote(note)((await app.saved()).records));
    // The note as the read gave it after the edit: no minutes.
    await app.run('restoreInterrupt', {
      ...running((await app.saved()).records),
      note: { id: note.id, at: note.at, text: '直した' },
    });
    const { records } = await app.saved();
    expect(interruptsOf(records).find((n) => n.id === note.id)).toEqual({
      id: note.id,
      at: note.at,
      text: '直した',
    });
    const kinds = (await app.db.select().from(activity)).map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'interruptEdited',
        'interruptDeleted',
        'interruptRestored',
      ]),
    );
  });

  it('F38: a note with the ID of another Sprint’s note is refused, writing nothing', async () => {
    // The ID is the person's for good: the table's key is across Sprints.
    const parsed = parseId('InterruptNote', missing('InterruptNote'));
    if (!parsed.ok) throw new Error('not an InterruptNote ID');
    const taken = parsed.value;
    const app = await setup('today-morning', (records) => ({
      ...records,
      sprints: records.sprints.map((s) =>
        s.id !== ids.sprint.previous
          ? s
          : {
              ...s,
              interrupts: [
                {
                  id: taken,
                  at: instant('2026-09-25T01:00:00.000Z'),
                  text: '前の週',
                },
              ],
            },
      ),
    }));
    await app.get('/me');
    const before = await app.saved();
    expect(
      before.records.sprints.flatMap((s) => s.interrupts.map((n) => n.id)),
    ).toEqual([taken]);
    const response = await app.post('restoreInterrupt', {
      ...running(before.records),
      note: { id: taken, at: '2026-10-01T01:00:00.000Z', text: '今週のメモ' },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'invalidInput' });
    expect(await app.saved()).toEqual(before);
  });

  it('F38: an interrupt is noted on a day of the Sprint, so a confirmed Sprint that has not begun takes none, writing nothing', async () => {
    // F34: a confirmed Sprint runs from its confirmation, before its first day.
    const app = await setup('today-morning', (records) => ({
      ...records,
      sprints: records.sprints.map((s) =>
        s.state === 'active'
          ? {
              ...s,
              start: localDate('2026-10-10'),
              end: localDate('2026-10-16'),
            }
          : s,
      ),
    }));
    await app.get('/me');
    const before = await app.saved();
    expect(activeOf(before.records).start > today).toBe(true);
    const response = await app.post('noteInterrupt', {
      ...running(before.records),
      text: '電話対応',
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'invalidInput' });
    expect(await app.saved()).toEqual(before);
  });

  it('invariant 29: noting an interrupt adds no Task and no mid-Sprint addition', async () => {
    const app = await setup('today-morning');
    await app.get('/me');
    const before = (await app.saved()).records;
    await app.run('noteInterrupt', {
      ...running(before),
      text: '電話対応',
      minutes: 15,
    });
    const after = (await app.saved()).records;
    expect(after.tasks).toEqual(before.tasks);
    expect(activeOf(after).tasks).toEqual(activeOf(before).tasks);
  });

  it('invariant 25: Today leaves the Goals, the criterion and the available hours', async () => {
    const app = await setup('today-morning');
    await app.get('/me');
    const before = activeOf((await app.saved()).records);
    for (const [name, body] of [
      ['startSelection', cleaningToday],
      ['pauseSelection', (r: Records) => ({ ...cleaningToday(r), hours: 1 })],
    ] as const)
      await app.run(name, body((await app.saved()).records));
    const after = activeOf((await app.saved()).records);
    for (const key of [
      'goals',
      'criterionUse',
      'availableHours',
      'plannedAvailableHours',
    ] as const)
      expect(after[key]).toEqual(before[key]);
  });
});

describe('the Today read', () => {
  /** What JSON makes of a value: `undefined` fields are gone. */
  const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

  async function readOn(
    state: Parameters<typeof setup>[0],
    path: (records: Records) => string,
  ) {
    const app = await setup(state);
    // Brought up to the clock's day first (#271), so that the records are
    // as the read finds them.
    await app.get('/me');
    const response = await app.get(path((await app.saved()).records));
    const { records } = await app.saved();
    return { response, records, json: await response.json() };
  }

  describe('getDay', () => {
    it.each([
      ['today', today, 'today'],
      ['a past day', yesterday, 'past'],
      ['a day still to come', addDays(today, 1), 'future'],
    ] as const)('answers %s as the application does', async (_, date, kind) => {
      const { response, records, json } = await readOn(
        'today-interrupt',
        () => `/days/${date}`,
      );
      expect(response.status).toBe(200);
      const body = v.parse(contract.vGetDayResponse, json);
      expect(body).toEqual({
        clock,
        view: asJson(dayView(records, clock, date)),
      });
      expect(body.view.kind).toBe(kind);
    });

    it('answers today with its choices', async () => {
      const { json } = await readOn('today-interrupt', () => `/days/${today}`);
      const { view } = v.parse(contract.vGetDayResponse, json);
      if (view.kind !== 'today') throw new Error(`a ${view.kind} day`);
      expect(view.today?.today).toBe(today);
      expect(view.today?.rows.map((r) => r.task.id)).toEqual([cleaning]);
    });

    it('answers a past day with what was chosen and noted on it', async () => {
      // 10/1 of the fixture: three choices (one done) and two interrupts.
      const { json } = await readOn(
        'today-interrupt',
        () => '/days/2026-10-01',
      );
      const { view } = v.parse(contract.vGetDayResponse, json);
      if (view.kind !== 'past') throw new Error(`a ${view.kind} day`);
      expect(
        view.day.records.map((r) => r.selection.resolution).toSorted(),
      ).toEqual(['done', 'unresolved', 'unresolved']);
      expect(view.day.interrupts.map((n) => n.id)).toEqual(
        fixtureNotes().map((n) => n.id),
      );
    });

    it('answers a day with no running Sprint as today with nothing', async () => {
      const { response, json } = await readOn(
        'planning-pick',
        () => `/days/${today}`,
      );
      expect(response.status).toBe(200);
      const { view } = v.parse(contract.vGetDayResponse, json);
      expect(view).toEqual({ kind: 'today' });
    });

    it('shows what an operation just changed', async () => {
      const app = await setup('today-morning');
      await app.get('/me');
      const rowOf = async () => {
        const { view } = v.parse(
          contract.vGetDayResponse,
          await (await app.get(`/days/${today}`)).json(),
        );
        return view.kind === 'today'
          ? view.today?.rows.find((r) => r.task.id === cleaning)
          : undefined;
      };
      expect(await rowOf()).toMatchObject({
        selection: { resolution: 'selected' },
      });
      await app.run(
        'startSelection',
        cleaningToday((await app.saved()).records),
      );
      expect(await rowOf()).toMatchObject({
        selection: { resolution: 'started' },
      });
    });

    it('writes nothing, whatever it is asked', async () => {
      const app = await setup('today-morning');
      await app.get('/me');
      const before = await app.saved();
      for (const date of [today, yesterday, addDays(today, 1)])
        await app.get(`/days/${date}`);
      expect(await app.saved()).toEqual(before);
    });

    it.each([
      ['a day that does not exist', '/days/2026-02-30'],
      ['a word', '/days/today'],
      ['a time', '/days/2026-10-03T00:00:00.000Z'],
      ['a date written the other way', '/days/10-03-2026'],
    ])('answers 400 to %s', async (_, path) => {
      const { response, json } = await readOn('today-morning', () => path);
      expect(response.status).toBe(400);
      expect(json).toMatchObject({ code: 'validationFailed' });
    });
  });
});
