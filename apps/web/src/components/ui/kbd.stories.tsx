import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd, KbdGroup } from './kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  args: { children: 'N' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * `code` の書体（LINE Seed JP）で、周りの文字の色を受け継ぐ。キーを色で
 * 強調しない。同時押しは KbdGroup でまとめる。
 */
export const Keys: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-body text-ink-muted">
      <span className="flex items-center gap-2">
        タスク追加欄へ <Kbd>N</Kbd>
      </span>
      <span className="flex items-center gap-2">
        Sprint を確定
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
      </span>
      <span className="flex items-center gap-2">
        並べ替え
        <KbdGroup>
          <Kbd>Alt</Kbd>
          <Kbd>↑</Kbd>
        </KbdGroup>
      </span>
    </div>
  ),
};

/** Tooltip の右端に置く。反転した面の上でも同じ部品で読める。 */
export const InTooltip: Story = {
  render: () => (
    <div className="pt-12">
      <Tooltip defaultOpen>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="rounded-sm border border-border-strong bg-surface px-3 py-1 text-button focus-visible:focus-ring"
            />
          }
        >
          タスクを追加
        </TooltipTrigger>
        <TooltipContent>
          タスクを追加 <Kbd>N</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};
