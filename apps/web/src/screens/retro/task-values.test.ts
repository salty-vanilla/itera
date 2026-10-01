import type { TaskFact } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { differenceText } from './task-values';

// Only the difference is read; the rest of the fact does not matter here.
const fact = (lo: number, hi: number) =>
  ({ actualVsPlan: { lo, hi } }) as unknown as TaskFact;

describe('differenceText (#167, #234)', () => {
  it('says a range by 計画の幅, not by its ends', () => {
    expect(differenceText(fact(1, 3))).toBe('計画の幅より 1h 多い');
    expect(differenceText(fact(-2, -0.5))).toBe('計画の幅より 30m 少ない');
    expect(differenceText(fact(-1, 1))).toBe('計画の幅の中');
    expect(differenceText(fact(-0.5, -0.5))).toBe('計画より 30m 少ない');
  });
});
