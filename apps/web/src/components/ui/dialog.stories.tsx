import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { Button } from './button';
import {
  AlertDialog,
  AlertDialogTrigger,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function SprintConfirmDialog({ defaultOpen }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [confirming, setConfirming] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirming) setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="primary" />}>
        Sprint 14 を確定
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sprint 14 を確定しますか？</DialogTitle>
          <DialogDescription>
            確定すると、各タスクの計画の時間がこの Sprint
            の値として固定されます。確定した後もタスクは追加できます。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>戻って調整</DialogClose>
          <Button
            variant="primary"
            loading={confirming}
            loadingLabel="確定中…"
            onClick={() => {
              setConfirming(true);
              setTimeout(() => {
                setConfirming(false);
                setOpen(false);
              }, 1500);
            }}
          >
            Sprint 14 を確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sprint の確定。タイトルは問いの形、ボタンは結果を書く。初期フォーカスは
 * 最も安全な操作（「戻って調整」）。確定を押すと Loading（「確定中…」）になり、
 * 幅は変わらない。
 */
export const SprintConfirm: Story = {
  render: () => <SprintConfirmDialog defaultOpen />,
};

/**
 * 破壊的操作の確認は `alertdialog`。実行ボタンだけが danger-solid で、
 * 初期フォーカスは「キャンセル」。外側のクリックでは閉じない。
 */
export const DestructiveConfirm: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger render={<Button variant="danger" />}>
        削除
      </AlertDialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>選んだ 3件を削除しますか？</DialogTitle>
          <DialogDescription>取り消せません。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>キャンセル</DialogClose>
          <DialogClose render={<Button variant="danger-solid" />}>
            3件を削除
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </AlertDialog>
  ),
};

/**
 * 幅は sm 440 / md 560 / lg 720px。compact 幅では 100% − 32px。
 * 本文が長いときは本文だけがスクロールする。
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Dialog key={size}>
          <DialogTrigger render={<Button />}>{size} を開く</DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Sprint 14 を確定しますか？</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <ul className="flex list-disc flex-col gap-2 ps-5 text-ink-muted">
                {Array.from({ length: 24 }, (_, index) => (
                  <li key={index}>確定するタスク {index + 1}</li>
                ))}
              </ul>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button />}>戻って調整</DialogClose>
              <DialogClose render={<Button variant="primary" />}>
                Sprint 14 を確定
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
};

/**
 * 開くとフォーカスが「戻って調整」へ移り、Tab は Dialog の中に閉じ込められる。
 * Esc で閉じるとトリガーへ戻る。Interactions パネルで各段階を確認できる。
 */
export const FocusFlow: Story = {
  render: () => <SprintConfirmDialog />,
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: 'Sprint 14 を確定' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'Sprint 14 を確定しますか？' });
    const safe = screen.getByRole('button', { name: '戻って調整' });
    await waitFor(() => expect(safe).toHaveFocus());
    await userEvent.tab();
    await userEvent.tab();
    await expect(safe).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
