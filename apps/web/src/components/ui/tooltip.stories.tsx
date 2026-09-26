import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 省略されたラベルの全文を短く示す。Tooltip は role="tooltip" で、
 * トリガーの aria-describedby から読み上げられる。アイコンだけの操作は
 * IconButton が同じ Tooltip を使う。必須の情報・エラー・操作できる内容は
 * 載せない。矢印・影・アニメーションで飾らない。
 */
export const TruncatedLabel: Story = {
  render: () => (
    // The width only forces truncation for this example.
    <div className="flex flex-col gap-2 pt-12" style={{ width: '10em' }}>
      <Tooltip defaultOpen>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="truncate rounded-sm text-left text-task text-ink focus-visible:focus-ring"
            />
          }
        >
          関連研究のメモを整理して章立てを決める
        </TooltipTrigger>
        <TooltipContent>関連研究のメモを整理して章立てを決める</TooltipContent>
      </Tooltip>
    </div>
  ),
};
