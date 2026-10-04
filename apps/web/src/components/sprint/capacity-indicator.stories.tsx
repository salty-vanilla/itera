import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapacityIndicator } from './capacity-indicator';

const areas = [
  { key: 'work', name: '仕事', color: 1 as const, lo: 5, hi: 7 },
  { key: 'research', name: '研究', color: 2 as const, lo: 7.5, hi: 7.5 },
  { key: 'study', name: '学習', color: 3 as const, lo: 1.5, hi: 1.5 },
];
const total = { lo: 14, hi: 16, unestimated: 1, unestimatedSubtasks: 0 };

const meta = {
  title: 'Components/Capacity Indicator',
  component: CapacityIndicator,
  parameters: { layout: 'padded' },
  args: {
    total,
    areas,
    hoursField: {
      etag: '"1"',
      save: () => ({
        ok: true,
        written: { over: [{ etag: '"1"' }], now: { etag: '"2"' } },
      }),
    },
  },
  decorators: [(Story) => <div className="max-w-pane-side">{Story()}</div>],
} satisfies Meta<typeof CapacityIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ok：多くかかっても残る。`ink-muted` の文。 */
export const Ok: Story = {
  args: {
    capacity: {
      availableHours: 18,
      remaining: { lo: 2, hi: 4 },
      status: 'within',
    },
  },
};

/** tight：多くかかれば超える可能性。`warning`。数字は `ink` のまま。 */
export const Tight: Story = {
  args: {
    capacity: {
      availableHours: 15,
      remaining: { lo: -1, hi: 1 },
      status: 'mayExceed',
    },
  },
};

/** over：少なく済んでも超える（確定的な容量超過）。数字が `danger` になるのはここだけ。 */
export const Over: Story = {
  args: {
    capacity: {
      availableHours: 11,
      remaining: { lo: -5, hi: -3 },
      status: 'exceeds',
    },
  },
};

/** unknown：使える時間が未入力。 */
export const Unknown: Story = {};

/**
 * Planning の確かめるの右列：数字・状態・入力欄は中央の要約にだけ置き、ここは
 * バーと領域ごとの内訳だけ（Issue #165）。
 */
export const BreakdownOnly: Story = {
  args: {
    breakdownOnly: true,
    capacity: {
      availableHours: 11,
      remaining: { lo: -5, hi: -3 },
      status: 'exceeds',
    },
  },
};
