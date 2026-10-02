import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSESSMENTS, AssessmentTag, carryOverWords } from './retro-words';

afterEach(cleanup);

describe('carryOverWords (#209)', () => {
  it('names one place with its count', () => {
    expect(
      carryOverWords({
        total: 2,
        inNext: 0,
        candidates: 2,
        completed: 0,
        archived: 0,
      }),
    ).toBe('Backlog に 2件');
  });

  it('leads with the total when the Tasks are in more than one place', () => {
    expect(
      carryOverWords({
        total: 5,
        inNext: 2,
        candidates: 3,
        completed: 0,
        archived: 0,
      }),
    ).toBe('5件：次の Sprint に 2件 · Backlog に 3件');
    expect(
      carryOverWords({
        total: 3,
        inNext: 0,
        candidates: 1,
        completed: 1,
        archived: 1,
      }),
    ).toBe('3件：Backlog に 1件 · 完了 1件 · アーカイブ 1件');
  });
});

describe('自己判定の語 (#205)', () => {
  it('offers 決めない as a choice', () => {
    expect(ASSESSMENTS.map((a) => a.label)).toEqual([
      'できた',
      '一部できた',
      'できなかった',
      '決めない',
    ]);
  });

  it('says 決めなかった on the Tag, and the choice’s word otherwise', () => {
    const tag = (value: (typeof ASSESSMENTS)[number]['value']) =>
      render(<AssessmentTag value={value} />).container.textContent;
    expect(tag('notJudged')).toBe('決めなかった');
    cleanup();
    expect(tag('achieved')).toBe('できた');
    cleanup();
    expect(tag('partly')).toBe('一部できた');
  });
});
