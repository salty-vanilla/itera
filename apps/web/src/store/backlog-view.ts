// What the Backlog shows, derived from the records by `@itera/domain`. The
// screen reads it through `useBacklog`; nothing here is stored.
import {
  backlogView,
  carryOverOf,
  inBacklogSlice,
  isCounted,
  isRecurring,
  planningValueOf,
  projectFrom,
  recurrenceSummary,
  sprintNumber,
  versionOn,
  type AreaColor,
  type AreaId,
  type BacklogSlice,
  type LocalDate,
  type PlanningValue,
  type RecurrencePattern,
  type RecurrenceSummary,
  type SprintTask,
  type Task,
} from '@itera/domain';
import type { Clock, Records } from './records';
import { activeSprint } from './task-changes';

export interface BacklogItem {
  readonly task: Task;
  /** The Area's current name (the Backlog shows current names, F5). */
  readonly area?: { readonly name: string; readonly color: AreaColor };
  /** 持ち越し N回（Sprint M から）(F25, F26). */
  readonly carry?: { readonly count: number; readonly fromSprint: number };
  readonly recurrence?: RecurrenceSummary;
  /** The rule's pattern today and its latest version, for the editor. */
  readonly rule?: {
    readonly current: RecurrencePattern;
    readonly latest: RecurrencePattern;
  };
  /**
   * In this week's Sprint: 「今週」, and 「Sprint 中に追加」 if mid-Sprint.
   * `confirmed` is false while that Sprint is still being planned.
   */
  readonly thisWeek?: {
    readonly midSprint: boolean;
    readonly confirmed: boolean;
  };
  /** The Task's own time: Estimate, suggestion, subtask sum or none. */
  readonly value: PlanningValue;
  /** The subtask sum, for choosing it as the time basis in the detail. */
  readonly subtaskValue: PlanningValue;
  /** 今日へ: only for a Task outside the active Sprint (invariant 26). */
  readonly canAddToToday: boolean;
  /**
   * 今日へ waits for the Sprint's first day (#59): the Sprint is confirmed
   * but has not started, so there is no day to choose on yet.
   */
  readonly todayOpensOn?: {
    readonly number: number;
    readonly start: LocalDate;
  };
  /** A recurring Task is completed per occurrence, in Today. */
  readonly canComplete: boolean;
}

/**
 * The Sprint 「今週」 refers to: the active one, or, before one is
 * confirmed, the one being planned (Scenario A step 3). A draft for next
 * week while this week still runs is not 「今週」.
 */
function thisWeeksSprint(records: Records) {
  return (
    activeSprint(records) ?? records.sprints.find((s) => s.state === 'planning')
  );
}

export function backlogItem(
  task: Task,
  records: Records,
  clock: Clock,
): BacklogItem {
  const area = records.areas.find((a) => a.id === task.areaId);
  const carry = carryOverOf(task.id, records.sprints);
  const carryFrom = records.sprints.find((s) => s.id === carry?.fromSprintId);
  const rule = records.rules.find((r) => r.id === task.recurrenceRuleId);
  const week = thisWeeksSprint(records);
  const inWeek: SprintTask | undefined = week?.tasks.find(
    (t) => t.taskId === task.id && isCounted(t),
  );
  const active = activeSprint(records);
  const latest = rule?.versions.at(-1);
  const canChoose =
    active !== undefined &&
    !isRecurring(task) &&
    !active.tasks.some((t) => t.taskId === task.id);
  const beforeStart = active !== undefined && clock.today < active.start;
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
      : {
          recurrence: recurrenceSummary(rule, records.occurrences, {
            today: clock.today,
            projectFrom: projectFrom(records.sprints, clock.today),
          }),
          rule: {
            current: (versionOn(rule, clock.today) ?? latest).pattern,
            latest: latest.pattern,
          },
        }),
    ...(inWeek === undefined
      ? {}
      : {
          thisWeek: {
            midSprint: inWeek.origin === 'midSprint',
            confirmed: week?.state === 'active',
          },
        }),
    value: planningValueOf(task, { now: clock.now }),
    subtaskValue: planningValueOf(
      { ...task, timeBasis: 'subtasks' },
      { now: clock.now },
    ),
    canAddToToday: canChoose && !beforeStart,
    ...(canChoose && beforeStart && active !== undefined
      ? {
          todayOpensOn: {
            number: sprintNumber(active, records.sprints),
            start: active.start,
          },
        }
      : {}),
    canComplete: !isRecurring(task),
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
  readonly items: readonly BacklogItem[];
  /** Any active Task by ID, for the detail (even when filtered out). */
  readonly item: (taskId: string) => BacklogItem | undefined;
}

export function backlogData(
  records: Records,
  clock: Clock,
  filter: BacklogFilter,
): BacklogData {
  const all = backlogView(records.tasks);
  const context = {
    user: records.user,
    today: clock.today,
    sprints: records.sprints,
  };
  const inSlice = (slice: BacklogSlice | 'all') =>
    slice === 'all'
      ? all
      : all.filter((t) => inBacklogSlice(t, slice, context));
  const bySlice = inSlice(filter.view ?? 'all');
  const shown =
    filter.area === undefined
      ? bySlice
      : bySlice.filter((t) => t.areaId === filter.area);
  return {
    today: clock.today,
    timeZone: records.user.timeZone,
    areas: records.areas
      .filter((a) => !a.archived)
      .toSorted((a, b) => a.order - b.order)
      .map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        count: bySlice.filter((t) => t.areaId === a.id).length,
      })),
    sliceCounts: Object.fromEntries(
      SLICES.map((slice) => [slice, inSlice(slice).length]),
    ) as Record<BacklogSlice | 'all', number>,
    items: shown.toReversed().map((task) => backlogItem(task, records, clock)),
    item: (taskId) => {
      const task = all.find((t) => t.id === taskId);
      return task === undefined ? undefined : backlogItem(task, records, clock);
    },
  };
}
