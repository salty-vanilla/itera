import type { Instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { plannedSourceText } from './planned-source';

const computedAt = '2026-09-27T11:00:00Z' as Instant;
const suggestion = (lo: number, hi: number, criterionApplied: boolean) =>
  ({ base: 'suggestion', lo, hi, criterionApplied, computedAt }) as const;

describe('plannedSourceText (#250)', () => {
  it('says which value of the suggestion the row plans with', () => {
    expect(plannedSourceText(suggestion(3, 5, false), 'hi', undefined)).toBe(
      '（提案）',
    );
    expect(plannedSourceText(suggestion(5, 5, true), 'hi', undefined)).toBe(
      '（提案の多めの値）',
    );
  });

  it('says the occurrences a recurring Task’s value is made of', () => {
    expect(plannedSourceText(suggestion(4, 8, false), 'hi', 4)).toBe(
      '（提案 × 4回）',
    );
    expect(plannedSourceText(suggestion(8, 8, true), 'hi', 4)).toBe(
      '（提案の多めの値 × 4回）',
    );
  });

  it('says nothing for the person’s own values', () => {
    expect(
      plannedSourceText(
        { base: 'estimate', lo: 2, hi: 2, criterionApplied: false, computedAt },
        'hi',
        undefined,
      ),
    ).toBeUndefined();
  });
});
