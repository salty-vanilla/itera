// What the Backlog shows, derived from the records by `@itera/domain`. The
// screen reads it through `useBacklog`; nothing here is stored.
import {
  backlogView,
  carryOverOf,
  endingRuleOf,
  inBacklogSlice,
  isCounted,
  planningValueOf,
  projectFrom,
  recurrenceOf,
  recurrenceSummary,
  renewedRecurrenceSummary,
  sprintNumber,
  versionOn,
  type AreaColor,
  type AreaId,
  type BacklogSlice,
  type DailySelectionId,
  type EstimateSuggestionId,
  type Instant,
  type LocalDate,
  type PlanningValue,
  type RecurrencePattern,
  type RecurrenceRule,
  type RecurrenceRuleVersion,
  type RecurrenceSummary,
  type SprintTask,
  type SubtaskId,
  type TaskId,
} from '@itera/domain';
import {
  selectionCapabilities,
  subtaskCapabilities,
  suggestionCapabilities,
  taskCapabilities,
  type DailySelectionCapabilities,
  type EstimateSuggestionCapabilities,
  type SubtaskCapabilities,
  type TaskCapabilities,
} from './capabilities';
import type { Clock, Records } from './records';
import { nextWeekSprintOf, thisWeekSprintOf } from './sprint-choice';
import { isLastDay, opensOn } from './sprint-day';
import { activeSprint } from './task-changes';
import {
  isClosedResolution,
  isListedResolution,
  type ClosedResolution,
  type ListedResolution,
} from './today-view';
import { taggedIn, type TaggedRecords, type TaggedTask } from './versions';

export interface BacklogItem {
  readonly task: TaggedTask;
  /** The Area's current name (the Backlog shows current names, F5). */
  readonly area?: { readonly name: string; readonly color: AreaColor };
  /** 持ち越し N回（Sprint M から）(F25, F26). */
  readonly carry?: { readonly count: number; readonly fromSprint: number };
  readonly recurrence?: RecurrenceSummary;
  /**
   * The rule's pattern today and its latest version, for the editor, and
   * the etag of the rule (#330): a change to the Task's own rule is made
   * from it. A rule that has come off the Task (F41) is shown, but a
   * change makes a new one, from none. Until its last day the pattern
   * today is that rule's, also once the Task has a new one (#338).
   */
  readonly rule?: {
    readonly current: RecurrencePattern;
    readonly latest: RecurrencePattern;
    readonly etag: string;
  };
  /**
   * In this week's Sprint: 「今週」, and 「週の途中で追加」 if mid-Sprint.
   * `confirmed` is false while that Sprint is still being planned.
   */
  readonly thisWeek?: {
    readonly midSprint: boolean;
    readonly confirmed: boolean;
  };
  /**
   * In the draft for next week (「来週」, #90): chosen while this week runs.
   * It may also be in this week's (`thisWeek`); the row says both (#150).
   */
  readonly nextWeek?: true;
  /**
   * In today's 今日やる (a selection made today that is open, done or
   * skipped: what Today lists there). The Backlog row says 「今日」 instead
   * of 「今週」 (Issue #94), and the detail offers the day's operations.
   * A Task chosen today and then closed (中断, 見送り, 今週の残りに戻した) is
   * back among the week's, so it has none.
   */
  readonly today?: {
    readonly selectionId: DailySelectionId;
    readonly resolution: ListedResolution;
    readonly startedAt?: Instant;
    /** An occurrence of a recurring Task: it can be skipped (F19). */
    readonly recurring: boolean;
    /** What the person can do with the selection now (#322). */
    readonly capabilities: DailySelectionCapabilities;
  };
  /**
   * Chosen today and closed for the day (中断, 見送り, 今週の残りに戻した): it
   * is among the week's remaining again, and the detail says what happened.
   */
  readonly closedToday?: ClosedResolution;
  /** The Task's own time: Estimate, suggestion, subtask sum or none. */
  readonly value: PlanningValue;
  /** The Task's own Estimate, for choosing it as the time basis in the detail. */
  readonly taskValue: PlanningValue;
  /** The subtask sum, for choosing it as the time basis in the detail. */
  readonly subtaskValue: PlanningValue;
  /**
   * 今日へ waits for the Sprint's first day (#59): the Sprint is confirmed
   * but has not started, so there is no day to choose on yet. Given while
   * the Task can join the Sprint (今週へ) but not today.
   */
  readonly todayOpensOn?: {
    readonly number: number;
    readonly start: LocalDate;
  };
  /** What the person can do with the Task now (#323). */
  readonly capabilities: TaskCapabilities;
  /** What the person can do with each of its suggestions, by ID (#323). */
  readonly suggestionCapabilities: Readonly<
    Record<EstimateSuggestionId, EstimateSuggestionCapabilities>
  >;
  /** What the person can do with each of its subtasks, by ID (#323). */
  readonly subtaskCapabilities: Readonly<
    Record<SubtaskId, SubtaskCapabilities>
  >;
}

/**
 * The row's recurrence and the detail's rule. A Task made recurring again
 * before the rule it ended has had its last day repeats by that one this
 * week, and by its own from the day it begins, as one rule changed (#338).
 */
function recurrenceOfItem(
  rule: RecurrenceRule,
  latest: RecurrenceRuleVersion,
  ending: RecurrenceRule | undefined,
  records: TaggedRecords,
  clock: Clock,
): Pick<BacklogItem, 'recurrence' | 'rule'> {
  const options = {
    today: clock.today,
    projectFrom: projectFrom(records.sprints, clock.today),
  };
  const recurrence =
    ending === undefined
      ? recurrenceSummary(rule, records.occurrences, options)
      : renewedRecurrenceSummary(ending, rule, records.occurrences, options);
  return {
    recurrence,
    rule: {
      current:
        ending === undefined
          ? (versionOn(rule, clock.today) ?? latest).pattern
          : recurrence.pattern,
      latest: latest.pattern,
      etag: taggedIn(records.rules)(rule).etag,
    },
  };
}

export function backlogItem(
  task: TaggedTask,
  records: TaggedRecords,
  clock: Clock,
): BacklogItem {
  const area = records.areas.find((a) => a.id === task.areaId);
  const carry = carryOverOf(task.id, records.sprints);
  const carryFrom = records.sprints.find((s) => s.id === carry?.fromSprintId);
  // An ended rule is shown until its last day (F41), also once the Task has
  // a rule of its own again, which begins after it (#338).
  const rule = recurrenceOf(task, records.rules, clock.today);
  const ending =
    task.recurrenceRuleId === undefined
      ? undefined
      : endingRuleOf(task, records.rules, clock.today);
  // 「今週」: the active one, or, before one is confirmed, the one being
  // planned (Scenario A step 3); a draft for next week is 「来週」 (#90).
  const week = thisWeekSprintOf(records, clock);
  const inWeek: SprintTask | undefined = week?.tasks.find(
    (t) => t.taskId === task.id && isCounted(t),
  );
  const inNextWeek = nextWeekSprintOf(records, clock)?.tasks.some(
    (t) => t.taskId === task.id && isCounted(t),
  );
  const active = activeSprint(records);
  const latest = rule?.versions.at(-1);
  const capabilities = taskCapabilities(records, task, clock);
  const firstDay =
    active === undefined ? undefined : opensOn(active, clock.today);
  // Today's selections of this Task (of its occurrences, if recurring).
  const todays =
    active?.dailySelections.filter(
      (s) =>
        s.date === clock.today &&
        active.tasks.some(
          (t) =>
            t.id === s.sprintTaskId &&
            t.taskId === task.id &&
            t.outcome !== 'removed',
        ),
    ) ?? [];
  const chosen = todays
    .filter((s) => isListedResolution(s.resolution))
    // What can still be done comes first: the detail acts on that one.
    .toSorted(
      (a, b) =>
        Number(b.resolution === 'selected' || b.resolution === 'started') -
        Number(a.resolution === 'selected' || a.resolution === 'started'),
    )
    .at(0);
  const closed = todays.findLast((s) => isClosedResolution(s.resolution));
  return {
    task,
    ...(area === undefined
      ? {}
      : { area: { name: area.name, color: area.color } }),
    ...(carry === undefined || carryFrom === undefined
      ? {}
      : {
          carry: {
            count: carry.count,
            fromSprint: sprintNumber(carryFrom, records.sprints),
          },
        }),
    ...(rule === undefined || latest === undefined
      ? {}
      : recurrenceOfItem(rule, latest, ending, records, clock)),
    ...(inWeek === undefined
      ? {}
      : {
          thisWeek: {
            midSprint: inWeek.origin === 'midSprint',
            confirmed: week?.state === 'active',
          },
        }),
    ...(inNextWeek === true ? { nextWeek: true as const } : {}),
    ...(active === undefined ||
    chosen === undefined ||
    !isListedResolution(chosen.resolution)
      ? {}
      : {
          today: {
            selectionId: chosen.id,
            resolution: chosen.resolution,
            ...(chosen.startedAt === undefined
              ? {}
              : { startedAt: chosen.startedAt }),
            recurring: chosen.occurrenceId !== undefined,
            capabilities: selectionCapabilities(
              records,
              active,
              chosen,
              clock.today,
            ),
          },
        }),
    ...(chosen !== undefined ||
    closed === undefined ||
    !isClosedResolution(closed.resolution)
      ? {}
      : { closedToday: closed.resolution }),
    value: planningValueOf(task, { now: clock.now }),
    taskValue: planningValueOf(
      { ...task, timeBasis: 'task' },
      { now: clock.now },
    ),
    subtaskValue: planningValueOf(
      { ...task, timeBasis: 'subtasks' },
      { now: clock.now },
    ),
    ...(active !== undefined &&
    firstDay !== undefined &&
    capabilities.canAddToWeek &&
    !capabilities.canAddToToday
      ? {
          todayOpensOn: {
            number: sprintNumber(active, records.sprints),
            start: firstDay,
          },
        }
      : {}),
    capabilities,
    suggestionCapabilities: suggestionCapabilities(task),
    subtaskCapabilities: subtaskCapabilities(task),
  };
}

export interface BacklogFilter {
  readonly view?: BacklogSlice | undefined;
  readonly area?: AreaId | undefined;
}

export const SLICES: readonly (BacklogSlice | 'all')[] = [
  'all',
  'dueSoon',
  'overdue',
  'carriedOver',
  'recurring',
  'noArea',
];

export interface BacklogData {
  readonly today: LocalDate;
  /**
   * Today is the last day of the active Sprint (the same value as Today's
   * `lastDay`). What is closed for the day does not come back to 今週の残り
   * tomorrow: the detail says so (#314).
   */
  readonly lastDay: boolean;
  readonly timeZone: Records['user']['timeZone'];
  /** Areas to filter and file under, in the person's order. */
  readonly areas: readonly {
    readonly id: AreaId;
    readonly name: string;
    readonly color: AreaColor;
    /** Tasks of the Area within the current 切り口. */
    readonly count: number;
  }[];
  readonly sliceCounts: Readonly<Record<BacklogSlice | 'all', number>>;
  /**
   * The Tasks shown, newest first (Issue #86). The domain's `backlogView` is
   * in creation order; the newest first is the screen's choice, so that a
   * Task just added is right under the Quick Add. Never by priority
   * (invariant 5).
   */
  readonly shown: readonly TaskId[];
  /** Every active Task by ID, for the rows and the detail (even when filtered out). */
  readonly items: Readonly<Record<TaskId, BacklogItem>>;
}

export function backlogData(
  records: TaggedRecords,
  clock: Clock,
  filter: BacklogFilter,
): BacklogData {
  const all = backlogView(records.tasks).map(taggedIn(records.tasks));
  const context = {
    user: records.user,
    today: clock.today,
    sprints: records.sprints,
    rules: records.rules,
  };
  const inSlice = (slice: BacklogSlice | 'all') =>
    slice === 'all'
      ? all
      : all.filter((t) => inBacklogSlice(t, slice, context));
  const bySlice = inSlice(filter.view ?? 'all');
  const choices = records.areas
    .filter((a) => !a.archived)
    .toSorted((a, b) => a.order - b.order);
  // An Area archived while chosen has no filter left to take it off (#113):
  // it narrows nothing.
  const area = choices.some((a) => a.id === filter.area)
    ? filter.area
    : undefined;
  const shown =
    area === undefined ? bySlice : bySlice.filter((t) => t.areaId === area);
  const active = activeSprint(records);
  return {
    today: clock.today,
    lastDay: active !== undefined && isLastDay(active, clock.today),
    timeZone: records.user.timeZone,
    areas: choices.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      count: bySlice.filter((t) => t.areaId === a.id).length,
    })),
    sliceCounts: Object.fromEntries(
      SLICES.map((slice) => [slice, inSlice(slice).length]),
    ) as Record<BacklogSlice | 'all', number>,
    shown: shown.toReversed().map((task) => task.id),
    items: Object.fromEntries(
      all.map((task) => [task.id, backlogItem(task, records, clock)]),
    ),
  };
}
