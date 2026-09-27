import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './field';
import { Textarea } from './textarea';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  args: {
    text: 'body',
    disabled: false,
  },
  argTypes: {
    text: { control: 'inline-radio', options: ['body', 'body-l'] },
    maxLength: { control: 'number' },
  },
  render: (args) => (
    <Field
      label="気になったこと"
      necessity="optional"
      className="max-w-measure-read"
    >
      <Textarea {...args} />
    </Field>
  ),
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 上限があるときは右下に文字数。文字数は入力欄の説明として読み上げられる。
 * 最小 88px で、縦方向だけリサイズできる。
 */
export const WithCount: Story = {
  render: () => (
    <Field
      label="次の Sprint で 1 つだけ変えてみること"
      necessity="optional"
      description="自然文で 1 件"
      className="max-w-measure-read"
    >
      <Textarea
        maxLength={200}
        defaultValue="研究の見積もりは、提案の上限を計画値にして立てる。"
      />
    </Field>
  ),
};

/**
 * Retro の振り返りなど、考える領域では body-l（16px）で組む。確定後の
 * reflection の大きさにはしない。
 */
export const BodyLarge: Story = {
  render: () => (
    <Field
      label="気になったこと"
      necessity="optional"
      className="max-w-measure-read"
    >
      <Textarea
        text="body-l"
        defaultValue="水曜に割り込みが 2 件入り、研究の時間が半分になった。"
      />
    </Field>
  ),
};

const states = [
  ['default', {}],
  ['hover', { 'data-demo': 'hover' }],
  ['focus', { 'data-demo': 'focus' }],
  ['hover-focus', { 'data-demo': 'hover-focus' }],
  ['disabled', { disabled: true }],
  ['read-only', { readOnly: true }],
] as const;

/**
 * DESIGN.md「共通の状態」で Textarea に必須の状態（Default・Hover・Focus・
 * Disabled・Error）と Read-only。Hover と Focus は storybook-addon-pseudo-states
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
    <div className="grid max-w-measure-read grid-cols-1 gap-4">
      {states.map(([state, props]) => (
        <Field key={state} label={state} disabled={state === 'disabled'}>
          <Textarea defaultValue="週の前半に論文を読み切る。" {...props} />
        </Field>
      ))}
      <Field label="error" error="200文字以内にしてください（今は 212文字）">
        <Textarea defaultValue="週の前半に論文を読み切る。" />
      </Field>
    </div>
  ),
};
