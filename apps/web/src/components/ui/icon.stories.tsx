import type { Meta, StoryObj } from '@storybook/react-vite';
import { Calendar } from 'lucide-react';
import { Icon, semanticIcons } from './icon';

const meta = {
  title: 'Components/Icon',
  component: Icon,
  args: { icon: Calendar, size: 's' },
  argTypes: {
    icon: { control: false },
    size: { control: 'inline-radio', options: ['xs', 's', 'm'] },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 16px（stroke 1.75）は 12–14px の文字の横、20px（stroke 1.5）はボタンと
 * ナビゲーション、12px はメタ情報の中だけ。色は隣の文字と同じ（currentColor）。
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <span className="inline-flex items-center gap-1 text-meta text-ink-muted">
        <Icon icon={semanticIcons.deadline} size="xs" />
        9/30 (水)
      </span>
      <span className="inline-flex items-center gap-1 text-body">
        <Icon icon={semanticIcons.recurrence} size="s" />
        毎週 土
      </span>
      <span className="inline-flex items-center gap-2 text-button">
        <Icon icon={semanticIcons.history} size="m" />
        変更履歴
      </span>
    </div>
  ),
};

const meanings: [keyof typeof semanticIcons, string, string?][] = [
  ['deadline', '期限'],
  ['deadlineSoon', '期限が近い'],
  ['overdue', '期限超過', 'text-danger'],
  ['carriedOver', '持ち越し'],
  ['recurrence', '繰り返し'],
  ['goalLink', '目標への紐づけ'],
  ['undo', '元に戻す'],
  ['history', '変更履歴'],
  ['proposal', 'Agent 提案・下書き'],
  ['criterion', '計画基準'],
  ['done', '成功'],
  ['warning', '注意', 'text-warning'],
  ['error', 'エラー', 'text-danger'],
  ['info', '情報'],
];

/**
 * docs/design/foundations.md の意味の固定表。`semanticIcons` の名前で使い、
 * 同じ意味に別のアイコンを選ばない。アイコンだけで意味を伝えるときは
 * `label` を渡す（role="img" と aria-label）。語と並べるときは渡さない
 * （aria-hidden）。
 */
export const Meanings: Story = {
  render: () => (
    <table className="border-collapse text-left">
      <thead>
        <tr className="text-label text-ink-muted">
          <th scope="col" className="py-1 pr-4">
            アイコン
          </th>
          <th scope="col" className="py-1 pr-4">
            意味
          </th>
          <th scope="col" className="py-1">
            名前
          </th>
        </tr>
      </thead>
      <tbody>
        {meanings.map(([name, meaning, color]) => (
          <tr key={name}>
            <td className={`py-1 pr-4 ${color ?? 'text-ink'}`}>
              <Icon icon={semanticIcons[name]} size="s" />
            </td>
            <td className="py-1 pr-4 text-body">{meaning}</td>
            <td className="py-1 text-meta text-ink-subtle">{name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
