import type { Meta, StoryObj } from '@storybook/react-vite';
import { SprintSummary } from './sprint-summary';

const meta = {
  title: 'Components/Sprint Summary',
  component: SprintSummary,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SprintSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 完了 / 持ち越し / スキップ / 週の途中の追加 / 計画値と使える時間。点数や割合は出さない。 */
export const Default: Story = {
  args: {
    items: [
      { label: '完了', value: 4, unit: '件' },
      { label: '持ち越し', value: 2, unit: '件' },
      { label: 'スキップ', value: 1, unit: '回' },
      { label: '週の途中の追加', value: 1, unit: '件' },
      {
        label: '計画値の合計',
        value: '17.25–20.25h',
        note: '使える時間 17h',
      },
    ],
  },
};
