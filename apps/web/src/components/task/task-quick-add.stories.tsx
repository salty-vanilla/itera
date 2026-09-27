import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TaskQuickAdd } from './task-quick-add';

const meta = {
  title: 'Components/Task Quick Add',
  component: TaskQuickAdd,
  parameters: { layout: 'padded' },
  args: { onAdd: () => true },
} satisfies Meta<typeof TaskQuickAdd>;

export default meta;
type Story = StoryObj<typeof meta>;

/** タイトルだけで追加し、入力にフォーカスを残す。Enter で追加、Esc で取り消し。 */
export const Default: Story = {
  render: () => {
    const [titles, setTitles] = useState<string[]>([]);
    return (
      <div className="flex flex-col gap-3">
        <TaskQuickAdd
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
