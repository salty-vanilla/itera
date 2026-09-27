// A planning criterion in words (DESIGN.md Components › 計画基準:
// 「研究の推定幅 → 上限を計画値に」). The value comes from the one policy
// (invariant 39); only the wording is made here.
import type { CriterionPolicy, SuggestionBound } from '@itera/domain';

export const BOUND_WORDS: Readonly<Record<SuggestionBound, string>> = {
  lo: '下限',
  mid: '中央',
  hi: '上限',
};

/** 「研究の推定幅 → 上限を計画値に」, or 「推定幅 → …」 for every Area. */
export function criterionName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}の`;
  return `${scope}推定幅 → ${BOUND_WORDS[policy.rangePolicy]}を計画値に`;
}
