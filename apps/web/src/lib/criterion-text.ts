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

/**
 * What the criterion does to a Planning: 「研究の幅のあるタスクを上限で
 * 計画します」, or with `count`, 「研究の幅のあるタスク 1件を…」. From the
 * same policy as its name (invariant 39).
 */
export function criterionEffectText(
  policy: CriterionPolicy,
  areaName: string | undefined,
  count?: number,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}の`;
  const tasks =
    count === undefined ? '幅のあるタスク' : `幅のあるタスク ${count}件`;
  return `${scope}${tasks}を${BOUND_WORDS[policy.rangePolicy]}で計画します`;
}
