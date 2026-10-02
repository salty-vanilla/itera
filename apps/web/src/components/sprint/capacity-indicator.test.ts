import { capacityOf } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  capacityHeadline,
  capacityHeadlineSentences,
  capacityRelationSentences,
  capacityStatement,
  capacityStatusLine,
} from './capacity-indicator';

const headline = (lo: number, hi: number, available: number) =>
  capacityHeadlineSentences(
    capacityHeadline(capacityOf({ lo, hi }, available)),
  ).join(' · ');

describe('capacityHeadline (owner decision S5 in #93, #234)', () => {
  it('says each end while the plan fits', () => {
    expect(headline(15, 17, 18)).toBe(
      '少なく済めば 3時間残る · 多くかかっても 1時間残る',
    );
    expect(headline(16, 18, 18)).toBe(
      '少なく済めば 2時間残る · 多くかかってもちょうど収まる',
    );
  });

  it('is two sentences while the difference crosses 0', () => {
    expect(headline(14.75, 17.75, 17)).toBe(
      '少なく済めば 2時間15分残る · 多くかかれば 45分超える',
    );
    // The lower end is exactly the available hours.
    expect(headline(17, 18, 17)).toBe(
      '少なく済めばちょうど収まる · 多くかかれば 1時間超える',
    );
  });

  it('says each end when even the lower end is over', () => {
    expect(headline(17, 19, 14)).toBe(
      '少なく済んでも 3時間超える · 多くかかれば 5時間超える',
    );
  });

  it('is one sentence for a total without a range', () => {
    expect(headline(15, 15, 18)).toBe('3時間残る');
    expect(headline(18, 18, 18)).toBe('ちょうど収まる');
    expect(headline(19, 19, 18)).toBe('1時間超える');
  });

  it('does not say the numbers again in the state while the difference crosses 0', () => {
    const capacity = capacityOf({ lo: 14.75, hi: 17.75 }, 17);
    expect(capacityStatement(capacity)).toEqual({
      tone: 'tight',
      text: '超える可能性',
    });
    expect(capacityStatusLine(capacity).text).toBe(
      '超える可能性：少なく済めば 2時間15分残る · 多くかかれば 45分超える',
    );
    // While it fits, the line is the statement itself.
    const fits = capacityOf({ lo: 15, hi: 17 }, 18);
    expect(capacityStatusLine(fits)).toEqual(capacityStatement(fits));
  });

  it('says the words only in the state when even the lower end is over (#165)', () => {
    const over = capacityOf({ lo: 17, hi: 19 }, 14);
    expect(capacityStatement(over)).toEqual({
      tone: 'over',
      text: '超える',
    });
    // Where no headline is shown, the numbers follow, once.
    expect(capacityStatusLine(over).text).toBe(
      '少なく済んでも 3時間超える · 多くかかれば 5時間超える',
    );
  });

  it('says that the estimated part fits when some is left out (#165)', () => {
    const fits = capacityOf({ lo: 15, hi: 17 }, 18);
    const total = { lo: 15, hi: 17, unestimated: 2, unestimatedSubtasks: 0 };
    expect(capacityStatement(fits, total).text).toBe(
      '見積もりのある分は、使える時間の範囲に収まっています。',
    );
    expect(capacityStatement(fits, { ...total, unestimated: 0 }).text).toBe(
      '使える時間の範囲に収まっています。',
    );
  });
});

describe('capacityRelationSentences (Retro, #167)', () => {
  const relation = (lo: number, hi: number, available: number) =>
    capacityRelationSentences(capacityOf({ lo, hi }, available)).join(' · ');

  it('says how the plan stood, as the headline does (#234)', () => {
    expect(relation(17.25, 20.25, 17)).toBe(
      '少なく済んでも 15分超える · 多くかかれば 3時間15分超える',
    );
    expect(relation(15.25, 17.25, 17)).toBe(
      '少なく済めば 1時間45分残る · 多くかかれば 15分超える',
    );
    expect(relation(15, 16, 17)).toBe(
      '少なく済めば 2時間残る · 多くかかっても 1時間残る',
    );
    expect(relation(15, 17, 17)).toBe(
      '少なく済めば 2時間残る · 多くかかってもちょうど収まる',
    );
  });
});
