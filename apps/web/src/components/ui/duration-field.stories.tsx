import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  DURATION_ERROR,
  EMPTY_DURATION,
  type DurationText,
} from '@/lib/duration-text';
import { DurationField } from './duration-field';

/**
 * 時間の入力。画面の書き方（「1時間30分」）と同じ「時間」と「分」の 2 欄で、
 * 数字のキーボードを出す。2 欄で 1 つのグループにし、見えるラベルを名前にする。
 * 分の 60 以上と時間の小数は受け付け、2 欄の外へ出たときに画面の書き方に
 * 書き直す（90分 → 1時間30分）。時間の欄の Enter は分の欄へ移る（#252）。
 */
const meta = {
  title: 'Components/DurationField',
  component: DurationField,
  args: {
    label: '見積もり',
    necessity: 'optional',
    value: EMPTY_DURATION,
    onChange: () => {},
  },
  argTypes: {
    necessity: {
      control: 'inline-radio',
      options: [undefined, 'required', 'optional'],
    },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    value: { control: false },
    onChange: { control: false },
    onCommit: { control: false },
  },
  render: function Render(args) {
    const [value, setValue] = useState<DurationText>(args.value);
    return <DurationField {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof DurationField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 保存した値は画面の書き方で欄に入る（1時間30分 → 「1」と「30」）。 */
export const Filled: Story = {
  args: { value: { hours: '1', minutes: '30' } },
};

/** 単位以外の説明だけを書く。単位は欄が示す。 */
export const WithDescription: Story = {
  args: {
    label: 'かかった時間',
    description: 'あとから追加もできます',
  },
};

/** エラーは 2 欄の下に 1 つ。2 欄とも aria-invalid になる。 */
export const WithError: Story = {
  args: {
    value: { hours: 'abc', minutes: '' },
    error: DURATION_ERROR,
  },
};

/** 行の中に置くときは見出しを隠し、行の名前をグループの名前にする。 */
export const HiddenLabel: Story = {
  args: {
    label: '見積もり：上の段',
    hideLabel: true,
    necessity: undefined,
    size: 'sm',
  },
};
