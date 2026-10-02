import { id, type CriterionPolicy } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  criterionMoveText,
  criterionName,
  criterionQuotedName,
  criterionTargetText,
} from './criterion-text';

describe('criterionName', () => {
  it('names the Area and the value it uses', () => {
    expect(
      criterionName(
        { scope: { kind: 'area', areaId: id('a') }, rangePolicy: 'hi' },
        '研究',
      ),
    ).toBe('研究：見積もりなしは提案の多めの値で計画');
  });

  it('heads every Area with 「すべての領域：」, never 「領域なし」', () => {
    expect(
      criterionName({ scope: { kind: 'all' }, rangePolicy: 'lo' }, undefined),
    ).toBe('すべての領域：見積もりなしは提案の少なめの値で計画');
    expect(
      criterionName({ scope: { kind: 'all' }, rangePolicy: 'mid' }, undefined),
    ).toBe('すべての領域：見積もりなしは提案のふつうの値で計画');
  });

  it('is put in 「」 inside a sentence, and never has 「多め」 alone', () => {
    const policy: CriterionPolicy = {
      scope: { kind: 'area', areaId: id('a') },
      rangePolicy: 'hi',
    };
    expect(criterionQuotedName(policy, '研究')).toBe(
      '「研究：見積もりなしは提案の多めの値で計画」',
    );
    expect(criterionName(policy, '研究')).not.toMatch(/多めで/);
  });
});

describe('criterionTargetText', () => {
  it('says only how many Tasks it acts on', () => {
    expect(criterionTargetText(1)).toBe('対象は 1件です。');
    expect(criterionTargetText(2, '今の Backlog で')).toBe(
      '対象は 2件です（今の Backlog で）。',
    );
  });
});

describe('criterionMoveText (#234)', () => {
  it('says each end that moves, in one sentence', () => {
    expect(criterionMoveText({ lo: 2, hi: 0 })).toBe(
      '少なく済んだときの合計が 2時間増えます。',
    );
    expect(criterionMoveText({ lo: 0, hi: -1 })).toBe(
      '多くかかったときの合計が 1時間減ります。',
    );
    expect(criterionMoveText({ lo: 1, hi: -1 })).toBe(
      '少なく済んだときの合計が 1時間増え、多くかかったときの合計が 1時間減ります。',
    );
    expect(criterionMoveText({ lo: 0, hi: 0 })).toBe('');
  });
});
