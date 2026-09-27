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
  type InterruptNote,
  type LocalDate,
  type Occurrence,
  type PlanningValue,
  type Sprint,
  type SprintTask,
  type Task,
  type TodayRemaining,
  type WeekProgress,
} from '@itera/domain';
import { daysBetween } from '@/lib/date-format';
import type { Clock, Records } from './records';

export interface TodayArea {
  readonly id: AreaId;
  readonly name: string;
  readonly color: AreaColor;
}

/** A SprintTask (or one occurrence of it) as Today shows it. */
export interface TodayItem {
  readonly sprintTask: SprintTask;
  readonly task: Task;
  readonly area?: TodayArea;
  /** Recurring only: the occurrence this row is about. */
  readonly occurrence?: Occurrence;
  /** This Sprint's value; one occurrence's share for a recurring Task. */
  readonly value: PlanningValue;
  /** 「N回続けて見送り」 (F4), 0 when there is none. */
  readonly streak: number;
}

/** A row of 今日やる, or one closed today. */
export interface TodayRow extends TodayItem {
  readonly selection: DailySelection;
  /** The actual hours recorded for this day's selection. */
  readonly actualHours: number;
}

export interface TodayData {
  readonly sprint: Sprint;
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
  /** 今日はここまで・見送り・外すにした選択. Still completable today (F17). */
  readonly closed: readonly TodayRow[];
  /** 昨日の続き (F6): candidates only, never chosen automatically. */
  readonly continuation: readonly TodayItem[];
  /** 今週の残り: planned and not chosen today (occurrences of any day, F18). */
  readonly rest: readonly TodayItem[];
  /** Today's interrupts, oldest first. */
  readonly interrupts: readonly InterruptNote[];
  /** Areas for the quick add, in the person's order. */
  readonly areas: readonly TodayArea[];
}

/** The Sprint Today works on: the active one. */
export function activeSprintOf(records: Records): Sprint | undefined {
  return records.sprints.find((s) => s.state === 'active');
}

const OPEN_OR_DONE = new Set(['selected', 'started', 'done', 'skipped']);
const CLOSED = new Set(['paused', 'deferred', 'removed']);

export function todayData(
  records: Records,
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
    sprintTask: SprintTask,
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
    const actualHours = sprint.actualTimes
      .filter(
        (a) =>
          a.date === selection.date &&
          a.sprintTaskId === selection.sprintTaskId &&
          a.occurrenceId === selection.occurrenceId,
      )
      .reduce((sum, a) => sum + a.hours, 0);
    return [{ ...base, selection, actualHours }];
  };

  const todays = sprint.dailySelections
    .filter((s) => s.date === today)
    .toSorted((a, b) =>
      a.selectedAt < b.selectedAt ? -1 : a.selectedAt > b.selectedAt ? 1 : 0,
    );
  const rows = [
    ...todays.filter(
      (s) => OPEN_OR_DONE.has(s.resolution) && s.origin !== 'backlogCompletion',
    ),
    ...todays.filter(
      (s) => OPEN_OR_DONE.has(s.resolution) && s.origin === 'backlogCompletion',
    ),
  ].flatMap(row);
  const closed = todays.filter((s) => CLOSED.has(s.resolution)).flatMap(row);

  const continuation = yesterdaysContinuation(sprint, sprints, today).flatMap(
    (c) => item(c.sprintTask, c.occurrenceId) ?? [],
  );
  const inContinuation = (sprintTask: SprintTask, occurrenceId?: string) =>
    continuation.some(
      (c) =>
        c.sprintTask.id === sprintTask.id && c.occurrence?.id === occurrenceId,
    );
  const chosenToday = (sprintTask: SprintTask, occurrenceId?: string) =>
    todays.some(
      (s) =>
        s.sprintTaskId === sprintTask.id && s.occurrenceId === occurrenceId,
    );

  const planned = sprint.tasks.filter((t) => t.outcome === 'planned');
  // The Tasks first, then each pending occurrence, which can be chosen on
  // any day of the Sprint (F18), in the order of their dates.
  const rest = [
    ...planned
      .filter((t) => t.occurrenceIds === undefined)
      .flatMap((sprintTask) =>
        chosenToday(sprintTask) || inContinuation(sprintTask)
          ? []
          : (item(sprintTask) ?? []),
      ),
    ...planned
      .filter((t) => t.occurrenceIds !== undefined)
      .flatMap((sprintTask) =>
        occurrences
          .filter(
            (o) =>
              (sprintTask.occurrenceIds ?? []).includes(o.id) &&
              o.state === 'pending' &&
              !chosenToday(sprintTask, o.id) &&
              !inContinuation(sprintTask, o.id),
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
    day: {
      index: daysBetween(sprint.start, today) + 1,
      count: daysBetween(sprint.start, sprint.end) + 1,
    },
    lastDay: today === sprint.end,
    timeZone: records.user.timeZone,
    progress: weekProgress(sprint, occurrences),
    remaining: todayRemaining(sprint, today),
    goals,
    rows,
    closed,
    continuation,
    rest,
    interrupts: sprint.interrupts.filter(
      (n) => toLocalDate(n.at, records.user.timeZone) === today,
    ),
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
