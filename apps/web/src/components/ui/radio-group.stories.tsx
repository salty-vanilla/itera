import type { Meta, StoryObj } from '@storybook/react-vite';
import { Radio, RadioGroup } from './radio-group';

const assessments = (
  <>
    <Radio value="achieved" label="できた" />
    <Radio value="partial" label="一部できた" />
    <Radio value="notAchieved" label="できなかった" />
    <Radio value="noJudgement" label="判断しない" />
  </>
);

/**
 * 2〜5 個の排他的な選択肢をすべて見せる。fieldset と legend で組み、矢印キーで
 * 選択を移す。Goal の自己判定には既定値を置かない（未選択は「未判定」）。
 */
const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  args: {
    legend: 'Goal の自己判定',
    children: assessments,
    disabled: false,
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定値なしで始まる。 */
export const Playground: Story = {};

/** legend の下にサポートテキスト、選択肢ごとにも説明を置ける。 */
export const WithDescription: Story = {
  args: {
    legend: 'Sprint の長さ',
    necessity: 'required',
    description: '次の Sprint から適用されます。',
    defaultValue: '1w',
    children: (
      <>
        <Radio value="1w" label="1週間" description="月曜から日曜まで" />
        <Radio value="2w" label="2週間" description="隔週の月曜から" />
      </>
    ),
  },
};

const states = ['default', 'hover', 'focus', 'hover-focus'] as const;

/**
 * DESIGN.md「共通の状態」で Radio に必須の状態（Default・Hover・Focus・
 * Selected・Disabled・Error）。Hover と Focus は storybook-addon-pseudo-states
 * で強制表示している。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: ['[data-demo="hover"]', '[data-demo="hover-focus"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
    },
  },
  render: () => (
    <div className="grid grid-cols-1 gap-6 medium:grid-cols-2">
      {states.map((state) => (
        <RadioGroup key={state} legend={state} defaultValue="checked">
          <Radio value="unchecked" label="未選択" data-demo={state} />
          <Radio value="checked" label="選択" data-demo={state} />
        </RadioGroup>
      ))}
      <RadioGroup legend="disabled" defaultValue="checked" disabled>
        <Radio value="unchecked" label="未選択" />
        <Radio value="checked" label="選択" />
      </RadioGroup>
      <RadioGroup
        legend="error · Sprint の長さ"
        error="Sprint の長さを選んでください"
      >
        <Radio value="1w" label="1週間" />
        <Radio value="2w" label="2週間" />
      </RadioGroup>
    </div>
  ),
};
