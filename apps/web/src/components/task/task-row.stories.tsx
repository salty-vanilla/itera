import { instant, localDate } from '@itera/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { IconButton } from '@/components/ui/icon-button';
import { semanticIcons } from '@/components/ui/icon';
import { Deadline } from './deadline';
import { Estimate } from './estimate';
import { MetaItem, TaskMetadata } from './task-metadata';
import { CompletionCircle, TaskRow } from './task-row';

const computedAt = instant('2026-09-29T00:00:00.000Z');
const today = localDate('2026-09-29');
const Carry = semanticIcons.carriedOver;
const Repeat = semanticIcons.recurrence;

const meta = {
  title: 'Components/Task Row',
  component: TaskRow,
  parameters: { layout: 'padded' },
  args: { title: '関連論文を 3 本読む' },
} satisfies Meta<typeof TaskRow>;

export default meta;
type Story = StoryObj<typeof meta>;

function Row({
  done: initial = false,
  current = false,
}: {
  done?: boolean;
  current?: boolean;
}) {
  const [done, setDone] = useState(initial);
  return (
    <TaskRow
      title="関連論文を 3 本読む"
      done={done}
      current={current}
      onOpen={() => {}}
      control={
        <CompletionCircle
          title="関連論文を 3 本読む"
          done={done}
          onToggle={() => setDone((d) => !d)}
        />
      }
      metadata={
        <TaskMetadata>
          <AreaIndicator name="研究" color={2} />
          <Deadline due={localDate('2026-10-01')} today={today} />
          <MetaItem icon={<Carry aria-hidden />}>
            持ち越し 1回（Sprint 13から）
          </MetaItem>
          <MetaItem className="text-ink">今週</MetaItem>
        </TaskMetadata>
      }
      estimate={
        <Estimate
          value={{
            base: 'suggestion',
            lo: 3,
            hi: 5,
            criterionApplied: false,
            computedAt,
          }}
        />
      }
      actions={
        <IconButton
          size="sm"
          label="その他の操作: 関連論文を 3 本読む"
          icon={<Ellipsis />}
        />
      }
    />
  );
}

/** Backlog の行。○ で完了、行を押すと詳細。操作 … は hover / focus で出る（compact は常時）。 */
export const Default: Story = { render: () => <Row /> };

/** 完了：○ を墨で塗り、タイトルを ink-subtle ＋取り消し線。 */
export const Done: Story = { render: () => <Row done /> };

/** 詳細を開いている行：現在地の here-subtle。 */
export const Current: Story = { render: () => <Row current /> };

/** 期限：upcoming / 近い（2日以内）/ 今日 / 超過。色だけでなくアイコンと語で示す。 */
export const Deadlines: Story = {
  render: () => (
    <div className="flex flex-col gap-2 text-meta">
      <Deadline due={localDate('2026-10-05')} today={today} />
      <Deadline due={localDate('2026-10-01')} today={today} />
      <Deadline due={today} today={today} />
      <Deadline due={localDate('2026-09-25')} today={today} />
    </div>
  ),
};

/** Estimate：本人の値（実線）、提案（破線＋「見積もりの提案」）、計画値、サブタスク合計、見積もりなし。 */
export const Estimates: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      <Estimate
        value={{
          base: 'estimate',
          lo: 3,
          hi: 3,
          criterionApplied: false,
          computedAt,
        }}
      />
      <Estimate
        value={{
          base: 'estimate',
          lo: 0.5,
          hi: 0.5,
          criterionApplied: false,
          computedAt,
        }}
      />
      <Estimate
        value={{
          base: 'suggestion',
          lo: 2,
          hi: 4,
          criterionApplied: false,
          computedAt,
        }}
      />
      <Estimate
        planned
        value={{
          base: 'suggestion',
          lo: 5,
          hi: 5,
          criterionApplied: true,
          computedAt,
        }}
      />
      <Estimate
        value={{
          base: 'subtasks',
          lo: 2.5,
          hi: 2.5,
          unestimatedSubtasks: 1,
          criterionApplied: false,
          computedAt,
        }}
      />
      <Estimate value={{ base: 'none', criterionApplied: false, computedAt }} />
    </div>
  ),
};

/** 繰り返しの行：Rule ごとに 1 行。○ は出さない（回の完了は今日の画面で）。 */
export const Recurring: Story = {
  render: () => (
    <TaskRow
      title="部屋の掃除"
      onOpen={() => {}}
      control={
        <span
          aria-hidden
          className="size-target-touch medium:size-target-min"
        />
      }
      metadata={
        <TaskMetadata>
          <AreaIndicator name="生活" color={4} />
          <MetaItem icon={<Repeat aria-hidden />}>
            毎週 土 · 次は 10/3 (土)
          </MetaItem>
        </TaskMetadata>
      }
      estimate={
        <Estimate
          value={{
            base: 'estimate',
            lo: 1,
            hi: 1,
            criterionApplied: false,
            computedAt,
          }}
        />
      }
    />
  ),
};
