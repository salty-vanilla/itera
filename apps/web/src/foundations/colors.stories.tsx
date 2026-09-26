import type { Meta, StoryObj } from '@storybook/react-vite';
import { contrast } from './contrast';
import { cssVariable } from './css-variable';
import {
  Cell,
  TokenName,
  TokenPage,
  TokenRow,
  TokenSection,
  TokenTable,
} from './token-page';
import { areaColors, colorGroups } from './token-lists';
import { useTheme } from './use-theme';

// Colors meant to sit on a particular fill are measured against it; the
// subtle fills are backgrounds, not text, so they get no ratio.
const pairedWith: Record<string, string> = {
  'on-primary': 'primary',
  'ink-inverse': 'surface-inverse',
  'on-danger': 'danger',
};

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
    pairedWith[name] ?? (name.endsWith('-subtle') ? undefined : contrastOn);
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
      <Cell className="font-mono text-code whitespace-nowrap text-ink-muted">
        {value}
      </Cell>
      <Cell className="text-right text-num-s tabular-nums text-ink-muted">
        {ratio ? `${ratio.toFixed(1)}:1（${against}）` : '—'}
      </Cell>
    </TokenRow>
  );
}

function AreaRow({ name, label }: { name: string; label: string }) {
  useTheme();
  const value = cssVariable(`--${name}`);
  const ratio = contrast(value, cssVariable('--canvas'));
  return (
    <TokenRow>
      <Cell>
        <span className="inline-flex items-center gap-2 text-meta font-medium whitespace-nowrap text-ink-muted">
          <span
            aria-hidden
            className="size-area-mark rounded-xs"
            style={{ backgroundColor: `var(--${name})` }}
          />
          {label}
        </span>
      </Cell>
      <Cell className="w-full">
        <TokenName>{name}</TokenName>
      </Cell>
      <Cell className="font-mono text-code whitespace-nowrap text-ink-muted">
        {value}
      </Cell>
      <Cell className="text-right text-num-s tabular-nums text-ink-muted">
        {ratio ? `${ratio.toFixed(1)}:1` : '—'}
      </Cell>
    </TokenRow>
  );
}

function ColorsPage() {
  const theme = useTheme();
  return (
    <TokenPage
      title="色"
      lead={`この画面で使われている CSS 変数の値（${theme}）。ツールバーの theme で light / dark を切り替えられる。値が DESIGN.md の YAML と一致することは tokens.test.ts が確かめている。`}
    >
      {colorGroups.map((group) => {
        const contrastOn = 'contrastOn' in group ? group.contrastOn : undefined;
        return (
          <TokenSection
            key={group.title}
            title={group.title}
            description={group.description}
          >
            <TokenTable columns={['見本', 'トークン', '値', 'コントラスト']}>
              {group.tokens.map((name) => (
                <ColorRow key={name} name={name} contrastOn={contrastOn} />
              ))}
            </TokenTable>
          </TokenSection>
        );
      })}
      <TokenSection
        title="Area"
        description="Area の色は 8px の四角い印だけに使い、必ずラベルと併記する。文字・面・枠・左ボーダーには使わない。"
      >
        <TokenTable columns={['Area Indicator', 'トークン', '値', 'canvas 上']}>
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
