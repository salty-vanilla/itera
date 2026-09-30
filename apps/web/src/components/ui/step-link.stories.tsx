import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepLink } from './step-link';

const meta = {
  title: 'Components/Step Link',
  component: StepLink,
  parameters: { layout: 'centered' },
  args: { direction: 'previous', label: '前の日（9/30 (水)）', href: '#' },
} satisfies Meta<typeof StepLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 前へ：見出しの左。hover / focus で行き先を Tooltip に出す。 */
export const Previous: Story = {};

/** 次へ：見出しの右。 */
export const Next: Story = {
  args: { direction: 'next', label: '次の日（10/2 (金)）' },
};

/** 行き先がない端：同じ位置に無効の形で残し、読み上げない。 */
export const Disabled: Story = {
  args: { label: undefined, href: undefined },
};
