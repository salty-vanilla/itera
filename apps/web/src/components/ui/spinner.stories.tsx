import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  args: { label: '見積中', size: 's' },
  argTypes: { size: { control: 'inline-radio', options: ['s', 'm'] } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 必ず文言と一緒に使う。スピナーだけの形は用意していない。role="status" で
 * 文言が読み上げられる。300ms 未満で終わる処理と画面全体のローディングには
 * 使わない。prefers-reduced-motion: reduce では回転が止まり、文言で伝える。
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <Spinner label="見積中" size="s" />
      <Spinner label="保存中…" size="m" />
    </div>
  ),
};

/** Task Row の Estimate の位置で、提案を待っている間。 */
export const InARow: Story = {
  render: () => (
    <div className="flex h-row-task max-w-pane-list items-center justify-between border-y border-border-soft px-3">
      <span className="text-task">関連研究のメモを整理する</span>
      <Spinner label="見積中" />
    </div>
  ),
};
