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
    week: '今週',
    onAvailableHoursChange: () => true,
  },
  decorators: [(Story) => <div className="max-w-pane-side">{Story()}</div>],
} satisfies Meta<typeof CapacityIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ok：上限でも収まる。`ink-muted` の文。 */
export const Ok: Story = {
  args: {
    capacity: {
      availableHours: 18,
      remaining: { lo: 2, hi: 4 },
      status: 'within',
    },
  },
};

/** tight：上限側だけ超える可能性。`warning`。差は正負にかかわらず 〜。 */
export const Tight: Story = {
  args: {
    capacity: {
      availableHours: 15,
      remaining: { lo: -1, hi: 1 },
      status: 'mayExceed',
    },
  },
};

/** over：下限でも超える（確定的な容量超過）。`danger` はここだけ。 */
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
 * バー・領域ごとの内訳・計画値の説明だけ（Issue #165）。
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
