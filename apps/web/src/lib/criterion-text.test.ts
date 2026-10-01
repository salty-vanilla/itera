import { id, type CriterionPolicy } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import { criterionEffectText, criterionName } from './criterion-text';

describe('criterionName', () => {
  it('names the Area and the value it uses', () => {
    expect(
      criterionName(
        { scope: { kind: 'area', areaId: id('a') }, rangePolicy: 'hi' },
        '研究',
      ),
    ).toBe('研究：見積もりがないときは提案の多めの値で計画する');
    expect(
      criterionName({ scope: { kind: 'all' }, rangePolicy: 'mid' }, undefined),
    ).toBe('見積もりがないときは提案のふつうの値で計画する');
  });
});

describe('criterionEffectText', () => {
  it('says how it plans, with or without a count', () => {
    const policy: CriterionPolicy = {
      scope: { kind: 'area', areaId: id('a') },
      rangePolicy: 'lo',
    };
    expect(criterionEffectText(policy, '研究')).toBe(
      '見積もりがない研究のタスクは、提案の少なめの値で計画します',
    );
    expect(criterionEffectText(policy, '研究', 2)).toBe(
      '研究のタスク 2件を、提案の少なめの値で計画します',
    );
  });
});
