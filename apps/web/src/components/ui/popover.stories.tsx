import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { Button } from './button';
import {
  Popover,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from './popover';

const meta = {
  title: 'Components/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

// The Estimate field is a stand-in until the input components land; it
// follows label → help → input with tokens (docs/design/accessibility.md).
function EstimatePopover({ defaultOpen }: { defaultOpen?: boolean }) {
  const id = useId();
  const [estimate, setEstimate] = useState('3');
  const [draft, setDraft] = useState(estimate);
  return (
    <Popover
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        if (open) setDraft(estimate);
      }}
    >
      <PopoverTrigger
        render={<Button size="sm" variant="quiet" />}
        aria-label={`見積もり ${estimate}時間。編集する`}
      >
        {estimate}h
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>見積もりを編集</PopoverTitle>
        </PopoverHeader>
        <PopoverBody>
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-label text-ink">
              見積もり
            </label>
            <p id={`${id}-help`} className="text-help text-ink-muted">
              時間で入力（例：1.5）
            </p>
            <div className="flex items-center gap-2">
              <input
                id={id}
                inputMode="decimal"
                aria-describedby={`${id}-help`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-control-lg w-24 rounded-sm border border-border-strong bg-surface px-3 text-right text-body-l text-ink focus-visible:focus-ring medium:h-control-md medium:text-body"
              />
              <span className="text-body text-ink-muted">時間</span>
            </div>
          </div>
        </PopoverBody>
        <PopoverFooter>
          <PopoverClose render={<Button variant="quiet" />}>
            キャンセル
          </PopoverClose>
          <PopoverClose render={<Button />} onClick={() => setEstimate(draft)}>
            保存
          </PopoverClose>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}

/**
 * その場で Estimate を編集する。幅 320px、`rounded.md`、`elevation-overlay`。
 * 開くとフォーカスは閉じるボタンではなく最初の入力へ移る。保存は Secondary
 * （Popover に Primary を置かない）。Esc・外側のクリック・閉じるで閉じる。
 */
export const EstimateEdit: Story = {
  render: () => (
    <div className="pb-64">
      <EstimatePopover defaultOpen />
    </div>
  ),
};

/**
 * 開くと Estimate の入力にフォーカスが移り、Esc で閉じるとトリガーへ戻る。
 * Interactions パネルで各段階を確認できる。
 */
export const FocusFlow: Story = {
  render: () => (
    <div className="pb-64">
      <EstimatePopover />
    </div>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: /見積もり 3時間/ });
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: '見積もりを編集' });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: '見積もり' })).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
