import type { PlanningValue, SuggestionBound } from '@itera/api-contract';
import { criterionBoundText } from '@/lib/criterion-text';

/**
 * Where a Planning row's value comes from, said after it, when it comes from
 * a suggestion (#250): 「（提案）」, or 「（提案の多めの値）」 where the
 * criterion plans with one value of it. A recurring Task's value is one
 * occurrence's times the week's occurrences, so it says how many
 * (「（提案 × 4回）」「（提案の多めの値 × 4回）」, the owner's decision).
 */
export function plannedSourceText(
  value: PlanningValue,
  criterionBound: SuggestionBound | undefined,
  occurrenceCount: number | undefined,
): string | undefined {
  if (value.base !== 'suggestion') return undefined;
  const source =
    value.criterionApplied && criterionBound !== undefined
      ? criterionBoundText(criterionBound)
      : '提案';
  const times = occurrenceCount === undefined ? '' : ` × ${occurrenceCount}回`;
  return `（${source}${times}）`;
}
