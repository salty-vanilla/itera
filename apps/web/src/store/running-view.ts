// What the Sprint screen shows of a confirmed Sprint (#51), derived from the
// records by `@itera/domain`: the running one, or, read only, one in Review
// or closed with how each Task ended (#90). The values are the plan fixed
// at confirm (planSnapshot, invariant 16); Goals and available hours may
// change after confirm and their planned values stay beside them
// (invariant 18, F16).
import {
  carryOriginOf,
  isCounted,
  occurrenceProgress,
  sprintAreaName,
  sprintNumber,
  sprintTotals,
  retroFacts,
  weekProgress,
  type AreaColor,
  type AreaId,
  type CriterionPolicy,
  type DailySelection,
  type LocalDate,
  type OccurrenceProgress,
  type PlanningValue,
  type Sprint,
  type SprintGoal,
  type SprintId,
  type SprintTask,
  type SprintTotals,
  type Task,
  type WeekProgress,
} from '@itera/domain';
import { daysBetween } from '@/lib/date-format';
import type { Clock, Records } from './records';
import { weekOf, type WeekName } from './sprint-choice';

export interface RunningArea {
  /** `null` for Tasks without an Area (「領域なし」). */
  readonly id: AreaId | null;
  readonly name: string;
  readonly color: AreaColor | 'none';
}

export interface RunningTask {
  readonly sprintTask: SprintTask;
  readonly task: Task;
  /** The planning value fixed for this Sprint (the whole week for a recurring Task). */
  readonly value: PlanningValue;
  /** Recurring only: its occurrences done of the week's (F32). */
  readonly occurrences?: OccurrenceProgress;
  /**
   * Carried over into this Sprint: how many times in a row, and the number
   * of the Sprint the run began in (「持ち越し 1回（Sprint 13から）」, F25).
   */
  readonly carry?: { readonly count: number; readonly fromSprint: number };
}

export interface RunningAreaPlan {
  readonly area: RunningArea;
  readonly goal?: SprintGoal;
  readonly tasks: readonly RunningTask[];
}

/** A past day's completion or skip, which can be undone (#53). */
export interface PastDayRecord {
  readonly selection: DailySelection;
  readonly title: string;
  readonly recurring: boolean;
  /**
   * What undoing leaves on that day (F33): unresolved; or, completed after
   * being closed that day, the way it had been closed (F17); or nothing,
   * for a choice made by a completion from the Backlog (F29).
   */
  readonly after:
    | { readonly kind: 'unresolved' }
    | {
        readonly kind: 'closed';
        readonly resolution: 'paused' | 'deferred' | 'removed';
      }
    | { readonly kind: 'gone' };
}

export interface PastDay {
  readonly date: LocalDate;
  readonly records: readonly PastDayRecord[];
}

export interface RunningData {
  readonly sprint: Sprint;
  /** 「Sprint 14」 (F25). */
  readonly number: number;
  /** 「今週」; none for one that has ended (#90). */
  readonly week?: WeekName;
  readonly today: LocalDate;
  /** 「2日目 / 7日」, absent before the first day and once it has ended. */
  readonly day?: { readonly index: number; readonly count: number };
  /**
   * Areas with a Goal or chosen Tasks, in the Sprint's order, then 領域なし.
   * Once the Sprint has ended, the carried-over Tasks are in it too.
   */
  readonly plan: readonly RunningAreaPlan[];
  /**
   * The planned values of the Tasks in `plan`. Once ended, the total is the
   * Retro's (retroFacts) and there are no per-Area totals.
   */
  readonly totals: Pick<SprintTotals, 'total' | 'byArea'>;
  readonly availableHours: {
    readonly planned?: number;
    readonly current?: number;
  };
  /** 「今週の完了 N / M件」 (F32), as Today counts it; only while running. */
  readonly progress?: WeekProgress;
  /** Before today, newest first: the days' completions and skips (#53). */
  readonly pastDays: readonly PastDay[];
  /** The criterion as this Sprint treated it at confirm (read only, invariant 37). */
  readonly criterion?: {
    readonly policy: CriterionPolicy;
    /** The Area it covers, when its scope is an Area. */
    readonly areaName?: string;
    readonly applied: boolean;
  };
}

const NO_AREA: RunningArea = { id: null, name: '領域なし', color: 'none' };

/**
 * A confirmed Sprint's plan and how it went: the running one by default,
 * or the one asked for. `undefined` for a Sprint still being planned.
 */
export function runningData(
  records: Records,
  clock: Clock,
  sprintId?: SprintId,
): RunningData | undefined {
  const sprint = records.sprints.find((s) =>
    sprintId === undefined ? s.state === 'active' : s.id === sprintId,
  );
  if (sprint === undefined || sprint.state === 'planning') return undefined;
  const ended = sprint.state !== 'active';
  const { tasks, areas } = records;

  const areaOf = (areaId: AreaId): RunningArea => {
    const area = areas.find((a) => a.id === areaId);
    return {
      id: areaId,
      name: sprintAreaName(sprint, areaId, areas) ?? area?.name ?? '',
      color: area?.color ?? 'none',
    };
  };
  const counted: RunningTask[] = sprint.tasks
    // Carried over at the end (Review): still part of what was planned.
    .filter((t) => isCounted(t) || t.outcome === 'carriedOver')
    .flatMap((sprintTask) => {
      const task = tasks.find((t) => t.id === sprintTask.taskId);
      const value = sprintTask.planSnapshot?.value;
      if (task === undefined || value === undefined) return [];
      const occurrences = occurrenceProgress(sprintTask, records.occurrences);
      const carry = carryOriginOf(sprintTask, records.sprints);
      const from = records.sprints.find((s) => s.id === carry?.fromSprintId);
      return [
        {
          sprintTask,
          task,
          value,
          ...(occurrences === undefined ? {} : { occurrences }),
          ...(carry === undefined || from === undefined
            ? {}
            : {
                carry: {
                  count: carry.count,
                  fromSprint: sprintNumber(from, records.sprints),
                },
              }),
        },
      ];
    });

  // The Sprint's Area order (snapshot), then Areas first seen later (F9).
  const order = [
    ...sprint.areaSnapshot
      .toSorted((a, b) => a.order - b.order)
      .map((e) => e.areaId),
    ...areas
      .toSorted((a, b) => a.order - b.order)
      .map((a) => a.id)
      .filter((id) => !sprint.areaSnapshot.some((e) => e.areaId === id)),
  ];
  const plan: RunningAreaPlan[] = [
    ...order.flatMap((areaId) => {
      const goal = sprint.goals.find((g) => g.areaId === areaId);
      const inArea = counted.filter((t) => t.task.areaId === areaId);
      // A Goal can be written for any Area of the Sprint, even without
      // Tasks (F16: it has no planned text then).
      // Once ended, an Area with neither has nothing to show.
      const archived = areas.find((a) => a.id === areaId)?.archived ?? false;
      if (goal === undefined && inArea.length === 0 && (archived || ended)) {
        return [];
      }
      return [
        {
          area: areaOf(areaId),
          ...(goal === undefined ? {} : { goal }),
          tasks: inArea,
        },
      ];
    }),
    ...(counted.some((t) => t.task.areaId === undefined)
      ? [
          {
            area: NO_AREA,
            tasks: counted.filter((t) => t.task.areaId === undefined),
          },
        ]
      : []),
  ];

  const use = sprint.criterionUse;
  const criterion = records.criteria.find((c) => c.id === use?.criterionId);
  const scope = criterion?.policy.scope;

  // Once ended, the planned total is the Retro's: carried-over Tasks
  // count too (retroFacts), and it has no per-Area totals.
  const totals = ended
    ? {
        total: retroFacts(sprint, {
          tasks,
          areas,
          occurrences: records.occurrences,
          sprints: records.sprints,
        }).plannedTotal.withAdditions,
        byArea: [],
      }
    : sprintTotals(sprint, { tasks, now: clock.now });

  return {
    sprint,
    number: sprintNumber(sprint, records.sprints),
    ...weekOf(sprint, records, clock),
    today: clock.today,
    ...(clock.today < sprint.start || ended
      ? {}
      : {
          day: {
            index: daysBetween(sprint.start, clock.today) + 1,
            count: daysBetween(sprint.start, sprint.end) + 1,
          },
        }),
    plan,
    ...(ended ? {} : { progress: weekProgress(sprint, records.occurrences) }),
    // Undoing a past day is for the running Sprint only (F33).
    pastDays: ended ? [] : pastDaysOf(sprint, tasks, clock.today),
    totals,
    availableHours: {
      ...(sprint.plannedAvailableHours === undefined
        ? {}
        : { planned: sprint.plannedAvailableHours }),
      ...(sprint.availableHours === undefined
        ? {}
        : { current: sprint.availableHours }),
    },
    ...(use === undefined || criterion === undefined
      ? {}
      : {
          criterion: {
            policy: criterion.policy,
            ...(scope?.kind === 'area'
              ? { areaName: areaOf(scope.areaId).name }
              : {}),
            applied: use.appliedAtConfirm,
          },
        }),
  };
}

function pastDaysOf(
  sprint: Sprint,
  tasks: readonly Task[],
  today: LocalDate,
): readonly PastDay[] {
  const records = sprint.dailySelections
    .filter(
      (s) =>
        s.date < today &&
        (s.resolution === 'done' || s.resolution === 'skipped'),
    )
    .flatMap((selection) => {
      const sprintTask = sprint.tasks.find(
        (t) => t.id === selection.sprintTaskId,
      );
      const task = tasks.find((t) => t.id === sprintTask?.taskId);
      return task === undefined
        ? []
        : [
            {
              selection,
              title: task.title,
              recurring: selection.occurrenceId !== undefined,
              after:
                selection.resolution === 'done' &&
                selection.origin === 'backlogCompletion'
                  ? { kind: 'gone' as const }
                  : selection.resolution === 'done' &&
                      selection.closedBefore !== undefined
                    ? {
                        kind: 'closed' as const,
                        resolution: selection.closedBefore.resolution,
                      }
                    : { kind: 'unresolved' as const },
            },
          ];
    });
  const dates = [...new Set(records.map((r) => r.selection.date))].toSorted(
    (a, b) => (a < b ? 1 : -1),
  );
  return dates.map((date) => ({
    date,
    records: records
      .filter((r) => r.selection.date === date)
      .toSorted((a, b) =>
        (a.selection.resolvedAt ?? '') < (b.selection.resolvedAt ?? '')
          ? -1
          : 1,
      ),
  }));
}
