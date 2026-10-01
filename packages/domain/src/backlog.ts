import { carryCount } from './retro-facts';
import type { AreaId, SprintId, TaskId } from './shared/ids';
import type { LocalDate } from './shared/time';
import { sprintEnd, weekStartOf, type Sprint, type SprintTask } from './sprint';
import type { User } from './user';
import type { Task } from './task';

export interface BacklogFilter {
  /** An Area, or `'none'` for Tasks without an Area. Omit for all. */
  readonly area?: AreaId | 'none';
}

/**
 * Backlog is not a container but a view: the active Tasks (invariant 2).
 * Being in a Sprint or in Today does not hide a Task.
 *
 * The default order is creation order. Priority is deliberately not the
 * default sort key (invariant 5); screens may offer it as an explicit sort.
 */
export function backlogView(
  tasks: readonly Task[],
  filter: BacklogFilter = {},
): readonly Task[] {
  return tasks
    .filter((task) => task.lifecycle === 'active')
    .filter((task) => {
      if (filter.area === undefined) return true;
      if (filter.area === 'none') return task.areaId === undefined;
      return task.areaId === filter.area;
    })
    .toSorted(
      (a, b) => compare(a.createdAt, b.createdAt) || compare(a.id, b.id),
    );
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface CarryOver {
  /** 持ち越し回数: how many Sprints ended with the Task unfinished in a row. */
  readonly count: number;
  /** The Sprint the run began in (「Sprint 13から」). */
  readonly fromSprintId: SprintId;
}

/**
 * The Task's carry-over, as the Backlog shows it (F26): from its latest
 * SprintTask, the carriedFrom chain behind it, plus one if that SprintTask
 * was itself carried over. A Task chosen again from a carry-over keeps the
 * count while it is in the new Sprint. A draft in a Sprint not yet
 * confirmed does not count as the latest (F36), so choosing a Task for the
 * next Sprint does not hide its carry-over. `undefined` when it has none.
 */
export function carryOverOf(
  taskId: TaskId,
  sprints: readonly Sprint[],
): CarryOver | undefined {
  let latest:
    { sprint: Sprint; sprintTask: Sprint['tasks'][number] } | undefined;
  for (const sprint of sprints) {
    const sprintTask = sprint.tasks.find(
      (t) => t.taskId === taskId && t.outcome !== 'draft',
    );
    if (
      sprintTask !== undefined &&
      (latest === undefined || sprint.start > latest.sprint.start)
    ) {
      latest = { sprint, sprintTask };
    }
  }
  if (latest === undefined) return undefined;
  const { sprintTask } = latest;
  const behind = carryOriginOf(sprintTask, sprints);
  const count =
    (behind?.count ?? 0) + (sprintTask.outcome === 'carriedOver' ? 1 : 0);
  if (count === 0) return undefined;
  return { count, fromSprintId: behind?.fromSprintId ?? latest.sprint.id };
}

/**
 * Where a SprintTask's carry-over began (F26): the carriedFrom chain behind
 * it, as the Sprint screen shows a Task carried into it (「持ち越し 1回
 * （Sprint 13から）」, #160). Unlike `carryOverOf`, it does not count the
 * SprintTask itself being carried over. `undefined` when nothing is behind.
 */
export function carryOriginOf(
  sprintTask: SprintTask,
  sprints: readonly Sprint[],
): CarryOver | undefined {
  const count = carryCount(sprintTask, sprints);
  if (count === 0) return undefined;
  // Walk back to the first SprintTask of the run.
  let first: Sprint | undefined;
  let from = sprintTask.carriedFrom;
  const seen = new Set<string>();
  while (from !== undefined && !seen.has(from)) {
    seen.add(from);
    const id = from;
    const sprint = sprints.find((s) => s.tasks.some((t) => t.id === id));
    if (sprint === undefined) break;
    first = sprint;
    from = sprint.tasks.find((t) => t.id === id)?.carriedFrom;
  }
  return first === undefined ? undefined : { count, fromSprintId: first.id };
}

/** The Backlog's 切り口 besides すべて (PRD §5 A Browse). */
export type BacklogSlice =
  'dueSoon' | 'overdue' | 'carriedOver' | 'recurring' | 'noArea';

export interface BacklogSliceContext {
  readonly user: User;
  /** Today, in the user's time zone. */
  readonly today: LocalDate;
  readonly sprints: readonly Sprint[];
}

/**
 * The last day 「期限が近い」 reaches: the end of the Sprint that holds
 * today (owner decision in #39). With no such Sprint, the end of this week.
 */
export function dueSoonUntil(context: BacklogSliceContext): LocalDate {
  const { today } = context;
  const current = context.sprints.find(
    (s) => s.start <= today && today <= s.end,
  );
  return current?.end ?? sprintEnd(weekStartOf(today, context.user));
}

/** 期限超過: due before today. Backlog and Planning share it (Issue #151). */
export function isOverdue(task: Task, today: LocalDate): boolean {
  return task.due !== undefined && task.due < today;
}

/** Whether a Task falls in a 切り口. Tasks with no due date are never due. */
export function inBacklogSlice(
  task: Task,
  slice: BacklogSlice,
  context: BacklogSliceContext,
): boolean {
  switch (slice) {
    case 'dueSoon':
      return (
        task.due !== undefined &&
        task.due >= context.today &&
        task.due <= dueSoonUntil(context)
      );
    case 'overdue':
      return isOverdue(task, context.today);
    case 'carriedOver':
      return carryOverOf(task.id, context.sprints) !== undefined;
    case 'recurring':
      return task.recurrenceRuleId !== undefined;
    case 'noArea':
      return task.areaId === undefined;
  }
}
