import type { Meta, StoryObj } from '@storybook/react-vite';
import { GoalBlock } from './goal-block';

const meta = {
  title: 'Components/Goal',
  component: GoalBlock,
  parameters: { layout: 'padded' },
  args: {
    area: { name: '研究', color: 2 },
    summary: '2件 · 7.5h',
    onSave: () => true,
  },
} satisfies Meta<typeof GoalBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** set：Goal 文を `goal` で、`measure-read` の幅に組む。 */
export const Set: Story = { args: { goal: '先行研究を押さえる' } };

/** empty：「+ Goal を書く」と、Goal は任意であること。警告色にしない。 */
export const Empty: Story = {};
