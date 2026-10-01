// A planning criterion in words (DESIGN.md Components › 計画のルール:
// 「研究：見積もりの提案の上限で計画する」). The value comes from the one policy
// (invariant 39); only the wording is made here.
import type { CriterionPolicy, SuggestionBound } from '@itera/domain';

export const BOUND_WORDS: Readonly<Record<SuggestionBound, string>> = {
  lo: '下限',
  mid: '中央',
  hi: '上限',
};

/** 「研究：見積もりの提案の上限で計画する」, or 「見積もりの提案の…」 for every Area. */
export function criterionName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}：`;
  return `${scope}見積もりの提案の${BOUND_WORDS[policy.rangePolicy]}で計画する`;
}

/** 「見積もりの提案の上限」: where in the suggestion the criterion plans. */
export function criterionBoundText(bound: SuggestionBound): string {
  return `見積もりの提案の${BOUND_WORDS[bound]}`;
}

/**
 * What the criterion does to a Planning, said by how it plans (#206):
 * 「見積もりがない研究のタスクは、見積もりの提案の上限で計画します」, or with
 * `count`, 「研究のタスク 1件を、見積もりの提案の上限で計画します」. Without a
 * count, 「見積もりがない」 says that a Task's own Estimate stays. From the
 * same policy as its name (invariant 39).
 */
export function criterionEffectText(
  policy: CriterionPolicy,
  areaName: string | undefined,
  count?: number,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}の`;
  const bound = criterionBoundText(policy.rangePolicy);
  return count === undefined
    ? `見積もりがない${scope}タスクは、${bound}で計画します`
    : `${scope}タスク ${count}件を、${bound}で計画します`;
}
