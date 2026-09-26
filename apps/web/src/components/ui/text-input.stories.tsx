import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search } from 'lucide-react';
import { Field } from './field';
import { TextInput } from './text-input';

const meta = {
  title: 'Components/TextInput',
  component: TextInput,
  args: {
    size: 'md',
    disabled: false,
    placeholder: '',
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  render: (args) => (
    <Field label="タイトル" className="max-w-drawer">
      <TextInput {...args} />
    </Field>
  ),
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * sm 28 / md 36 / lg 44px。compact 幅（768px 未満）では、どのサイズも 44px・
 * 16px の文字になる（iOS のズーム回避）。
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex max-w-drawer flex-col gap-4">
      <Field label="sm">
        <TextInput size="sm" defaultValue="論文の関連研究を読む" />
      </Field>
      <Field label="md（既定）">
        <TextInput size="md" defaultValue="論文の関連研究を読む" />
      </Field>
      <Field label="lg">
        <TextInput size="lg" defaultValue="論文の関連研究を読む" />
      </Field>
    </div>
  ),
};

/**
 * ラベル → サポートテキスト → 入力 → エラーの順。サポートテキストには単位や
 * 例を書く。接尾の単位は読み上げないので、ラベルかサポートテキストにも書く。
 */
export const WithSupportTextAndUnit: Story = {
  render: () => (
    <div className="flex max-w-drawer flex-col gap-6">
      <Field
        label="可用時間"
        necessity="required"
        description="今週、計画に使える時間。0.5時間単位"
      >
        <TextInput inputMode="decimal" defaultValue="18" suffix="h" />
      </Field>
      <Field
        label="見積もり"
        necessity="optional"
        description="時間で入力（例: 1.5）"
      >
        <TextInput inputMode="decimal" suffix="h" />
      </Field>
    </div>
  ),
};

/**
 * 視覚ラベルを省略できるのは検索とクイック追加だけ。ラベルは読み上げ用に残る。
 * 接頭のアイコンは装飾。
 */
export const SearchField: Story = {
  render: () => (
    <Field label="タスクを検索" hideLabel className="max-w-drawer">
      <TextInput type="search" prefix={<Search />} placeholder="タスクを検索" />
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
 * DESIGN.md「共通の状態」で TextInput に必須の状態（Default・Hover・Focus・
 * Disabled・Error）と Read-only。Hover と Focus は storybook-addon-pseudo-states
 * で強制表示している。Loading は入力の外側で示す。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: [
        '[data-slot="text-input"]:has([data-demo="hover"])',
        '[data-slot="text-input"]:has([data-demo="hover-focus"])',
      ],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
    },
  },
  render: () => (
    <div className="grid max-w-drawer grid-cols-1 gap-4">
      {states.map(([state, props]) => (
        <Field
          key={state}
          label={state}
          description="0.5時間単位"
          disabled={state === 'disabled'}
        >
          <TextInput defaultValue="3" suffix="h" {...props} />
        </Field>
      ))}
      <Field
        label="error"
        description="0.5時間単位"
        error="数値で入力してください（例: 1.5）"
      >
        <TextInput defaultValue="3時間" suffix="h" />
      </Field>
    </div>
  ),
};
