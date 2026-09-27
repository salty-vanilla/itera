import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsList, TabsPanel, TabsTab } from './tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 同じ場所の表示を切り替える（例：タスクの詳細の中身）。← → で移動して選び、
 * Home / End で端へ。段階を進めるフロー（→ Sprint Header）と絞り込み（→ Filter）には
 * 使わない。タブは 5 個まで。
 */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="detail" className="max-w-measure-read">
      <TabsList aria-label="タスクの情報">
        <TabsTab value="detail">詳細</TabsTab>
        <TabsTab value="subtasks" count={3}>
          サブタスク
        </TabsTab>
        <TabsTab value="history">変更履歴</TabsTab>
      </TabsList>
      <TabsPanel value="detail" className="py-4 text-body">
        関連研究のメモを整理して、論文の章立てを決める。
      </TabsPanel>
      <TabsPanel value="subtasks" className="py-4 text-body">
        サブタスク 3件の一覧がここに入る。
      </TabsPanel>
      <TabsPanel value="history" className="py-4 text-body">
        Estimate の変更と、どの Sprint に入ったかの記録がここに入る。
      </TabsPanel>
    </Tabs>
  ),
};

/**
 * DESIGN.md「共通の状態」で Tabs に必須の状態。Selected は `ink` 700 の文字と
 * 2px の下線（色面・Pill にしない）。Hover・Focus は storybook-addon-pseudo-states で
 * 強制表示している。Focus は項目の内側のリング。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: ['[data-demo="hover"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="selected-focus"]'],
    },
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="selected">
        <TabsList aria-label="状態の一覧">
          <TabsTab value="default">default</TabsTab>
          <TabsTab value="hover" data-demo="hover" count={12}>
            hover
          </TabsTab>
          <TabsTab value="focus" data-demo="focus">
            focus
          </TabsTab>
          <TabsTab value="selected" count={3}>
            selected
          </TabsTab>
          <TabsTab value="disabled" disabled>
            disabled
          </TabsTab>
        </TabsList>
      </Tabs>
      <Tabs defaultValue="selected-focus">
        <TabsList aria-label="選択とフォーカス">
          <TabsTab value="other">default</TabsTab>
          <TabsTab value="selected-focus" data-demo="selected-focus">
            selected + focus
          </TabsTab>
        </TabsList>
      </Tabs>
    </div>
  ),
};
