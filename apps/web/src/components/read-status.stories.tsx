import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReadStatus } from './read-status';

const meta = {
  title: 'Components/Read Status',
  component: ReadStatus,
  args: { label: 'タスクの一覧' },
  decorators: [
    (Story) => (
      <div className="max-w-pane-rows">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReadStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 画面の記録を読んでいる間。300ms 続いたら、線（不透明度だけが動く）と
 * 「読み込み中…」を出す。それより早く終われば何も出さない。
 */
export const Pending: Story = {
  args: { read: { status: 'pending' } },
};

/** 読めなかったとき。次にできることを操作で示す（Notice の danger）。 */
export const Failed: Story = {
  args: { read: { status: 'failed', retry: () => {} } },
};
