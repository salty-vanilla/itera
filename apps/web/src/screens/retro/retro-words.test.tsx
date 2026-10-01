import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ASSESSMENTS, AssessmentTag } from './retro-words';

afterEach(cleanup);

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
