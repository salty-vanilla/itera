import type { Meta, StoryObj } from '@storybook/react-vite';
import { AreaIndicator } from './area-indicator';

const meta = {
  title: 'Components/Area Indicator',
  component: AreaIndicator,
  args: { name: '研究', color: 2, variant: 'label' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['label', 'badge', 'heading'],
    },
  },
} satisfies Meta<typeof AreaIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 路線記号（20px の四角に名前の先頭 1 文字）と名前。label は行のメタ情報、
 * badge は凡例がある場所だけ（名前は読み上げる）、heading はグループ見出し。
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <AreaIndicator name="仕事" color={1} />
        <AreaIndicator name="研究" color={2} />
        <AreaIndicator name="学習" color={3} />
        <AreaIndicator name="生活" color={4} />
        <AreaIndicator name="領域なし" color="none" />
      </div>
      <div className="flex gap-2">
        <AreaIndicator name="仕事" color={1} variant="badge" />
        <AreaIndicator name="研究" color={2} variant="badge" />
      </div>
      <AreaIndicator name="研究" color={2} variant="heading" count={3} />
    </div>
  ),
};
