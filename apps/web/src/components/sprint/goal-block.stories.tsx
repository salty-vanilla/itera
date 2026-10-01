import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalBlock } from './goal-block';

const meta = {
  title: 'Components/Goal',
  component: GoalBlock,
  parameters: { layout: 'padded' },
  args: {
    week: '今週',
    area: { name: '研究', color: 2 },
    summary: '2件 · 7.5h',
    onSave: () => true,
  },
} satisfies Meta<typeof GoalBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** set：Goal 文を `goal` で、`measure-read` の幅に組む。 */
export const Set: Story = { args: { goal: '先行研究を押さえる' } };

/** empty：「+ Goal を書く」だけ。Goal は任意だが、その説明は置かない。警告色にしない。 */
export const Empty: Story = {};

/** 実行中の Sprint の empty：「+ 目標を書く」だけ。 */
export const EmptyAfterConfirm: Story = {
  args: { removable: false },
};

/** Goal も Task もない Area：名前と「+ 目標を書く」を 1 行に。案内は添えない（Issue #161）。 */
export const Bare: Story = { args: { bare: true, summary: undefined } };

/** 確定後に文を変えた：今の文と、確定したときの文を並べる（不変条件 18、F16）。 */
export const ChangedAfterConfirm: Story = {
  args: {
    goal: '先行研究を 2本押さえる',
    planned: '先行研究を押さえる',
    removable: false,
  },
};

/** 確定後に新しく書いた：確定したときにはなかったことを添える（F16）。 */
export const WrittenAfterConfirm: Story = {
  args: {
    goal: 'オンボーディング資料を仕上げる',
    planned: null,
    removable: false,
  },
};
