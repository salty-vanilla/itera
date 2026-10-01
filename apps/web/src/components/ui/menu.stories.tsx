import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Ellipsis,
  Pencil,
  Sun,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { expect, screen, userEvent, waitFor } from 'storybook/test';
import { Button } from './button';
import { IconButton } from './icon-button';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from './menu';

const meta = {
  title: 'Components/Menu',
  component: Menu,
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 行の補助操作。トリガーは `…` の IconButton。項目は 32px（compact は 44px）で、
 * アイコン・ラベル・Kbd を並べる。Kbd は、タッチが主な端末（`pointer: coarse`）では出さない。
 * 破壊的な項目は `danger` で、
 * 区切りの後の最後に置く。
 * 主要な操作（完了の ○ など）はメニューに隠さない。
 */
export const RowActions: Story = {
  render: () => (
    <div className="pb-72">
      <Menu>
        <MenuTrigger
          render={<IconButton label="タスクの操作" icon={<Ellipsis />} />}
        />
        <MenuContent>
          <MenuItem>
            <Sun aria-hidden />
            今日へ
          </MenuItem>
          <MenuItem>
            <Pencil aria-hidden />
            見積もりを編集
            <MenuShortcut>E</MenuShortcut>
          </MenuItem>
          <MenuSeparator />
          <MenuItem>
            <ArrowUp aria-hidden />
            上へ
            <MenuShortcut>Alt+↑</MenuShortcut>
          </MenuItem>
          <MenuItem>
            <ArrowDown aria-hidden />
            下へ
            <MenuShortcut>Alt+↓</MenuShortcut>
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="danger">
            <Trash2 aria-hidden />
            削除
            <MenuShortcut>Delete</MenuShortcut>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  ),
  // Opens with Enter, moves with the arrow keys, Home and End, and Esc
  // returns focus to the trigger. The Interactions panel shows each step.
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: 'タスクの操作' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const first = await screen.findByRole('menuitem', { name: '今日へ' });
    await waitFor(() => expect(first).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    await expect(
      screen.getByRole('menuitem', { name: /見積もりを編集/ }),
    ).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(screen.getByRole('menuitem', { name: /削除/ })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(first).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};

/**
 * Secondary の Button をトリガーにした並び順の選択。選べる項目は
 * `menuitemradio` で、選んだ項目はチェック＋`here-subtle`。
 */
export const SortOrder: Story = {
  render: function Render() {
    const [order, setOrder] = useState('deadline');
    const labels: Record<string, string> = {
      deadline: '期限',
      priority: '優先度',
      created: '追加した順',
    };
    return (
      <div className="pb-56">
        <Menu>
          <MenuTrigger render={<Button />}>
            並び順：{labels[order]}
            <ChevronDown aria-hidden />
          </MenuTrigger>
          <MenuContent>
            <MenuGroup>
              <MenuGroupLabel>並び順</MenuGroupLabel>
              <MenuRadioGroup
                value={order}
                onValueChange={(value: string) => setOrder(value)}
              >
                {Object.entries(labels).map(([value, label]) => (
                  <MenuRadioItem key={value} value={value}>
                    {label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </MenuContent>
        </Menu>
      </div>
    );
  },
};

/**
 * 表示のオン / オフ。`menuitemcheckbox` で、押してもメニューは閉じない
 * （続けて切り替えられる）。
 */
export const Toggles: Story = {
  render: () => (
    <div className="pb-40">
      <Menu>
        <MenuTrigger render={<Button />}>
          表示
          <ChevronDown aria-hidden />
        </MenuTrigger>
        <MenuContent>
          <MenuCheckboxItem defaultChecked>完了したタスク</MenuCheckboxItem>
          <MenuCheckboxItem>アーカイブしたタスク</MenuCheckboxItem>
        </MenuContent>
      </Menu>
    </div>
  ),
};

// Names the forced state next to the label; not part of the component.
function StateLabel({ children }: { children: string }) {
  return (
    <span className="ms-auto ps-4 text-meta text-ink-subtle">{children}</span>
  );
}

const states = [
  ['default', '今日へ'],
  ['hover', '見積もりを編集'],
  ['focus', '詳細を開く'],
  ['hover-focus', '上へ'],
] as const;

/**
 * DESIGN.md「共通の状態」で Menu の項目に必須の状態：Default・Hover・Focus・
 * Disabled・checked と、危険な項目。Hover と Focus は
 * storybook-addon-pseudo-states で強制表示している。Focus は項目の内側の
 * 2px の輪郭で、hover と同時でも両方見える。無効の項目は理由を添える。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      rootSelector: 'body',
      hover: ['[data-demo="hover"]', '[data-demo="hover-focus"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
    },
  },
  render: () => (
    <div className="pb-96">
      <Menu defaultOpen modal={false}>
        <MenuTrigger
          render={<IconButton label="タスクの操作" icon={<Ellipsis />} />}
        />
        <MenuContent>
          {states.map(([state, label]) => (
            <MenuItem key={state} data-demo={state}>
              {label}
              <StateLabel>{state}</StateLabel>
            </MenuItem>
          ))}
          <MenuItem disabled>
            下へ
            <span className="ms-auto ps-4 text-meta text-ink-subtle">
              最後のタスクです
            </span>
          </MenuItem>
          <MenuSeparator />
          <MenuCheckboxItem defaultChecked>目標に入れる</MenuCheckboxItem>
          <MenuCheckboxItem defaultChecked data-demo="hover">
            完了したタスク
            <StateLabel>hover</StateLabel>
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuItem variant="danger">削除</MenuItem>
          <MenuItem variant="danger" data-demo="hover-focus">
            削除
            <StateLabel>hover-focus</StateLabel>
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  ),
};
