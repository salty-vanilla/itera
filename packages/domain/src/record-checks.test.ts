// The checks of the commands besides Today's (#323, as today-checks.test.ts
// for those, #322): each says what its command would say of the records,
// apart from the values it is given, so that a read can tell what the
// person can do with a Task, an Area, a suggestion, a criterion, a Sprint,
// its SprintTasks, occurrences and Retro from the rule the command keeps
// (ADR 0007 操作の可否). Against the state diagrams of the domain model
// (Task, SprintTask, Occurrence, EstimateSuggestion, PlanningCriterion,
// Sprint) and invariants 11, 12, 14, 26, 33, 35, 36, F21, F22, F40, F41.
import { describe, expect, it } from 'vitest';
import {
  archiveArea,
  checkArchiveArea,
  checkRenameArea,
  checkRestoreArea,
  renameArea,
  restoreArea,
  type Area,
} from './area';
import {
  checkSetDraftPolicy,
  setDraftPolicy,
  type CriterionState,
  type PlanningCriterion,
} from './criterion';
import {
  adoptSuggestion,
  checkAdoptSuggestion,
  checkRejectSuggestion,
  checkUndoAdoption,
  checkUndoRejection,
  rejectSuggestion,
  undoAdoption,
  undoRejection,
  type EstimateSuggestion,
  type SuggestionState,
} from './estimate';
import {
  addTaskMidSprint,
  checkAddTaskMidSprint,
  checkUndoAddTaskMidSprint,
  undoAddTaskMidSprint,
} from './mid-sprint';
import {
  checkExcludeOccurrence,
  checkIncludeOccurrence,
  excludeOccurrence,
  includeOccurrence,
  type Occurrence,
  type OccurrenceState,
} from './occurrence';
import {
  checkConfirmSprint,
  checkSelectTask,
  checkSetAvailableHours,
  checkSetGoalLink,
  checkSetGoalText,
  checkUnselectTask,
  confirmSprint,
  selectTask,
  setAvailableHours,
  setGoalLink,
  setGoalText,
  unselectTask,
  checkExcludeFromPlan,
  checkIncludeInPlan,
  excludeFromPlan,
  includeInPlan,
} from './planning';
import {
  checkCompleteRetro,
  checkDecideCriterion,
  checkDraftCriterion,
  checkDropCriterionDraft,
  checkEnterReview,
  checkSetReflection,
  completeRetro,
  decideCriterion,
  draftCriterion,
  dropCriterionDraft,
  enterReview,
  setReflection,
  assessGoal,
  checkAssessGoal,
  checkPinFact,
  checkSetImprovement,
  checkUnpinFact,
  pinFact,
  setImprovement,
  unpinFact,
} from './review';
import { id } from './shared/ids';
import type { Result } from './shared/result';
import { addDays, instant, localDate } from './shared/time';
import type { Sprint, SprintState, SprintTask } from './sprint';
import {
  archiveTask,
  checkArchiveTask,
  checkRestoreTask,
  restoreTask,
  type Task,
  type TaskLifecycle,
  addSubtask,
  checkAddSubtask,
  checkUpdateSubtask,
  checkUpdateTask,
  setSubtaskDone,
  updateTask,
} from './task';
import {
  ctx,
  ids,
  newTask,
  research,
  sprintFixture,
  user,
  userId,
} from './testing';
import {
  addToToday,
  checkAddToToday,
  checkCompleteFromBacklog,
  checkRecordActualTime,
  completeFromBacklog,
  recordActualTime,
} from './today';
import {
  checkChangeRuleForNextSprint,
  checkCreateRuleForNextSprint,
  checkEndRuleForNextSprint,
  changeRuleForNextSprint,
  createRuleForNextSprint,
  endRuleForNextSprint,
} from './sprint-recurrence';
import type { RecurrenceRule } from './recurrence';

/**
 * The check and its command agree: both go through, or both are refused
 * with the same code.
 */
function agree(check: Result<unknown>, run: Result<unknown>) {
  expect(check.ok).toBe(run.ok);
  if (!check.ok && !run.ok) expect(check.error.code).toBe(run.error.code);
}

const LIFECYCLES: readonly TaskLifecycle[] = [
  'active',
  'completed',
  'archived',
];
const SPRINT_STATES: readonly SprintState[] = [
  'planning',
  'active',
  'review',
  'closed',
];

function taskIn(lifecycle: TaskLifecycle): Task {
  return { ...newTask(), lifecycle };
}

describe('Task (state diagram: Task)', () => {
  it.each(LIFECYCLES)('archive and restore a %s Task', (lifecycle) => {
    const task = taskIn(lifecycle);
    agree(checkArchiveTask(task), archiveTask(task, ctx));
    agree(checkRestoreTask(task), restoreTask(task, ctx));
  });

  it.each(LIFECYCLES)(
    'completes a %s one-off Task from the Backlog, with no day in a Sprint',
    (lifecycle) => {
      const task = taskIn(lifecycle);
      const sprint = sprintFixture('2026-09-28', 'active');
      const input = {
        task,
        date: localDate('2026-09-30'),
        selectionId: id<'DailySelection'>('sel-1'),
      };
      agree(
        checkCompleteFromBacklog(sprint, input),
        completeFromBacklog(sprint, input, ctx),
      );
    },
  );
});

describe('Area', () => {
  it.each([false, true])('archived: %s', (archived) => {
    const area: Area = { ...research, archived };
    agree(checkRenameArea(), renameArea(area, '新しい名前', ctx));
    agree(checkArchiveArea(area), archiveArea(area, ctx));
    agree(checkRestoreArea(area), restoreArea(area, ctx));
  });
});

describe('EstimateSuggestion (state diagram, F27, F30)', () => {
  const suggestion = (
    n: number,
    state: SuggestionState,
  ): EstimateSuggestion => ({
    id: id<'EstimateSuggestion'>(`sug-${n}`),
    lo: 2,
    hi: 4,
    rationale: '',
    uncertainties: [],
    createdAt: ctx.now,
    state,
  });
  const STATES: readonly SuggestionState[] = [
    'presented',
    'adopted',
    'rejected',
    'replaced',
  ];
  const cases = STATES.flatMap((state) =>
    [false, true].map((another) => ({ state, another })),
  );

  it.each(cases)(
    'a $state suggestion, another on show: $another',
    ({ state, another }) => {
      const first = suggestion(1, state);
      const task: Task = {
        ...newTask(),
        suggestions: [first, ...(another ? [suggestion(2, 'presented')] : [])],
        // An adopted suggestion is the Estimate's source while it stands.
        ...(state === 'adopted'
          ? {
              estimate: {
                hours: 4,
                setAt: ctx.now,
                source: {
                  kind: 'adopted' as const,
                  suggestionId: first.id,
                  bound: 'hi' as const,
                },
              },
            }
          : {}),
      };
      agree(
        checkAdoptSuggestion(task, first.id),
        adoptSuggestion(task, first.id, 'hi', ctx),
      );
      agree(
        checkUndoAdoption(task, first.id),
        undoAdoption(task, { suggestionId: first.id, previous: null }, ctx),
      );
      agree(
        checkRejectSuggestion(task, first.id),
        rejectSuggestion(task, first.id, ctx),
      );
      agree(
        checkUndoRejection(task, first.id),
        undoRejection(task, first.id, ctx),
      );
    },
  );
});

describe('PlanningCriterion (state diagram)', () => {
  const STATES: readonly CriterionState[] = [
    'draft',
    'active',
    'ended',
    'replaced',
  ];
  it.each(STATES)('sets the policy of a %s criterion', (state) => {
    const criterion: PlanningCriterion = {
      id: id<'PlanningCriterion'>('crit-1'),
      userId,
      policy: { scope: { kind: 'all' }, rangePolicy: 'hi' },
      sourceSprintId: id<'Sprint'>('sprint-1'),
      state,
      createdAt: ctx.now,
    };
    agree(
      checkSetDraftPolicy(criterion),
      setDraftPolicy(criterion, criterion.policy, ctx),
    );
  });
});

describe('Occurrence (state diagram)', () => {
  const STATES: readonly OccurrenceState[] = [
    'pending',
    'excluded',
    'done',
    'skipped',
    'missed',
  ];
  it.each(STATES)('excludes and includes a %s occurrence', (state) => {
    const occurrence: Occurrence = {
      id: id<'Occurrence'>('occ-1'),
      taskId: id<'Task'>('task-1'),
      ruleId: id<'RecurrenceRule'>('rule-1'),
      scheduledDate: localDate('2026-09-30'),
      ruleVersion: 1,
      materializedAt: ctx.now,
      state,
      stateChangedAt: ctx.now,
    };
    agree(
      checkExcludeOccurrence(occurrence),
      excludeOccurrence(occurrence, ctx),
    );
    agree(
      checkIncludeOccurrence(occurrence),
      includeOccurrence(occurrence, ctx),
    );
  });
});

describe('Sprint (state diagram: Sprint, SprintTask)', () => {
  const task = newTask();
  const draft: SprintTask = {
    id: id<'SprintTask'>('st-1'),
    taskId: task.id,
    origin: 'planning',
    addedAt: ctx.now,
    goalLink: 'linked',
    outcome: 'draft',
  };

  it.each(SPRINT_STATES)('in %s: hours, Goals and links', (state) => {
    const sprint = sprintFixture('2026-09-28', state, { tasks: [draft] });
    agree(
      checkSetAvailableHours(sprint),
      setAvailableHours(sprint, { hours: 20 }, ctx),
    );
    agree(
      checkSetGoalText(sprint),
      setGoalText(sprint, { areaId: research.id, text: '目標' }, ctx),
    );
    const link = { sprintTaskId: draft.id, task };
    agree(
      checkSetGoalLink(sprint, link),
      setGoalLink(sprint, { ...link, goalLink: 'unlinked' }, ctx),
    );
  });

  it.each(SPRINT_STATES)(
    'in %s: a Task joins and leaves (invariant 14, F40)',
    (state) => {
      const empty = sprintFixture('2026-09-28', state);
      const other = newTask('ほかの Task', 'task-2');
      agree(
        checkSelectTask(empty, { task: other }),
        selectTask(
          empty,
          { sprintTaskId: id<'SprintTask'>('st-2'), task: other },
          ctx,
        ),
      );
      agree(
        checkAddTaskMidSprint(empty, { task: other }),
        addTaskMidSprint(
          empty,
          {
            sprintTaskId: id<'SprintTask'>('st-2'),
            task: other,
            areas: [],
            via: 'backlog',
          },
          ctx,
        ),
      );
      const withDraft = sprintFixture('2026-09-28', state, { tasks: [draft] });
      agree(
        checkUnselectTask(withDraft, draft.id),
        unselectTask(withDraft, draft.id, ctx),
      );
      const added: SprintTask = {
        ...draft,
        origin: 'midSprint',
        outcome: 'planned',
      };
      const withAdded = sprintFixture('2026-09-28', state, { tasks: [added] });
      agree(
        checkUndoAddTaskMidSprint(withAdded, { sprintTaskId: added.id }),
        undoAddTaskMidSprint(withAdded, { sprintTaskId: added.id }, ctx),
      );
    },
  );

  it.each(SPRINT_STATES)(
    'confirms a Sprint after one that is %s (invariant 12)',
    (state) => {
      const previous = sprintFixture('2026-09-21', state);
      const sprint = sprintFixture('2026-09-28', 'planning', {
        previousSprintId: previous.id,
        tasks: [draft],
      });
      const input = {
        sprints: [previous, sprint],
        tasks: [task],
        areas: [],
        applyCriterion: false,
      };
      agree(
        checkConfirmSprint(sprint, input),
        confirmSprint(sprint, input, ctx),
      );
    },
  );

  it.each(LIFECYCLES)(
    'confirms a Sprint with a chosen Task that is %s',
    (lifecycle) => {
      const sprint = sprintFixture('2026-09-28', 'planning', {
        tasks: [draft],
      });
      const input = {
        sprints: [sprint],
        tasks: [{ ...task, lifecycle }],
        areas: [],
        applyCriterion: false,
      };
      agree(
        checkConfirmSprint(sprint, input),
        confirmSprint(sprint, input, ctx),
      );
    },
  );

  const days = [-1, 0, 1].map((n) => addDays(localDate('2026-10-04'), n));
  const reviewCases = SPRINT_STATES.flatMap((state) =>
    days.flatMap((today) =>
      (['user', 'system'] as const).map((actor) => ({ state, today, actor })),
    ),
  );
  it.each(reviewCases)(
    'Retro starts on $today by the $actor of a $state Sprint (F21)',
    ({ state, today, actor }) => {
      const sprint = sprintFixture('2026-09-28', state);
      const input = { today, occurrences: [] };
      agree(
        checkEnterReview(sprint, input, actor),
        enterReview(sprint, input, { ...ctx, actor }),
      );
    },
  );
});

describe('Retro (invariants 35, 36, 38)', () => {
  const retroOf = (
    state: SprintState,
    extra: Partial<Sprint> = {},
    improvement?: NonNullable<Sprint['retro']>['improvement'],
  ) =>
    sprintFixture('2026-09-28', state, {
      retro: {
        startedAt: instant('2026-10-05T00:00:00.000Z'),
        pins: [],
        reflection: '',
        ...(improvement === undefined ? {} : { improvement }),
      },
      ...extra,
    });
  const criterionId = id<'PlanningCriterion'>('crit-1');
  const draft: PlanningCriterion = {
    id: criterionId,
    userId,
    policy: { scope: { kind: 'all' }, rangePolicy: 'hi' },
    sourceSprintId: id<'Sprint'>('sprint-2026-09-28'),
    state: 'draft',
    createdAt: ctx.now,
  };
  const improvements = [
    undefined,
    { text: '多めに見積もる' },
    { text: '多めに見積もる', criterionId },
  ];
  const cases = SPRINT_STATES.flatMap((state) =>
    improvements.map((improvement) => ({ state, improvement })),
  );

  it.each(cases)(
    'in $state, improvement $improvement',
    ({ state, improvement }) => {
      const sprint = retroOf(state, {}, improvement);
      agree(
        checkSetReflection(sprint),
        setReflection(sprint, { text: '気づき' }, ctx),
      );
      agree(
        checkDraftCriterion(sprint),
        draftCriterion(
          sprint,
          {
            criterionId: id<'PlanningCriterion'>('crit-2'),
            policy: draft.policy,
          },
          ctx,
        ),
      );
      agree(checkDropCriterionDraft(sprint), dropCriterionDraft(sprint, ctx));
      const criteria = improvement?.criterionId === undefined ? [] : [draft];
      agree(
        checkCompleteRetro(sprint, { criteria }),
        completeRetro(sprint, { criteria }, ctx),
      );
    },
  );

  const active: PlanningCriterion = {
    ...draft,
    id: id<'PlanningCriterion'>('crit-0'),
    state: 'active',
  };
  const decisions = [undefined, 'continue', 'end', 'replace'] as const;
  const decided = decisions.flatMap((retroDecision) =>
    [false, true].map((withDraft) => ({ retroDecision, withDraft })),
  );
  it.each(decided)(
    'with a criterion decided $retroDecision, a draft: $withDraft',
    ({ retroDecision, withDraft }) => {
      const sprint = retroOf(
        'review',
        {
          criterionUse: {
            criterionId: active.id,
            appliedAtConfirm: true,
            ...(retroDecision === undefined ? {} : { retroDecision }),
          },
        },
        withDraft ? { text: '多めに見積もる', criterionId } : undefined,
      );
      agree(
        checkDecideCriterion(sprint),
        decideCriterion(sprint, { decision: 'end' }, ctx),
      );
      const criteria = withDraft ? [active, draft] : [active];
      agree(
        checkCompleteRetro(sprint, { criteria }),
        completeRetro(sprint, { criteria }, ctx),
      );
    },
  );
});

describe('Task: its attributes and subtasks, whatever its state', () => {
  it.each(LIFECYCLES)('a %s Task', (lifecycle) => {
    const task = {
      ...taskIn(lifecycle),
      subtasks: [{ id: id<'Subtask'>('sub-1'), title: '下調べ', done: false }],
    };
    agree(checkUpdateTask(), updateTask(task, { title: '新しい題' }, ctx));
    agree(
      checkAddSubtask(),
      addSubtask(task, { id: id<'Subtask'>('sub-2'), title: '確かめる' }, ctx),
    );
    for (const subtaskId of ['sub-1', 'sub-none'].map((s) => id<'Subtask'>(s)))
      agree(
        checkUpdateSubtask(task, subtaskId),
        setSubtaskDone(task, subtaskId, true, ctx),
      );
  });
});

describe('Recurrence from the next Sprint (F1, F7, F15, F41)', () => {
  const ruleId = id<'RecurrenceRule'>('rule-1');
  const rule = (ended: boolean): RecurrenceRule => ({
    id: ruleId,
    taskId: id<'Task'>('task-1'),
    versions: [
      {
        version: 1,
        pattern: { freq: 'weekly', daysOfWeek: [6] },
        effectiveFrom: localDate('2026-09-21'),
        ...(ended ? { effectiveTo: localDate('2026-10-04') } : {}),
      },
    ],
  });
  const context = {
    user,
    today: localDate('2026-09-30'),
    sprints: [sprintFixture('2026-09-28', 'active')],
    occurrences: [],
    newOccurrenceId: ids<'Occurrence'>('occ'),
    newSprintTaskId: ids<'SprintTask'>('st'),
  };
  const cases = LIFECYCLES.flatMap((lifecycle) =>
    (['none', 'running', 'ended'] as const).map((has) => ({ lifecycle, has })),
  );
  it.each(cases)('a $lifecycle Task, its rule $has', ({ lifecycle, has }) => {
    const base = taskIn(lifecycle);
    const task = has === 'none' ? base : { ...base, recurrenceRuleId: ruleId };
    agree(
      checkCreateRuleForNextSprint(task),
      createRuleForNextSprint(
        { ...context, task, ruleId, pattern: { freq: 'daily' } },
        ctx,
      ),
    );
    if (has === 'none') return;
    const input = { ...context, task, rule: rule(has === 'ended') };
    agree(
      checkChangeRuleForNextSprint(input),
      changeRuleForNextSprint({ ...input, pattern: { freq: 'daily' } }, ctx),
    );
    agree(checkEndRuleForNextSprint(input), endRuleForNextSprint(input, ctx));
  });
});

describe('Today: 今日へ from outside the Sprint and actual time (invariant 26, F22)', () => {
  const days = ['2026-09-27', '2026-09-30', '2026-10-05'].map(localDate);
  const cases = SPRINT_STATES.flatMap((state) =>
    days.map((date) => ({ state, date })),
  );
  it.each(cases)('a $state Sprint, on $date', ({ state, date }) => {
    const task = newTask();
    const sprint = sprintFixture('2026-09-28', state);
    agree(
      checkAddToToday(sprint, { task, date }),
      addToToday(
        sprint,
        {
          task,
          date,
          sprintTaskId: id<'SprintTask'>('st-1'),
          selectionId: id<'DailySelection'>('sel-1'),
          areas: [],
          via: 'backlogToToday',
        },
        ctx,
      ),
    );
    const planned: SprintTask = {
      id: id<'SprintTask'>('st-1'),
      taskId: task.id,
      origin: 'planning',
      addedAt: ctx.now,
      goalLink: 'linked',
      outcome: 'planned',
    };
    const withTask = sprintFixture('2026-09-28', state, { tasks: [planned] });
    for (const sprintTaskId of [planned.id, id<'SprintTask'>('st-none')])
      agree(
        checkRecordActualTime(withTask, { sprintTaskId }),
        recordActualTime(
          withTask,
          { sprintTaskId, date: localDate('2026-09-30'), hours: 1 },
          ctx,
        ),
      );
  });
});

describe('Planning: occurrences (invariant 33)', () => {
  const STATES: readonly OccurrenceState[] = ['pending', 'excluded', 'done'];
  const cases = SPRINT_STATES.flatMap((sprintState) =>
    STATES.map((state) => ({ sprintState, state })),
  );
  it.each(cases)(
    'a $state occurrence of a $sprintState Sprint',
    ({ sprintState, state }) => {
      const task = newTask();
      const occurrence: Occurrence = {
        id: id<'Occurrence'>('occ-1'),
        taskId: task.id,
        ruleId: id<'RecurrenceRule'>('rule-1'),
        scheduledDate: localDate('2026-09-30'),
        ruleVersion: 1,
        materializedAt: ctx.now,
        state,
        stateChangedAt: ctx.now,
      };
      const sprint = sprintFixture('2026-09-28', sprintState, {
        tasks: [
          {
            id: id<'SprintTask'>('st-1'),
            taskId: task.id,
            origin: 'planning',
            addedAt: ctx.now,
            goalLink: 'unlinked',
            outcome: 'draft',
            occurrenceIds: [occurrence.id],
          },
        ],
      });
      agree(
        checkExcludeFromPlan(sprint, occurrence),
        excludeFromPlan(sprint, occurrence, ctx),
      );
      agree(
        checkIncludeInPlan(sprint, { occurrence, task }),
        includeInPlan(
          sprint,
          { occurrence, task, sprintTaskId: id<'SprintTask'>('st-2') },
          ctx,
        ),
      );
    },
  );
});

describe('Confirm while another Sprint is active (invariant 11)', () => {
  it('is refused, the previous one closed', () => {
    const previous = sprintFixture('2026-09-14', 'closed');
    const active = sprintFixture('2026-09-21', 'active');
    const sprint = sprintFixture('2026-09-28', 'planning', {
      previousSprintId: previous.id,
    });
    const input = {
      sprints: [previous, active, sprint],
      tasks: [],
      areas: [],
      applyCriterion: false,
    };
    const checked = checkConfirmSprint(sprint, input);
    expect(checked.ok).toBe(false);
    agree(checked, confirmSprint(sprint, input, ctx));
  });
});

describe('Retro: Goals, pins and the improvement (invariants 19, 38, 40)', () => {
  const cases = SPRINT_STATES.flatMap((state) =>
    [false, true].map((goal) => ({ state, goal })),
  );
  it.each(cases)('in $state, a Goal: $goal', ({ state, goal }) => {
    const sprint = sprintFixture('2026-09-28', state, {
      goals: goal ? [{ areaId: research.id, text: '目標' }] : [],
      ...(state === 'review' || state === 'closed'
        ? {
            retro: {
              startedAt: instant('2026-10-05T00:00:00.000Z'),
              pins: [],
              reflection: '',
            },
          }
        : {}),
    });
    agree(
      checkAssessGoal(sprint, { areaId: research.id }),
      assessGoal(sprint, { areaId: research.id, assessment: 'achieved' }, ctx),
    );
    const pin = { kind: 'availableHours' as const };
    agree(checkPinFact(sprint), pinFact(sprint, { pin }, ctx));
    agree(checkUnpinFact(sprint), unpinFact(sprint, { pin }, ctx));
    agree(
      checkSetImprovement(sprint),
      setImprovement(sprint, { text: '多めに見積もる' }, ctx),
    );
  });
});
