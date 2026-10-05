import type { Meta, StoryObj } from '@storybook/react-vite';
import { cssVariable } from './css-variable';
import {
  Cell,
  TokenName,
  TokenPage,
  TokenRow,
  TokenSection,
  TokenTable,
} from './token-page';
import { dimensions, radii, spacingScale } from './token-lists';
import { useTheme } from './use-theme';

const radiusUse: Record<(typeof radii)[number], string> = {
  xs: 'Checkbox、Progress、Switch のつまみ',
  sm: 'Button、IconButton、Input、Tooltip、Notice、Area の路線記号',
  md: 'Popover、Menu、Toast、Agent 提案',
  lg: 'Dialog（通常 UI の最大）',
  xl: 'compact 幅の Bottom Sheet の上角だけ',
  full: 'Filter、Tag / Status、Radio、完了サークルだけ',
};

const elevations = [
  ['overlay', 'Menu、Popover、Toast、非モーダル Drawer。必ず border と併用'],
  ['modal', 'Dialog、モーダル Drawer、Bottom Sheet。scrim と併用'],
  ['drag', 'ドラッグ中の Task Row だけ'],
] as const;

const layers = [
  'layer-local',
  'layer-sticky',
  'layer-drawer',
  'layer-popover',
  'layer-dialog',
  'layer-toast',
  'layer-tooltip',
] as const;

const motion = [
  ['duration-fast', 'hover / press の色、Checkbox・Switch の切り替え'],
  ['duration-base', 'Menu・Popover・Tooltip の出現、行の追加・除外'],
  ['duration-slow', 'Dialog・Drawer の出入り（最大）'],
  ['duration-toast', 'Toast の表示時間'],
  ['duration-toast-action', '操作付きの Toast の表示時間'],
  ['duration-added-flash', '追加した直後の行の点滅'],
  ['ease-standard', '既定'],
  ['ease-enter', '出現'],
  ['ease-exit', '退場'],
] as const;

const breakpoints = [
  ['compact', '768px 未満', '1 カラム、下部タブバー、操作は 44px'],
  ['breakpoint-medium', '768px', '2 ペイン（Backlog / Sprint）'],
  ['breakpoint-wide', '1200px', 'ナビを 64px の rail にし 3 ペインを保つ'],
  ['breakpoint-nav', '1440px', 'ナビ 224px ＋ 3 ペイン'],
  ['breakpoint-xl', '1920px', '3 ペインを保ち、中央のペインを広げる'],
] as const;

function Value({ name }: { name: string }) {
  return (
    <Cell className="text-code whitespace-nowrap text-ink-muted">
      {cssVariable(`--${name}`)}
    </Cell>
  );
}

function ShapeAndSpacePage() {
  useTheme();
  return (
    <TokenPage
      title="形・余白・奥行き"
      lead="Small radius · Flat · Border first · Divider first · Shadow last. 値はこの画面の CSS 変数。YAML にあるもの（角丸・余白・寸法）が DESIGN.md と一致することは tokens.test.ts が確かめている。"
    >
      <TokenSection
        title="角丸"
        description="行（Task Row、差分の行）は角丸 0。Button と Switch に Pill を使わない。"
      >
        <TokenTable columns={['見本', 'トークン', '値', '使う場所']}>
          {radii.map((name) => (
            <TokenRow key={name}>
              <Cell>
                <span
                  aria-hidden
                  className="block size-control-lg border border-border-strong bg-canvas-subtle"
                  style={{ borderRadius: `var(--radius-${name})` }}
                />
              </Cell>
              <Cell>
                <TokenName>rounded.{name}</TokenName>
              </Cell>
              <Value name={`radius-${name}`} />
              <Cell className="w-full text-help text-ink-muted">
                {radiusUse[name]}
              </Cell>
            </TokenRow>
          ))}
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="線"
        description="実線 = 確定、破線 = 未確定（Agent 提案・下書き）。破線を装飾や読み取り専用に使わない。"
      >
        <TokenTable columns={['見本', 'トークン', '値', '使う場所']}>
          <TokenRow>
            <Cell>
              <span aria-hidden className="block w-16 border-t border-border" />
            </Cell>
            <Cell>
              <TokenName>stroke-hairline</TokenName>
            </Cell>
            <Value name="stroke-hairline" />
            <Cell className="w-full text-help text-ink-muted">
              すべての罫、枠、行区切り、Agent 提案の破線
            </Cell>
          </TokenRow>
          <TokenRow>
            <Cell>
              <span
                aria-hidden
                className="block w-16 border-ink"
                style={{ borderTopWidth: 'var(--stroke-strong)' }}
              />
            </Cell>
            <Cell>
              <TokenName>stroke-strong</TokenName>
            </Cell>
            <Value name="stroke-strong" />
            <Cell className="w-full text-help text-ink-muted">
              フォーカスリング、選択中タブの下線、使える時間マーカー
            </Cell>
          </TokenRow>
          <TokenRow>
            <Cell>
              <span
                aria-hidden
                className="block w-16 border-t border-dashed border-proposal-border"
              />
            </Cell>
            <Cell>
              <TokenName>proposal-border</TokenName>
            </Cell>
            <Cell className="text-code whitespace-nowrap text-ink-muted">
              1px 破線
            </Cell>
            <Cell className="w-full text-help text-ink-muted">
              Agent 提案と下書きだけ
            </Cell>
          </TokenRow>
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="余白"
        description="4px 基準。Task density（Backlog・Today）と Thinking space（目標・Capacity・振り返り）を同じ spacing で組まない。"
      >
        <TokenTable columns={['見本', 'トークン', '値']}>
          {spacingScale.map((name) => (
            <TokenRow key={name}>
              <Cell className="w-full">
                <span
                  aria-hidden
                  className="block h-2 bg-ink-subtle"
                  style={{ width: `var(--spacing-${name})` }}
                />
              </Cell>
              <Cell>
                <TokenName>spacing.{name}</TokenName>
              </Cell>
              <Value name={`spacing-${name}`} />
            </TokenRow>
          ))}
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="寸法"
        description="compact 幅ではコントロールを control-lg、Task Row を row-touch にする。ターゲットは pointer 24px、touch 44px 以上。"
      >
        <TokenTable columns={['トークン', '値']}>
          {dimensions.map((name) => (
            <TokenRow key={name}>
              <Cell className="w-full">
                <TokenName>{name}</TokenName>
              </Cell>
              <Value name={`spacing-${name}`} />
            </TokenRow>
          ))}
          <TokenRow>
            <Cell className="w-full">
              <TokenName>measure-read</TokenName>
            </Cell>
            <Value name="container-measure-read" />
          </TokenRow>
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="ブレークポイント"
        description="PC 画面を縮小しただけのレイアウトにしない。ツールバーの viewport で各幅を切り替えられる。"
      >
        <TokenTable columns={['名前', '幅', 'レイアウト']}>
          {breakpoints.map(([name, width, layout]) => (
            <TokenRow key={name}>
              <Cell>
                <TokenName>{name}</TokenName>
              </Cell>
              <Cell className="text-num-s whitespace-nowrap text-ink-muted">
                {width}
              </Cell>
              <Cell className="w-full text-help text-ink-muted">{layout}</Cell>
            </TokenRow>
          ))}
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="奥行き"
        description="Flat が既定。影は浮いている・重なっている面だけに使い、hover を影で表現しない。"
      >
        <div className="grid gap-6 bg-canvas-subtle p-6 medium:grid-cols-3">
          {elevations.map(([name, use]) => (
            <div
              key={name}
              className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4"
              style={{ boxShadow: `var(--elevation-${name})` }}
            >
              <TokenName>elevation-{name}</TokenName>
              <p className="text-help text-ink-muted">{use}</p>
            </div>
          ))}
        </div>
        <TokenTable columns={['重なり順', 'z-index']}>
          {layers.map((name) => (
            <TokenRow key={name}>
              <Cell className="w-full">
                <TokenName>{name}</TokenName>
              </Cell>
              <Value name={name} />
            </TokenRow>
          ))}
        </TokenTable>
      </TokenSection>

      <TokenSection
        title="動き"
        description="状態が変わったことを伝えるためだけに使う。prefers-reduced-motion: reduce ではすべて 0ms。"
      >
        <TokenTable columns={['トークン', '値', '用途']}>
          {motion.map(([name, use]) => (
            <TokenRow key={name}>
              <Cell>
                <TokenName>{name}</TokenName>
              </Cell>
              <Value name={name} />
              <Cell className="w-full text-help text-ink-muted">{use}</Cell>
            </TokenRow>
          ))}
        </TokenTable>
      </TokenSection>
    </TokenPage>
  );
}

const meta = {
  title: 'Foundations/形・余白・奥行き',
  component: ShapeAndSpacePage,
} satisfies Meta<typeof ShapeAndSpacePage>;

export default meta;

export const ShapeAndSpace: StoryObj<typeof meta> = {
  name: '形・余白・奥行き',
};
