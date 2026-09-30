import type { Meta, StoryObj } from '@storybook/react-vite';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from './button';
import { Field } from './field';
import { Radio, RadioGroup } from './radio-group';
import { Select } from './select';
import { TextInput } from './text-input';
import { Textarea } from './textarea';

/**
 * フォームの枠組み。ラベル → サポートテキスト → 入力 → エラーの順に組み、
 * サポートテキストとエラーは aria-describedby で入力に結ぶ。必須・任意は語で
 * 示す。Checkbox・RadioGroup・Switch は自分のラベルを持つ。
 */
const meta = {
  title: 'Components/Field',
  component: Field,
  args: {
    label: '見積もり',
    necessity: 'optional',
    description: '時間で入力（例: 1.5）',
    children: <TextInput inputMode="decimal" suffix="h" />,
  },
  argTypes: {
    necessity: {
      control: 'inline-radio',
      options: [undefined, 'required', 'optional'],
    },
    children: { control: false },
  },
  render: (args) => <Field {...args} className="max-w-drawer" />,
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** エラーはアイコンと「何が問題で、どう直すか」の文で、入力の直下に出す。 */
export const WithError: Story = {
  args: {
    error: '数値で入力してください（例: 1.5）',
    children: <TextInput inputMode="decimal" defaultValue="3時間" suffix="h" />,
  },
};

type Values = { title: string; estimate: string; area: string };
type Errors = Partial<Record<keyof Values, string | undefined>>;

function validate(name: keyof Values, value: string): string | undefined {
  if (name === 'title' && value.trim() === '') {
    return 'タイトルを入力してください';
  }
  if (name === 'estimate' && value !== '' && !/^\d+(\.\d+)?$/.test(value)) {
    return '数値で入力してください（例: 1.5）';
  }
  return undefined;
}

/**
 * エラーは入力中に出さず、離脱時（blur）と送信時に出す。送信時は最初のエラーへ
 * フォーカスを移す。エラーのときも入力内容は消さない。出ているエラーは、直した
 * 時点で消す（新しいエラーは入力中には出さない）。タイトルを空のまま離れるか、
 * 見積もりに「3時間」と入れて離れると確認できる。
 */
export const ValidateOnBlurAndSubmit: Story = {
  render: function ValidationDemo() {
    const [values, setValues] = useState<Values>({
      title: '',
      estimate: '',
      area: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [saved, setSaved] = useState(false);
    const refs = {
      title: useRef<HTMLInputElement>(null),
      estimate: useRef<HTMLInputElement>(null),
    };

    const change = (name: keyof Values) => (value: string) => {
      setValues((current) => ({ ...current, [name]: value }));
      setSaved(false);
      // Typing never adds an error, but it removes one as soon as the value
      // is fixed, so the form does not move under the pointer on the next
      // blur.
      if (errors[name] !== undefined && validate(name, value) === undefined) {
        setErrors((current) => ({ ...current, [name]: undefined }));
      }
    };
    const blur = (name: keyof Values) => () =>
      setErrors((current) => ({
        ...current,
        [name]: validate(name, values[name]),
      }));

    const submit = (event: FormEvent) => {
      event.preventDefault();
      const next: Errors = {
        title: validate('title', values.title),
        estimate: validate('estimate', values.estimate),
      };
      setErrors(next);
      const first = (['title', 'estimate'] as const).find((name) => next[name]);
      if (first) refs[first].current?.focus();
      setSaved(first === undefined);
    };

    return (
      <form
        noValidate
        onSubmit={submit}
        className="flex max-w-drawer flex-col gap-6"
      >
        <Field label="タイトル" necessity="required" error={errors.title}>
          <TextInput
            ref={refs.title}
            value={values.title}
            onValueChange={change('title')}
            onBlur={blur('title')}
          />
        </Field>
        <Field
          label="見積もり"
          necessity="optional"
          description="時間で入力（例: 1.5）。空欄なら見積もりなし"
          error={errors.estimate}
        >
          <TextInput
            ref={refs.estimate}
            inputMode="decimal"
            suffix="h"
            value={values.estimate}
            onValueChange={change('estimate')}
            onBlur={blur('estimate')}
          />
        </Field>
        <Field label="領域" necessity="optional">
          <Select
            value={values.area}
            onChange={(event) => change('area')(event.target.value)}
          >
            <option value="">領域なし</option>
            <option value="work">仕事</option>
            <option value="research">研究</option>
          </Select>
        </Field>
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-help text-ink-muted">
            {saved ? '保存しました' : ''}
          </p>
          <Button type="submit" variant="primary">
            保存
          </Button>
        </div>
      </form>
    );
  },
};

/**
 * 部品を組み合わせた例。任意の項目が多いので「任意」を付け、必須は「必須」と
 * 書く。自己判定には既定値を置かない。Checkbox の例は Checkbox の Story にある。
 */
export const Composition: Story = {
  render: () => (
    <form noValidate className="flex max-w-measure-read flex-col gap-6">
      <Field
        label="目標"
        necessity="optional"
        description="「〜な状態にする」「〜を終える」の形で"
      >
        <Textarea defaultValue="関連研究の章を書き終える" />
      </Field>
      <RadioGroup legend="目標の自己判定" necessity="optional">
        <Radio value="achieved" label="できた" />
        <Radio value="partial" label="一部できた" />
        <Radio value="notAchieved" label="できなかった" />
        <Radio value="noJudgement" label="判断しない" />
      </RadioGroup>
      <Field label="気になったこと" necessity="optional">
        <Textarea text="body-l" maxLength={400} />
      </Field>
    </form>
  ),
};
