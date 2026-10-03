import type { Meta, StoryObj } from '@storybook/react-vite';
import type { AreaId } from '@itera/api-contract';
import { useState } from 'react';
import { AreaSelect } from './area-select';

const areas = [
  { id: 'area-work' as AreaId, name: '仕事', color: 1 },
  { id: 'area-research' as AreaId, name: '研究', color: 2 },
  { id: 'area-study' as AreaId, name: '学習', color: 3 },
  { id: 'area-life' as AreaId, name: '生活', color: 4 },
] as const;

// The Area of a Task in a Quick Add: the native Select with the chosen
// Area's line symbol in it (「領域なし」 is 「－」).
const meta = {
  title: 'Components/Area Select',
  component: AreaSelect,
  args: { areas, value: '', onChange: () => {} },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="max-w-drawer">
        <AreaSelect {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof AreaSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 領域なし: `area-none` の「－」。 */
export const NoArea: Story = {};

/** 領域を選ぶと、その色と頭文字の記号になる。 */
export const Chosen: Story = { args: { value: 'area-research' } };

/** 末尾に「新しい領域…」。選ぶと領域の Dialog を開き、値は変えない（Issue #113）。 */
export const WithNewArea: Story = { args: { onNewArea: () => {} } };
