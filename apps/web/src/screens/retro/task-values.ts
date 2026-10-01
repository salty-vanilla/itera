import type { TaskFact } from '@itera/domain';
import { SELECTION_WORDS } from '@/lib/selection-words';
import {
  formatHours,
  formatPlanningValue,
  formatRange,
  formatUnestimatedSubtasks,
  UNESTIMATED,
} from '@/lib/time-format';
import type { RetroData } from '@/store/retro-view';
import { OUTCOME_WORDS } from './retro-words';

// A Task's values in words, shared by the table and the stacked list of 事実を見る
// and by 振り返りの材料, so that a Task reads the same in all three (#108).

/** The planning value fixed in the plan. */
export function plannedText(t: TaskFact): string {
  return t.plan === undefined ? UNESTIMATED : formatPlanningValue(t.plan.value);
}

/**
 * The planning value in the table's narrow column: a subtask sum without
 * its count, which goes under it (`unestimatedNote`).
 */
export function plannedCellText(t: TaskFact): string {
  const value = t.plan?.value;
  return value?.base === 'subtasks'
    ? formatRange(value.lo, value.hi)
    : plannedText(t);
}

/** 「サブタスク 1件は見積もりなし」 for the subtasks left out of a subtask sum. */
export function unestimatedNote(t: TaskFact): string[] {
  const value = t.plan?.value;
  return value?.base === 'subtasks' && value.unestimatedSubtasks > 0
    ? [formatUnestimatedSubtasks(value.unestimatedSubtasks)]
    : [];
}

/** What the value came from: the criterion, and a recurring Task's count. */
export function planNotes(t: TaskFact): string[] {
  return [
    ...(t.plan?.value.criterionApplied === true ? ['ルール'] : []),
    ...(t.plan?.occurrenceCount === undefined
      ? []
      : [`${t.plan.occurrenceCount}回分`]),
  ];
}

/** 「見送り 2回 · 中断 1回」, or nothing. */
export function daysText(t: TaskFact): string | undefined {
  const parts = [
    ...(t.deferredDates.length > 0
      ? [`見送り ${t.deferredDates.length}回`]
      : []),
    ...(t.pausedDates.length > 0
      ? [`${SELECTION_WORDS.paused} ${t.pausedDates.length}回`]
      : []),
  ];
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** The Estimate in the plan: the person's, the suggestion shown, or none. */
export function estimateOf(t: TaskFact): {
  kind: 'estimate' | 'suggestion' | 'none';
  text: string;
} {
  const plan = t.plan;
  if (plan?.estimateHours !== undefined) {
    return { kind: 'estimate', text: formatHours(plan.estimateHours) };
  }
  if (plan?.suggestion !== undefined) {
    return {
      kind: 'suggestion',
      text: `見積もりの提案 ${formatRange(plan.suggestion.lo, plan.suggestion.hi)}`,
    };
  }
  return { kind: 'none', text: UNESTIMATED };
}

export function resultText(t: TaskFact, data: RetroData): string {
  if (!t.recurring) return OUTCOME_WORDS[t.outcome];
  // A recurring Task is shown by its occurrences, not done / carried (F20).
  const { done, skipped, missed } = data.facts.occurrences;
  const count = (list: readonly { taskId: string }[]) =>
    list.filter((o) => o.taskId === t.taskId).length;
  return `繰り返し：完了 ${count(done)} · スキップ ${count(skipped)} · 未完了 ${count(missed)}`;
}

/** 「計画 5h（ルール）」: the planning value with what it came from. */
export function plannedLabel(t: TaskFact): string {
  return `計画 ${plannedText(t)}${planNotes(t)
    .map((n) => `（${n}）`)
    .join('')}`;
}

/**
 * 確定したときとの差 of a Task in words (#167): 「計画より 0.5h 少ない」, and against
 * a range 「計画の幅より 1h 多い」「計画の幅より 30m 少ない」「計画の幅の中」 (#234). Nothing
 * without actual time or an estimated value. Only the difference: no color
 * and no judgement (invariant 40).
 */
export function differenceText(t: TaskFact): string | undefined {
  const d = t.actualVsPlan;
  if (d === undefined) return undefined;
  const hours = (h: number) => formatHours(Math.abs(h));
  if (d.lo === d.hi) {
    if (d.lo === 0) return '計画と同じ';
    return `計画より ${hours(d.lo)} ${d.lo > 0 ? '多い' : '少ない'}`;
  }
  if (d.lo > 0) return `計画の幅より ${hours(d.lo)} 多い`;
  if (d.hi < 0) return `計画の幅より ${hours(d.hi)} 少ない`;
  return '計画の幅の中';
}

/** 「実績 4.5h」, or 「実績 未入力」 while none is entered. */
export function actualLabel(t: TaskFact): string {
  return `実績 ${t.actualHours > 0 ? formatHours(t.actualHours) : '未入力'}`;
}
