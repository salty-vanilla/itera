// Token names shown on the Foundations pages. The values are read from the
// CSS custom properties at run time; tokens.test.ts checks that these lists
// cover every token in DESIGN.md.

export const colorGroups = [
  {
    title: '地と面',
    description:
      '画面の大半は白（dark は墨の地）と墨の文字で成立させる。surface は必ず border と組み、単なるグルーピングには使わない。',
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
      'ink → ink-muted → ink-subtle の 3 段まで。ink-disabled は無効状態だけで、コントラストの要件の対象外。on-* は塗りの上の文字。',
    tokens: [
      'ink',
      'ink-muted',
      'ink-subtle',
      'ink-disabled',
      'ink-inverse',
      'on-area',
    ],
    contrastOn: 'canvas',
  },
  {
    title: '罫',
    description:
      '構造は border、リスト内は border-soft、操作部品の輪郭は border-strong。proposal-border は Agent 提案・計画中の 1px 破線だけ。',
    tokens: ['border', 'border-soft', 'border-strong', 'proposal-border'],
    contrastOn: 'canvas',
  },
  {
    title: '確定（墨）とフォーカス',
    description:
      'Primary は墨。確定の操作だけが塗りを持つ。dark では反転して明るい塗りに墨の文字になる。focus も墨で、2px の輪郭と 2px のアキで示し、色相を持たない。',
    tokens: [
      'primary',
      'primary-hover',
      'primary-active',
      'on-primary',
      'link',
      'focus',
    ],
    contrastOn: 'canvas',
  },
  {
    title: '現在地（黄）',
    description:
      '今日・今の段階・選んだものだけに使う予約色。必ずチェックか語を伴う。注意やフォーカスには使わない。',
    tokens: ['here', 'here-subtle', 'on-here'],
    contrastOn: 'canvas',
  },
  {
    title: 'Semantic',
    description:
      '色を持つのは危険（赤）と注意（琥珀）だけ。必ずアイコンか語と組む。成功と情報は墨の文字にアイコンと語を添える。',
    tokens: [
      'warning',
      'warning-subtle',
      'danger',
      'danger-hover',
      'danger-active',
      'danger-subtle',
      'on-danger',
    ],
    contrastOn: 'canvas',
  },
] as const;

// Example Area names; the badge shows the first character of the name.
export const areaColors = [
  ['area-1', '研究'],
  ['area-2', '仕事'],
  ['area-3', '学習'],
  ['area-4', '生活'],
  ['area-5', '創作'],
  ['area-6', '健康'],
  ['area-7', '家事'],
  ['area-none', '領域なし'],
] as const;

// Class names are written out in full so that Tailwind can find them.
export const typographyGroups = [
  {
    title: '見出しと確定した言葉',
    description:
      '階層は 700 とサイズの差で作る。本人が確定した言葉（Goal、次に試すこと、振り返り）は goal / reflection で本文より一段大きく組む。',
    samples: [
      ['display-l', 'text-display-l', 'Sprint 14'],
      ['display-m', 'text-display-m', '今週、何を進めるか'],
      ['goal', 'text-goal', '論文の第3章の草稿を終える'],
      [
        'reflection',
        'text-reflection',
        '午前に集中する時間を取れた日は、研究のタスクが進んでいた。',
      ],
    ],
  },
  {
    title: '操作と本文',
    description:
      '太さは 400 と 700 だけ。12px 未満の文字は作らない。kicker は「Agent 提案」などのラベルで、見出しの上の飾りにしない。',
    samples: [
      ['heading', 'text-heading', '時間の見通し'],
      ['subheading', 'text-subheading', '研究'],
      ['button', 'text-button', 'Sprint を確定'],
      ['body-l', 'text-body-l', '見積もりの提案のどこで計画するかを決めます。'],
      [
        'body',
        'text-body',
        '使える時間から計画の合計を引いた残りを、幅のまま示します。',
      ],
      ['task', 'text-task', '関連研究のメモを整理する'],
      ['label', 'text-label', '使える時間'],
      ['help', 'text-help', '0.5時間単位で入力します'],
      ['meta', 'text-meta', '10/5 (月) · 持ち越し 1回'],
      ['kicker', 'text-kicker', 'Agent 提案'],
    ],
  },
  {
    title: '数字と Kbd',
    description:
      '数字も LINE Seed JP で組む。数字はプロポーショナルなので、並ぶ列は右揃えにする。–（範囲）と −（負号）はハイフンと見分けられる。',
    samples: [
      ['num-l', 'text-num-l', '残り 1 〜 3h'],
      ['num-m', 'text-num-m', '16.5–18.5h'],
      ['num-s', 'text-num-s', '2–4h / 2-4'],
      ['code', 'text-code', '⌘ Enter'],
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
  'row-menu',
  'target-min',
  'target-touch',
  'icon-s',
  'icon-m',
  'area-badge',
  'pane-nav',
  'pane-rail',
  'pane-list',
  'pane-list-slim',
  'pane-list-xl',
  'pane-list-slim-xl',
  'pane-sprint',
  'pane-today',
  'pane-rows',
  'pane-side',
  'toast',
  'drawer',
  'popover',
  'dialog-sm',
  'dialog-md',
  'dialog-lg',
] as const;
