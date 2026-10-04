// The capabilities the reads give the records besides today's choices and
// interrupts (#323 完了条件, as #322 for those): in every fixture state, for
// every Task of the Backlog and its suggestions and subtasks, Area, Sprint,
// Goal, SprintTask, candidate, occurrence, Retro, criterion and past day,
// each `can…` that is true lets its operation go through with example
// values, and each that is false is refused (422, or 404 for a record not
// found). The rule is the command's own check, so the two cannot part.
import {
  type AreaId,
  type CriterionPolicy,
  type DomainErrorCode,
  type Result,
  type SprintId,
} from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { areaList } from './area-view';
import { backlogData } from './backlog-view';
import type {
  AreaCapabilities,
  CriterionUseCapabilities,
  DailySelectionCapabilities,
  EstimateSuggestionCapabilities,
  OccurrenceCapabilities,
  PlanningCriterionCapabilities,
  RetroCapabilities,
  SprintCandidateCapabilities,
  SprintCapabilities,
  SprintGoalCapabilities,
  SprintTaskCapabilities,
  SubtaskCapabilities,
  TaskCapabilities,
} from './capabilities';
import { createIdSource } from './ids';
import { fixtureSnapshot, fixtureStateIds } from './fixtures/states';
import { operations } from './operations';
import type { Change, StoreSnapshot } from './record-store';
import {
  dayView,
  sprintCandidates,
  sprintList,
  sprintRetro,
  sprintView,
} from './resource-views';
import { catchUp } from './system-changes';
import { memoryStore, tagged } from './testing';

type Input<N extends keyof typeof operations> = Parameters<
  (typeof operations)[N]
>[0];
type TaskId = Input<'archiveTask'>['taskId'];
type SprintTaskId = Input<'setGoalLink'>['sprintTaskId'];

/** The HTTP status the API answers a domain error with (ADR 0006). */
const STATUS: Readonly<Record<DomainErrorCode, number>> = {
  notFound: 404,
  invalidInput: 422,
  invalidTransition: 422,
  recurringTaskCannotComplete: 422,
};

const POLICY: CriterionPolicy = {
  scope: { kind: 'all' },
  rangePolicy: 'hi',
};

/** An ID no record has, for an operation on a record there is not. */
const missing = (kind: string) =>
  createIdSource((bytes) => bytes.fill(7)).newId(
    kind,
    '2026-01-01T00:00:00.000Z' as never,
  );

/** A record with capabilities, and how to run each of their operations. */
interface Target {
  readonly where: string;
  readonly kind: string;
  readonly capabilities: object;
  /** A SprintTask's: whether its Task repeats (it has occurrences). */
  readonly recurring?: boolean;
  readonly run: (name: string) => Result<unknown>;
}

/** The records with capabilities that the reads give in a state. */
function targetsOf(snapshot: StoreSnapshot): Target[] {
  const { records, clock } = snapshot;
  const read = tagged(records);
  // Each operation runs on the state as it is, not after another.
  const fresh = (change: Change<unknown>) => memoryStore(snapshot).run(change);
  const target = <C extends object>(
    kind: string,
    where: string,
    capabilities: C,
    changes: { readonly [K in keyof C]: () => Change<unknown> },
  ): Target => ({
    where: `${kind} ${where}`,
    kind,
    capabilities,
    run: (name) => fresh(changes[name as keyof C]()),
  });
  const targets: Target[] = [];
  const running = records.sprints.find((s) => s.state === 'active');
  // The Backlog's 今日へ・今週へ name the running Sprint; without one, a
  // Sprint there is not.
  const runningId = running?.id ?? (missing('Sprint') as SprintId);

  // ------------------------------------------------------------ Backlog
  for (const item of Object.values(backlogData(read, clock, {}).items)) {
    const taskId = item.task.id as TaskId;
    targets.push(
      target<TaskCapabilities>('task', taskId, item.capabilities, {
        canSave: () =>
          operations.saveTask({ taskId, update: { description: 'メモ' } }),
        canArchive: () => operations.archiveTask({ taskId }),
        canComplete: () => operations.completeTask({ taskId }),
        canSetRecurrence: () =>
          operations.setRecurrence({ taskId, pattern: { freq: 'daily' } }),
        canEndRecurrence: () => operations.endRecurrence({ taskId }),
        canAddSubtask: () => operations.addSubtask({ taskId, title: '下調べ' }),
        canAddToToday: () =>
          operations.addTaskToToday({
            sprintId: runningId,
            date: clock.today,
            taskId,
          }),
        canAddToWeek: () =>
          operations.addSprintTasks({ sprintId: runningId, taskIds: [taskId] }),
      }),
    );
    for (const [id, capabilities] of Object.entries(
      item.suggestionCapabilities,
    )) {
      const suggestionId = id as Input<'rejectSuggestion'>['suggestionId'];
      const on = { taskId, suggestionId };
      targets.push(
        target<EstimateSuggestionCapabilities>(
          'suggestion',
          `${taskId} ${suggestionId}`,
          capabilities,
          {
            canAdopt: () => operations.adoptSuggestion({ ...on, bound: 'hi' }),
            canUndoAdoption: () =>
              operations.undoAdoption({ ...on, previous: null }),
            canReject: () => operations.rejectSuggestion(on),
            canUndoRejection: () => operations.undoRejection(on),
          },
        ),
      );
    }
    for (const [id, capabilities] of Object.entries(item.subtaskCapabilities)) {
      const subtaskId = id as Input<'setSubtaskDone'>['subtaskId'];
      targets.push(
        target<SubtaskCapabilities>(
          'subtask',
          `${taskId} ${subtaskId}`,
          capabilities,
          {
            canUpdate: () =>
              operations.setSubtaskDone({ taskId, subtaskId, done: true }),
          },
        ),
      );
    }
  }

  // --------------------------------------------------------------- Area
  for (const area of areaList(read))
    targets.push(
      target<AreaCapabilities>('area', area.id, area.capabilities, {
        canRename: () =>
          operations.renameArea({ areaId: area.id, name: '新しい名前' }),
        canArchive: () => operations.archiveArea({ areaId: area.id }),
        canRestore: () => operations.restoreArea({ areaId: area.id }),
      }),
    );

  // ------------------------------------------------------------- Sprint
  const sprintTarget = (
    where: string,
    sprintId: SprintId,
    capabilities: SprintCapabilities,
  ) =>
    target<SprintCapabilities>('sprint', where, capabilities, {
      canSetAvailableHours: () =>
        operations.setAvailableHours({ sprintId, hours: 20 }),
      canConfirm: () =>
        operations.confirmSprint({ sprintId, applyCriterion: false }),
      canBeginRetro: () => operations.beginRetro({ sprintId }),
    });
  const goalTarget = (
    where: string,
    sprintId: SprintId,
    areaId: AreaId | undefined,
    capabilities: SprintGoalCapabilities,
  ) => {
    const on = { sprintId, areaId: areaId ?? (missing('Area') as AreaId) };
    return target<SprintGoalCapabilities>('goal', where, capabilities, {
      canSet: () => operations.setGoal({ ...on, text: '今週の目標' }),
      canAssess: () => operations.assessGoal({ ...on, assessment: 'achieved' }),
    });
  };
  const sprintTaskTarget = (
    where: string,
    sprintId: SprintId,
    sprintTaskId: SprintTaskId,
    capabilities: SprintTaskCapabilities,
  ) => {
    const sprint = records.sprints.find((s) => s.id === sprintId)!;
    const sprintTask = sprint.tasks.find((t) => t.id === sprintTaskId)!;
    const occurrenceId = sprintTask.occurrenceIds?.[0];
    const recurring = sprintTask.occurrenceIds !== undefined;
    return {
      recurring,
      ...target<SprintTaskCapabilities>('sprintTask', where, capabilities, {
        canRemove: () =>
          operations.removeSprintTasks({
            sprintId,
            sprintTaskIds: [sprintTaskId],
          }),
        canSetGoalLink: () =>
          operations.setGoalLink({
            sprintId,
            sprintTaskId,
            goalLink: 'unlinked',
          }),
        canExcludeAllOccurrences: () =>
          operations.excludeAllOccurrences({ sprintId, sprintTaskId }),
        canRecordActualTime: () =>
          operations.recordActualTime({
            sprintId,
            sprintTaskId,
            date: sprint.start,
            hours: 1,
            ...(occurrenceId === undefined ? {} : { occurrenceId }),
          }),
      }),
    };
  };

  for (const item of sprintList(records, clock))
    targets.push(sprintTarget(`list ${item.id}`, item.id, item.capabilities));

  for (const sprint of records.sprints) {
    const sprintId = sprint.id;
    const view = sprintView(read, clock, sprintId, { applyCriterion: false });
    if (view?.state === 'planning') {
      const { plan } = view;
      targets.push(
        sprintTarget(`plan ${sprintId}`, sprintId, plan.capabilities),
      );
      for (const block of plan.plan) {
        targets.push(
          goalTarget(
            `plan ${sprintId} ${block.area?.id ?? 'none'}`,
            sprintId,
            block.area?.id,
            block.goalCapabilities,
          ),
        );
        for (const t of block.tasks)
          targets.push(
            sprintTaskTarget(
              `plan ${t.sprintTask.id}`,
              sprintId,
              t.sprintTask.id,
              t.capabilities,
            ),
          );
      }
      const candidates = sprintCandidates(read, clock, sprintId);
      if (candidates === undefined) throw new Error('No candidates.');
      for (const row of [
        ...candidates.carriedOver,
        ...candidates.overdue,
        ...candidates.dueSoon,
        ...candidates.others,
      ]) {
        const taskId = row.task.id as TaskId;
        targets.push(
          target<SprintCandidateCapabilities>(
            'candidate',
            `${sprintId} ${taskId}`,
            row.capabilities,
            {
              canAdd: () =>
                operations.addSprintTasks({ sprintId, taskIds: [taskId] }),
            },
          ),
        );
        if (row.chosen !== undefined && row.chosenCapabilities !== undefined)
          targets.push(
            sprintTaskTarget(
              `candidate ${row.chosen.id}`,
              sprintId,
              row.chosen.id,
              row.chosenCapabilities,
            ),
          );
      }
      for (const recurring of candidates.recurring)
        for (const occurrence of recurring.occurrences) {
          const on = { sprintId, occurrenceId: occurrence.id };
          targets.push(
            target<OccurrenceCapabilities>(
              'occurrence',
              occurrence.id,
              occurrence.capabilities,
              {
                canInclude: () =>
                  operations.setOccurrenceIncluded({ ...on, included: true }),
                canExclude: () =>
                  operations.setOccurrenceIncluded({ ...on, included: false }),
              },
            ),
          );
        }
    } else if (view !== undefined) {
      const { running: data } = view;
      targets.push(
        sprintTarget(`run ${sprintId}`, sprintId, data.capabilities),
      );
      for (const block of data.plan) {
        targets.push(
          goalTarget(
            `run ${sprintId} ${block.area?.id ?? 'none'}`,
            sprintId,
            block.area?.id,
            block.goalCapabilities,
          ),
        );
        for (const t of block.tasks)
          targets.push(
            sprintTaskTarget(
              `run ${t.sprintTask.id}`,
              sprintId,
              t.sprintTask.id,
              t.capabilities,
            ),
          );
      }
      for (const day of data.pastDays)
        for (const record of day.records) {
          const on = { sprintId, selectionId: record.selection.id };
          targets.push(
            target<DailySelectionCapabilities>(
              'pastDay',
              record.selection.id,
              record.capabilities,
              {
                canStart: () => operations.startSelection(on),
                canPause: () => operations.pauseSelection({ ...on, hours: 1 }),
                canDefer: () => operations.deferSelection(on),
                canUndoDefer: () => operations.undoDeferSelection(on),
                canRemove: () => operations.removeFromToday(on),
                canUndoRemove: () => operations.undoRemoveFromToday(on),
                canComplete: () => operations.completeSelection(on),
                canUndoComplete: () => operations.undoCompleteSelection(on),
                canSkip: () => operations.skipSelection(on),
                canUndoSkip: () => operations.undoSkipSelection(on),
              },
            ),
          );
        }
    }

    // ----------------------------------------------------------- Retro
    const retro = sprintRetro(read, clock, sprintId);
    if (retro === undefined) continue;
    const pin = { kind: 'availableHours' as const };
    targets.push(
      target<RetroCapabilities>('retro', sprintId, retro.capabilities, {
        canUpdate: () =>
          operations.setReflection({ sprintId, text: '気づいたこと' }),
        canComplete: () => operations.completeRetro({ sprintId }),
        canPinFact: () => operations.pinFact({ sprintId, pin }),
        canUnpinFact: () => operations.unpinFact({ sprintId, pin }),
        canDraftCriterion: () =>
          operations.draftCriterion({ sprintId, policy: POLICY }),
      }),
    );
    for (const [areaId, capabilities] of Object.entries(retro.goalCapabilities))
      targets.push(
        goalTarget(
          `retro ${sprintId} ${areaId}`,
          sprintId,
          areaId as AreaId,
          capabilities,
        ),
      );
    for (const [id, capabilities] of Object.entries(
      retro.sprintTaskCapabilities,
    ))
      targets.push(
        sprintTaskTarget(
          `retro ${id}`,
          sprintId,
          id as SprintTaskId,
          capabilities,
        ),
      );
    if (retro.used !== undefined)
      targets.push(
        target<CriterionUseCapabilities>(
          'criterionUse',
          sprintId,
          retro.used.capabilities,
          {
            canDecide: () =>
              operations.decideCriterion({ sprintId, decision: 'end' }),
          },
        ),
      );
    if (retro.draft !== undefined) {
      const criterionId = retro.draft.criterion.id;
      targets.push(
        target<PlanningCriterionCapabilities>(
          'criterion',
          criterionId,
          retro.draft.capabilities,
          {
            canSetDraftPolicy: () =>
              operations.setDraftPolicy({ criterionId, policy: POLICY }),
            canDropDraft: () => operations.dropCriterionDraft({ criterionId }),
          },
        ),
      );
    }
  }

  // -------------------------------------------------------------- Today
  const today = dayView(read, clock, clock.today);
  if (today.kind === 'today' && today.today !== undefined)
    targets.push(
      sprintTarget(
        'today',
        today.today.sprint.id,
        today.today.sprintCapabilities,
      ),
    );
  return targets;
}

/**
 * States the fixture does not have, made by the person's operations (and
 * the system's catch-up of the days): a Retro whose improvement made a
 * draft criterion, and that Retro completed; a suggestion adopted, and one
 * rejected; an Area archived; an occurrence left out of a plan; and the last
 * day of a running Sprint, when its Retro can start.
 */
function madeStates(): [string, StoreSnapshot][] {
  const made = (
    state: Parameters<typeof fixtureSnapshot>[0],
    steps: (records: StoreSnapshot['records']) => Change<unknown>[],
  ) => {
    const store = memoryStore(fixtureSnapshot(state));
    for (const step of steps(store.getSnapshot().records)) {
      const result = store.run(step);
      if (!result.ok) throw new Error(result.error.message);
    }
    return store.getSnapshot();
  };
  const reviewOf = (records: StoreSnapshot['records']) => {
    const review = records.sprints.find((s) => s.state === 'review');
    if (review === undefined) throw new Error('No Sprint in Review.');
    return review;
  };
  const presentedOf = (records: StoreSnapshot['records']) => {
    const task = records.tasks.find((t) =>
      t.suggestions.some((s) => s.state === 'presented'),
    );
    const suggestion = task?.suggestions.find((s) => s.state === 'presented');
    if (task === undefined || suggestion === undefined)
      throw new Error('No suggestion on show.');
    return { taskId: task.id, suggestionId: suggestion.id };
  };
  const drafted = made('retro-before-complete', (records) => {
    const review = reviewOf(records);
    return review.retro?.improvement?.criterionId === undefined
      ? [operations.draftCriterion({ sprintId: review.id, policy: POLICY })]
      : [];
  });
  const completed = made('retro-before-complete', (records) => {
    const review = reviewOf(records);
    return [
      ...(review.criterionUse !== undefined &&
      review.criterionUse.retroDecision === undefined
        ? [operations.decideCriterion({ sprintId: review.id, decision: 'end' })]
        : []),
      operations.completeRetro({ sprintId: review.id }),
    ];
  });
  const adopted = made('backlog-detail', (records) => [
    operations.adoptSuggestion({ ...presentedOf(records), bound: 'hi' }),
  ]);
  const rejected = made('backlog-detail', (records) => [
    operations.rejectSuggestion(presentedOf(records)),
  ]);
  const archived = made('backlog-detail', (records) => [
    operations.archiveArea({ areaId: records.areas[0]!.id }),
  ]);
  const excluded = made('planning-pick', (records) => {
    const planning = records.sprints.find((s) => s.state === 'planning');
    const occurrenceId = planning?.tasks.find(
      (t) => t.occurrenceIds !== undefined,
    )?.occurrenceIds?.[0];
    if (planning === undefined || occurrenceId === undefined)
      throw new Error('No occurrence in the plan.');
    return [
      operations.setOccurrenceIncluded({
        sprintId: planning.id,
        occurrenceId,
        included: false,
      }),
    ];
  });
  // A rule ended (F41): until its last day the Task, off it, can be made
  // recurring again from the next Sprint (owner decision in #323).
  const ended = made('backlog-recurrence', (records) => {
    const task = records.tasks.find(
      (t) =>
        t.recurrenceRuleId !== undefined &&
        records.occurrences.some((o) => o.ruleId === t.recurrenceRuleId),
    );
    if (task === undefined) throw new Error('No recurring Task.');
    return [operations.endRecurrence({ taskId: task.id })];
  });
  // The last day of the running Sprint, after the system's catch-up.
  const today = fixtureSnapshot('today-interrupt');
  const running = today.records.sprints.find((s) => s.state === 'active');
  if (running === undefined) throw new Error('No running Sprint.');
  const lastDay = memoryStore({
    ...today,
    clock: {
      today: running.end,
      now: `${running.end}T03:00:00.000Z` as StoreSnapshot['clock']['now'],
    },
  });
  const caughtUp = lastDay.run(catchUp(today.clock.today), {
    actor: 'system',
  });
  if (!caughtUp.ok) throw new Error(caughtUp.error.message);
  return [
    ['retro-before-complete, with a draft criterion', drafted],
    ['retro-before-complete, completed', completed],
    ['backlog-detail, a suggestion adopted', adopted],
    ['backlog-detail, a suggestion rejected', rejected],
    ['backlog-detail, an Area archived', archived],
    ['planning-pick, an occurrence left out', excluded],
    ['backlog-recurrence, a rule ended', ended],
    ['today-interrupt, on the last day', lastDay.getSnapshot()],
  ];
}

const STATES: [string, StoreSnapshot][] = [
  ...fixtureStateIds.map((state): [string, StoreSnapshot] => [
    state,
    fixtureSnapshot(state),
  ]),
  ...madeStates(),
];

describe('capabilities of the other records agree with the operations (#323)', () => {
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

  it('lets a Task whose rule ends be made recurring again (owner decision in #323)', () => {
    const [, snapshot] = STATES.find(([name]) => name.endsWith('rule ended'))!;
    const read = tagged(snapshot.records);
    const offRule = Object.values(
      backlogData(read, snapshot.clock, {}).items,
    ).filter(
      (item) =>
        item.recurrence?.endsOn !== undefined &&
        item.task.recurrenceRuleId === undefined,
    );
    expect(offRule.length).toBeGreaterThan(0);
    for (const item of offRule)
      expect(item.capabilities).toMatchObject({
        canSetRecurrence: true,
        canEndRecurrence: false,
      });
  });

  // The domain tells a Task that does not repeat from one with no
  // occurrences left by `occurrenceIds` being there (ADR 0007).
  it('lets only a recurring draft leave by all of its occurrences (#346)', () => {
    const planned = (recurring: boolean) =>
      all.filter(
        (t) =>
          t.kind === 'sprintTask' &&
          t.recurring === recurring &&
          t.where.startsWith('sprintTask plan '),
      );
    expect(planned(false).length).toBeGreaterThan(0);
    for (const t of planned(false))
      expect([t.where, t.capabilities]).toEqual([
        t.where,
        expect.objectContaining({ canExcludeAllOccurrences: false }),
      ]);
    expect(
      planned(true).some(
        (t) =>
          (t.capabilities as SprintTaskCapabilities).canExcludeAllOccurrences,
      ),
    ).toBe(true);
  });

  it('covers every kind of record', () => {
    expect(new Set(all.map((t) => t.kind))).toEqual(
      new Set([
        'task',
        'suggestion',
        'subtask',
        'area',
        'sprint',
        'goal',
        'sprintTask',
        'candidate',
        'occurrence',
        'pastDay',
        'retro',
        'criterionUse',
        'criterion',
      ]),
    );
  });

  // The operations a record's state does not decide: the record is always
  // open to them (their values are checked when given). And those of the
  // Backlog's Tasks, which are all active: any can be archived, and made
  // recurring or given another rule (an ended rule is off its Task, F41).
  const ALWAYS = new Set([
    'task canSave',
    'task canAddSubtask',
    'subtask canUpdate',
    'area canRename',
    'task canArchive',
    'task canSetRecurrence',
  ]);

  it('answers each `can…` both ways somewhere, so that none is checked for nothing', () => {
    const answers = new Map<string, Set<boolean>>();
    for (const t of all)
      for (const [name, can] of Object.entries(t.capabilities)) {
        const key = `${t.kind} ${name}`;
        // A past day's record has the capabilities of a choice, which #322
        // answers both ways (capabilities.test.ts); here, that they agree.
        if (t.kind === 'pastDay') continue;
        answers.set(key, (answers.get(key) ?? new Set()).add(can as boolean));
      }
    expect(
      [...answers]
        .map(([key, seen]) => [key, [...seen].toSorted()] as const)
        .filter(
          ([key, seen]) =>
            seen.length !== (ALWAYS.has(key) ? 1 : 2) ||
            (ALWAYS.has(key) && seen[0] !== true),
        ),
    ).toEqual([]);
  });
});
