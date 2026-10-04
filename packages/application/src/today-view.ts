// What the Today screen shows, derived from the records by `@itera/domain`.
// The screen reads it through `useToday`; nothing here is stored. Today has
// no daily capacity and never judges going over (invariant 25).
import {
  deferralStreak,
  planningValueOf,
  sprintAreaName,
  sprintNumber,
  todayRemaining,
  toLocalDate,
  weekProgress,
  yesterdaysContinuation,
  type AreaColor,
  type AreaId,
  type DailySelection,
  type LocalDate,
  type Occurrence,
  type PlanningValue,
  type Sprint,
  type SprintTask,
  type Task,
  type TodayRemaining,
  type WeekProgress,
} from '@itera/domain';
import {
  interruptCapabilities,
  selectionCapabilities,
  type DailySelectionCapabilities,
  type InterruptItem,
} from './capabilities';
import type { Clock, Records } from './records';
import { dayInPeriod, isLastDay, selectionActualHours } from './sprint-day';
import {
  taggedIn,
  type TaggedRecords,
  type TaggedSprint,
  type TaggedSprintTask,
  type TaggedTask,
} from './versions';

export interface TodayArea {
  readonly id: AreaId;
  readonly name: string;
  readonly color: AreaColor;
}

/** A SprintTask (or one occurrence of it) as Today shows it. */
export interface TodayItem {
  readonly sprintTask: TaggedSprintTask;
  readonly task: TaggedTask;
  readonly area?: TodayArea;
  /** Recurring only: the occurrence this row is about. */
  readonly occurrence?: Occurrence;
  /** This Sprint's value; one occurrence's share for a recurring Task. */
  readonly value: PlanningValue;
  /** 「N回続けて見送り」 (F4), 0 when there is none. */
  readonly streak: number;
  /**
   * 今週の残り only: today's choice of it, put back with 今週の残りに戻す
   * (Removed). 今日へ takes that choice back (F37) rather than making a
   * second one, which the day does not allow (F17, #233).
   */
  readonly removedToday?: DailySelection['id'];
  /**
   * What the person can do with the choice `removedToday` names (#322):
   * 今日へ takes it back with `undoRemoveFromToday`.
   */
  readonly removedTodayCapabilities?: DailySelectionCapabilities;
}

/** A row of 今日やる, or one closed today. */
export interface TodayRow extends TodayItem {
  readonly selection: DailySelection;
  /** What the person can do with the selection now (#322). */
  readonly capabilities: DailySelectionCapabilities;
  /** The actual hours recorded for this day's selection. */
  readonly actualHours: number;
}

export interface TodayData {
  readonly sprint: TaggedSprint;
  /** 「Sprint 14」 (F25). */
  readonly number: number;
  readonly today: LocalDate;
  /** 「2日目 / 7日」. */
  readonly day: { readonly index: number; readonly count: number };
  /** The last day: 「Retro を始める」 shows (F21). */
  readonly lastDay: boolean;
  readonly timeZone: Records['user']['timeZone'];
  /** 今週の完了 (F32). */
  readonly progress: WeekProgress;
  /** 今日の残り: a value to show, never a capacity. */
  readonly remaining: TodayRemaining;
  /** The week's Goals, in the Areas' order; Areas without one are left out. */
  readonly goals: readonly {
    readonly area: TodayArea;
    readonly text: string;
  }[];
  /**
   * 今日やる: open, done and skipped, in the order chosen; those completed
   * from the Backlog come last.
   */
  readonly rows: readonly TodayRow[];
  /**
   * 今日は中断する・今日は見送るにした選択. Still completable today (F17).
   * One put back with 今週の残りに戻す is in 今週の残り instead (#233).
   */
  readonly closed: readonly TodayRow[];
  /** 昨日の続き (F6): candidates only, never chosen automatically. */
  readonly continuation: readonly TodayItem[];
  /** 今週の残り: planned and not chosen today (occurrences of any day, F18). */
  readonly rest: readonly TodayItem[];
  /**
   * The planned Tasks and pending occurrences, whether or not chosen or
   * continued: what 今週の計画 shows before the first day (#156).
   */
  readonly plan: readonly TodayItem[];
  /** Today's interrupts, oldest first. */
  readonly interrupts: readonly InterruptItem[];
  /** Areas for the quick add, in the person's order. */
  readonly areas: readonly TodayArea[];
}

/** The Sprint Today works on: the active one. */
export function activeSprintOf<S extends Sprint>(records: {
  readonly sprints: readonly S[];
}): S | undefined {
  return records.sprints.find((s) => s.state === 'active');
}

/**
 * The resolutions of a selection that Today lists in 今日やる. The Backlog's
 * 「今日」 (Issue #94) is the same set, so that the two agree.
 */
export type ListedResolution = 'selected' | 'started' | 'done' | 'skipped';
export function isListedResolution(
  resolution: DailySelection['resolution'],
): resolution is ListedResolution {
  return (
    resolution === 'selected' ||
    resolution === 'started' ||
    resolution === 'done' ||
    resolution === 'skipped'
  );
}

const CLOSED = new Set(['paused', 'deferred', 'removed']);

/** A selection closed for the day: back among the week's remaining. */
export type ClosedResolution = 'paused' | 'deferred' | 'removed';
export function isClosedResolution(
  resolution: DailySelection['resolution'],
): resolution is ClosedResolution {
  return CLOSED.has(resolution);
}

export function todayData(
  records: TaggedRecords,
  clock: Clock,
): TodayData | undefined {
  const sprint = activeSprintOf(records);
  if (sprint === undefined) return undefined;
  const today = clock.today;
  const { tasks, occurrences, sprints } = records;

  const areaOf = (task: Task): TodayArea | undefined => {
    if (task.areaId === undefined) return undefined;
    const area = records.areas.find((a) => a.id === task.areaId);
    if (area === undefined) return undefined;
    return {
      id: area.id,
      name: sprintAreaName(sprint, area.id, records.areas) ?? area.name,
      color: area.color,
    };
  };

  const item = (
    sprintTask: TaggedSprintTask,
    occurrenceId?: Occurrence['id'],
  ): TodayItem | undefined => {
    const task = tasks.find((t) => t.id === sprintTask.taskId);
    if (task === undefined) return undefined;
    const occurrence =
      occurrenceId === undefined
        ? undefined
        : occurrences.find((o) => o.id === occurrenceId);
    const area = areaOf(task);
    return {
      sprintTask,
      task,
      ...(area === undefined ? {} : { area }),
      ...(occurrence === undefined ? {} : { occurrence }),
      value: valueOf(sprintTask, task, clock),
      streak: deferralStreak(sprints, task.id),
    };
  };

  const row = (selection: DailySelection): TodayRow[] => {
    const sprintTask = sprint.tasks.find(
      (t) => t.id === selection.sprintTaskId,
    );
    // A SprintTask removed from the Sprint keeps its selection but is not
    // in Today (F13).
    if (sprintTask === undefined || sprintTask.outcome === 'removed') return [];
    const base = item(sprintTask, selection.occurrenceId);
    if (base === undefined) return [];
    const actualHours = selectionActualHours(sprint, selection);
    const capabilities = selectionCapabilities(
      records,
      sprint,
      selection,
      today,
    );
    return [{ ...base, selection, capabilities, actualHours }];
  };

  const todays = sprint.dailySelections
    .filter((s) => s.date === today)
    .toSorted((a, b) =>
      a.selectedAt < b.selectedAt ? -1 : a.selectedAt > b.selectedAt ? 1 : 0,
    );
  const rows = [
    ...todays.filter(
      (s) =>
        isListedResolution(s.resolution) && s.origin !== 'backlogCompletion',
    ),
    ...todays.filter(
      (s) =>
        isListedResolution(s.resolution) && s.origin === 'backlogCompletion',
    ),
  ].flatMap(row);
  const closed = todays
    .filter((s) => CLOSED.has(s.resolution) && s.resolution !== 'removed')
    .flatMap(row);

  const sprintTaskOf = taggedIn(sprint.tasks);
  const continuation = yesterdaysContinuation(sprint, sprints, today).flatMap(
    (c) => item(sprintTaskOf(c.sprintTask), c.occurrenceId) ?? [],
  );
  const inContinuation = (sprintTask: SprintTask, occurrenceId?: string) =>
    continuation.some(
      (c) =>
        c.sprintTask.id === sprintTask.id && c.occurrence?.id === occurrenceId,
    );
  const todayOf = (sprintTask: SprintTask, occurrenceId?: string) =>
    todays.find(
      (s) =>
        s.sprintTaskId === sprintTask.id && s.occurrenceId === occurrenceId,
    );

  const planned = sprint.tasks.filter((t) => t.outcome === 'planned');
  // The Tasks first, then each pending occurrence, which can be chosen on
  // any day of the Sprint (F18), in the order of their dates.
  const plan = [
    ...planned
      .filter((t) => t.occurrenceIds === undefined)
      .flatMap((sprintTask) => item(sprintTask) ?? []),
    ...planned
      .filter((t) => t.occurrenceIds !== undefined)
      .flatMap((sprintTask) =>
        occurrences
          .filter(
            (o) =>
              (sprintTask.occurrenceIds ?? []).includes(o.id) &&
              o.state === 'pending',
          )
          .flatMap((o) => item(sprintTask, o.id) ?? []),
      )
      .toSorted((a, b) =>
        (a.occurrence?.scheduledDate ?? '') <
        (b.occurrence?.scheduledDate ?? '')
          ? -1
          : 1,
      ),
  ];
  // Put back with 今週の残りに戻す: in 今週の残り again at once (#233).
  const rest = plan.flatMap((i): TodayItem[] => {
    if (inContinuation(i.sprintTask, i.occurrence?.id)) return [];
    const chosen = todayOf(i.sprintTask, i.occurrence?.id);
    if (chosen === undefined) return [i];
    return chosen.resolution === 'removed'
      ? [
          {
            ...i,
            removedToday: chosen.id,
            removedTodayCapabilities: selectionCapabilities(
              records,
              sprint,
              chosen,
              today,
            ),
          },
        ]
      : [];
  });

  const areas = records.areas
    .filter((a) => !a.archived)
    .toSorted((a, b) => a.order - b.order)
    .map((a) => ({
      id: a.id,
      name: sprintAreaName(sprint, a.id, records.areas) ?? a.name,
      color: a.color,
    }));
  const goals = records.areas
    .toSorted((a, b) => a.order - b.order)
    .flatMap((a) => {
      const goal = sprint.goals.find((g) => g.areaId === a.id);
      if (goal === undefined) return [];
      return [
        {
          area: {
            id: a.id,
            name: sprintAreaName(sprint, a.id, records.areas) ?? a.name,
            color: a.color,
          },
          text: goal.text,
        },
      ];
    });

  return {
    sprint,
    number: sprintNumber(sprint, sprints),
    today,
    day: dayInPeriod(sprint, today),
    lastDay: isLastDay(sprint, today),
    timeZone: records.user.timeZone,
    progress: weekProgress(sprint, occurrences),
    remaining: todayRemaining(sprint, today),
    goals,
    rows,
    closed,
    continuation,
    rest,
    plan,
    interrupts: sprint.interrupts
      .filter((n) => toLocalDate(n.at, records.user.timeZone) === today)
      .map((note) => ({
        ...note,
        capabilities: interruptCapabilities(records, sprint, note),
      })),
    areas,
  };
}

/**
 * The value confirmed for this Sprint (the plan snapshot), per occurrence
 * for a recurring Task, as `todayRemaining` counts it. A Task without a
 * snapshot shows its own value.
 */
function valueOf(
  sprintTask: SprintTask,
  task: Task,
  clock: Clock,
): PlanningValue {
  const snapshot = sprintTask.planSnapshot;
  if (snapshot === undefined) return planningValueOf(task, { now: clock.now });
  const value = snapshot.value;
  const share = snapshot.occurrenceCount ?? 1;
  if (value.base === 'none' || share === 1) return value;
  return { ...value, lo: value.lo / share, hi: value.hi / share };
}
