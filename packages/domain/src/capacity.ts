import { sprintTaskValue, type ActiveCriterion } from './planning';
import {
  totalPlanningValues,
  type PlanningTotal,
  type PlanningValue,
} from './planning-value';
import type { AreaId } from './shared/ids';
import type { Instant } from './shared/time';
import { isCounted, type Sprint } from './sprint';
import type { Task } from './task';

/**
 * How the planned total compares with the available hours. Only a value:
 * choosing colours and wording (danger only for `exceeds`) is the UI's job.
 * - `within`: even the upper end fits.
 * - `mayExceed`: the lower end fits but the upper end does not.
 * - `exceeds`: even the lower end is over (確定的な容量超過).
 */
export type CapacityStatus = 'within' | 'mayExceed' | 'exceeds';

export interface Capacity {
  readonly availableHours: number;
  /** available − total, as a range: lo uses the upper total. */
  readonly remaining: { readonly lo: number; readonly hi: number };
  readonly status: CapacityStatus;
}

export interface AreaTotal extends PlanningTotal {
  /** `null` for Tasks without an Area. */
  readonly areaId: AreaId | null;
}

export interface SprintTotals {
  readonly total: PlanningTotal;
  readonly byArea: readonly AreaTotal[];
  /** Absent while no available hours are entered. */
  readonly capacity?: Capacity;
}

export interface SprintTotalsOptions {
  /** At least every Task this Sprint has a SprintTask for. */
  readonly tasks: readonly Task[];
  readonly now: Instant;
  /**
   * Planning preview only: the criterion to apply to drafts, as the Check
   * currently says. Confirmed SprintTasks use their fixed snapshot.
   */
  readonly previewCriterion?: ActiveCriterion;
}

/**
 * Planned totals of a Sprint, per Area and overall, with unestimated counts
 * (invariant 8). Goal-unlinked and mid-Sprint Tasks count too (invariant
 * 15); removed and carried-over ones do not. Drafts are valued live;
 * planned ones by their snapshot (invariant 16).
 */
export function sprintTotals(
  sprint: Sprint,
  options: SprintTotalsOptions,
): SprintTotals {
  const entries: { areaId: AreaId | null; value: PlanningValue }[] = [];
  for (const sprintTask of sprint.tasks) {
    if (!isCounted(sprintTask)) continue;
    const task = options.tasks.find((t) => t.id === sprintTask.taskId);
    const value =
      sprintTask.planSnapshot?.value ??
      (task === undefined
        ? undefined
        : sprintTaskValue(task, sprintTask, options.previewCriterion, options));
    if (value === undefined) continue;
    entries.push({ areaId: task?.areaId ?? null, value });
  }

  const areaIds = [...new Set(entries.map((e) => e.areaId))];
  const byArea = areaIds.map((areaId) => ({
    areaId,
    ...totalPlanningValues(
      entries.filter((e) => e.areaId === areaId).map((e) => e.value),
    ),
  }));
  const total = totalPlanningValues(entries.map((e) => e.value));
  return {
    total,
    byArea,
    ...(sprint.availableHours === undefined
      ? {}
      : { capacity: capacityOf(total, sprint.availableHours) }),
  };
}

export function capacityOf(
  total: Pick<PlanningTotal, 'lo' | 'hi'>,
  availableHours: number,
): Capacity {
  const status: CapacityStatus =
    total.lo > availableHours
      ? 'exceeds'
      : total.hi > availableHours
        ? 'mayExceed'
        : 'within';
  return {
    availableHours,
    remaining: { lo: availableHours - total.hi, hi: availableHours - total.lo },
    status,
  };
}
