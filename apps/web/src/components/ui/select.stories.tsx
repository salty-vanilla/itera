import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './field';
import { Select } from './select';

const areaOptions = (
  <>
    <option value="">領域なし</option>
    <option value="work">仕事</option>
    <option value="research">研究</option>
    <option value="study">学習</option>
    <option value="life">生活</option>
  </>
);

const meta = {
  title: 'Components/Select',
  component: Select,
  args: {
    size: 'md',
    disabled: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: (args) => (
    <Field label="領域" className="max-w-drawer">
      <Select defaultValue="research" {...args}>
        {areaOptions}
      </Select>
    </Field>
  ),
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** sm 28 / md 36 / lg 44px。compact 幅では、どのサイズも 44px・16px の文字になる。 */
export const Sizes: Story = {
  render: () => (
    <div className="flex max-w-drawer flex-col gap-4">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Field key={size} label={size}>
          <Select size={size} defaultValue="research">
            {areaOptions}
          </Select>
        </Field>
      ))}
    </div>
  ),
};

const states = [
  ['default', {}],
  ['hover', { 'data-demo': 'hover' }],
  ['focus', { 'data-demo': 'focus' }],
  ['hover-focus', { 'data-demo': 'hover-focus' }],
  ['disabled', { disabled: true }],
] as const;

/**
 * DESIGN.md「共通の状態」で Select に必須の状態（Default・Hover・Focus・
 * Disabled・Error）。選択肢の一覧はブラウザの標準の表示。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: [
        '[data-slot="select"]:has([data-demo="hover"])',
        '[data-slot="select"]:has([data-demo="hover-focus"])',
      ],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
    },
  },
  render: () => (
    <div className="grid max-w-drawer grid-cols-1 gap-4">
      {states.map(([state, props]) => (
        <Field key={state} label={state} disabled={state === 'disabled'}>
          <Select defaultValue="research" {...props}>
            {areaOptions}
          </Select>
        </Field>
      ))}
      <Field label="error" error="繰り返しのルールを選んでください">
        <Select defaultValue="">
          <option value="" disabled>
            選んでください
          </option>
          <option value="weekly">毎週</option>
          <option value="weekdays">平日</option>
        </Select>
      </Field>
    </div>
  ),
};
