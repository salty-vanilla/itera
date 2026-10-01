import type { Meta, StoryObj } from '@storybook/react-vite';
import { Inbox, Rewind, Route, Settings, Sun } from 'lucide-react';
import { useState } from 'react';
import { Navigation, type NavigationItem } from './navigation';

// Dummy destinations: routing belongs to the screen Issues.
const items: NavigationItem[] = [
  {
    id: 'today',
    label: '今日',
    icon: <Sun aria-hidden />,
    href: '#today',
    count: 4,
  },
  {
    id: 'sprint',
    label: 'Sprint',
    icon: <Route aria-hidden />,
    href: '#sprint',
    count: 18,
  },
  {
    id: 'backlog',
    label: 'Backlog',
    icon: <Inbox aria-hidden />,
    href: '#backlog',
    count: 42,
  },
  {
    id: 'retro',
    label: '振り返り',
    icon: <Rewind aria-hidden />,
    href: '#retro',
  },
  {
    id: 'settings',
    label: '設定',
    icon: <Settings aria-hidden />,
    href: '#settings',
    inTabBar: false,
  },
];

const titles: Record<string, string> = {
  today: '今日',
  sprint: 'Sprint 14',
  backlog: 'Backlog',
  retro: '振り返り',
  settings: '設定',
};

/**
 * 画面の枠の中にナビゲーションを置いた例。項目を押すと現在地が移る。
 * 幅は Storybook の viewport（toolbar）で切り替える。
 */
function Shell() {
  const [current, setCurrent] = useState('sprint');
  return (
    // Column-reverse puts the bottom tab bar under the content below 768px;
    // from 768px the sidebar or rail sits on the left.
    <div className="flex h-dvh flex-col-reverse bg-canvas medium:flex-row">
      <Navigation
        items={items}
        brand="Itera"
        current={current}
        onNavigate={(id, event) => {
          event.preventDefault();
          setCurrent(id);
        }}
      />
      <main className="min-h-0 flex-1 overflow-auto p-4 medium:p-6">
        <h1 className="text-display-m">{titles[current]}</h1>
        <p className="mt-2 text-body text-ink-muted">
          画面の中身は画面の Issue
          で作る。ここではナビゲーションの現在地だけが変わる。
        </p>
      </main>
    </div>
  );
}

const meta = {
  title: 'Components/Navigation',
  component: Navigation,
  parameters: { layout: 'fullscreen' },
  args: { items, current: 'sprint' },
} satisfies Meta<typeof Navigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 既定の responsive。1440px 以上はサイドバー（224px）、768–1439px は rail（64px、
 * アイコンの下に名前）、768px 未満は下部タブバー（今日 / Sprint / Backlog /
 * 振り返り）。現在地は `here` の 4px の線＋`ink` 700＋aria-current="page"。
 */
export const Responsive: Story = {
  render: () => <Shell />,
};

/** 768px 未満：下部タブバー。PC のサイドバーを縮めたものではなく、別の配置。 */
export const Compact: Story = {
  globals: { viewport: { value: 'compact', isRotated: false } },
  render: () => <Shell />,
};

/** 768–1199px：2 ペインを保つため rail（64px）。名前はアイコンの下に出す。 */
export const Medium: Story = {
  globals: { viewport: { value: 'medium', isRotated: false } },
  render: () => <Shell />,
};

/** 1200–1439px：rail（64px）で 3 ペインを保つ。 */
export const WideRail: Story = {
  name: 'Wide · rail',
  globals: { viewport: { value: 'wide-rail', isRotated: false } },
  render: () => <Shell />,
};

/** 1440px 以上：サイドバー（224px）。項目 36px に 20px アイコン＋ラベル＋件数。 */
export const Wide: Story = {
  globals: { viewport: { value: 'wide', isRotated: false } },
  render: () => <Shell />,
};

const stateItems: NavigationItem[] = [
  {
    id: 'today',
    label: '今日',
    icon: <Sun aria-hidden />,
    href: '#today',
    count: 4,
  },
  {
    id: 'sprint',
    label: 'Sprint',
    icon: <Route aria-hidden />,
    href: '#sprint',
    count: 18,
  },
  {
    id: 'backlog',
    label: 'Backlog',
    icon: <Inbox aria-hidden />,
    href: '#backlog',
    count: 42,
  },
  {
    id: 'hover',
    label: 'hover',
    icon: <Rewind aria-hidden />,
    href: '#hover',
  },
  {
    id: 'focus',
    label: 'focus',
    icon: <Rewind aria-hidden />,
    href: '#focus',
  },
  {
    id: 'disabled',
    label: 'disabled',
    icon: <Settings aria-hidden />,
    href: '#disabled',
    disabled: true,
  },
];

const tabBarStateItems: NavigationItem[] = [
  stateItems[1]!,
  stateItems[3]!,
  stateItems[4]!,
  stateItems[5]!,
];

/**
 * DESIGN.md「共通の状態」で Navigation に必須の状態：Default・Hover・Focus・
 * Selected（現在地 = Sprint）・Disabled。Hover と Focus は
 * storybook-addon-pseudo-states で強制表示している。focus は項目の内側のリング。
 */
export const States: Story = {
  parameters: {
    layout: 'padded',
    pseudo: {
      hover: ['a[href="#hover"]'],
      focusVisible: ['a[href="#focus"]', 'a[href="#sprint"]'],
    },
  },
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <figure className="flex flex-col gap-2">
        <figcaption className="text-label text-ink-muted">sidebar</figcaption>
        <Navigation
          items={stateItems}
          brand="Itera"
          current="sprint"
          layout="sidebar"
          label="sidebar"
        />
      </figure>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-label text-ink-muted">rail</figcaption>
        <Navigation
          items={stateItems}
          brand="Itera"
          current="sprint"
          layout="rail"
          label="rail"
        />
      </figure>
      <figure className="flex flex-col gap-2" style={{ width: 390 }}>
        <figcaption className="text-label text-ink-muted">tab-bar</figcaption>
        <Navigation
          items={tabBarStateItems}
          current="sprint"
          layout="tab-bar"
          label="tab-bar"
        />
      </figure>
    </div>
  ),
};
