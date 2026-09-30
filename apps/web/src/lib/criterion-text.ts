// A planning criterion in words (DESIGN.md Components › 計画基準:
// 「研究：提案の幅の上限で計画する」). The value comes from the one policy
// (invariant 39); only the wording is made here.
import type { CriterionPolicy, SuggestionBound } from '@itera/domain';

export const BOUND_WORDS: Readonly<Record<SuggestionBound, string>> = {
  lo: '下限',
  mid: '中央',
  hi: '上限',
};

/** 「研究：提案の幅の上限で計画する」, or 「提案の幅の…」 for every Area. */
export function criterionName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}：`;
  return `${scope}提案の幅の${BOUND_WORDS[policy.rangePolicy]}で計画する`;
}
