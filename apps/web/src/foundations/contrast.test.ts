import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';

describe('contrast', () => {
  it('matches the ratios quoted in DESIGN.md', () => {
    // ink on canvas (light) is 17.8:1, ink-subtle on canvas-subtle is 5.6:1,
    // on-area on area-1 is 5.2:1 (DESIGN.md Colors › コントラスト).
    expect(contrast('#16181a', '#ffffff')?.toFixed(1)).toBe('17.8');
    expect(contrast('#5c6167', '#f2f3f4')?.toFixed(1)).toBe('5.6');
    expect(contrast('#ffffff', '#0a6fbd')?.toFixed(1)).toBe('5.2');
  });

  it('skips values that are not opaque #rrggbb', () => {
    expect(contrast('#16181a66', '#ffffff')).toBeUndefined();
  });
});
