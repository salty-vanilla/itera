import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AreaId } from '@itera/api-contract';
import { useState } from 'react';
import { AreaSelect } from './area-select';
import { TaskQuickAdd } from './task-quick-add';

const meta = {
  title: 'Components/Task Quick Add',
  component: TaskQuickAdd,
  parameters: { layout: 'padded' },
  args: { label: 'Backlog にタスクを追加', onAdd: (): boolean => true },
} satisfies Meta<typeof TaskQuickAdd>;

export default meta;
type Story = StoryObj<typeof meta>;

/** タイトルだけで追加し、入力にフォーカスを残す。追加ボタンか Enter で追加、Esc で取り消し。 */
export const Default: Story = {
  render: () => {
    const [titles, setTitles] = useState<string[]>([]);
    return (
      <div className="flex flex-col gap-3">
        <TaskQuickAdd
          label="Backlog にタスクを追加"
          onAdd={(title) => {
            setTitles((t) => [...t, title]);
            return true;
          }}
        />
        <ul className="text-body">
          {titles.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    );
  },
};

/** 領域の Select があるとき。768px 未満では、入力が 1 行目、Select とボタンが 2 行目。 */
export const WithArea: Story = {
  args: {
    label: '今日やるタスクを追加',
    area: (
      <AreaSelect
        areas={[
          { id: 'area-work' as AreaId, name: '仕事', color: 1 },
          { id: 'area-research' as AreaId, name: '研究', color: 2 },
        ]}
        value=""
        onChange={() => {}}
      />
    ),
  },
};

/**
 * 追加を送っている間。300ms 続いたら、追加ボタンがスピナーと「追加中…」に
 * なる（幅は変わらない）。入力はそのまま残り、終わったら空になる。
 */
export const Loading: Story = {
  args: { loading: true },
};
