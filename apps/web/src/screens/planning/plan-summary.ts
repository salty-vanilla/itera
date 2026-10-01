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
   * while it may or does go over (`capacityStatusLine`).
   */
  readonly statement: CapacityState;
  /** 「14.75–17.75h」, or 「見積もりなし 3件」 with nothing estimated. */
  readonly total: string;
  /** 「18h」; absent while no available hours are entered. */
  readonly available?: string;
  readonly taskCount: number;
  /** Tasks that confirming leaves without a Goal (goalLinkAtConfirm). */
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
  /** 「「研究：提案の幅の上限で計画する」を今回の計画に使う」 */
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
          available: formatHours(totals.capacity.availableHours, {
            total: true,
          }),
        }),
    taskCount: tasks.length,
    unlinked: tasks.filter((t) => t.linkAtConfirm === 'unlinked').length,
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
    ...(criterion === undefined
      ? {}
      : {
          criterion: `「${criterionName(criterion.active.policy, criterion.areaName)}」${
            criterion.applied ? 'を今回の計画に使う' : 'は今回は使わない'
          }`,
        }),
  };
}
