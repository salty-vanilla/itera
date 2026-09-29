import { id, instant } from '@itera/domain';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EstimateSuggestion, SuggestionOutcome } from './estimate-suggestion';

const suggestion = {
  id: id<'EstimateSuggestion'>('sug-1'),
  lo: 2,
  hi: 4,
  rationale: '過去の類似タスク 3件（実績 2h / 2.5h / 4h）',
  uncertainties: ['調査範囲（対象データの件数が未定）'],
  createdAt: instant('2026-09-29T03:00:00.000Z'),
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

/** 提示中：破線の枠。採用（下限・中央・上限）は Secondary、編集して採用と却下は Quiet。 */
export const Pending: Story = {};

/** 根拠がないとき。 */
export const NoRationale: Story = {
  args: { suggestion: { ...suggestion, rationale: '', uncertainties: [] } },
};

/** 採用・却下の後：実線の canvas-subtle の 1 行と「元に戻す」。 */
export const Outcome: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <SuggestionOutcome onUndo={() => {}}>
        Estimate 3h を採用しました（Agent 提案 2–4h）
      </SuggestionOutcome>
      <SuggestionOutcome onUndo={() => {}}>
        Estimate 2.5h を採用しました（Agent 提案 2–4h を編集）
      </SuggestionOutcome>
      <SuggestionOutcome onUndo={() => {}}>
        提案 2–4h を却下しました
      </SuggestionOutcome>
    </div>
  ),
};
