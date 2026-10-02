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

/**
 * 完了 / 持ち越し / 繰り返し / 週の途中の追加、その下に計画と実績。点数や割合は出さない。
 * 答えの完了・持ち越しだけを num-l にし、ほかは quiet（num-m）にする（Issue #243）。
 */
export const Default: Story = {
  args: {
    items: [
      { label: '完了', value: 4, unit: '件' },
      { label: '持ち越し', value: 2, unit: '件' },
      {
        label: '繰り返し',
        value: 4,
        unit: '回',
        note: '完了 3 · スキップ 1 · 未完了 0',
        quiet: true,
      },
      { label: '週の途中の追加', value: 1, unit: '件', quiet: true },
      {
        label: '計画',
        value: '17時間15分〜20時間15分',
        lower: true,
        note: '見積もりなし 1件',
        quiet: true,
      },
      {
        label: '実績',
        value: '17時間45分',
        lower: true,
        note: '入力済み 8件',
        quiet: true,
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
      { label: '繰り返し', value: 0, unit: '回', quiet: true },
    ],
  },
};
