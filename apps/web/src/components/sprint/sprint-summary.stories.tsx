import type { Meta, StoryObj } from '@storybook/react-vite';
import { CornerDownRight } from 'lucide-react';
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
        label: '計画の合計',
        value: '17.25–20.25h',
        note: '使える時間 17h',
      },
    ],
  },
};

/** 持ち越しの件数は、その行へ移るボタン。固定のアイコンを付け、0 件のときは文字だけ。 */
export const WithJump: Story = {
  args: {
    items: [
      { label: '完了', value: 4, unit: '件' },
      {
        label: '持ち越し',
        icon: <CornerDownRight aria-hidden />,
        value: 2,
        unit: '件',
        onSelect: () => {},
        selectLabel: '持ち越し 2件の行へ移る',
      },
      { label: 'スキップ', value: 0, unit: '回' },
    ],
  },
};
