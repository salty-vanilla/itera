// Token names shown on the Foundations pages. The values are read from the
// CSS custom properties at run time; tokens.test.ts checks that these lists
// cover every token in DESIGN.md.

export const colorGroups = [
  {
    title: '地と面',
    description:
      '画面の 9 割は Neutral で成立させる。surface は必ず border と組み、単なるグルーピングには使わない。',
    tokens: [
      'canvas',
      'canvas-subtle',
      'surface',
      'surface-hover',
      'surface-pressed',
      'surface-inverse',
      'scrim',
    ],
  },
  {
    title: '文字',
    description:
      'ink → ink-muted → ink-subtle の 3 段まで。ink-disabled は無効状態だけで、コントラストの要件の対象外。',
    tokens: ['ink', 'ink-muted', 'ink-subtle', 'ink-disabled', 'ink-inverse'],
    contrastOn: 'canvas',
  },
  {
    title: '罫',
    description:
      '構造は border、リスト内は border-soft、操作部品の輪郭は border-strong。proposal-border は Agent 提案・未確定の 1px 破線だけ。',
    tokens: ['border', 'border-soft', 'border-strong', 'proposal-border'],
    contrastOn: 'canvas',
  },
  {
    title: 'Primary と Focus',
    description:
      'Primary はブルーブラックの 1 色。focus はフォーカスリングだけに使い、選択（primary-subtle）と見分けられる明るさにしている。',
    tokens: [
      'primary',
      'primary-hover',
      'primary-active',
      'primary-subtle',
      'on-primary',
      'link',
      'focus',
    ],
    contrastOn: 'canvas',
  },
  {
    title: 'Semantic',
    description:
      '必ずアイコンか語と組む。danger はエラー・期限超過・確定的な容量超過・破壊的操作だけ。',
    tokens: [
      'success',
      'success-subtle',
      'warning',
      'warning-subtle',
      'danger',
      'danger-hover',
      'danger-active',
      'danger-subtle',
      'on-danger',
      'info',
      'info-subtle',
    ],
    contrastOn: 'canvas',
  },
] as const;

export const areaColors = [
  ['area-1', '弁柄'],
  ['area-2', '青磁の濃色'],
  ['area-3', '葡萄'],
  ['area-4', '苔'],
  ['area-5', '臙脂'],
  ['area-6', '鉄紺'],
  ['area-7', '煤竹'],
  ['area-none', '灰（領域なし）'],
] as const;

// Class names are written out in full so that Tailwind can find them.
export const typographyGroups = [
  {
    title: '考える（明朝）',
    description:
      '本人が確定した考えだけに使う：Sprint 見出し、Goal、改善策、Retro の振り返り。編集中と未確定の提案は Sans に戻す。',
    samples: [
      ['display-l', 'font-serif text-display-l', 'Sprint 14'],
      ['display-m', 'font-serif text-display-m', '今週、何を進めますか'],
      ['goal', 'font-serif text-goal', '論文の第 3 章の草稿を終える'],
      [
        'reflection',
        'font-serif text-reflection',
        '午前に集中する時間を取れた日は、研究のタスクが進んでいた。',
      ],
    ],
  },
  {
    title: '操作する（Sans）',
    description:
      '見出しを太くして階層を作らない。階層は書体・サイズ・余白・罫で作る。12px 未満の文字は作らない。',
    samples: [
      ['heading', 'text-heading', '時間の見通し'],
      ['subheading', 'text-subheading', '研究'],
      ['button', 'text-button', 'Sprint を確定'],
      [
        'body-l',
        'text-body-l',
        'Estimate の幅を計画値のどこで使うかを決めます。',
      ],
      [
        'body',
        'text-body',
        '可用時間から計画値の合計を引いた残りを、幅のまま示します。',
      ],
      ['task', 'text-task', '関連研究のメモを整理する'],
      ['label', 'text-label', '可用時間'],
      ['help', 'text-help', '0.5時間単位で入力します'],
      ['meta', 'text-meta', '10/5 (月) · 持ち越し 1回'],
      ['kicker', 'text-kicker', 'SPRINT 14 · 2日目 / 7日'],
    ],
  },
  {
    title: '数値と Kbd',
    description:
      '数値は tabular-nums。時間・件数・日付が並ぶ列は右揃え。mono は Kbd だけに使う。',
    samples: [
      ['num-l', 'text-num-l tabular-nums', '残り −1 〜 1h'],
      ['num-m', 'text-num-m tabular-nums', '16.5–18.5h'],
      ['num-s', 'text-num-s tabular-nums', '2–4h'],
      ['code', 'font-mono text-code', '⌘ Enter'],
    ],
  },
] as const;

export const radii = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;

export const spacingScale = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '16',
] as const;

export const dimensions = [
  'control-sm',
  'control-md',
  'control-lg',
  'row-task',
  'row-touch',
  'target-min',
  'target-touch',
  'icon-s',
  'icon-m',
  'area-mark',
  'pane-nav',
  'pane-rail',
  'pane-list',
  'pane-side',
  'drawer',
] as const;
