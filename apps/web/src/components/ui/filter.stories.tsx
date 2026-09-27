import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { type AreaColor, Filter, FilterGroup } from './filter';

const meta = {
  title: 'Components/Filter',
  component: Filter,
  args: {
    children: '期限が近い',
    pressed: false,
    count: 5,
    disabled: false,
  },
} satisfies Meta<typeof Filter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function PlaygroundDemo(args) {
    const [pressed, setPressed] = useState(args.pressed);
    return <Filter {...args} pressed={pressed} onPressedChange={setPressed} />;
  },
};

const areas: { name: string; color: AreaColor; count: number }[] = [
  { name: '仕事', color: 1, count: 12 },
  { name: '研究', color: 2, count: 5 },
  { name: '学習', color: 3, count: 0 },
  { name: '生活', color: 4, count: 7 },
  { name: '領域なし', color: 'none', count: 3 },
];

/**
 * Backlog を領域で絞り込む。押すと選択が切り替わる（aria-pressed）。選択中は
 * `here-subtle` の地、`ink` の枠、太字のラベル。選んでも幅は変わらない。0件の「学習」は disabled。
 * 路線記号は Area 名の先頭 1 文字（「領域なし」は「－」）。
 */
export const Areas: Story = {
  render: function AreasDemo() {
    const [selected, setSelected] = useState<string[]>(['研究']);
    return (
      <FilterGroup label="領域で絞り込む">
        {areas.map((area) => (
          <Filter
            key={area.name}
            area={area}
            count={area.count}
            pressed={selected.includes(area.name)}
            onPressedChange={(pressed) =>
              setSelected((names) =>
                pressed
                  ? [...names, area.name]
                  : names.filter((name) => name !== area.name),
              )
            }
          >
            {area.name}
          </Filter>
        ))}
      </FilterGroup>
    );
  },
};

const views = [
  ['期限が近い', 5],
  ['期限超過', 0],
  ['持ち越し', 3],
  ['繰り返し', 4],
] as const;

/**
 * 路線記号のない Filter。Backlog の切り口（docs/design/patterns.md の Browse）を
 * 重ねて絞り込む例。Filter はトグルなので、1 つだけを選ぶ排他の切り替えには使わない。
 */
export const WithoutArea: Story = {
  render: function WithoutAreaDemo() {
    const [selected, setSelected] = useState<string[]>(['期限が近い']);
    return (
      <FilterGroup label="切り口で絞り込む">
        {views.map(([name, count]) => (
          <Filter
            key={name}
            count={count}
            pressed={selected.includes(name)}
            onPressedChange={(pressed) =>
              setSelected((names) =>
                pressed ? [...names, name] : names.filter((n) => n !== name),
              )
            }
          >
            {name}
          </Filter>
        ))}
      </FilterGroup>
    );
  },
};

const states = ['default', 'hover', 'focus', 'hover-focus'] as const;

/**
 * DESIGN.md「共通の状態」で Filter に必須の状態。Hover・Focus は
 * storybook-addon-pseudo-states で強制表示している。Disabled は 0件のとき。
 * 選択中の Filter は 0件になっても外せるよう、disabled にしない。
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
              pressed
            </th>
            {states.map((state) => (
              <th key={state} scope="col" className="px-3 py-2">
                {state}
              </th>
            ))}
            <th scope="col" className="px-3 py-2">
              0件
            </th>
          </tr>
        </thead>
        <tbody>
          {[false, true].map((pressed) => (
            <tr key={String(pressed)}>
              <th scope="row" className="px-3 py-3 text-label text-ink-muted">
                {pressed ? 'selected' : 'not selected'}
              </th>
              {states.map((state) => (
                <td key={state} className="px-3 py-3">
                  <Filter
                    pressed={pressed}
                    area={{ name: '研究', color: 2 }}
                    count={5}
                    data-demo={state}
                  >
                    研究
                  </Filter>
                </td>
              ))}
              <td className="px-3 py-3">
                <Filter
                  pressed={pressed}
                  area={{ name: '学習', color: 3 }}
                  count={0}
                >
                  学習
                </Filter>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};
