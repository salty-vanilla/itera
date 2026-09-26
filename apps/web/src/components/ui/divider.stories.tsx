import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider, DividerLabel } from './divider';

const meta = {
  title: 'Components/Divider',
  component: Divider,
  args: { variant: 'default', orientation: 'horizontal' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'soft', 'rule'] },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div
      className={
        args.orientation === 'vertical'
          ? 'flex h-10 gap-3'
          : 'flex flex-col gap-3'
      }
    >
      <span className="text-body">前</span>
      <Divider {...args} />
      <span className="text-body">後</span>
    </div>
  ),
};

/**
 * default は構造の罫、soft はリスト内の行区切り、rule は考える領域の上端
 * （墨 1px、1 画面に 1〜2 本）、label はグループ見出し。どれも 1px で、
 * 太い罫・二重線・点線は使わない。
 */
export const Variants: Story = {
  render: () => (
    <div className="flex max-w-drawer flex-col gap-6">
      {(['default', 'soft', 'rule'] as const).map((variant) => (
        <div key={variant} className="flex flex-col gap-2">
          <span className="text-label text-ink-muted">{variant}</span>
          <Divider variant={variant} />
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <span className="text-label text-ink-muted">label</span>
        <DividerLabel>今週</DividerLabel>
      </div>
    </div>
  ),
};

/** Task density：グループ見出しはラベル付き Divider、行の区切りは soft。 */
export const InAList: Story = {
  render: () => (
    <div className="max-w-pane-list">
      {[
        ['今週', ['関連研究のメモを整理する', '実験のスクリプトを直す']],
        ['来週以降', ['学会の宿を取る']],
      ].map(([group, tasks]) => (
        <section key={group as string}>
          <DividerLabel level={3}>{group}</DividerLabel>
          <ul>
            {(tasks as string[]).map((task, index) => (
              <li key={task}>
                {index > 0 && <Divider variant="soft" />}
                <div className="flex h-row-task items-center px-3 text-task">
                  {task}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  ),
};

/** Thinking space：セクションの上端に墨の rule を引き、罫と余白で区切る。 */
export const Rule: Story = {
  render: () => (
    <section className="flex max-w-measure-read flex-col gap-3">
      <Divider variant="rule" />
      <h2 className="text-display-m">今週の Goal</h2>
      <p className="text-goal">関連研究の章を書き終えた状態にする</p>
    </section>
  ),
};
