import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { SprintHeader } from './sprint-header';

const meta = {
  title: 'Components/Sprint Header',
  component: SprintHeader,
  parameters: { layout: 'padded' },
  args: {
    status: <Tag tone="draft">計画中 · 未確定</Tag>,
    title: 'Sprint 14',
    period: '9/28 (月) – 10/4 (日)',
    actions: <Button variant="primary">Sprint 14 を確定</Button>,
    stages: [
      { id: 'pick', label: '選ぶ', href: '#pick' },
      { id: 'shape', label: '整える', href: '#shape' },
      { id: 'check', label: '確かめる', href: '#check' },
    ],
    currentStage: 'shape',
  },
} satisfies Meta<typeof SprintHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Planning：段階を路線図の駅のように並べ、今の段階に黄の印と「現在」。どの段階にも戻れる。 */
export const Planning: Story = {};

/**
 * 前後の Sprint へ（#90）：タイトルの左右の矢印で過去・次の Sprint を開く。今と比べた呼び名（「来週」）を期間の前に添える。
 * 端では矢印を無効の形で残す。
 */
export const Steps: Story = {
  args: {
    title: 'Sprint 3',
    week: '来週',
    period: '10/5 (月) – 10/11 (日)',
    actions: <Button variant="primary">Sprint 3 を確定</Button>,
    steps: { previous: { number: 2, href: '#sprint-2' } },
  },
};
