import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: '差分を確認',
    variant: 'secondary',
    size: 'md',
    disabled: false,
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'quiet', 'danger', 'danger-solid'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 既定は Secondary。Primary は 1 画面に 1 つ。danger はアーカイブの入口、
 * danger-solid は破壊的操作の確認 Dialog の実行ボタンだけに使う。
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Sprint を確定</Button>
      <Button variant="secondary">差分を確認</Button>
      <Button variant="quiet">キャンセル</Button>
      <Button variant="danger">アーカイブ</Button>
      <Button variant="danger-solid">完全に削除</Button>
    </div>
  ),
};

/** compact 幅（768px 未満）では、どのサイズも 44px になる。 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">差分を確認</Button>
      <Button size="md">差分を確認</Button>
      <Button size="lg">差分を確認</Button>
    </div>
  ),
};

/** 先頭・末尾に 16px のアイコン（任意）。すべてのボタンには付けない。 */
export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <Plus aria-hidden />
        タスクを追加
      </Button>
      <Button>
        並び順: 期限
        <ChevronDown aria-hidden />
      </Button>
    </div>
  ),
};

const variants = [
  ['primary', 'Sprint を確定', '確定中…'],
  ['secondary', '下書きを保存', '保存中…'],
  ['quiet', '計画案を取り消す', '取り消し中…'],
  ['danger', 'アーカイブ', 'アーカイブ中…'],
  ['danger-solid', '完全に削除', '削除中…'],
] as const;

const states = ['default', 'hover', 'focus', 'hover-focus', 'active'] as const;

/**
 * DESIGN.md「共通の状態」で Button に必須の状態。Hover・Focus・Active は
 * storybook-addon-pseudo-states で強制表示している。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: ['[data-demo="hover"]', '[data-demo="hover-focus"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
      active: ['[data-demo="active"]'],
    },
  },
  render: () => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-left">
        <thead>
          <tr className="text-label text-ink-muted">
            <th scope="col" className="px-3 py-2">
              variant
            </th>
            {states.map((state) => (
              <th key={state} scope="col" className="px-3 py-2">
                {state}
              </th>
            ))}
            <th scope="col" className="px-3 py-2">
              disabled
            </th>
            <th scope="col" className="px-3 py-2">
              loading
            </th>
          </tr>
        </thead>
        <tbody>
          {variants.map(([variant, label, loadingLabel]) => (
            <tr key={variant}>
              <th scope="row" className="px-3 py-3 text-label text-ink-muted">
                {variant}
              </th>
              {states.map((state) => (
                <td key={state} className="px-3 py-3">
                  <Button variant={variant} data-demo={state}>
                    {label}
                  </Button>
                </td>
              ))}
              <td className="px-3 py-3">
                <Button variant={variant} disabled>
                  {label}
                </Button>
              </td>
              <td className="px-3 py-3">
                <Button variant={variant} loading loadingLabel={loadingLabel}>
                  {label}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

/**
 * 無効にするときは理由を近くに書く。無効のボタンもフォーカスでき、理由は
 * aria-describedby で読み上げられる。可能なら無効にせず、押したときに理由を示す。
 * 例は、前の Sprint が Closed でないと確定できない条件（ドメインモデルの変更表 #12）。
 */
export const DisabledWithReason: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Button variant="primary" disabled aria-describedby="confirm-reason">
        Sprint を確定
      </Button>
      <p id="confirm-reason" className="text-help text-ink-muted">
        前の Sprint の振り返りを完了すると確定できます。
      </p>
    </div>
  ),
};

/**
 * 押すと 2 秒間 Loading になる。先頭にスピナー、ラベルは「確定中…」、
 * 幅は変わらない。300ms 未満で終わる処理には使わない。
 */
export const Loading: Story = {
  render: function LoadingDemo() {
    const [loading, setLoading] = useState(false);
    return (
      <Button
        variant="primary"
        loading={loading}
        loadingLabel="確定中…"
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 2000);
        }}
      >
        Sprint を確定
      </Button>
    );
  },
};

/** Primary は右端、Secondary / Quiet はその左に並べる。 */
export const Placement: Story = {
  render: () => (
    <div className="flex max-w-drawer justify-end gap-2 border-t border-border pt-4">
      <Button variant="quiet">キャンセル</Button>
      <Button variant="secondary">下書きを保存</Button>
      <Button variant="primary">Sprint を確定</Button>
    </div>
  ),
};
