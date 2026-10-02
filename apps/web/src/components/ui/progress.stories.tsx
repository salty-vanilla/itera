import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from './progress';

const meta = {
  title: 'Components/Progress',
  component: Progress,
  args: { label: '完了', value: 7, max: 18, unit: '件', thin: false },
  decorators: [
    (Story) => (
      <div className="max-w-pane-side">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 4px（thin は 2px）の線と数値。数値は必ず併記し、aria-valuetext でも同じ
 * 「7 / 18件」を読み上げる。塗りは墨だけで、段階で色を変えない。
 * Goal の達成度を数値化するのには使わない。
 */
export const Values: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Progress label="完了" value={0} max={18} unit="件" />
      <Progress label="完了" value={7} max={18} unit="件" />
      <Progress label="完了" value={18} max={18} unit="件" />
      <Progress label="今日やる" value={2} max={5} unit="件" thin />
    </div>
  ),
};

/**
 * 画面の答えのときだけ、数値を num-l でラベルの下に置く（実行中の Sprint の
 * 「今週の完了」。今日の画面は num-s のまま。Issue #243）。
 */
export const Large: Story = {
  args: { label: '今週の完了', value: 4, max: 9, large: true },
};

/**
 * 件数が分からない間は数値の代わりに文言を出し、線は明滅する（動かさない）。
 * prefers-reduced-motion: reduce では線が止まり、文言で状態を伝える。
 */
export const Indeterminate: Story = {
  args: { value: null, indeterminateText: '読み込み中…' },
};
