import { capacityOf } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  capacityHeadline,
  capacityHeadlineSentences,
  capacityStatement,
  capacityStatusLine,
} from './capacity-indicator';

const headline = (lo: number, hi: number, available: number) =>
  capacityHeadlineSentences(
    capacityHeadline(capacityOf({ lo, hi }, available)),
  ).join(' · ');

describe('capacityHeadline (owner decision S5 in #93)', () => {
  it('is a range while the plan fits', () => {
    expect(headline(15, 17, 18)).toBe('残り 1 〜 3h');
    expect(headline(16, 18, 18)).toBe('残り 0 〜 2h');
  });

  it('is two sentences while the difference crosses 0', () => {
    expect(headline(14.75, 17.75, 17)).toBe(
      '下限なら 2.25h 残る · 上限なら 0.75h 超える',
    );
    // The lower end is exactly the available hours.
    expect(headline(17, 18, 17)).toBe(
      '下限ならちょうど収まる · 上限なら 1h 超える',
    );
  });

  it('is 超過 as a range when even the lower end is over', () => {
    expect(headline(17, 19, 14)).toBe('超過 3 〜 5h');
  });

  it('does not say the numbers again in the state while the difference crosses 0', () => {
    const capacity = capacityOf({ lo: 14.75, hi: 17.75 }, 17);
    expect(capacityStatement(capacity)).toEqual({
      tone: 'tight',
      text: '超える可能性',
    });
    expect(capacityStatusLine(capacity).text).toBe(
      '超える可能性：下限なら 2.25h 残る · 上限なら 0.75h 超える',
    );
    // Otherwise the line is the statement itself.
    const over = capacityOf({ lo: 17, hi: 19 }, 14);
    expect(capacityStatusLine(over)).toEqual(capacityStatement(over));
  });
});
