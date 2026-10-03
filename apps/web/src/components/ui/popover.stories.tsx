import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { durationText, readMinutes } from '@/lib/duration-text';
import { formatHours } from '@/lib/time-format';
import { Button } from './button';
import { DurationField } from './duration-field';
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

// The Estimate is typed in DurationField, as on the screens (#252).
function EstimatePopover({ defaultOpen }: { defaultOpen?: boolean }) {
  const [estimate, setEstimate] = useState(180);
  const [draft, setDraft] = useState(() => durationText(estimate));
  return (
    <Popover
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        if (open) setDraft(durationText(estimate));
      }}
    >
      <PopoverTrigger
        render={<Button size="sm" variant="quiet" />}
        aria-label={`見積もり ${formatHours(estimate / 60)}。編集する`}
      >
        {formatHours(estimate / 60)}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>見積もりを編集</PopoverTitle>
        </PopoverHeader>
        <PopoverBody>
          <DurationField label="見積もり" value={draft} onChange={setDraft} />
        </PopoverBody>
        <PopoverFooter>
          <PopoverClose render={<Button variant="quiet" />}>
            キャンセル
          </PopoverClose>
          <PopoverClose
            render={<Button />}
            onClick={() => setEstimate(readMinutes(draft) || estimate)}
          >
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
      expect(screen.getByRole('textbox', { name: '時間' })).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
