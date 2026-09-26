import { describe, expect, it } from 'vitest';
import { contrast } from './contrast';

describe('contrast', () => {
  it('matches the ratios quoted in DESIGN.md', () => {
    // ink on canvas (light) is 14.2:1, primary on canvas is 9.1:1.
    expect(contrast('#2b2b29', '#ffffff')?.toFixed(1)).toBe('14.2');
    expect(contrast('#2a4a6e', '#ffffff')?.toFixed(1)).toBe('9.1');
  });

  it('skips values that are not opaque #rrggbb', () => {
    expect(contrast('#1f1f1d52', '#ffffff')).toBeUndefined();
  });
});
