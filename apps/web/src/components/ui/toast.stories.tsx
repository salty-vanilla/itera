import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import { Button } from './button';
import { ToastProvider, useToast, type ToastOptions } from './toast';

const meta = {
  title: 'Components/Toast',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="p-4">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const examples = {
  neutral: {
    tone: 'neutral',
    title: '3件を今週に入れました',
    action: { label: '元に戻す', onClick: () => {} },
  },
  done: { tone: 'done', title: 'Sprint 14 を確定しました' },
  danger: {
    tone: 'danger',
    title: '保存できませんでした',
    description:
      '記録は変わっていません。内容を確かめてもう一度試してください。',
  },
  // 再試行 only where the write may have been saved: sending it again is
  // safe (content.md 保存の失敗, #320).
  unknown: {
    tone: 'danger',
    title: '保存できたかわかりませんでした',
    description: '記録が変わったかもしれません。最新の記録を見てください。',
    action: { label: '再試行', onClick: () => {} },
  },
} satisfies Record<string, ToastOptions>;

function ShowOnMount({ toasts }: { toasts: ToastOptions[] }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    for (const options of toasts) toast.show(options);
  }, [toast, toasts]);
  return null;
}

function Triggers() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast.show(examples.neutral)}>neutral</Button>
      <Button onClick={() => toast.show(examples.done)}>done</Button>
      <Button onClick={() => toast.show(examples.danger)}>danger</Button>
      <Button onClick={() => toast.show(examples.unknown)}>
        danger with 再試行
      </Button>
    </div>
  );
}

/**
 * 面 surface＋border、rounded.md、elevation-overlay。desktop は左下、
 * compact は下部タブバーの上（高さは画面側が --toast-offset-bottom で渡す）。
 * 8 秒（操作付きは 16 秒）で消え、pointer が載っている間とフォーカスが中にある間は止まる
 * （F6 で Toast へ移れる）。同じ種類は最新の 1 つに置き換え、種類が違うものは同時に 3 つまで。danger は role="alert" で
 * 読み上げる。ボタンを押すと Toast が出る。
 */
export const Tones: Story = {
  render: () => (
    <>
      <ShowOnMount
        toasts={[examples.neutral, examples.done, examples.danger]}
      />
      <Triggers />
    </>
  ),
};

/** 操作は Quiet の「元に戻す」「再試行」。押すと Toast も閉じる。 */
export const WithUndo: Story = {
  render: () => (
    <>
      <ShowOnMount toasts={[examples.neutral]} />
      <Triggers />
    </>
  ),
};

/**
 * 保存できたかが分からない失敗の「再試行」。同じ書き込みを同じキーで送り直す。
 * 閉じるまで残る。保存できなかった失敗には付けない（content.md の「保存の失敗」）。
 */
export const WithRetry: Story = {
  render: () => (
    <>
      <ShowOnMount toasts={[examples.unknown]} />
      <Triggers />
    </>
  ),
};
