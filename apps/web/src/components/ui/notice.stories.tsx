import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Notice } from './notice';

const meta = {
  title: 'Components/Notice',
  component: Notice,
  args: {
    tone: 'info',
    title: 'Backlog が変わりました',
    children: '計画案を作った後に 2件が追加されました。差分を確認できます。',
  },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['info', 'warning', 'danger', 'done', 'neutral'],
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-drawer">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 地は warning / danger が各 *-subtle、ほかは canvas-subtle。枠と左の色線は
 * 付けない。アイコン＋タイトル＋本文＋任意の操作で、次にできることを書く。
 * role="alert" は danger だけ。同じ画面に 3 つ以上置かない。
 */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Notice
        tone="info"
        title="Backlog が変わりました"
        action={<Button size="sm">差分を確認</Button>}
      >
        計画案を作った後に 2件が追加されました。
      </Notice>
      <Notice tone="warning" title="可用時間を超えるかもしれません">
        計画値の合計は 16.5–19.5h です。上限では可用時間 18h を 1.5h 超えます。
      </Notice>
      <Notice
        tone="danger"
        title="Backlog を読み込めませんでした"
        action={<Button size="sm">もう一度読み込む</Button>}
      >
        通信を確認してから、もう一度読み込んでください。
      </Notice>
      <Notice tone="done" title="計画案を反映しました">
        3件を今週に入れ、1件の Estimate を更新しました。
      </Notice>
      <Notice tone="neutral" title="未見積のタスクは合計に含めません">
        Estimate を入れると、計画値の合計に加わります。
      </Notice>
    </div>
  ),
};

/**
 * 持ち越し・見送り・未達は事実として中立に書き、warning や danger の
 * Notice にしない。超過の「可能性」は warning、下限でも超える確定的な
 * 超過だけが danger の候補になる（DESIGN.md Colors）。
 */
export const NeutralFacts: Story = {
  render: () => (
    <Notice tone="neutral" title="前の Sprint から 2件を持ち越しています">
      今週も続けるか、Backlog に戻すかを選べます。
    </Notice>
  ),
};

/** 操作は Secondary / Quiet の sm。フォーカスの輪郭は地の上でも見える。 */
export const WithActions: Story = {
  parameters: {
    pseudo: { focusVisible: ['[data-demo="focus"]'] },
  },
  render: () => (
    <Notice
      tone="warning"
      title="未見積のタスクが 3件あります"
      action={
        <>
          <Button size="sm" data-demo="focus">
            見積もりを入れる
          </Button>
          <Button size="sm" variant="quiet">
            このまま進める
          </Button>
        </>
      }
    >
      未見積のタスクは計画値の合計に含まれません。
    </Notice>
  ),
};
