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
    ).toBe('研究の推定幅 → 上限を計画値に');
    expect(
      criterionName({ scope: { kind: 'all' }, rangePolicy: 'mid' }, undefined),
    ).toBe('推定幅 → 中央を計画値に');
  });
});
