import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';

/**
 * 即時に反映される設定のオン / オフ。「オン」「オフ」の語を添え、説明で
 * オンにすると何が起きるかを書く。保存ボタンで確定するフォームでは Checkbox を
 * 使う。
 */
const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: {
    label: '振り返りの前日に通知',
    description: 'オンにすると、Sprint の最終日の前日 18:00 に通知します。',
    disabled: false,
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const states = ['default', 'hover', 'focus', 'hover-focus'] as const;

/**
 * DESIGN.md「共通の状態」で Switch に必須の状態（Default・Hover・Focus・
 * checked・Disabled・Error）。Hover と Focus は storybook-addon-pseudo-states
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
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 medium:grid-cols-2">
      {states.flatMap((state) => [
        <Switch
          key={`${state}-off`}
          label={`off · ${state}`}
          data-demo={state}
        />,
        <Switch
          key={`${state}-on`}
          label={`on · ${state}`}
          data-demo={state}
          defaultChecked
        />,
      ])}
      <Switch label="off · disabled" disabled />
      <Switch label="on · disabled" disabled defaultChecked />
      <Switch
        label="off · error"
        error="設定を保存できませんでした。もう一度切り替えてください"
      />
      <Switch
        label="on · error"
        defaultChecked
        error="設定を保存できませんでした。もう一度切り替えてください"
      />
    </div>
  ),
};
