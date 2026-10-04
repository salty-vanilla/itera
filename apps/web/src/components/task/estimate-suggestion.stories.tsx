import type { Meta, StoryObj } from '@storybook/react-vite';
import { EstimateSuggestion, SuggestionOutcome } from './estimate-suggestion';

const suggestion = {
  id: 'sug-1',
  lo: 2,
  hi: 4,
  rationale: '過去の類似タスク 3件（実績 2時間 / 2時間30分 / 4時間）',
  uncertainties: ['調査範囲（対象データの件数が未定）'],
  createdAt: '2026-09-29T03:00:00.000Z',
  state: 'presented' as const,
};

const meta = {
  title: 'Components/Estimate Suggestion',
  component: EstimateSuggestion,
  parameters: { layout: 'padded' },
  args: {
    suggestion,
    madeAt: '9/29 (火) 12:00',
    onAdopt: () => {},
    onAdoptEdited: () => true,
    onReject: () => {},
  },
} satisfies Meta<typeof EstimateSuggestion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 提示中：破線の枠。「使う：」の後の 3 つの値は枠を共有した 1 つの群（Secondary）、「直して使う」と「使わない」は Quiet。 */
export const Pending: Story = {};

/**
 * 3 つの値がどれも「X時間Y分」のとき。「使う：」の後に群が入らない幅では、
 * 「使う：」が群の上の行に回り、群は折れない（Issue #242）。
 */
export const LongValues: Story = {
  args: { suggestion: { ...suggestion, lo: 1.5, hi: 3.5 } },
};

/** 根拠がないとき。 */
export const NoRationale: Story = {
  args: { suggestion: { ...suggestion, rationale: '', uncertainties: [] } },
};

/** 使う・使わないの後：実線の canvas-subtle の 1 行と「元に戻す」。 */
export const Outcome: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <SuggestionOutcome onUndo={() => {}}>
        見積もりを 3時間にしました
      </SuggestionOutcome>
      <SuggestionOutcome onUndo={() => {}}>
        提案を使いませんでした
      </SuggestionOutcome>
    </div>
  ),
};
