import type { TaskFact } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { differenceText } from './task-values';

// Only the difference is read; the rest of the fact does not matter here.
const fact = (lo: number, hi: number) =>
  ({ actualVsPlan: { lo, hi } }) as unknown as TaskFact;

describe('differenceText (#167, #234, #241)', () => {
  it('says a range by 計画の幅, not by its ends', () => {
    expect(differenceText(fact(1, 3))).toBe('計画の幅より 1時間多い');
    expect(differenceText(fact(-2, -0.5))).toBe('計画の幅より 30分少ない');
    expect(differenceText(fact(-0.5, -0.5))).toBe('計画より 30分少ない');
  });

  it('says nothing without a difference', () => {
    expect(differenceText(fact(-1, 1))).toBeUndefined();
    expect(differenceText(fact(0, 0))).toBeUndefined();
  });
});
