// A planning criterion in words (DESIGN.md Components › 計画のルール): a short
// name, 「研究：提案の多めで計画」, said wherever the criterion is, and its
// condition and effect said once, in its card (#241). The value comes from
// the one policy (invariant 39); only the wording is made here. The three
// values of a suggestion are said on the 「少ない・多い」 axis of 「少なく済めば
// / 多くかかれば」 (#234).
import type { CriterionPolicy, SuggestionBound } from '@itera/domain';
import { formatHours } from '@/lib/time-format';

export const BOUND_WORDS: Readonly<Record<SuggestionBound, string>> = {
  lo: '少なめ',
  mid: 'ふつう',
  hi: '多め',
};

/** 「研究：提案の多めで計画」, without 「研究：」 for every Area. */
export function criterionName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  const scope = policy.scope.kind === 'all' ? '' : `${areaName ?? '領域'}：`;
  return `${scope}提案の${BOUND_WORDS[policy.rangePolicy]}で計画`;
}

/** 「提案の多めの値」: which value of the suggestion the criterion plans with. */
export function criterionBoundText(bound: SuggestionBound): string {
  return `提案の${BOUND_WORDS[bound]}の値`;
}

/**
 * What the criterion does to a Planning, said by how it plans (#206), with
 * its condition, 「見積もりがない」, which the name leaves out (#241):
 * 「見積もりがない研究のタスクは、提案の多めの値で計画します」, or with
 * `count`, 「見積もりがない研究のタスク 1件を、提案の多めの値で計画します」.
 * From the same policy as its name (invariant 39).
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
    : `見積もりがない${scope}タスク ${count}件を、${bound}で計画します`;
}

/**
 * How applying the criterion moves the planned total, by its ends (#234):
 * 「少なく済んだときの合計が 2時間増えます。」, one sentence when both move:
 * 「少なく済んだときの合計が 1時間増え、多くかかったときの合計が 1時間減ります。」.
 * Empty when neither moves.
 */
export function criterionMoveText(delta: {
  readonly lo: number;
  readonly hi: number;
}): string {
  const moves = [
    { end: '少なく済んだとき', by: delta.lo },
    { end: '多くかかったとき', by: delta.hi },
  ].filter((m) => m.by !== 0);
  return moves
    .map(({ end, by }, i) => {
      const last = i === moves.length - 1;
      const verb =
        by > 0
          ? last
            ? '増えます。'
            : '増え、'
          : last
            ? '減ります。'
            : '減り、';
      return `${end}の合計が ${formatHours(Math.abs(by))}${verb}`;
    })
    .join('');
}
