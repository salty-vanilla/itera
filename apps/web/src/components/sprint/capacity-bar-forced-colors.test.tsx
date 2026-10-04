// jsdom has no forced-colors mode, so this keeps the two halves of #359
// together: the bar's parts carry the slots, and the forced-colors block of
// globals.css has a rule for each of them. Computed colours were measured in
// Chromium with `forcedColors: 'active'` (see the PR).
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { forcedColorsBlock } from '@/test/forced-colors';
import { CapacityIndicator } from './capacity-indicator';

afterEach(cleanup);

const areas = [
  { key: 'work', name: '仕事', color: 1 as const, lo: 5, hi: 7 },
  { key: 'research', name: '研究', color: 2 as const, lo: 7.5, hi: 7.5 },
];
const total = { lo: 12.5, hi: 14.5, unestimated: 0, unestimatedSubtasks: 0 };

describe('Capacity bar in forced colors (#359)', () => {
  it('has a rule in the forced-colors block for each part drawn by a background', () => {
    const { container } = render(
      <CapacityIndicator
        total={total}
        capacity={{
          availableHours: 13,
          remaining: { lo: -0.5, hi: 1.5 },
          status: 'mayExceed',
        }}
        areas={areas}
      />,
    );
    const block = forcedColorsBlock();
    for (const slot of [
      'capacity-bar-track',
      'capacity-bar-segment',
      'capacity-bar-open',
      'capacity-bar-marker',
    ]) {
      expect(container.querySelector(`[data-slot='${slot}']`)).not.toBeNull();
      expect(block).toContain(`[data-slot='${slot}']`);
    }
  });

  it('keeps the Area colour and draws the marker in CanvasText', () => {
    const block = forcedColorsBlock();
    const rule = (slot: string) =>
      block.match(new RegExp(`\\[data-slot='${slot}'\\] \\{([^}]*)\\}`))?.[1];
    expect(rule('capacity-bar-segment')).toContain('forced-color-adjust: none');
    expect(rule('capacity-bar-marker')).toContain('CanvasText');
  });
});
