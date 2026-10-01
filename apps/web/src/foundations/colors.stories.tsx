import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { contrast } from './contrast';
import { cssVariable } from './css-variable';
import {
  Cell,
  TokenName,
  TokenPage,
  TokenRow,
  TokenSection,
  TokenTable,
  compactHiddenCell,
} from './token-page';
import { areaColors, colorGroups } from './token-lists';
import { useTheme } from './use-theme';

// Colors meant to sit on a particular fill are measured against it; the
// *-subtle fills are backgrounds, not text, so they get no ratio (ink-subtle
// is text and keeps one).
const pairedWith: Record<string, string> = {
  'on-primary': 'primary',
  'on-here': 'here',
  'on-area': 'area-1',
  'ink-inverse': 'surface-inverse',
  'on-danger': 'danger',
};

const isBackground = (name: string) =>
  name.endsWith('-subtle') && !name.startsWith('ink-');

// The route badge: an area color square with the first character of the
// Area name cut out in on-area. Screens use the Area Indicator component
// (a later issue); this page only shows the tokens at work.
function RouteBadge({ name, label }: { name: string; label: string }) {
  const mark = name === 'area-none' ? '－' : label.slice(0, 1);
  return (
    <span className="inline-flex items-center gap-2 text-meta font-bold whitespace-nowrap text-ink-muted">
      <span
        aria-hidden
        className="inline-flex size-area-badge items-center justify-center rounded-sm text-kicker text-on-area"
        style={{ backgroundColor: `var(--${name})` }}
      >
        {mark}
      </span>
      {label}
    </span>
  );
}

// The palette at work, shown first: ink confirms, yellow marks where you
// are, a dashed line means not yet decided. These are demonstrations of the
// tokens; the real Sprint Header and Estimate components come later.
const stages = ['選ぶ', '整える', '確かめる'] as const;
const days = ['月', '火', '水', '木', '金', '土', '日'] as const;

function StageLine({ current }: { current: number }) {
  return (
    <ol className="flex items-start" aria-label="計画の段階">
      {stages.map((stage, index) => {
        const isCurrent = index === current;
        return (
          <li key={stage} className="flex items-start">
            {index > 0 && (
              // The rail meets the middle of the 36px station.
              <span aria-hidden className="mt-4 h-1 w-8 bg-ink medium:w-12" />
            )}
            <span
              className="flex flex-col items-center gap-1"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={
                  isCurrent
                    ? 'flex size-control-md items-center justify-center rounded-full border-2 border-ink bg-here text-num-m text-on-here'
                    : 'flex size-control-md items-center justify-center rounded-full border-2 border-ink bg-canvas text-num-m text-ink'
                }
              >
                {index + 1}
              </span>
              <span className="text-label text-ink">{stage}</span>
              {isCurrent && <span className="text-kicker text-ink">現在</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WeekStrip({ today }: { today: number }) {
  return (
    <ol className="grid grid-cols-7 border-t border-border" aria-label="今週">
      {days.map((day, index) => (
        <li
          key={day}
          className={
            index === today
              ? 'flex flex-col items-center gap-1 border-t-4 border-here pt-2'
              : 'flex flex-col items-center gap-1 border-t-4 border-transparent pt-2'
          }
        >
          <span className="text-label text-ink">{day}</span>
          <span className="text-meta text-ink-muted">
            {index === today ? '今日' : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Specimen({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note: string;
}) {
  return (
    <figure className="flex flex-col gap-3 border-t-2 border-ink pt-3">
      <figcaption className="text-heading text-ink">{title}</figcaption>
      <div className="flex min-h-control-lg items-center">{children}</div>
      <p className="text-help text-ink-muted">{note}</p>
    </figure>
  );
}

function Roles() {
  return (
    <div className="flex flex-col gap-8">
      <ul
        className="flex flex-wrap gap-x-6 gap-y-3"
        aria-label="Area の路線記号"
      >
        {areaColors.map(([name, label]) => (
          <li key={name}>
            <RouteBadge name={name} label={label} />
          </li>
        ))}
      </ul>
      <div className="grid gap-8 medium:grid-cols-2">
        <Specimen
          title="墨：確定"
          note="塗りを持つのは確定の操作だけ。1 画面に 1 つ。"
        >
          <div className="flex gap-2">
            <Button variant="quiet">キャンセル</Button>
            <Button variant="primary">Sprint を確定</Button>
          </div>
        </Specimen>
        <Specimen
          title="黄：現在地"
          note="今の段階と今日だけに黄を置き、「現在」「今日」の語を添える。"
        >
          <StageLine current={1} />
        </Specimen>
        <Specimen
          title="黄：今日の列"
          note="週の格子で、今日の列の上端に黄の太線。"
        >
          <div className="w-full">
            <WeekStrip today={2} />
          </div>
        </Specimen>
        <Specimen
          title="破線：計画中"
          note="見積もりの提案と下書きは 1px の破線と「提案」の語。本人の値は実線。"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xs border border-dashed border-proposal-border px-2 py-1 text-ink">
              <span className="text-kicker">提案</span>
              <span className="text-num-m">2–4h</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-xs border border-ink px-2 py-1 text-ink">
              <span className="text-kicker">計画</span>
              <span className="text-num-m">4h</span>
            </span>
          </div>
        </Specimen>
      </div>
    </div>
  );
}

function ColorRow({
  name,
  contrastOn,
}: {
  name: string;
  contrastOn?: string | undefined;
}) {
  // Re-read the variables when the theme changes.
  useTheme();
  const value = cssVariable(`--${name}`);
  const against =
    pairedWith[name] ?? (isBackground(name) ? undefined : contrastOn);
  const ratio = against
    ? contrast(value, cssVariable(`--${against}`))
    : undefined;
  return (
    <TokenRow>
      <Cell>
        <span
          aria-hidden
          className="block size-control-md rounded-sm border border-border"
          style={{ backgroundColor: `var(--${name})` }}
        />
      </Cell>
      <Cell className="w-full">
        <TokenName>{name}</TokenName>
      </Cell>
      <Cell
        className={cn(
          'text-code whitespace-nowrap text-ink-muted',
          compactHiddenCell,
        )}
      >
        {value}
      </Cell>
      <Cell className="text-right text-num-s whitespace-nowrap text-ink-muted">
        {ratio ? (
          <>
            {ratio.toFixed(1)}:1
            <span className="block font-sans text-meta">{against}</span>
          </>
        ) : (
          '—'
        )}
      </Cell>
    </TokenRow>
  );
}

function AreaRow({ name, label }: { name: string; label: string }) {
  useTheme();
  const value = cssVariable(`--${name}`);
  const onArea = contrast(cssVariable('--on-area'), value);
  const onCanvas = contrast(value, cssVariable('--canvas'));
  return (
    <TokenRow>
      <Cell>
        <RouteBadge name={name} label={label} />
      </Cell>
      <Cell className="w-full">
        <TokenName>{name}</TokenName>
      </Cell>
      <Cell
        className={cn(
          'text-code whitespace-nowrap text-ink-muted',
          compactHiddenCell,
        )}
      >
        {value}
      </Cell>
      <Cell className="text-right text-num-s whitespace-nowrap text-ink-muted">
        {onArea ? `${onArea.toFixed(1)}:1` : '—'}
      </Cell>
      <Cell className="text-right text-num-s whitespace-nowrap text-ink-muted">
        {onCanvas ? `${onCanvas.toFixed(1)}:1` : '—'}
      </Cell>
    </TokenRow>
  );
}

function ColorsPage() {
  const theme = useTheme();
  return (
    <TokenPage
      title="色"
      lead={`色は予約語で、1 つの色に 1 つの意味だけを持たせる。表の値はこの画面の CSS 変数（${theme}）。ツールバーの theme で light / dark を切り替えられる。値が DESIGN.md の YAML と一致することは tokens.test.ts が確かめている。`}
    >
      <Roles />
      {colorGroups.map((group) => {
        const contrastOn = 'contrastOn' in group ? group.contrastOn : undefined;
        return (
          <TokenSection
            key={group.title}
            title={group.title}
            description={group.description}
          >
            <TokenTable
              columns={['見本', 'トークン', '値', 'コントラスト']}
              compactHidden={[2]}
            >
              {group.tokens.map((name) => (
                <ColorRow key={name} name={name} contrastOn={contrastOn} />
              ))}
            </TokenTable>
          </TokenSection>
        );
      })}
      <TokenSection
        title="Area"
        description="路線記号：色の四角に Area 名の先頭 1 文字を白抜きにし、必ず名前と併記する。8 色は同じ明度で、light / dark で同じ値。文字・面・枠・左ボーダーには使わない。"
      >
        <TokenTable
          columns={['路線記号', 'トークン', '値', '白抜きの文字', 'canvas 上']}
          compactHidden={[2]}
        >
          {areaColors.map(([name, label]) => (
            <AreaRow key={name} name={name} label={label} />
          ))}
        </TokenTable>
      </TokenSection>
    </TokenPage>
  );
}

const meta = {
  title: 'Foundations/色',
  component: ColorsPage,
} satisfies Meta<typeof ColorsPage>;

export default meta;

export const Colors: StoryObj<typeof meta> = { name: '色' };
