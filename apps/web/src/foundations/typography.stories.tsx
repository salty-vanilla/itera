import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Cell,
  TokenName,
  TokenPage,
  TokenRow,
  TokenSection,
  TokenTable,
} from './token-page';
import { typographyGroups } from './token-lists';

// The rendered family, size/line height, weight and tracking of the sample.
function useRenderedSpec() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [spec, setSpec] = useState('');
  useLayoutEffect(() => {
    if (!ref.current) return;
    const style = getComputedStyle(ref.current);
    const family = style.fontFamily.split(',')[0]?.replaceAll('"', '').trim();
    const tracking =
      style.letterSpacing === 'normal' || parseFloat(style.letterSpacing) === 0
        ? ''
        : ` · 字間 ${style.letterSpacing}`;
    setSpec(
      `${family} · ${style.fontSize}/${style.lineHeight} · ${style.fontWeight}${tracking}`,
    );
  }, []);
  return { ref, spec };
}

function TypeRow({
  name,
  className,
  text,
}: {
  name: string;
  className: string;
  text: string;
}) {
  const { ref, spec } = useRenderedSpec();
  return (
    <TokenRow>
      <Cell className="w-full">
        <p ref={ref} className={cn(className, 'text-ink')}>
          {text}
        </p>
      </Cell>
      <Cell>
        <TokenName>{name}</TokenName>
      </Cell>
      <Cell className="text-code whitespace-nowrap text-ink-muted">{spec}</Cell>
    </TokenRow>
  );
}

// Whether each family has been loaded from Google Fonts. Without it the page
// falls back to the system fonts listed in DESIGN.md.
function FontStatus() {
  const [loaded, setLoaded] = useState<[string, boolean][]>([]);
  useLayoutEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (!active) return;
      setLoaded([
        ['LINE Seed JP', document.fonts.check('700 14px "LINE Seed JP"', 'あ')],
      ]);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <ul className="flex flex-col gap-1 text-help text-ink-muted">
      {loaded.map(([family, ok]) => (
        <li key={family}>
          {family}：
          {ok ? '読み込み済み' : '読み込めていない（代替の書体で表示）'}
        </li>
      ))}
    </ul>
  );
}

function TypographyPage() {
  return (
    <TokenPage
      title="タイポグラフィ"
      lead="書体は LINE Seed JP の 1 系列。文字も数字も Kbd も同じ書体。右の列は見本が実際に描画された書体・サイズ/行送り・ウェイト・字間。トークンの値が DESIGN.md の YAML と一致することは tokens.test.ts が確かめている。"
    >
      <TokenSection title="書体の読み込み">
        <FontStatus />
      </TokenSection>
      {typographyGroups.map((group) => (
        <TokenSection
          key={group.title}
          title={group.title}
          description={group.description}
        >
          <TokenTable columns={['見本', 'トークン', '描画']}>
            {group.samples.map(([name, className, text]) => (
              <TypeRow
                key={name}
                name={name}
                className={className}
                text={text}
              />
            ))}
          </TokenTable>
        </TokenSection>
      ))}
    </TokenPage>
  );
}

const meta = {
  title: 'Foundations/タイポグラフィ',
  component: TypographyPage,
} satisfies Meta<typeof TypographyPage>;

export default meta;

export const Typography: StoryObj<typeof meta> = { name: 'タイポグラフィ' };
