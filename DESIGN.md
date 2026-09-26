---
version: alpha
name: Itera
description: Quiet, precise personal planning tool. 紙面の「情報の秩序・余白・罫線・タイポグラフィ・静けさ」をプロダクト UI に翻訳する。
colors:
  # Light theme. Dark theme values use the same name with a `-dark` suffix.
  # Reference tokens (link, proposal-border) have no `-dark` twin: they follow
  # the referenced token in each theme.
  canvas: "#ffffff"
  canvas-subtle: "#f6f6f4"
  surface: "#ffffff"
  surface-hover: "#efefec"
  surface-pressed: "#e6e6e2"
  surface-inverse: "#2b2b29"
  ink: "#2b2b29"
  ink-muted: "#5b5b56"
  ink-subtle: "#6a6a64"
  ink-disabled: "#a8a8a2"
  ink-inverse: "#ffffff"
  border: "#dcdcd7"
  border-soft: "#ebebe7"
  border-strong: "#8a8a84"
  primary: "#2a4a6e"
  primary-hover: "#223d5b"
  primary-active: "#1b3149"
  primary-subtle: "#edf1f6"
  on-primary: "#ffffff"
  link: "{colors.primary}"
  focus: "#3269b0"
  success: "#2d6a45"
  success-subtle: "#ebf3ed"
  warning: "#855800"
  warning-subtle: "#faf2de"
  danger: "#b02a22"
  danger-hover: "#962219"
  danger-active: "#7d1c15"
  danger-subtle: "#fbeceb"
  on-danger: "#ffffff"
  info: "#2f5f94"
  info-subtle: "#ecf2f8"
  area-1: "#a45f36"
  area-2: "#2d7773"
  area-3: "#7b5a8e"
  area-4: "#687a2c"
  area-5: "#a8526a"
  area-6: "#5a6d88"
  area-7: "#7a6a58"
  area-none: "#8a8a84"
  proposal-border: "{colors.border-strong}"
  scrim: "#1f1f1d52"
  canvas-dark: "#1b1b1a"
  canvas-subtle-dark: "#222221"
  surface-dark: "#262625"
  surface-hover-dark: "#2f2f2d"
  surface-pressed-dark: "#383835"
  surface-inverse-dark: "#e9e9e4"
  ink-dark: "#ebebe6"
  ink-muted-dark: "#b8b8b1"
  ink-subtle-dark: "#a0a099"
  ink-disabled-dark: "#696964"
  ink-inverse-dark: "#1b1b1a"
  border-dark: "#3b3b38"
  border-soft-dark: "#2f2f2d"
  border-strong-dark: "#7d7d77"
  primary-dark: "#a3bfe2"
  primary-hover-dark: "#b7cdea"
  primary-active-dark: "#cad9ef"
  primary-subtle-dark: "#233142"
  on-primary-dark: "#14202d"
  focus-dark: "#82b3f0"
  success-dark: "#82c79a"
  success-subtle-dark: "#1e2e24"
  warning-dark: "#e3b95e"
  warning-subtle-dark: "#322916"
  danger-dark: "#f2918a"
  danger-hover-dark: "#f5a7a1"
  danger-active-dark: "#f8bdb8"
  danger-subtle-dark: "#3a2321"
  on-danger-dark: "#1b1b1a"
  info-dark: "#94b9e6"
  info-subtle-dark: "#1f2b3a"
  area-1-dark: "#d69b74"
  area-2-dark: "#6dbcb6"
  area-3-dark: "#bd9dcd"
  area-4-dark: "#abba6c"
  area-5-dark: "#dc8fa3"
  area-6-dark: "#9dafc6"
  area-7-dark: "#b5a48f"
  area-none-dark: "#8f8f89"
  scrim-dark: "#000000a3"
typography:
  display-l:
    fontFamily: Zen Old Mincho
    fontSize: 32px
    fontWeight: 500
    lineHeight: 44px
    letterSpacing: 0.02em
  display-m:
    fontFamily: Zen Old Mincho
    fontSize: 24px
    fontWeight: 500
    lineHeight: 36px
    letterSpacing: 0.02em
  goal:
    fontFamily: Zen Old Mincho
    fontSize: 18px
    fontWeight: 500
    lineHeight: 30px
    letterSpacing: 0.02em
  reflection:
    fontFamily: Zen Old Mincho
    fontSize: 16px
    fontWeight: 400
    lineHeight: 30px
    letterSpacing: 0.02em
  button:
    fontFamily: Noto Sans JP
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0em
  heading:
    fontFamily: Noto Sans JP
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0em
  subheading:
    fontFamily: Noto Sans JP
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0em
  body-l:
    fontFamily: Noto Sans JP
    fontSize: 16px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0.02em
  body:
    fontFamily: Noto Sans JP
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0.01em
  task:
    fontFamily: Noto Sans JP
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0em
  label:
    fontFamily: Noto Sans JP
    fontSize: 13px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0em
  help:
    fontFamily: Noto Sans JP
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0em
  meta:
    fontFamily: Noto Sans JP
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0em
  kicker:
    fontFamily: Noto Sans JP
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.04em
  num-l:
    fontFamily: Noto Sans JP
    fontSize: 24px
    fontWeight: 500
    lineHeight: 32px
    fontFeature: '"tnum"'
  num-m:
    fontFamily: Noto Sans JP
    fontSize: 16px
    fontWeight: 500
    lineHeight: 24px
    fontFeature: '"tnum"'
  num-s:
    fontFamily: Noto Sans JP
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    fontFeature: '"tnum"'
  code:
    fontFamily: ui-monospace
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "10": 40px
  "12": 48px
  "16": 64px
  control-sm: 28px
  control-md: 36px
  control-lg: 44px
  row-task: 40px
  row-touch: 48px
  target-min: 24px
  target-touch: 44px
  icon-s: 16px
  icon-m: 20px
  area-mark: 8px
  pane-nav: 224px
  pane-rail: 64px
  pane-list: 384px
  pane-side: 336px
  drawer: 400px
  measure-read: 38em
  bp-medium: 768px
  bp-wide: 1200px
  bp-nav: 1440px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    height: 36px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 36px
  button-quiet:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 36px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: 36px
    typography: "{typography.body}"
  task-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.task}"
    height: 40px # minimum; stacked rows with metadata are about 52px
  task-row-selected:
    backgroundColor: "{colors.primary-subtle}"
  proposal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  tag:
    rounded: "{rounded.full}"
    height: 20px
---

# Itera DESIGN.md v0.2

仕事・研究・学習・生活を並行する個人が、1 週間の Sprint ごとに「何を達成するか」を決め、実行し、Retro で計画の立て方を改善するための道具のデザインシステム。人と Coding Agent の両方が読む前提で、曖昧な形容詞ではなくトークン名・数値・許可 / 禁止で判断できるように書く。

- 形式は公式の DESIGN.md spec（google-labs-code/design.md）に従う。先頭の YAML がトークンの正で、本文はその使い方を説明する。
- 意味・状態・用語は `docs/domain/domain-model.md` と `docs/requirements/prd.md` が優先する。この文書は見た目・部品・レイアウトを決める。
- この形式に収まらない製品固有の指針は `docs/design/` にある：[パターン](docs/design/patterns.md)（Planning / Today / Retro / Backlog）、[Agent UI](docs/design/agent-ui.md)、[文言と用語](docs/design/content.md)、[アクセシビリティ](docs/design/accessibility.md)、[アイコンと動き](docs/design/foundations.md)、[参照方針](docs/design/design-context.md)。

## Overview

方向は **Quiet, precise personal planning tool**。手帳の装飾ではなく、紙面が持つ情報の秩序・余白・罫線・タイポグラフィ・静けさを UI に翻訳する。白と無彩を中心に、罫線で構造を作り、影はほとんど使わない。情報が主役で、装飾はしない。

迷ったら次の 3 つに戻る。

1. **Border first → Divider first → Shadow last**
2. **Sans で操作し、明朝で考える**
3. **破線は「まだ本人が決めていない」**

### 原則

1. **Clarity — 今何を決めているかが分かる。** 画面ごとに「決めていること」を 1 つだけ見出しにする（例：「今週、何を進めますか」）。選択は `primary-subtle` の背景 **と** チェックで示し、色だけにしない。幅がある時間は幅のまま出す（`−1 〜 1h`）。
2. **Agency — 決めるのは本人。** Agent・AI の値は破線と「提案」「Agent 提案」の語で区別し、本人の値は実線・ラベルなし。「採用」は Secondary、「編集して採用」「却下」は Quiet にし、Primary で採用を誘導しない。
3. **Calmness — 注意を奪わない。** Primary Button は 1 画面に 1 つ。色面は状態と選択だけ。Area の色は 8px の印だけ。考える領域（Goal、Capacity、Retro）には意図的に余白を取る。
4. **Precision — 小さな数値ほど丁寧に。** 数値は tabular-nums。1h 未満は `30m`、合計は常に h、範囲は en dash（`2–4h`）、負を含む範囲は `〜`。未見積は「0」ではなく「未見積」と書き、合計に含めないことを示す。
5. **Continuity — Planning → Today → Retro → 次の Planning。** Task Row・Goal・Estimate・Area Indicator はすべての画面で同じ見た目。明朝は Sprint 見出し・Goal・改善策・Retro の振り返りに一貫して使い、「考えた言葉」の連続性を作る。
6. **Accessibility — 最初から設計に含める。** テキスト 4.5:1、操作部品の輪郭・フォーカス・意味のある印は 3:1。フォーカスリングを消さない。ターゲットは pointer 24px、compact 幅 44px。詳細は [アクセシビリティ](docs/design/accessibility.md)。

## Colors

画面の 9 割は Neutral（`canvas` `canvas-subtle` `surface` `ink` `ink-muted` `border`）で成立させる。色は意味がある場所にだけ置く。

| 層 | トークン | 使う場所 | 使わない場所 |
| --- | --- | --- | --- |
| 地 | `canvas` | 紙面：Sprint 本体、Today、Retro の本文 | — |
| 地 | `canvas-subtle` | Backlog ペイン、ナビゲーション、表ヘッダー、読み取り専用入力 | 考える領域の主面 |
| 面 | `surface` | Dialog、Drawer、Popover、Menu、Toast、Agent 提案。必ず `border` と組む | 単なるグルーピング |
| 状態 | `surface-hover` / `surface-pressed` | hover / 押下 | 選択（選択は `primary-subtle`） |
| 反転 | `surface-inverse` / `ink-inverse` | Tooltip とショートカット表示だけ | それ以外 |
| 文字 | `ink` / `ink-muted` / `ink-subtle` | 本文 / 補足 / 三次（件数・完了済み・プレースホルダー）。これより薄い文字色を作らない | — |
| 文字 | `ink-disabled` | 無効状態だけ | 情報を伝える文字 |
| 罫 | `border` / `border-soft` | 構造の罫 / リスト内の行区切り | 操作部品の輪郭 |
| 罫 | `border-strong` | 入力・Checkbox・Radio・Switch・Secondary Button の輪郭 | 装飾の罫 |
| Primary | `primary` 系 | Primary Button、オン状態、選択の印、Progress、リンク | 大きな面、見出しの文字色 |
| Focus | `focus` | フォーカスリングだけ | それ以外すべて |
| Semantic | `success` `warning` `danger` `info` と `*-subtle` | 状態の文字・アイコン・Status Tag・Notice。必ずアイコンか語を伴う | Area の識別、装飾 |
| Area | `area-1`〜`area-7`、`area-none` | 8px の Area Mark、Capacity バーのセグメント、Filter の印 | 文字色、面の塗り、枠線、左ボーダー |
| 未確定 | `proposal-border` | Agent 提案・未確定値の 1px 破線 | 確定済みの値 |
| 暗幕 | `scrim` | Dialog / モーダル Drawer の背後。Blur は使わない | — |

### Primary は 1 色

`primary`（ブルーブラック）だけ。万年筆のインクの色として、選択・確定・進捗に使う。

- Primary Button は 1 画面に 1 つ（Planning では「Sprint を確定」）。
- 選択 = `primary-subtle` の背景 + チェック。Tabs の選択は `ink` の下線（ナビゲーションは色で示さない）。
- 塗りの上の文字は必ず `on-primary`。dark では暗色になるので白を直書きしない。
- `link` は `primary` の別名。下線を常に付け、色だけでリンクを示さない。

### Area の色

Area（領域）はユーザーが作る。色は面ではなく **印** として使い、明度・彩度を揃えた 7 色と未設定の 1 色から割り当てる。

| トークン | 色見本 | 既定の割り当て |
| --- | --- | --- |
| `area-1` | 弁柄 | 1 番目に作った Area |
| `area-2` | 青磁の濃色 | 2 番目 |
| `area-3` | 葡萄 | 3 番目（紫だが AI 表現には使わない） |
| `area-4` | 苔 | 4 番目 |
| `area-5` | 臙脂 | 5 番目 |
| `area-6` | 鉄紺 | 6 番目 |
| `area-7` | 煤竹 | 7 番目 |
| `area-none` | 灰 | Area 未設定（「領域なし」）だけ。Goal に紐づかない Task は、その Task の Area の色に含める（goalLink は Area とは別の軸） |

- Area は **必ずラベルと併記**（Area Indicator）。四角（`rounded.xs`）で描き、Semantic の丸いアイコンと形で区別する。
- 同じ画面に Area の色を 8 種類以上並べない。本人は Area の色を変えられる（ドメインモデル Area の「色」）。

### Semantic と Area を混同しない

- Semantic はアイコン＋語とセットで、文字・アイコン・Status Tag・Notice にだけ使う。
- Area は四角い印＋ラベル。Semantic の色で Area を塗らない。`area-1`（弁柄）を danger の代わりに使わない。
- `danger` はエラー・期限超過・確定的な容量超過（下限でも超える）・破壊的操作だけ。持ち越し・見送り・「できなかった」・超過の可能性には使わない。持ち越しは `ink-muted`、3 回以上だけ `warning`。

### コントラスト

- 文字のトークン（`ink` `ink-muted` `ink-subtle` `primary` `success` `warning` `danger` `info`）は light / dark とも `canvas` `canvas-subtle` `surface` `surface-hover` `primary-subtle` の上で 4.5:1 以上。Semantic は各 `*-subtle` の上でも 4.5:1 以上。
- `on-primary` は `primary` / `primary-hover` / `primary-active` の上で、`on-danger` は `danger` / `danger-hover` / `danger-active` の上で 4.5:1 以上。
- `border-strong` `focus` `primary` `area-*` は上の地で 3:1 以上。
- 実測の例：`ink` は light の `canvas` 上で 14.2:1、`ink-subtle` は light の `canvas-subtle` 上で 5.0:1、`primary` を文字に使うと `canvas` 上で 9.1:1。
- `focus` は選択（`primary-subtle`）と見分けられるよう、`primary` より明るい青にしている。
- `ink-disabled` は無効状態の文字だけに使い、コントラストの要件の対象外とする。
- 新しい色を足すときは、同じ表を light / dark で埋めてから使う。

### Dark theme

`<html data-theme="dark">` で切り替える（未指定は light）。値は YAML の `-dark` のトークン。参照トークン（`link`、`proposal-border`）は参照先の変数を指すので `-dark` を持たない。地は `canvas-dark`（純黒にしない）、文字は `ink-dark`（純白にしない）。面の差は影ではなく `surface`（一段明るい）と `border` で作る。

## Typography

**Sans で操作し、明朝で考える。** 書体は 2 ファミリーまで。

| 役割 | ファミリー（フォールバック） | 使う場所 |
| --- | --- | --- |
| 操作 | Noto Sans JP（Hiragino Sans → Hiragino Kaku Gothic ProN → Yu Gothic UI → Meiryo → system-ui） | Button、Input、Task、ナビゲーション、Estimate、数値、メタ情報、ラベル、Dialog |
| 考える | Zen Old Mincho（Hiragino Mincho ProN → Yu Mincho → YuMincho → serif） | Sprint 見出し、Goal、改善策、Retro の振り返り |
| 補助 | ui-monospace（SF Mono → Menlo → Consolas → monospace） | キーボードショートカット（Kbd）だけ |

読み込み：`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Zen+Old+Mincho:wght@400;500;600&display=swap`。ウェイトは 400 / 500 / 600 だけ。

| トークン | 書体 | 用途 |
| --- | --- | --- |
| `display-l` | 明朝 32/44 | Sprint Header のタイトル（1 画面に 1 つ） |
| `display-m` | 明朝 24/36 | 考える領域のセクション見出し |
| `goal` | 明朝 18/30 | 確定した Goal 文、改善策 |
| `reflection` | 明朝 16/30 | Retro の振り返りの本文 |
| `heading` / `subheading` | Sans 16/24・14/20 600 | ペイン・Dialog の見出し / グループ見出し |
| `button` | Sans 14/20 500 | Button のラベル、タブ |
| `body-l` | Sans 16/28 | 説明文、compact 幅の入力文字 |
| `body` | Sans 14/22 | UI の標準 |
| `task` | Sans 14/20 | Task Row のタイトル |
| `label` / `help` | Sans 13/20 | フォームのラベル / Help・エラー |
| `meta` | Sans 12/16 | メタ情報（最小サイズ） |
| `kicker` | Sans 12/16 500 | 小見出し、「Agent 提案」ラベル、段階表示。欧文は大文字にしてよい（「SPRINT 14」）、和文はそのまま |
| `num-l` / `num-m` / `num-s` | Sans + tabular | 残り時間・Sprint Summary の主要値 / 合計・Estimate の編集欄 / 行の Estimate・件数 |
| `code` | mono 12/16 | Kbd だけ |

### ルール

- 12px 未満の文字を作らない（例外：EstimateRange の目盛り 11px。同じ値を 16px でも示す）。
- 見出しを太くして階層を作らない。階層は書体・サイズ・余白・罫で作る。
- `font-feature-settings: "palt"` を使わない。素のメトリクスで組む。
- 数値は tabular-nums。時間・件数・日付が並ぶ列は右揃え。
- 明朝の本文は 1 行 38 字程度（`measure-read`）まで。Task タイトルは 1 行で省略し、詳細で全文を読める。
- 本文は `line-break: strict`、`overflow-wrap: anywhere`。`anywhere` は表のセルや flex の子の最小幅も 1 文字まで縮めるので、段落（説明文・Goal・振り返り）にだけ付け、画面全体の既定は `break-word` にする。
- **明朝 = 本人が確定した考え。** 編集中の Goal と未確定の Agent 提案は Sans。保存すると明朝で清書する。
- ○ Sprint Header「Sprint 14」＝明朝 32、期間「9/28 (月) – 10/4 (日)」＝Sans 14 muted。× Button や Estimate・Capacity の数字を明朝にする。

## Layout

4px 基準。**Task density と Thinking space を同じ spacing で組まない。**

| トークン | 値 | 主な用途 |
| --- | --- | --- |
| `spacing.1` | 4px | アイコンとラベル、ラベルと入力 |
| `spacing.2` | 8px | コントロール内部、メタ情報どうし、行の上下 padding |
| `spacing.3` | 12px | コントロール・行の左右 padding、関連フィールド間 |
| `spacing.4` | 16px | Task density のペイン padding、フィールド間 |
| `spacing.5` | 20px | Thinking space のブロック内部 |
| `spacing.6` | 24px | Thinking space のペイン padding、Dialog の左右 |
| `spacing.8` | 32px | Goal と Goal の間、考える領域のセクション間 |
| `spacing.10` | 40px | ページヘッダーの上下 |
| `spacing.12` | 48px | Retro の大セクション間 |
| `spacing.16` | 64px | Retro の読み物の上端（最大） |

### Task density（Backlog、Today、Sprint のタスク一覧）

- 行は `row-task` 40px 以上（メタ情報付きは約 52px）。行間の余白は 0、区切りは `border-soft` の 1px。
- 行内は左右 `spacing.2`〜`spacing.3`、要素間 `spacing.2`、メタ情報どうし `spacing.3`。
- 高さ 1080px の画面の Backlog に 15 行以上が見えること。
- グループ見出しはラベル付き Divider で、上に `spacing.2` だけ空ける。Card で囲まない。

### Thinking space（Goal、Capacity、Agent 提案、Retro）

- ペイン padding `spacing.6`〜`spacing.8`、ブロック間 `spacing.8`、ブロック内 `spacing.2`〜`spacing.5`。
- 見出しの上に `border`（またはセクション罫 `ink` 1px）を引き、罫と余白で区切る。
- 明朝の本文は `measure-read` を超えて横に伸ばさない。Planning の Sprint ペインは最大 680px、Retro の読み物と desktop の Today は最大 720px。

### 寸法

| トークン | 値 | 用途 |
| --- | --- | --- |
| `control-sm` / `control-md` / `control-lg` | 28 / 36 / 44px | コントロールの高さ（lg は compact 幅と確定ボタン） |
| `row-task` / `row-touch` | 40 / 48px | Task Row の最小高さ（desktop / compact） |
| `target-min` / `target-touch` | 24 / 44px | 最小ターゲット（pointer / touch） |
| `icon-s` / `icon-m` | 16 / 20px | 文字の横 / ボタン・ナビゲーション |
| `area-mark` | 8px | Area Mark の一辺 |
| `pane-nav` / `pane-rail` | 224 / 64px | ナビゲーション（1440px 以上 / 1200–1439px） |
| `pane-list` / `pane-side` | 384 / 336px | Planning の Backlog ペイン / 時間の見通しペイン |
| `drawer` | 400px | 右 Drawer |

### Responsive

Desktop の Planning を中心に設計し、スマートフォンでは Today・タスクの完了・追加・Sprint の進捗を完結させる。PC 画面を縮小しただけのレイアウトにしない。

| 幅 | 名前 | レイアウト |
| --- | --- | --- |
| 1440px 以上（`bp-nav`） | wide | ナビ 224px ＋ Planning 3 ペイン（Backlog 384 / Sprint / 時間の見通し 336） |
| 1200–1439px（`bp-wide`） | wide（rail） | ナビをアイコンだけの 64px にし、3 ペインを保つ |
| 768–1199px（`bp-medium`） | medium | 2 ペイン（Backlog / Sprint）。Capacity は Sprint の上に要約 1 行を sticky で出し、クリックで右 Drawer。Agent 提案も Drawer の中 |
| 768px 未満 | compact | 1 カラム。下部タブバー（今日 / Sprint / Backlog / 振り返り） |

compact の原則：

- コントロールは `control-lg` 44px、Task Row は `row-touch` 48px、入力文字は 16px（iOS のズーム回避）。
- 画面下に「タスクを追加」の入力（sticky）と下部タブバー。Floating Action Button を置かない。
- 行の操作メニュー（…）は常に表示する（hover がないため）。ドラッグハンドルは出さず、並べ替えはメニューから。
- Planning は段階（選ぶ / 整える / 確かめる）ごとに画面を分けてよいが、どの段階にも自由に移れ、順に通ることを求めない（PRD §5.B）。Capacity は整える・確かめるの画面上部に 1 行で見せる。
- Dialog は幅 100% − 32px、Drawer は Bottom Sheet（上角 `rounded.xl`）。

すべての幅で変えないもの：書体の役割、色、角丸、破線の意味、Task Row の構造。情報を幅で消さず、畳む（Drawer・要約）だけにする。

## Elevation & Depth

**Flat が既定。** 面の区別は地の色（`canvas` / `canvas-subtle` / `surface`）と罫で作り、影は浮いている・重なっている面だけに使う。

| トークン | light | dark | 用途 |
| --- | --- | --- | --- |
| `elevation-0` | none | none | 既定。行、Button、Input |
| `elevation-overlay` | `0 1px 2px #1f1f1d14, 0 6px 16px #1f1f1d14` | `0 1px 2px #00000066, 0 6px 16px #00000066` | Menu、Popover、Toast、非モーダル Drawer。必ず `border` と併用 |
| `elevation-modal` | `0 2px 6px #1f1f1d14, 0 16px 40px #1f1f1d24` | `0 2px 6px #00000080, 0 16px 40px #00000099` | Dialog、モーダル Drawer、Bottom Sheet。`scrim` と併用 |
| `elevation-drag` | `0 2px 8px #1f1f1d24` | `0 2px 8px #000000a3` | ドラッグ中の Task Row だけ |

- 影で「押せそう」を表現しない。hover は背景色の変化だけ。
- `scrim` は半透明の色だけで、背景をぼかさない。
- 重なり順は `layer-sticky` 10 / `layer-drawer` 30 / `layer-popover` 40 / `layer-dialog` 50 / `layer-toast` 60 / `layer-tooltip` 70 だけを使う。

## Shapes

**Small radius · Flat · Border first · Divider first · Shadow last.**

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `rounded.xs` | 2px | Checkbox、Area Mark、Progress、Switch のつまみ、Estimate の提案枠 |
| `rounded.sm` | 4px | Button、Icon Button、Input、Select、Textarea、Switch のトラック、Tooltip、メニュー項目、Notice |
| `rounded.md` | 6px | Popover、Menu、Toast、Agent 提案 |
| `rounded.lg` | 8px | Dialog（通常 UI の最大） |
| `rounded.xl` | 12px | compact 幅の Bottom Sheet の上角だけ |
| `rounded.full` | 9999px | Filter、Tag / Status、Radio、完了サークル、段階番号だけ |

- 行（Task Row、Capacity の内訳、差分の行）は角丸 0。Button と Switch に Pill を使わない。

### 線

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `stroke-hairline` | 1px | すべての罫、枠、行区切り、Agent 提案の破線 |
| `stroke-strong` | 2px | フォーカスリング、選択中タブの下線、可用時間マーカー、編集的なセクション罫 |

- 構造の罫 = `border`、リスト内 = `border-soft`、操作部品 = `border-strong`、考える領域のセクション上端 = `ink` 1px（1 画面に 1〜2 本）。
- **実線 = 確定、破線 = 未確定（Agent 提案・下書き）。** 破線を装飾や読み取り専用に使わない。確定した計画値は幅があっても実線。
- 形で意味を分ける：四角 = Area、丸 = Semantic / Radio / 完了サークル。

## Components

部品は shadcn（base-ui）と Tailwind で実装し、見た目はこの節とトークンに合わせる。Task Row・Goal・Estimate・Area Indicator はすべての画面で同じ見た目を使う。

### 共通の状態

すべての操作部品は次の状態を持つ。**Focus は省略しない。**

| 状態 | 表現 |
| --- | --- |
| Hover | 背景 `surface-hover`（Primary は `primary-hover`）、輪郭 `ink-muted`。影・拡大・移動はしない。情報を hover だけに置かない |
| Focus | `focus` の 2px outline、offset 2px（リスト内・タブ・メニュー項目は −2px）。hover と同時でも両方見える |
| Active | `surface-pressed` / `primary-active` |
| Selected | `primary-subtle` の背景＋チェック（`aria-selected` / `aria-pressed`） |
| Disabled | 地 `canvas-subtle`、文字 `ink-disabled`、輪郭 `border`、`cursor: not-allowed`。理由を近くに書く。可能なら無効化しない |
| Loading | スピナー＋文言、`aria-busy`、幅を変えない。300ms 未満の処理には出さない |
| Error | `danger` の 2px 相当の輪郭＋アイコン＋文（`aria-invalid`）。入力内容を消さず、再試行の手段を示す |
| Read-only | 地 `canvas-subtle`、輪郭 `border`。破線にしない |
| Proposal | 1px 破線 `proposal-border`＋「提案」。Agent の値と下書きだけ |

部品ごとに必要な状態（● = 必須）：

| 部品 | Default | Hover | Focus | Active | Selected | Disabled | Loading | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button / IconButton | ● | ● | ● | ● | IconButton の pressed | ● | ● | — |
| TextInput / Textarea / Select | ● | ● | ● | — | — | ● | —（外側で表示） | ● |
| Checkbox / Radio / Switch | ● | ● | ● | — | checked / indeterminate | ● | — | ● |
| Tabs / Filter / Navigation | ● | ● | ● | — | ● | ● | — | — |
| Menu の項目 | ● | ● | ● | — | checked | ● | — | —（危険な項目あり） |
| Task Row | ● | ●（ハンドルと操作を表示） | ●（focus-within） | dragging | selected / done / skipped | ● | Estimate の見積中 | 保存エラー |
| Estimate | 値 | — | 編集時 | — | — | — | 見積中 | 推定できません |
| Agent 提案 | pending | — | 内部の Button | — | 採用 / 編集して採用 / 却下の後 | — | loading（取り消す） | error（もう一度試す・手入力で続ける） |
| Capacity Indicator | ok | — | 可用時間の入力 | — | — | — | — | tight / over / unknown |

### 操作

**Button** — 既定は Secondary。Primary は 1 画面に 1 つ。
- 36px、`rounded.sm`、1px 枠、ラベルは `button`（Sans 14/20 500）で動詞で終える（「Sprint を確定」「差分を確認」）。先頭・末尾に 16px アイコン（任意）。
- Variant：primary（塗り `primary`、文字 `on-primary`）/ secondary（`surface`＋`border-strong`）/ quiet（枠なし。キャンセル、編集して採用、却下）/ danger（`danger` の枠と文字。アーカイブの入口）/ danger-solid（破壊的操作の確認 Dialog の実行ボタンだけ）。サイズ sm 28 / md 36 / lg 44px（compact は lg）。
- Hover / Active：secondary と danger は `surface-hover` / `surface-pressed`（secondary は輪郭も `ink-muted`）、quiet は枠なしのまま `surface-hover` / `surface-pressed`、danger-solid は `danger-hover` / `danger-active`。
- Disabled は共通の状態どおり（quiet だけは地と枠を付けず、文字を `ink-disabled` にする）。無効にしてもフォーカスでき、近くに書いた理由を読み上げられる。
- Loading は先頭にスピナー、ラベルを「確定中…」に、幅は保つ。Loading 中は押しても反応しないが、Disabled の見た目にはしない。
- Primary は右端、Secondary / Quiet はその左。画面の移動にはリンクを使う。× Pill、影、グラデーション、「OK」「はい」、アイコンだけの Button（→ IconButton）。

**IconButton** — アイコンだけの操作。ラベル必須で、hover / focus で Tooltip に出す。
- 36px または 28px の正方形、`rounded.sm`、アイコン 20 / 16px `ink-muted`。Variant：quiet（既定）/ secondary / pressed（`primary-subtle` の地＋`primary` の 1px 枠とアイコン。地の差だけでは見分けにくいので枠を付ける。`aria-pressed`）。compact は 44px。
- Disabled は共通の状態どおり（quiet は Button と同じく地と枠を付けない）。Loading はアイコンをスピナーに替え、名前と Tooltip を「保存中…」などにする。
- 意味が広く共有されたアイコン（閉じる、…、編集、検索）だけ。同じ行に 3 つ以上並べず Menu にまとめる。

**Menu** — 行やヘッダーの補助操作のドロップダウン。トリガーは `…` の IconButton か、Secondary の Button（「並び順: 期限 ⌄」）。
- 面 `surface`＋`border`、`rounded.md`、`elevation-overlay`。項目 32px（アイコン・ラベル・Kbd）、区切り `border-soft`、危険な項目は `danger` で最後。Checked は チェック＋`primary-subtle`。
- 主要な操作を隠さない。サブメニューを入れ子にしない。キーボードは ↓ ↑ Home End、Enter で実行、Esc でトリガーに戻る、Tab で閉じる。

**Kbd** — ショートカットの表示。`code` の書体で Tooltip とメニュー項目の右端に置く。キーを色で強調しない。

### 入力（ラベル → サポートテキスト → 入力 → エラーの順）

**TextInput** — 1 行の入力。
- 36px、`border-strong`、`rounded.sm`。ラベルは `label`（必須なら「必須」、任意なら「任意」）、サポートテキストは `help` で入力の上、エラーはアイコン＋直し方の文で入力の下。接頭アイコン・接尾の単位（「h」）は任意。
- サイズ sm / md / lg（28 / 36 / 44px）、compact では自動で 44px・16px 文字。視覚ラベルの省略は検索とクイック追加だけ。フォーカスリングの offset は 1px。
- help には単位や例を書く（「0.5時間単位」）。エラーは直し方まで書く（「数値で入力してください（例: 1.5）」）。
- × プレースホルダーをラベルの代わりにする、入力中にエラーを出す（離脱時・送信時に出す）、入力内容を消す。

**Textarea** — 複数行の入力（Goal の編集、Retro の振り返り）。最小 88px、縦方向だけリサイズ、上限があれば右下に文字数。明朝で入力させない。

**Select** — 5〜15 個の選択肢から 1 つ（Area、繰り返しルール）。ネイティブの `<select>`（36px、`border-strong`）と `chevron-down`。独自のドロップダウンで置き換えない。

**Checkbox（□ = 選ぶ）** — Backlog のタスクを今週へ選ぶ、差分の行を反映する、設定のオプション。
- 当たり判定 24px（compact 44px）、16px の四角（`rounded.xs`、`border-strong`）。Checked は `primary` の塗り＋`on-primary` のチェック、Indeterminate は横線。
- タスクの完了には使わない（→ 完了サークル ○）。□ と ○ の意味を入れ替えない。

**Radio / RadioGroup** — 2〜5 個の排他的な選択肢をすべて見せる（Goal の自己判定、Sprint の長さ）。16px の円、選択時は `primary` の 4px 内枠。fieldset と legend で組む。自己判定には既定値を置かない。

**Switch** — 即時に反映される設定のオン / オフ。トラック 36×20px（`rounded.sm`、Pill にしない）、つまみ 14px（`rounded.xs`）、「オン / オフ」の語を添える。On はトラック `primary`・つまみ `on-primary`、Off はトラック `surface`・枠とつまみ `border-strong`。説明で「オンにすると何が起きるか」を書く。保存ボタンで確定するフォームには使わない（→ Checkbox）。

### 表示

**Tag** — Status（Sprint の状態、Goal の自己判定）と本人のラベルだけに使う小さな Pill。
- 20px、`rounded.full`、Status はアイコン必須、語は 1〜2 語。Variant：neutral / success / warning / danger / info / draft（破線。「計画中 · 未確定」）。
- tone の使い分け：neutral = 本人のラベル・一部できた・できなかった・判断しない、success = できた・保存済み、warning = 超過の可能性、danger = 期限超過、info = 同期中・次の Sprint で試す、draft = 未確定。
- 期限・Estimate・持ち越し・繰り返し・Area を Tag にしない（→ Task Metadata の文字）。1 行に 3 つ以上並べない。

**Divider** — Card の代わりにグループを区切る、構造の主役。default（`border`）/ soft（`border-soft`、リスト内）/ rule（`ink` 1px、考える領域の上端、1 画面に 1〜2 本）/ label（ラベル付き。グループ見出し）。× 2px 以上の太い罫、二重線、点線。

**Icon** — Lucide の線画。16px（stroke 1.75）と 20px（stroke 1.5）、色は `currentColor`。意味とアイコンの対応は [アイコンと動き](docs/design/foundations.md)。

**Spinner** — 必ず文言と一緒に使う（「見積中」「保存中…」）。300ms 未満の処理と画面全体のローディングには使わない。

**Progress** — 4px（thin は 2px）の線と数値（「7 / 18件」）。トラック `border-soft`、塗り `primary`。必ず数値を併記し、色を段階で変えない。Goal の達成度を数値化しない。

**Notice** — 画面内に留まる説明・注意・エラー。地 `*-subtle`、`rounded.sm`、枠なし、アイコン＋タイトル（600）＋本文＋任意の操作。Variant：info（データ不足、同期状態、計画案の作成後に Backlog が変わった）/ warning（超過の可能性、未見積）/ danger（読み込みの失敗、`role="alert"`）/ success（反映済み）/ neutral（補足）。次にできることを書く。× 左に色の太線、同じ画面に 3 つ以上。

**Toast** — 操作の結果を短く伝え、元に戻す手段を添える。面 `surface`＋`border`、`rounded.md`、`elevation-overlay`。Variant：neutral（「3件を今週に入れました」＋元に戻す）/ success（「Sprint 14 を確定しました」）/ danger（「保存できませんでした。入力内容は残っています。」＋再試行、`role="alert"`）。表示 8 秒、hover / focus 中は止め、操作付きは閉じるまで残してよい。位置は desktop 左下、compact は下部タブバーの上。同時に 3 つ以上出さない。入力エラー・確認が必要なこと・タスク完了のたびの通知には使わない。祝福の演出をしない。

**Tooltip** — アイコンだけの操作と省略されたラベルに短い説明。`surface-inverse` の小さな面（`rounded.sm`、12px）、任意で Kbd。hover 400ms 後 / focus で即時に出て、pointer が離れる・blur・Esc で消える（pointer を Tooltip に載せても消えない）。1 行 20 字程度まで。矢印・影・アニメーションで飾らない。必須の情報・エラー・操作可能な内容を載せない。

### 面

**Dialog** — 作業を止めて確認・決定を求めるモーダル。Sprint の確定と破壊的操作の確認だけ。
- `scrim`（Blur なし）、面 sm 440 / md 560 / lg 720px、`rounded.lg`、`elevation-modal`。タイトルは問いの形（Sans 16 / 600）、フッターは `border-soft` の罫の下に右寄せで Secondary → Primary。
- 初期フォーカスは最も安全な操作（確定では「戻って調整」）。ボタンは結果を書く。× 「本当によろしいですか？」、Dialog を重ねる、操作のたびに確認する。

**Drawer** — 文脈を残したまま詳細を編集する側面パネル。desktop は右 400px（左に `border`）、compact は Bottom Sheet（上角 `rounded.xl`、グリップ）。ヘッダー（タイトル＋閉じる、下に `border-soft`）、本文（スクロール）、フッター（キャンセル / 保存）。非モーダルが既定で、背後を操作させない場合だけ modal（`scrim` あり）。タスクの詳細、計画案の差分、medium 幅の Capacity に使う。Drawer の中に Drawer を開かない。

**Popover** — その場で 1〜3 項目を編集する浮いた面（Estimate の編集など）。幅 320px、`rounded.md`、`elevation-overlay`、タイトル＋閉じる、本文、フッター（キャンセル / 保存）。開いたらフォーカスを最初の入力へ移し、Esc・外側のクリック・閉じるで閉じる。保存は Secondary（Popover に Primary を置かない）。Popover から Popover を開かない。

### ナビゲーション

**Navigation** — desktop の左サイドバー（`canvas-subtle`、右に `border`）。項目 36px（20px アイコン＋ラベル＋件数）、現在地は `surface-pressed` の地＋`ink` 600＋`aria-current`。1200–1439px は `pane-rail`（アイコンだけ＋Tooltip）、compact は下部タブバー（今日 / Sprint / Backlog / 振り返り）。項目は 8 個まで。

**Tabs** — 同じ場所の表示を切り替える。タブ 40px、ラベルは `button`、選択は `ink` 600 の文字＋`stroke-strong` の下線（色面・Pill にしない）、件数は `ink-subtle`。タブは 5 個まで。段階を進めるフロー（→ Sprint Header）と絞り込み（→ Filter）には使わない。

**Filter** — リストを絞り込むトグル。Pill（28px、`border`）＋選択時のチェック＋任意の Area Mark＋ラベル＋件数。Selected は `primary-subtle` の地と `primary` の枠。0 件は disabled。

**Sprint Header** — Sprint の画面の見出し。kicker（「Sprint Planning」など）＋Status Tag、明朝のタイトル（`display-l`「Sprint 14」）、期間（Sans `ink-muted`）、右に操作（Primary は 1 つ）、段階表示（番号付き、`nav`＋`ol`、現在は `aria-current="step"`）。段階表示は目安で、どの段階にも戻れる。
- Planning：選ぶ / 整える / 確かめる（PRD §5.B の Pick / Shape / Check）
- 実行中：Status「実行中」、段階なし
- Retro：事実を見る / 振り返る / 引き継ぐ（PRD §5.D）

### タスク

**Task Row** — タスク 1 件の行。Backlog・Sprint・Today で同じ構造。
- 左から：ドラッグハンドル（hover / focus 時のみ、compact は非表示）、コントロール（□ 選ぶ / ○ 完了 / なし）、タイトル（`task`、1 行で省略）、Task Metadata、Estimate（右端 `num-s`）、行の操作 `…`（hover / focus 時、compact は常時）。
- layout stacked（既定、約 52px）/ inline（40px、`row-task` は最小高さ）。区切りは `border-soft`、行間 0、角丸・影なし、Card で囲まない。
- 状態：Selected（`primary-subtle`＋チェック）、Done（○ を `primary` で塗り、タイトル `ink-subtle`＋取り消し線）、Skipped（○ に「−」＋「スキップ」）、Dragging（`surface`＋`elevation-drag`＋`border`）、Loading（Estimate が「見積中」）、Error（行内に「保存できませんでした · 再試行」）、Disabled（アーカイブ済み、`ink-disabled`）。
- Today の「今日やる」の行は、日次の操作（開始 / 完了 / 今日はここまで / 今日は見送る / 今日から外す / 繰り返しのスキップ）を持つ。強い操作を常時並べすぎず、完了（○）以外は行の操作 `…` と詳細から出す（PRD §12）。「今週の残り」「昨日の続き」の行は □ ではなく、行の先頭に常に見える「今日へ」のボタンで選ぶ（□ は今週へ選ぶ意味なので使わない）。
- × メタ情報を Badge / Pill にする、□ と ○ を入れ替える、Goal に紐づかない行を薄くする。

**Task Metadata** — タスクの属性を Badge ではなく文字とアイコンで 1 行に並べる（`meta` 12px、要素間 `spacing.3`）。順に Area Indicator（グループ化していない一覧だけ）、Deadline、持ち越し、繰り返し、Goal（`target`＋Goal 文を省略）、注記（`ink-subtle`）。値がない属性は出さない（「—」で埋めない）。グループ見出しと同じ情報を行に重ねない。

**Task Quick Add** — 画面を中断せずにタイトルだけでタスクを追加する入力。`plus` の接頭アイコン、視覚ラベルなし（`aria-label` あり）、任意で Area の Select（既定は直前に使った Area）、ヒント（Enter で追加 / Esc で取り消し）。追加後も入力にフォーカスを残す。Backlog 上部、Planning、Today の下部（compact は sticky）で同じ形。モーダルで追加させない。

**Estimate** — タスクを終えるまでの作業時間。本人の値と提案を見た目と語で区別する。

| Variant | 表示 | 意味 |
| --- | --- | --- |
| user（既定） | 「3h」実線・ラベルなし | 本人の Estimate（点の値） |
| suggestion | 「提案 2–4h」破線枠（`rounded.xs`） | EstimateSuggestion（未確定の幅） |
| planned | 「計画 5h」実線 | この Sprint の PlanningValue（確定時・追加時に固定。幅のこともある） |
| unset | 「未見積」 | 0h と書かない。合計に含めない |

- 1h 未満は分（30m）、それ以上は h（1.5h）、範囲は en dash。「約」「〜くらい」と書かない。
- 状態：Loading（スピナー＋「見積中」）/ Error（「推定できません」＋手入力を促す）。
- 過去の実績からコードが作った幅も EstimateSuggestion として扱い、suggestion の見た目で出所（「過去の実績から」）を添える。4 つ目の時間の値を作らない（ドメインモデルの時間は Estimate・提案・計画値の 3 つ）。
- 計画値の元が幅（提案・サブタスク合計）のときは、元と計画値を並べる（「Estimate 提案 3–5h / 今回は 5h で計画」、ドメインモデル Scenario A）。点の Estimate には計画基準が効かない（不変条件 9）。確定後に本人が Estimate を変え、固定した計画値と違ったときも両方を並べる（不変条件 16・18）。
- 読み上げは「見積もり 3時間」「Agent の提案（未確定）: 2〜4時間」。

**EstimateRange** — 提案の幅を 0〜8h の目盛り上の帯で見せる。数値（「2–4h」「中央 3h」）、1h ごとの `border` の刻み、提案の帯（破線＋`primary-subtle`）、中央値のマーカー（`ink` 2px）、目盛りの数値（0 / 4h / 8h）。同じ値を必ず数値でも示す。行内では使わない（→ Estimate）。確率・confidence を % で出さない。

**Deadline** — 日付＋曜日＋相対表現。upcoming（`calendar`＋「10/5 (月)」`ink-muted`）/ soon（2日以内）・today（`clock`＋「あと2日」「今日まで」`warning`）/ overdue（`circle-alert`＋「2日超過」`danger`）。色だけで超過を示さない。

**持ち越し（CarryOverIndicator）** — `corner-down-right`＋「持ち越し 1回（Sprint 13から）」`ink-muted`。3 回以上は `warning`＋「持ち越し 3回 · 分割を検討」。`danger` と「遅れ」「失敗」の語を使わない。

**繰り返し（RecurringIndicator）** — `repeat`＋ルール（「毎週 土」「平日」）＋任意で今週の回（「今週 2/5」）。ルールと回を区別する（ルールを変えても生成済みの回は変わらない）。

**Area Indicator** — Area を 8px の四角い印とラベルで示す。label（既定：印＋名前 12px / 500 `ink-muted`）/ mark（印だけ。凡例がある場所のみ、名前は読み上げる）/ heading（グループ見出し 14px / 600 `ink`＋件数）。Sprint の画面（Planning / Today / Retro）では Sprint 確定時の Area 名、Backlog では現在の名前を出す。× 印を 8px より大きくする、文字・背景・枠を Area の色にする。

### 計画と振り返り

**Goal** — Sprint × Area の「今週どんな状態にしたいか」。
- 上端の罫（`border`）、見出し（Area Indicator heading＋タスク数と時間＋自己判定の Tag＋編集）、Goal 文（`goal` 明朝、`measure-read`）、その Area の選んだタスク。
- set（確定）/ empty（「+ Goal を書く」＋「この領域の Goal は任意です。」）/ editing（Sans の Textarea＋保存 / キャンセル）/ 自己判定済み（できた = success の Tag、一部できた・できなかった・判断しない = neutral）。
- Goal の間は `spacing.8`。× Card で囲む、Goal がない Area を警告色で示す、Goal 文を太字・大見出しにする、全体 Goal を作る。

**Capacity Indicator** — 可用時間と計画値の合計の差を、幅のまま示す。
- 最上段に残り（`num-l`。下限でも超える場合は「超過」`danger`）、可用時間（本人が入力）と計画値の合計（幅）、状態の文（アイコン＋語）、バー（Area ごとの 8px セグメント。Goal に紐づかない Task もその Area に含める＋提案の幅は破線＋残り `border-soft`＋可用時間マーカー `ink` 2px＋超過部分の下線 `danger`）、Area ごとの内訳、未見積の件数（合計に含めない）。
- 状態：ok（`ink-muted`「可用時間の範囲に収まっています。」）/ tight（上限側だけ超える：`warning`「上限側では 1h 超える可能性があります。」）/ over（下限でも超える：`danger`「超過 3 〜 5h」）/ unknown（「可用時間を入力すると、計画との差を表示します。」）。
- バーは `aria-hidden`、数値と状態の文が正（`role="status"`）。超過でも確定を止めない。Today と Backlog には出さない。× ドーナツ・円グラフ・ゲージ、未見積を 0h として足す。

**Sprint Summary** — Retro の「事実を見る」の最上部で、Sprint の結果を静かな表で示す。上端 `ink` 1px・下端 `border` の罫、項目（ラベル `meta`、値 `num-l`、単位、補足）、項目間の縦罫 `border-soft`。実績は入力済みのものだけを集計したと補足に書く。× 統計 Card を並べる、点数化、ランキング、Goal に紐づかないタスクの完了率を Goal 達成の代わりに置く。

**改善策（Retro Improvement）** — Retro で決める「次の Sprint で 1 つだけ変えてみること」。上端 `ink` 1px・下端 `border` の罫、ラベル（「次に試す変更」/「前回決めた改善策」）と出所、本文（確定後は明朝 `goal`、下書きは Sans）。下書き（破線の Tag）→「改善策として確定」。次の Planning の最初（選ぶ段階の右ペインの上部）に表示だけで戻る。改善策そのものに判定や「反映した」の記録はない（ドメインモデル RetroImprovement）。× 複数並べる、達成率で評価する。

**計画基準（Planning Criterion）** — 改善策から作った「Estimate の幅を計画値のどこで使うか」のルール。前回の改善策の直下に、`info-subtle` の地、`info` のアイコン＋名前（「研究の推定幅 → 上限を計画値に」）＋「Estimate そのものは書き換えません。」で出す（UI v0.1 モック）。Planning の確かめる段階では、対象・幅の扱い・今回使うかの Switch と、効果（「研究の推定タスク 1 件を上限で計画値にしています（+2h）」）を同じ値から出す（不変条件 39）。確定後は Switch を読み取り専用にする（不変条件 37）。Retro では、CriterionUse がある Sprint（確定時に Active な基準があった Sprint）に「続ける / 終える / 置き換える」の RadioGroup を出し、選ぶまで Retro を完了できない（不変条件 36。理由は求めない）。

**振り返りの材料（RetroInsight）** — Retro の 1 つの気づき。fact（「事実」：記録から言えること、Sans＋根拠の列挙）/ reflection（本人の言葉、明朝 `reflection`）/ agent（Agent の見立て：破線枠＋折りたたみの根拠＋振り返りに加える / 編集して加える / 却下）。事実には「気になる」の印を付けられる。× Agent の見立てを本人が加える前に明朝で表示する、評価・点数。

### Agent

破線・語・根拠の構造で区別し、別世界の見た目にしない。振る舞いと文言は [Agent UI](docs/design/agent-ui.md)。

**Agent 提案（AgentSuggestion）** — Estimate の提案、Goal の文案、計画案の入口。
- 破線の枠（`proposal-border`、`rounded.md`、`surface`）、ヘッダー（「Agent 提案」`kicker`＋種類＋出所と時刻）、対象、提案の値（EstimateRange / suggestion の Estimate / Sans の文）、根拠、操作。
- Estimate の提案は、下限・中央・上限のどれかを本人の Estimate として **採用** できる（PRD §5.A）。採用は Secondary、編集して採用・却下は Quiet。
- 状態：pending / loading（「過去の類似タスクを調べています…」＋取り消す）/ insufficient（幅を広く、不確実な点に理由）/ error（「提案を作れませんでした。手入力でそのまま計画を続けられます。」＋もう一度試す）/ 採用・編集・却下の後（実線の `canvas-subtle` の 1 行＋元に戻す）。

**根拠（AgentRationale）** — 「根拠 / 不確実な点 / 参照していない情報」の 3 行。columns（既定）/ stacked（狭い場所）/ collapsible（「根拠を見る」）。根拠がないときは「根拠となるデータがありません」。× confidence を % で出す、「高精度」と書く。

**計画案の差分（ProposalDiff）** — Agent の計画案と今の計画の差を、行ごとに選んで反映する。要約（追加 / 除外 / 変更の件数、計画値の合計の前後、可用時間）、行（□ 反映する＋記号と語「＋追加 / −除外 / →変更」＋タスク名＋Area と理由＋値）、フッター（「選んだ N件を計画に反映」Secondary / すべて却下 /「反映しても Sprint は確定されません」）。除外と変更前の値は取り消し線。desktop は右 Drawer、compact は全画面。× 追加を緑・除外を赤に塗る。

## Do's and Don'ts

### Do

- 構造は罫と余白で作る（Border first → Divider first → Shadow last）。
- 選択・状態・Area・エラー・提案は、色に加えてチェック・アイコン・語・形・破線のどれかで示す。
- 本人が確定した考え（Goal、改善策、振り返り）は明朝、操作と数値は Sans。
- 幅のある時間は幅のまま示し、未見積は合計に含めないことを書く。
- Agent の値は破線と「提案」で示し、採用は Secondary、編集して採用・却下は Quiet にして、Primary で誘導しない。
- 持ち越し・見送り・未達は事実として中立に書く。

### Don't

- 大きな Soft Shadow、Glassmorphism、装飾目的の Blur、Glow、Gradient 主体の面。
- 12px 以上の角丸（例外：compact の Bottom Sheet 上角）、巨大な角丸 Card、Card inside Card。
- 何でも Pill・何でも Badge（メタ情報は文字とアイコンで並べる）、過剰なアイコン。
- Sparkle・魔法の杖・紫のグラデーションなど「AI は特別」という表現、チャットバブル、アバター。
- Product 画面の Hero section、装飾イラスト、巨大な統計数字の Card 並び。
- ベージュを敷くだけの「手帳風」、紙のテクスチャ、ノートのリング、手書きフォント、文具の擬物表現。
- 色付きの左ボーダーで Card を飾ること（選択・Area・注意のどれにも使わない）。

### 条件付きで使う

- **Pill**：Filter / Tag / Status / Radio / 完了サークルだけ。Button・Tabs・入力には使わない。
- **Card**（`border` で囲んだ独立面）：Dialog、Drawer、Popover、Menu、Toast、Agent 提案だけ。単なるグルーピングは余白・Divider・見出し・`canvas-subtle` の背景差で行う。
- **Shadow**：浮いている・重なっている面だけ（`elevation-overlay` `elevation-modal` `elevation-drag`）。
- **明朝**：Sprint 見出し、Goal、改善策、Retro の振り返り。編集中は Sans に戻す。
- **Area の色**：8px の Area Mark、Capacity バーのセグメント、Filter の印だけ。
