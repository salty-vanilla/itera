import { Field as FieldPrimitive } from '@base-ui/react/field';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Checkbox, CheckboxControl } from './checkbox';

/**
 * □ = 選ぶ。Backlog のタスクを今週へ選ぶ、差分の行を反映する、保存ボタンで
 * 確定するフォームのオプションに使う。タスクの完了には使わない（完了は
 * タスクの部品の完了サークル ○）。即時に反映される設定は Switch。
 */
const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: {
    label: '週の途中で追加したタスクも Today に出す',
    disabled: false,
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** ラベルの下にサポートテキスト。ラベルを押しても切り替わる。 */
export const WithDescription: Story = {
  args: {
    label: '差分を反映する',
    description: '反映しても Sprint は確定されません。',
    defaultChecked: true,
  },
};

/**
 * ラベルを横に置かない場所（Backlog の行など）では、四角だけを使い、
 * aria-label で「今週に入れる：タスク名」と読ませる。
 */
export const BareControl: Story = {
  render: () => (
    <div className="flex items-center gap-1 border-y border-border-soft">
      <CheckboxControl aria-label="今週に入れる：関連研究を読む" />
      <span className="text-task text-ink">関連研究を読む</span>
    </div>
  ),
};

const diffRows = [
  ['add', '＋追加：関連研究を読む'],
  ['remove', '−除外：発表資料の下書き'],
  ['change', '→変更：実験の再実行 3時間 → 5時間'],
] as const;

/**
 * 一部だけ選ばれている親は Indeterminate（横線、aria-checked="mixed"）。
 * 親を押すと、すべて選ぶ / すべて外す。
 */
export const Indeterminate: Story = {
  render: function IndeterminateDemo() {
    const [selected, setSelected] = useState<string[]>(['add']);
    const all = selected.length === diffRows.length;
    return (
      <div className="flex flex-col">
        <Checkbox
          label={`すべて反映する（${diffRows.length}件中 ${selected.length}件）`}
          checked={all}
          indeterminate={!all && selected.length > 0}
          onCheckedChange={() =>
            setSelected(all ? [] : diffRows.map(([key]) => key))
          }
        />
        <div className="pl-6">
          {diffRows.map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={selected.includes(key)}
              onCheckedChange={(checked) =>
                setSelected((current) =>
                  checked
                    ? [...current, key]
                    : current.filter((item) => item !== key),
                )
              }
            />
          ))}
        </div>
      </div>
    );
  },
};

const values = [
  ['unchecked', {}],
  ['checked', { defaultChecked: true }],
  ['indeterminate', { indeterminate: true }],
] as const;

const states = ['default', 'hover', 'focus', 'hover-focus'] as const;

/**
 * DESIGN.md「共通の状態」で Checkbox に必須の状態（Default・Hover・Focus・
 * checked / indeterminate・Disabled・Error）。Hover と Focus は
 * storybook-addon-pseudo-states で強制表示している。
 */
export const States: Story = {
  parameters: {
    pseudo: {
      hover: ['[data-demo="hover"]', '[data-demo="hover-focus"]'],
      focusVisible: ['[data-demo="focus"]', '[data-demo="hover-focus"]'],
    },
  },
  render: () => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-left">
        <thead>
          <tr className="text-label text-ink-muted">
            <th scope="col" className="px-3 py-2">
              value
            </th>
            {states.map((state) => (
              <th key={state} scope="col" className="px-3 py-2">
                {state}
              </th>
            ))}
            <th scope="col" className="px-3 py-2">
              disabled
            </th>
            <th scope="col" className="px-3 py-2">
              error
            </th>
          </tr>
        </thead>
        <tbody>
          {values.map(([value, props]) => (
            <tr key={value}>
              <th scope="row" className="px-3 py-2 text-label text-ink-muted">
                {value}
              </th>
              {states.map((state) => (
                <td key={state} className="px-3 py-2">
                  <CheckboxControl
                    aria-label={`${value} ${state}`}
                    data-demo={state}
                    {...props}
                  />
                </td>
              ))}
              <td className="px-3 py-2">
                <CheckboxControl
                  aria-label={`${value} disabled`}
                  disabled
                  {...props}
                />
              </td>
              <td className="px-3 py-2">
                {/* Field marks the control invalid, as Checkbox's error does. */}
                <FieldPrimitive.Root invalid>
                  <CheckboxControl aria-label={`${value} error`} {...props} />
                </FieldPrimitive.Root>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};

/** エラーはアイコンと直し方の文で、ラベルの下に出す。 */
export const WithError: Story = {
  args: {
    label: '差分を反映する',
    error: '反映する行を 1つ以上選んでください',
  },
};
