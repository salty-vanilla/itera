import { id } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { criterionName } from './criterion-text';

describe('criterionName', () => {
  it('names the Area and the end it uses', () => {
    expect(
      criterionName(
        { scope: { kind: 'area', areaId: id('a') }, rangePolicy: 'hi' },
        '研究',
      ),
    ).toBe('研究：見積もりの提案の上限で計画する');
    expect(
      criterionName({ scope: { kind: 'all' }, rangePolicy: 'mid' }, undefined),
    ).toBe('見積もりの提案の中央で計画する');
  });
});
