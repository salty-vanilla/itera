import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CarryOverText } from './backlog-row';

afterEach(cleanup);

describe('CarryOverText (#205)', () => {
  it('says only the count below 3', () => {
    const { container } = render(<CarryOverText count={2} fromSprint={1} />);
    expect(container.textContent).toBe('持ち越し 2回（Sprint 1から）');
  });

  it('from 3, adds 「小さく分けてみる」, breaking only at 「 · 」', () => {
    const { container } = render(<CarryOverText count={3} fromSprint={1} />);
    expect(container.textContent).toBe(
      '持ち越し 3回（Sprint 1から） · 小さく分けてみる',
    );
    const parts = [...container.querySelectorAll('.nowrap-phrase')].map(
      (e) => e.textContent,
    );
    expect(parts).toEqual(['持ち越し 3回（Sprint 1から）', '小さく分けてみる']);
  });
});
