import { describe, expect, it } from 'vitest';
import { carryOverWords } from './retro-words';

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
    ).toBe('5件：次の計画に 2件 · Backlog に 3件');
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
