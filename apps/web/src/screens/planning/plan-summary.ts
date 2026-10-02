import {
  capacityStatusLine,
  type CapacityState,
} from '@/components/sprint/capacity-indicator';
import { criterionName } from '@/lib/criterion-text';
import {
  formatHours,
  formatLeftOut,
  formatPlanningSum,
} from '@/lib/time-format';
import type {
  AreaPlan,
  PlannedTask,
  PlanningData,
} from '@/store/planning-view';

// What the plan comes to, in words: the one source of the 確かめる summary
// and the 確定 Dialog, so that both say the same (Issue #93, owner decision
// S4). The screens only lay it out.

export interface PlanSummary {
  /**
   * Whether the plan fits: ok / tight / over / unknown, with the numbers
   * while it may or does go over (`capacityStatusLine`). The 確定 Dialog's
   * line; 確かめる shows the state and the headline apart (#243).
   */
  readonly statement: CapacityState;
  /** 「14時間45分〜17時間45分」, or 「見積もりなし 3件」 with nothing estimated. */
  readonly total: string;
  /** 「18時間」; absent while no available hours are entered. */
  readonly available?: string;
  readonly taskCount: number;
  /**
   * Tasks not linked to their Area's Goal, in the Areas with one: the rows
   * that say 「目標に入っていない」. A Task in an Area without a Goal is not
   * counted, though confirming leaves it unlinked (owner decision, #159).
   */
  readonly unlinked: number;
  /** The Areas with a Goal. */
  readonly goals: readonly AreaPlan[];
  /** The Areas with chosen Tasks and no Goal; 領域なし has none to write. */
  readonly goalless: readonly AreaPlan[];
  /**
   * Tasks left out of the total, whole (no value) or in part (subtasks
   * without an Estimate).
   */
  readonly unestimated: readonly PlannedTask[];
  /** 「見積もりのないタスク 1件は合計に含まれていません。」 */
  readonly leftOut?: string;
  /**
   * 「「研究：提案の多めで計画」 · このルールで計画する」; absent when no
   * chosen Task is one it acts on (#161).
   */
  readonly criterion?: string;
}

export function planSummary(data: PlanningData): PlanSummary {
  const { totals, criterion } = data;
  const tasks = data.plan.flatMap((p) => p.tasks);
  const leftOut = formatLeftOut(totals.total);
  return {
    statement: capacityStatusLine(totals.capacity, totals.total),
    total: formatPlanningSum(totals.total),
    ...(totals.capacity === undefined
      ? {}
      : {
          available: formatHours(totals.capacity.availableHours),
        }),
    taskCount: tasks.length,
    unlinked: data.plan
      .filter((p) => p.goal !== undefined)
      .flatMap((p) => p.tasks)
      .filter((t) => t.linkAtConfirm === 'unlinked').length,
    goals: data.plan.filter((p) => p.goal !== undefined),
    goalless: data.plan.filter(
      (p) => p.area.id !== null && p.goal === undefined && p.tasks.length > 0,
    ),
    // As `sprintTotals` counts them, so that the list and 「…は合計に含まれて
    // いません」 agree.
    unestimated: tasks.filter(
      (t) =>
        t.value.base === 'none' ||
        (t.value.base === 'subtasks' && t.value.unestimatedSubtasks > 0),
    ),
    ...(leftOut === undefined ? {} : { leftOut }),
    ...(criterion?.hasTarget !== true
      ? {}
      : {
          criterion: `「${criterionName(criterion.active.policy, criterion.areaName)}」${
            criterion.applied
              ? ' · このルールで計画する'
              : ' · 今回はこのルールで計画しない'
          }`,
        }),
  };
}
