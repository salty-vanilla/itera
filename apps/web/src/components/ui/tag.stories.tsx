import type { Meta, StoryObj } from '@storybook/react-vite';
import { Info } from 'lucide-react';
import { Tag } from './tag';

const meta = {
  title: 'Components/Tag',
  component: Tag,
  args: { tone: 'done', children: 'できた' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['neutral', 'done', 'warning', 'danger', 'draft'],
    },
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * Status はアイコン必須。done・warning・danger・draft のアイコンは
 * docs/design/foundations.md の意味の固定表どおりに決まる。neutral の Status は
 * アイコンを渡す。成功は色を持たず、墨の文字と circle-check で示す。
 */
export const Tones: Story = {
  render: () => (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
      <dt className="text-label text-ink-muted">done</dt>
      <dd className="flex gap-2">
        <Tag tone="done">できた</Tag>
        <Tag tone="done">保存済み</Tag>
      </dd>
      <dt className="text-label text-ink-muted">neutral</dt>
      <dd className="flex gap-2">
        <Tag icon={Info}>同期中</Tag>
        <Tag icon={Info}>次に試す</Tag>
      </dd>
      <dt className="text-label text-ink-muted">warning</dt>
      <dd className="flex gap-2">
        <Tag tone="warning">超過の可能性</Tag>
      </dd>
      <dt className="text-label text-ink-muted">danger</dt>
      <dd className="flex gap-2">
        <Tag tone="danger">同期エラー</Tag>
      </dd>
      <dt className="text-label text-ink-muted">draft</dt>
      <dd className="flex gap-2">
        <Tag tone="draft">計画中 · 未確定</Tag>
      </dd>
      <dt className="text-label text-ink-muted">本人のラベル</dt>
      <dd className="flex gap-2">
        <Tag>輪読</Tag>
        <Tag>買い物</Tag>
      </dd>
    </dl>
  ),
};

/**
 * danger は保存・同期の失敗だけ。期限超過は Tag にせず、Task Metadata の文字
 * （circle-alert＋「2日超過」）で示す。Goal の自己判定「できなかった」・持ち越し・
 * 見送りは danger にも warning にもしない（DESIGN.md Colors）。自己判定の
 * アイコンは Retro の最初の実装 Issue で決めるので、ここには例を置かない。
 * 持ち越し・繰り返し・期限・Estimate・Area は Tag にしない。1 行に 3 つ以上並べない。
 */
export const InARow: Story = {
  render: () => (
    <div
      className="flex items-center justify-between gap-4 border-b border-border-soft pb-3"
      style={{ maxWidth: '28em' }}
    >
      <span className="text-body">Sprint 14</span>
      <span className="flex gap-2">
        <Tag icon={Info}>同期中</Tag>
      </span>
    </div>
  ),
};
