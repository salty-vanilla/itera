import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, type ReactNode } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { Button } from './button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

// Stand-in fields for the examples. The input components come in their own
// Issue; these only follow the order label → input with tokens.
function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const inputClassName =
  'w-full rounded-sm border border-border-strong bg-surface px-3 text-body-l text-ink medium:text-body focus-visible:focus-ring';

const tasks = [
  '関連研究のメモを整理して章立てを決める',
  '実験 3 の結果を表にまとめる',
  '週次の定例の議事録を共有する',
  '確定申告の書類を集める',
];

function TaskDetailDrawer({
  modal = false,
  defaultOpen = false,
  trigger,
}: {
  modal?: boolean;
  defaultOpen?: boolean;
  trigger: string;
}) {
  return (
    <Drawer modal={modal} defaultOpen={defaultOpen}>
      <DrawerTrigger render={<Button />}>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>タスクの詳細</DrawerTitle>
          <DrawerDescription>研究 · Backlog</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <Field label="タイトル">
            {(id) => (
              <input
                id={id}
                defaultValue={tasks[0]}
                className={`${inputClassName} h-control-lg medium:h-control-md`}
              />
            )}
          </Field>
          <Field label="説明（任意）">
            {(id) => (
              <textarea
                id={id}
                rows={12}
                defaultValue="先行研究を 3 つの観点で分類し、各章で扱う範囲を決める。"
                className={`${inputClassName} resize-y py-2`}
              />
            )}
          </Field>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="quiet" />}>
            キャンセル
          </DrawerClose>
          <DrawerClose render={<Button />}>保存</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// A list behind the Drawer shows what stays visible and usable.
function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-canvas p-4">
      {children}
      <ul className="flex flex-col border-t border-border-soft">
        {tasks.map((task) => (
          <li
            key={task}
            className="flex min-h-row-touch items-center border-b border-border-soft px-3 text-task medium:min-h-row-task"
          >
            <button
              type="button"
              className="min-h-target-touch w-full truncate rounded-sm text-left focus-visible:focus-ring medium:min-h-target-min"
            >
              {task}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 既定は非モーダル。desktop は右 400px（左に `border`、`elevation-overlay`）で、
 * 背後の一覧を見ながら操作できる（scrim なし、外側のクリックでは閉じない）。
 * compact 幅では Bottom Sheet（上角 12px、グリップ）になり、画面の大半を覆うので
 * 常にモーダル（scrim あり）。ヘッダーと フッターは固定で、本文だけがスクロールする。
 * ここは Drawer の既定の形（キャンセル / 保存、最初の入力にフォーカス）。実際の
 * タスクの詳細は欄ごとに保存し、フッターは「閉じる」だけ、フォーカスは見出しに置く
 * （Issue #95、docs/design/patterns.md の Backlog Organize）。
 */
export const TaskDetail: Story = {
  render: () => (
    <Backdrop>
      <TaskDetailDrawer defaultOpen trigger="詳細を開く" />
    </Backdrop>
  ),
};

/**
 * 背後を操作させない場合だけ `modal`。`scrim` と `elevation-modal` が付き、
 * フォーカスは Drawer の中に閉じ込められる。
 */
export const Modal: Story = {
  render: () => (
    <Backdrop>
      <TaskDetailDrawer modal defaultOpen trigger="詳細を開く（modal）" />
    </Backdrop>
  ),
};

/**
 * 開くとフォーカスが最初の入力（タイトル）へ移る。Esc で閉じるとトリガーへ戻る。
 * Interactions パネルで各段階を確認できる。
 */
export const FocusFlow: Story = {
  render: () => (
    <Backdrop>
      <TaskDetailDrawer trigger="詳細を開く" />
    </Backdrop>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: '詳細を開く' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog', { name: 'タスクの詳細' });
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'タイトル' })).toHaveFocus(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
