// A planning criterion in words (DESIGN.md Components › 計画のルール): its
// name, 「研究：見積もりなしは提案の多めの値で計画」, made here and nowhere
// else, so that every screen says it in one form (#254). It carries the
// condition and the effect; the card says only how many Tasks it acts on and
// what that does to the total (#254, #241). The value comes from the one
// policy (invariant 39); only the wording is made here. The three values of a
// suggestion are said on the 「少ない・多い」 axis of 「少なく済めば / 多くかかれば」
// (#234), and 「多め」 is never alone, since 「多めに見て」 reads as 「大目に見る」.
import type { CriterionPolicy, SuggestionBound } from '@itera/domain';
import { formatHours } from '@/lib/time-format';

export const BOUND_WORDS: Readonly<Record<SuggestionBound, string>> = {
  lo: '少なめ',
  mid: 'ふつう',
  hi: '多め',
};

/**
 * 「研究：見積もりなしは提案の多めの値で計画」. For every Area the head is
 * 「すべての領域：」, so that the form is one and is not read as 「領域なし」.
 * Said alone (a heading, a line), or in a sentence through
 * `criterionQuotedName`.
 */
export function criterionName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  const scope =
    policy.scope.kind === 'all' ? 'すべての領域' : (areaName ?? '領域');
  return `${scope}：見積もりなしは${criterionBoundText(policy.rangePolicy)}で計画`;
}

/** The name inside a sentence: 「「研究：見積もりなしは提案の多めの値で計画」」. */
export function criterionQuotedName(
  policy: CriterionPolicy,
  areaName: string | undefined,
): string {
  return `「${criterionName(policy, areaName)}」`;
}

/** 「提案の多めの値」: which value of the suggestion the criterion plans with. */
export function criterionBoundText(bound: SuggestionBound): string {
  return `提案の${BOUND_WORDS[bound]}の値`;
}

/**
 * 「対象は 1件です。」: how many Tasks the criterion acts on, with where they
 * are counted when that is not the plan: 「対象は 2件です（今の Backlog で）。」
 */
export function criterionTargetText(count: number, where?: string): string {
  return where === undefined
    ? `対象は ${count}件です。`
    : `対象は ${count}件です（${where}）。`;
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
