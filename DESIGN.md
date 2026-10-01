---
version: alpha
name: Itera
description: Wayfinding for your week. 駅の公共サインの文法で、今どこにいて次に何をするかを一目で示す個人の計画の道具。
colors:
  # Light theme. Dark theme values use the same name with a `-dark` suffix.
  # Reference tokens (link, focus, proposal-border) and the area colors have
  # no `-dark` twin: they follow the referenced token or stay the same.
  canvas: "#ffffff"
  canvas-subtle: "#f2f3f4"
  surface: "#ffffff"
  surface-hover: "#eceeef"
  surface-pressed: "#e1e3e5"
  surface-inverse: "#16181a"
  ink: "#16181a"
  ink-muted: "#4a4e53"
  ink-subtle: "#5c6167"
  ink-disabled: "#a3a7ac"
  ink-inverse: "#ffffff"
  border: "#d3d6d9"
  border-soft: "#e7e9eb"
  border-strong: "#7a7f85"
  primary: "#16181a"
  primary-hover: "#2c3034"
  primary-active: "#000000"
  on-primary: "#ffffff"
  here: "#ffd23f"
  here-subtle: "#fff3c4"
  on-here: "#16181a"
  link: "{colors.ink}"
  focus: "{colors.ink}"
  warning: "#8a5200"
  warning-subtle: "#fcebd9"
  danger: "#c4161c"
  danger-hover: "#a51217"
  danger-active: "#870e12"
  danger-subtle: "#fce8e8"
  on-danger: "#ffffff"
  area-1: "#0a6fbd"
  area-2: "#12844a"
  area-3: "#5c7a00"
  area-4: "#4a5bc4"
  area-5: "#8a4fbf"
  area-6: "#0b7f85"
  area-7: "#a23c9c"
  area-none: "#6b7076"
  on-area: "#ffffff"
  proposal-border: "{colors.border-strong}"
  scrim: "#16181a66"
  canvas-dark: "#121416"
  canvas-subtle-dark: "#1a1d20"
  surface-dark: "#1f2225"
  surface-hover-dark: "#292d31"
  surface-pressed-dark: "#33383d"
  surface-inverse-dark: "#eef0f2"
  ink-dark: "#eef0f2"
  ink-muted-dark: "#b9bec4"
  ink-subtle-dark: "#9aa0a7"
  ink-disabled-dark: "#5d6268"
  ink-inverse-dark: "#121416"
  border-dark: "#33373c"
  border-soft-dark: "#26292d"
  border-strong-dark: "#7e848b"
  primary-dark: "#eef0f2"
  primary-hover-dark: "#ffffff"
  primary-active-dark: "#d4d8dc"
  on-primary-dark: "#121416"
  here-dark: "#ffd23f"
  here-subtle-dark: "#3b3312"
  on-here-dark: "#121416"
  warning-dark: "#f0b54a"
  warning-subtle-dark: "#33240f"
  danger-dark: "#ff8a80"
  danger-hover-dark: "#ffa39b"
  danger-active-dark: "#ffbcb6"
  danger-subtle-dark: "#3a1c1b"
  on-danger-dark: "#121416"
  scrim-dark: "#000000a3"
typography:
  display-l:
    fontFamily: LINE Seed JP
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: 0em
  display-m:
    fontFamily: LINE Seed JP
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: 0em
  goal:
    fontFamily: LINE Seed JP
    fontSize: 18px
    fontWeight: 700
    lineHeight: 28px
    letterSpacing: 0.01em
  reflection:
    fontFamily: LINE Seed JP
    fontSize: 16px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0.02em
  button:
    fontFamily: LINE Seed JP
    fontSize: 14px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0em
  heading:
    fontFamily: LINE Seed JP
    fontSize: 16px
    fontWeight: 700
    lineHeight: 24px
    letterSpacing: 0em
  subheading:
    fontFamily: LINE Seed JP
    fontSize: 14px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0em
  body-l:
    fontFamily: LINE Seed JP
    fontSize: 16px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0.02em
  body:
    fontFamily: LINE Seed JP
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0.01em
  task:
    fontFamily: LINE Seed JP
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0em
  label:
    fontFamily: LINE Seed JP
    fontSize: 13px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0em
  help:
    fontFamily: LINE Seed JP
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0em
  meta:
    fontFamily: LINE Seed JP
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0em
  kicker:
    fontFamily: LINE Seed JP
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0em
  num-l:
    fontFamily: LINE Seed JP
    fontSize: 28px
    fontWeight: 700
    lineHeight: 32px
  num-m:
    fontFamily: LINE Seed JP
    fontSize: 16px
    fontWeight: 700
    lineHeight: 24px
  num-s:
    fontFamily: LINE Seed JP
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
  code:
    fontFamily: LINE Seed JP
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
  row-menu: 32px
  target-min: 24px
  target-touch: 44px
  icon-s: 16px
  icon-m: 20px
  area-badge: 20px
  pane-nav: 224px
  pane-rail: 64px
  pane-list: 384px
  pane-list-slim: 240px
  pane-list-xl: 480px
  pane-list-slim-xl: 320px
  pane-sprint: 680px
  pane-today: 720px
  pane-rows: 1280px
  pane-side: 336px
  toast: 480px
  drawer: 400px
  popover: 320px
  dialog-sm: 440px
  dialog-md: 560px
  dialog-lg: 720px
  measure-read: 38em
  bp-medium: 768px
  bp-wide: 1200px
  bp-nav: 1440px
  bp-xl: 1920px
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
    backgroundColor: "{colors.here-subtle}"
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

# Itera DESIGN.md v0.3

仕事・研究・学習・生活を並行する個人が、1 週間の Sprint ごとに「何を達成するか」を決め、実行し、Retro で計画の立て方を改善するための道具のデザインシステム。人と Coding Agent の両方が読む前提で、曖昧な形容詞ではなくトークン名・数値・許可 / 禁止で判断できるように書く。

- 形式は公式の DESIGN.md spec（google-labs-code/design.md）に従う。先頭の YAML がトークンの正で、本文はその使い方を説明する。
- 意味・状態・用語は `docs/domain/domain-model.md` と `docs/requirements/prd.md` が優先する。この文書は見た目・部品・レイアウトを決める。
- この形式に収まらない製品固有の指針は `docs/design/` にある：[パターン](docs/design/patterns.md)（Planning / Today / Retro / Backlog）、[Agent UI](docs/design/agent-ui.md)、[文言と用語](docs/design/content.md)、[アクセシビリティ](docs/design/accessibility.md)、[アイコンと動き](docs/design/foundations.md)、[参照方針](docs/design/design-context.md)。

## Overview

方向は **Wayfinding for your week**。駅の公共サインが、初めての駅でも現在地・行き先・乗り換えを一目で分からせるのと同じ文法で、今週どこにいて、次に何を決めるかを示す。白と墨の 2 色を地にし、色は意味を持つ場所にだけ置く。Area は路線のように色と記号で呼び分け、現在地は黄で示す。手帳や紙の擬物、淡い色の雰囲気づくりはしない。

迷ったら次の 3 つに戻る。

1. **現在地は黄、確定は墨、計画中は破線**
2. **Area は路線記号（色の四角＋名前の先頭 1 文字）で呼ぶ**
3. **Border first → Divider first → Shadow last**

### 原則

1. **Clarity — 今どこで何を決めているかが分かる。** 画面ごとに「決めていること」を 1 つだけ見出しにする（例：「今週、何を進めますか」）。現在地（今日、今の段階、選んだもの）は `here` の黄 **と** チェック・語で示し、色だけにしない（Filter の選択は幅を変えないため、チェックの代わりに `ink` の 2px の枠と太字）。幅がある時間は幅のまま出す（`2–4h`、`残り 1 〜 3h`）。
2. **Agency — 決めるのは本人。** Agent・AI の値は破線と「提案」「Agent 提案」の語で区別し、本人の値は実線・ラベルなし。「採用」は Secondary、「編集して採用」「却下」は Quiet にし、Primary で採用を誘導しない。
3. **Calmness — 注意を奪わない。** Primary Button（墨の塗り）は 1 画面に 1 つ。色面は状態と現在地だけ。Area の色は路線記号と容量バーだけ。考える領域（Goal、Capacity、Retro）には意図的に余白を取る。
4. **Precision — 小さな数値ほど丁寧に。** 数値は `num-*` で組み、並ぶ列は右揃え。1h 未満は `30m`、合計は常に h、範囲は en dash（`2–4h`）、負を含む範囲と、使える時間との差（残り・超過）は `〜`（`残り 1 〜 3h`、`超過 3 〜 5h`）。ただし、使える時間との差が 0 をまたぐときは、負の値を含む範囲を見出しにせず、「下限なら 2.25h 残る · 上限なら 0.75h 超える」の 2 つの文で出す（Issue #93）。見積もりがないものは「0」ではなく「見積もりなし」と書き、合計に含めないことを示す。
5. **Continuity — Planning → Today → Retro → 次の Planning。** Task Row・Goal・Estimate・Area の路線記号はすべての画面で同じ見た目。本人が確定した言葉（Goal、改善策、振り返り）は `goal` / `reflection` で本文より一段大きく組み、確定したことを実線の罫の下に置いて示す。
6. **Accessibility — 最初から設計に含める。** テキスト 4.5:1、操作部品の輪郭・フォーカス・意味のある印は 3:1。フォーカスリングを消さない。ターゲットは pointer 24px、compact 幅 44px。詳細は [アクセシビリティ](docs/design/accessibility.md)。

## Colors

画面の大半は白（dark は墨の地）と墨の文字で成立させる。色は予約語として扱い、1 つの色に 1 つの意味だけを持たせる。

| 層 | トークン | 意味・使う場所 | 使わない場所 |
| --- | --- | --- | --- |
| 地 | `canvas` | 本体の地：Sprint、Today、Retro | — |
| 地 | `canvas-subtle` | Backlog ペイン、ナビゲーション、表ヘッダー、読み取り専用入力 | 考える領域の主面 |
| 面 | `surface` | Dialog、Drawer、Popover、Menu、Toast、Agent 提案。必ず `border` と組む | 単なるグルーピング |
| 状態 | `surface-hover` / `surface-pressed` | hover / 押下 | 選択（選択は `here-subtle`） |
| 反転 | `surface-inverse` / `ink-inverse` | Tooltip とショートカット表示だけ | それ以外 |
| 文字 | `ink` / `ink-muted` / `ink-subtle` | 本文 / 補足 / 三次（件数・完了済み・プレースホルダー）。これより薄い文字色を作らない | — |
| 文字 | `ink-disabled` | 無効状態だけ | 情報を伝える文字 |
| 罫 | `border` / `border-soft` | 構造の罫 / リスト内の行区切り | 操作部品の輪郭 |
| 罫 | `border-strong` | 入力・Checkbox・Radio・Switch・Secondary Button の輪郭 | 装飾の罫 |
| 確定 | `primary`（墨）/ `on-primary` | Primary Button の塗り、オン状態、完了サークル、Progress、IconButton の pressed | 大きな面 |
| 現在地 | `here`（黄）/ `here-subtle` / `on-here` | 今日の列・今の段階・Today で開始した行（作業中）の印（`here`）、選んだ行・項目の地（`here-subtle`）。必ずチェックか語を伴う（Filter だけは `ink` の 2px の枠と太字。もう 1 つの例外は、Backlog と Planning の選ぶで追加した直後の行の点滅で、2.5 秒でこの地から透明に消える。docs/design/foundations.md） | 注意・警告（→ `warning`）、装飾、フォーカス |
| Focus | `focus`（`ink` の別名） | フォーカスリングだけ。色相を持たず、墨の 2px の輪郭と 2px のアキで示す | それ以外すべて |
| リンク | `link`（`ink` の別名） | 下線付きの文字リンク | — |
| Semantic | `danger` `warning` と `*-subtle` | 危険と注意の文字・アイコン・Status Tag・Notice。必ずアイコンか語を伴う。成功と情報は色を持たず、墨の文字＋アイコン（`circle-check` / `info`）＋語で示す | Area の識別、装飾 |
| Area | `area-1`〜`area-7`、`area-none` / `on-area` | 路線記号の地（文字は `on-area`）、Capacity バーのセグメント、Filter の路線記号 | 文字色、面の塗り、枠線、左ボーダー |
| 未確定 | `proposal-border` | Agent 提案・計画中の値の 1px 破線 | 確定済みの値 |
| 暗幕 | `scrim` | Dialog / モーダル Drawer の背後。Blur は使わない | — |

### Primary は墨

Primary は色ではなく墨（light は `#16181a` の塗りに白抜き、dark は明るい塗りに墨の文字）。確定の操作だけが塗りを持ち、ほかの操作は線と文字で示す。

- Primary Button は 1 画面に 1 つ（Planning では「Sprint を確定」）。
- 塗りの上の文字は必ず `on-primary`。dark では反転するので白を直書きしない。
- `link` は `ink` の別名。下線を常に付け、色だけでリンクを示さない。

### 現在地の黄

`here` は駅の案内で現在地を示す黄に当たる。「今どこか」だけに使う。

- 選択 = `here-subtle` の地＋チェック（Filter は幅を変えないため、チェックの代わりに `ink` の 2px の枠と太字）。今日の列・今の段階は `here` の印（太線や塗りの四角）＋語（「今日」「現在」）。Today で開始した行は、今やっているものとして先頭の端に `here` の 4px の縦線＋語（「作業中」）＋タイトル 700（Task Row › In progress、Issue #163）。
- 注意・警告には使わない（→ `warning` とアイコン）。フォーカスにも使わない（→ `focus` の墨の輪郭）。
- 黄の上の文字は `on-here`（墨）。

### Area の路線記号

Area（領域）はユーザーが作る。駅の路線記号のように、色の角丸の四角（`area-badge` 20px、`rounded.sm`）に Area 名の先頭 1 文字を `on-area` で白抜きにし、隣に名前を置く。

| トークン | 色 | 既定の割り当て |
| --- | --- | --- |
| `area-1` | 青 | 1 番目に作った Area |
| `area-2` | 緑 | 2 番目 |
| `area-3` | 若草 | 3 番目 |
| `area-4` | 藍 | 4 番目 |
| `area-5` | 紫 | 5 番目（AI の表現には使わない） |
| `area-6` | 青緑 | 6 番目 |
| `area-7` | 赤紫 | 7 番目 |
| `area-none` | 灰 | Area 未設定（「領域なし」、記号の文字は「－」）だけ |

- 8 色は同じ明度に揃え、light / dark で同じ値を使う（白抜きの文字に 4.5:1、dark の `canvas` に 3:1）。暖色（赤・橙・琥珀・黄）は Semantic と現在地に取っておき、Area には使わない。本人は Area の色を変えられる（ドメインモデル Area の「色」）。
- 記号の文字は Area 名の先頭 1 文字から作る（ドメインモデルは変えない。重複したときの扱いは未決）。
- 必ず名前と併記する（記号だけにするのは凡例がある場所のみ。名前は読み上げる）。四角い路線記号の形で、Semantic の丸いアイコンと区別する。
- 同じ画面に Area の色を 8 種類以上並べない。
- 8 番目以降に作った Area の色は、`area-1` から順に繰り返して割り当てる（Issue #113）。同じ色の Area が並んでも、記号の文字と名前で区別する。

### Semantic と Area を混同しない

- Semantic はアイコン＋語とセットで、文字・アイコン・Status Tag・Notice にだけ使う。
- Area は路線記号＋ラベル。Semantic の色で Area を塗らない。Area の色相は Semantic（赤・琥珀）と現在地（黄）から離してある。
- `danger` はエラー・期限超過・確定的な容量超過（下限でも超える）・破壊的操作だけ。持ち越し・見送り・「できなかった」・超過の可能性には使わない。持ち越しは `ink-muted`、3 回以上だけ `warning`。

### コントラスト

- 文字のトークン（`ink` `ink-muted` `ink-subtle` `warning` `danger`）は light / dark とも `canvas` `canvas-subtle` `surface` `surface-hover` `here-subtle` の上で 4.5:1 以上。Semantic は各 `*-subtle` の上でも 4.5:1 以上。
- `on-primary` は `primary` / `primary-hover` / `primary-active` の上で、`on-danger` は `danger` / `danger-hover` / `danger-active` の上で、`on-area` は各 `area-*` の上で、`on-here` は `here` の上で 4.5:1 以上。
- `border-strong` `focus` `area-*` は上の地で 3:1 以上。
- 実測の例：`ink` は light の `canvas` 上で 17.8:1、`ink-subtle` は light の `canvas-subtle` 上で 5.6:1、`on-area` は `area-1` 上で 5.2:1。
- `ink-disabled` は無効状態の文字だけに使い、コントラストの要件の対象外とする。
- 新しい色を足すときは、同じ表を light / dark で埋めてから使う。

### Dark theme

`<html data-theme="dark">` で切り替える（未指定は light。light と dark は同格で、利用者の設定に従う）。値は YAML の `-dark` のトークン。参照トークン（`link`、`proposal-border`）と Area の色は `-dark` を持たない。地は `canvas-dark`（純黒にしない）、文字は `ink-dark`（純白にしない）。Primary は反転し、明るい塗りに墨の文字になる。面の差は影ではなく `surface`（一段明るい）と `border` で作る。

## Typography

**書体は LINE Seed JP の 1 系列。** 文字も数字も Kbd も同じ書体で組む。明朝やセリフ体、等幅の書体は使わない。階層は太さ（400 / 700）とサイズの差で作る。

| 役割 | ファミリー（フォールバック） | 使う場所 |
| --- | --- | --- |
| すべて | LINE Seed JP（Hiragino Sans → Hiragino Kaku Gothic ProN → Yu Gothic UI → Meiryo → system-ui） | 文字、数字（`num-*`）、Kbd（`code`） |

読み込み：`https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700&display=swap`。ウェイトは 400 / 700 だけ。LINE Seed JP の数字はプロポーショナルで `tabular-nums` が効かない。数字の列は右揃えにし、小数点まで縦に揃える必要がある表（Retro の Estimate / 計画値 / 実績）は単位と小数の桁数を揃えて書く。en dash（`–`）・負号（`−`）・`〜` はハイフンと見分けられるので、そのまま組む。

| トークン | 仕様 | 用途 |
| --- | --- | --- |
| `display-l` | 32/40 700 | 画面の主見出し。Sprint Header の「Sprint 14」（1 画面に 1 つ） |
| `display-m` | 24/32 700 | 考える領域のセクション見出し |
| `goal` | 18/28 700 | 確定した Goal 文、改善策 |
| `reflection` | 16/28 400 | Retro の振り返りの本文 |
| `heading` / `subheading` | 16/24・14/20 700 | ペイン・Dialog の見出し / グループ見出し |
| `button` | 14/20 700 | Button のラベル、タブ |
| `body-l` | 16/26 | 説明文、compact 幅の入力文字 |
| `body` | 14/22 | UI の標準 |
| `task` | 14/20 | Task Row のタイトル |
| `label` / `help` | 13/20 700・13/20 400 | フォームのラベル / Help・エラー |
| `meta` | 12/16 | メタ情報（最小サイズ） |
| `kicker` | 12/16 700 | 「Agent 提案」ラベル、段階表示の番号。見出しの上に飾りとして置かない |
| `num-l` / `num-m` / `num-s` | 28/32・16/24・12/16 700 | 残り時間・Sprint Summary の主要値 / 合計・Estimate の編集欄 / 行の Estimate・件数 |
| `code` | 12/16 400 | Kbd だけ |

### ルール

- 12px 未満の文字を作らない（例外：EstimateRange の目盛り 11px。同じ値を 16px でも示す）。
- 見出しの階層は 700 とサイズの差、余白、罫で作る。500 や 600 の中間の太さを使わない。
- `font-feature-settings: "palt"` を使わない。素のメトリクスで組む。
- 数値は `num-*`。時間・件数・日付が並ぶ列は右揃え。
- 確定した言葉（Goal、改善策、振り返り）は 1 行 38 字程度（`measure-read`）まで。Task タイトルは compact では 2 行まで、medium 以上では 1 行で省略し、詳細で全文を読める（Issue #100）。
- 本文は `line-break: strict`、`overflow-wrap: anywhere`。`anywhere` は表のセルや flex の子の最小幅も 1 文字まで縮めるので、段落（説明文・Goal・振り返り）にだけ付け、画面全体の既定は `break-word` にする。
- 見出し（`h1`〜`h3`）は `word-break: auto-phrase` で文節の途中では折らず、`text-wrap: balance` で行の長さを揃える。画面の既定にする。見出しの横に添える短い語（Today の「過去」「未来」）は、語の途中で折らない（Issue #166）。
- **確定した言葉は大きく、編集中は本文のサイズ。** Goal は編集中は `body-l`、確定すると `goal` で組む。未確定の Agent 提案は `body` のまま破線の枠に入れる。
- ○ Sprint Header「Sprint 14」＝`display-l`、期間「9/28 (月) – 10/4 (日)」＝`body` `ink-muted`。× Estimate・Capacity の数字を `num-*` 以外で組む、数字だけ別の書体にする。

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
- 確定した言葉（Goal、改善策、振り返り）は `measure-read` を超えて横に伸ばさない。Planning の Sprint ペインは最大 680px、Retro の読み物と desktop の Today は最大 720px。ただし Retro の「事実を見る」の Task の表は一覧なので、振り返りの材料のペインを出さず、その分まで広げる（`pane-today`＋`pane-side`＋間隔。`bp-xl` 以上では、画面の幅いっぱい）。どの表も同じ列幅にして、Goal をまたいで列を揃える。
- どの画面も、見出しの左端はナビの右に `spacing.6`（compact は `spacing.4`）を足した位置に置く。画面ごとに中央へ寄せたり、幅の上限で位置を変えたりしない。画面を移っても見出しが動かないようにするため。Today も 1 カラム（と、wide では右の Goal の要約）の構成のまま、左に寄せる。余った幅は右に空く。
- 大きい画面（`bp-xl` 1920px 以上）で変えてよいのは、ペインの広さと、その中に並ぶ数だけ。どのペインに何があるかは、画面の大きさで変えない。中央のペインは固定幅にせず、左右のペインを除いた幅を使い、上限は中身の種類で決める。
  - ブロック（Planning の Area）：幅に応じて 1〜3 列に並べる（1 列は `pane-sprint` まで）。
  - 表（Retro の事実を見る）：幅いっぱい。
  - 1 行 1 Task の一覧（Backlog、Retro の繰り返しの回）：行は最大 `pane-rows` 1280px。
  - 文章（Goal、改善策、振り返り）：`measure-read` のまま。

### 寸法

| トークン | 値 | 用途 |
| --- | --- | --- |
| `control-sm` / `control-md` / `control-lg` | 28 / 36 / 44px | コントロールの高さ（lg は compact 幅と確定ボタン） |
| `row-task` / `row-touch` | 40 / 48px | Task Row の最小高さ（desktop / compact） |
| `row-menu` | 32px | Menu の項目の高さ（compact は `control-lg` 44px） |
| `target-min` / `target-touch` | 24 / 44px | 最小ターゲット（pointer / touch） |
| `icon-s` / `icon-m` | 16 / 20px | 文字の横 / ボタン・ナビゲーション |
| `area-badge` | 20px | Area の路線記号の一辺（compact でも同じ。当たり判定は行や Filter が持つ） |
| `pane-nav` / `pane-rail` | 224 / 64px | ナビゲーション（1440px 以上 / 768–1439px） |
| `pane-list` / `pane-side` | 384 / 336px | Planning の Backlog ペイン / 時間の見通しペイン |
| `pane-list-slim` | 240px | Planning の整える・確かめる段階の Backlog ペイン（タイトルだけ） |
| `pane-list-xl` / `pane-list-slim-xl` | 480 / 320px | 1920px 以上での `pane-list` / `pane-list-slim`（中央のペインに余りがあるため広げる） |
| `pane-sprint` | 680px | Planning の Sprint ペインの最大幅 |
| `pane-today` | 720px | Today の 1 カラムの最大幅 |
| `pane-rows` | 1280px | 1 行 1 Task の一覧（Backlog、Retro の繰り返しの回）の行の最大幅 |
| `drawer` | 400px | 右 Drawer |
| `popover` | 320px | Popover の幅 |
| `toast` | 480px | Toast の幅（medium 以上。開いた Drawer に重ならない幅まで。compact は幅 100% − 32px） |
| `dialog-sm` / `dialog-md` / `dialog-lg` | 440 / 560 / 720px | Dialog の幅（compact は幅 100% − 32px） |

### Responsive

Desktop の Planning を中心に設計し、スマートフォンでは Today・タスクの完了・追加・Sprint の進捗を完結させる。PC 画面を縮小しただけのレイアウトにしない。

| 幅 | 名前 | レイアウト |
| --- | --- | --- |
| 1440px 以上（`bp-nav`） | wide | ナビ 224px ＋ Planning 3 ペイン（Backlog 384 / Sprint / 時間の見通し 336） |
| 1200–1439px（`bp-wide`） | wide（rail） | ナビを 64px の rail（アイコンと名前）にし、3 ペインを保つ |
| 1920px 以上（`bp-xl`） | xl | wide のペインの数と役割は変えず、中央のペインを広げる。Planning は Area のブロックを 1〜3 列に並べ、Backlog ペインを `pane-list-xl`（選ぶ）/ `pane-list-slim-xl`（整える・確かめる）に広げ、Retro の事実を見るの表は幅いっぱい、Backlog の行は最大 `pane-rows`。Today・実行中の Sprint は変えない（どちらも左のまま） |
| 768–1199px（`bp-medium`） | medium | ナビを 64px の rail（アイコンと名前）にし、2 ペイン（Backlog / Sprint）。Capacity は Sprint の上に要約 1 行を sticky で出し、クリックで右 Drawer。Agent 提案も Drawer の中 |
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
| `elevation-overlay` | `0 1px 2px #16181a14, 0 6px 16px #16181a14` | `0 1px 2px #00000066, 0 6px 16px #00000066` | Menu、Popover、Toast、非モーダル Drawer。必ず `border` と併用 |
| `elevation-modal` | `0 2px 6px #16181a14, 0 16px 40px #16181a24` | `0 2px 6px #00000080, 0 16px 40px #00000099` | Dialog、モーダル Drawer、Bottom Sheet。`scrim` と併用 |
| `elevation-drag` | `0 2px 8px #16181a24` | `0 2px 8px #000000a3` | ドラッグ中の Task Row だけ |

- 影で「押せそう」を表現しない。hover は背景色の変化だけ。
- `scrim` は半透明の色だけで、背景をぼかさない。
- 重なり順は `layer-sticky` 10 / `layer-drawer` 30 / `layer-popover` 40 / `layer-dialog` 50 / `layer-toast` 60 / `layer-tooltip` 70 だけを使う。

## Shapes

**Small radius · Flat · Border first · Divider first · Shadow last.**

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `rounded.xs` | 2px | Checkbox、Progress、Switch のつまみ、Estimate の提案枠 |
| `rounded.sm` | 4px | Button、Icon Button、Input、Select、Textarea、Switch のトラック、Tooltip、メニュー項目、Notice、Area の路線記号 |
| `rounded.md` | 6px | Popover、Menu、Toast、Agent 提案 |
| `rounded.lg` | 8px | Dialog（通常 UI の最大） |
| `rounded.xl` | 12px | compact 幅の Bottom Sheet の上角だけ |
| `rounded.full` | 9999px | Filter、Tag / Status、Radio、完了サークル、段階番号だけ |

- 行（Task Row、Capacity の内訳、差分の行）は角丸 0。Button と Switch に Pill を使わない。

### 線

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `stroke-hairline` | 1px | すべての罫、枠、行区切り、Agent 提案の破線 |
| `stroke-strong` | 2px | フォーカスリング、選択中タブの下線、使える時間のマーカー |

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
| Focus | `focus`（墨）の 2px outline、offset 2px（リスト内・タブ・メニュー項目は −2px）。hover と同時でも両方見える。黄（選択）や墨の塗り（Primary・pressed）の上でも、外側のアキで見分けられる |
| Active | `surface-pressed` / `primary-active` |
| Selected | リストの選択は `here-subtle` の地＋チェック（`aria-selected`）。Filter のオン（`aria-pressed`）は `here-subtle` の地＋`ink` の 2px の枠＋太字。トグルのオン（`aria-pressed`、IconButton の pressed）は墨の反転（`primary` の塗り＋`on-primary`） |
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
| Capacity Indicator | ok | — | 使える時間の入力 | — | — | — | — | tight / over / unknown |

### 操作

**Button** — 既定は Secondary。Primary は 1 画面に 1 つ。
- 36px、`rounded.sm`、1px 枠、ラベルは `button`（14/20 700）で動詞で終える（「Sprint を確定」「差分を確認」）。先頭・末尾に 16px アイコン（任意）。
- Variant：primary（墨の塗り `primary`、文字 `on-primary`。hover `primary-hover`、押下 `primary-active`）/ secondary（`surface`＋`border-strong`）/ quiet（枠なし。キャンセル、編集して採用、却下）/ danger（`danger` の枠と文字。破壊的操作の入口。アーカイブは元に戻せるので使わず、secondary にする。Issue #164）/ danger-solid（破壊的操作の確認 Dialog の実行ボタンだけ）。サイズ sm 28 / md 36 / lg 44px（compact は lg）。
- Hover / Active：secondary と danger は `surface-hover` / `surface-pressed`（secondary は輪郭も `ink-muted`）、quiet は枠なしのまま `surface-hover` / `surface-pressed`、danger-solid は `danger-hover` / `danger-active`。
- Disabled は共通の状態どおり（quiet だけは地と枠を付けず、文字を `ink-disabled` にする）。無効にしてもフォーカスでき、近くに書いた理由を読み上げられる。
- Loading は先頭にスピナー、ラベルを「確定中…」に、幅は保つ。Loading 中は押しても反応しないが、Disabled の見た目にはしない。
- Primary は右端、Secondary / Quiet はその左。画面の移動にはリンクを使う。× Pill、影、グラデーション、「OK」「はい」、アイコンだけの Button（→ IconButton）。

**IconButton** — アイコンだけの操作。ラベル必須で、hover / focus で Tooltip に出す。
- 36px または 28px の正方形、`rounded.sm`、アイコン 20 / 16px `ink-muted`。Variant：quiet（既定）/ secondary / pressed（墨の塗り `primary` に `on-primary` のアイコン。駅の案内の白抜きと同じく反転で示す。`aria-pressed`）。compact は 44px。
- Disabled は共通の状態どおり（quiet は Button と同じく地と枠を付けない）。Loading はアイコンをスピナーに替え、名前と Tooltip を「保存中…」などにする。
- 意味が広く共有されたアイコン（閉じる、…、編集、検索）だけ。同じ行に 3 つ以上並べず Menu にまとめる。

**Menu** — 行やヘッダーの補助操作のドロップダウン。トリガーは `…` の IconButton か、Secondary の Button（「並び順: 期限 ⌄」）。
- 面 `surface`＋`border`、`rounded.md`、`elevation-overlay`。項目 32px（アイコン・ラベル・Kbd）、区切り `border-soft`、破壊的な項目（`danger`）は最後。アーカイブは元に戻せるので `danger` にしない（区切りの後の最後に置く）。Checked は チェック＋`here-subtle`。
- 主要な操作を隠さない。サブメニューを入れ子にしない。キーボードは ↓ ↑ Home End、Enter で実行、Esc でトリガーに戻る、Tab で閉じる。

**Kbd** — ショートカットの表示。`code` の書体で Tooltip とメニュー項目の右端に置く。キーを色で強調しない。主な入力がタッチの端末（`pointer: coarse`）では、メニュー項目の Kbd を出さない（押すキーがないため。Issue #163）。

### 入力（ラベル → サポートテキスト → 入力 → エラーの順）

**TextInput** — 1 行の入力。
- 36px、`border-strong`、`rounded.sm`。ラベルは `label`（必須なら「必須」、任意なら「任意」）、サポートテキストは `help` で入力の上、エラーはアイコン＋直し方の文で入力の下。接頭アイコン・接尾の単位（「h」）は任意。
- サイズ sm / md / lg（28 / 36 / 44px）、compact では自動で 44px・16px 文字。視覚ラベルの省略は検索とクイック追加だけ。フォーカスリングの offset は 1px。
- Hover は輪郭を `ink-muted` にするだけで、地は `surface` のまま（`canvas-subtle` の地は Disabled と Read-only の印なので、入力欄では hover に使わない）。Select と Textarea も同じ。
- help には単位や例を書く（「0.5時間単位」）。エラーは直し方まで書く（「数値で入力してください（例: 1.5）」）。
- × プレースホルダーをラベルの代わりにする、入力中にエラーを出す（離脱時・送信時に出す）、入力内容を消す。

**Textarea** — 複数行の入力（Goal の編集、Retro の振り返り）。最小 88px、縦方向だけリサイズ、上限があれば右下に文字数。入力中は `body` / `body-l` のまま組み、確定後の `goal` / `reflection` の大きさにしない。

**Select** — 5〜15 個の選択肢から 1 つ（Area、繰り返しルール）。ネイティブの `<select>`（36px、`border-strong`）と `chevron-down`。独自のドロップダウンで置き換えない。

**Checkbox（□ = 選ぶ）** — Backlog のタスクを今週へ選ぶ、差分の行を反映する、設定のオプション。
- 当たり判定 24px（compact 44px）、16px の四角（`rounded.xs`、`border-strong`）。Checked は `primary` の塗り＋`on-primary` のチェック、Indeterminate は横線。フォーカスリングは当たり判定ではなく 16px の四角を囲む（Radio も同じ）。
- ラベルは四角の右。ラベルを押しても切り替わる。行の中など横にラベルを置かない場所では、`aria-label` で「今週に入れる: タスク名」と読ませる。
- タスクの完了には使わない（→ 完了サークル ○）。□ と ○ の意味を入れ替えない。

**Radio / RadioGroup** — 2〜5 個の排他的な選択肢をすべて見せる（Goal の自己判定、Sprint の長さ）。16px の円、選択時は `primary` の 4px 内枠。fieldset と legend で組む。自己判定には既定値を置かない。

**Switch** — 即時に反映される設定のオン / オフ。トラック 36×20px（`rounded.sm`、Pill にしない）、つまみ 14px（`rounded.xs`）、「オン / オフ」の語を添える。On はトラック `primary`・つまみ `on-primary`、Off はトラック `surface`・枠とつまみ `border-strong`。説明で「オンにすると何が起きるか」を書く。ラベルと説明を左、トラックと語を右に置く。トラックは 20px なので、当たり判定をトラックの外へ広げて 24px 以上（compact 44px）にする。Disabled でも「オン / オフ」の語は `ink-muted` のまま読めるようにする（オンとオフを区別する唯一の文字なので、共通の状態の `ink-disabled` の例外）。保存ボタンで確定するフォームには使わない（→ Checkbox）。

### 表示

**Tag** — Status（Sprint の状態、Goal の自己判定）と本人のラベルだけに使う小さな Pill。
- 20px、`rounded.full`、Status はアイコン必須、語は 1〜2 語（本人のラベルは 12em で省略し、全文を title で読める）。Variant：neutral / done（墨の文字＋`circle-check`）/ warning（`triangle-alert`）/ danger（`circle-alert`）/ draft（破線＋`circle-dashed`。「計画中 · 未確定」）。neutral の Status は意味に合うアイコンを画面側で選ぶ（同期中・次の Sprint で試すは `info`）。アイコンのない neutral は本人のラベルで、`border` の輪郭だけにする。
- tone の使い分け：neutral = 本人のラベル・一部できた・できなかった・判断しない・同期中・次の Sprint で試す、done = できた・保存済み、warning = 超過の可能性、danger = 同期エラーなど保存・同期の失敗、draft = 未確定。期限超過は Tag にせず、Task Metadata の文字（`circle-alert`＋「2日超過」）で示す。Goal の自己判定は円の形と語で区別し、色で区別しない（Issue #42）：できた `circle-check`（done）/ 一部できた `contrast`（半分を描いた円、neutral）/ できなかった `circle`（空の円、neutral）/ 判断しない `circle-minus`（neutral）。できなかったに赤や × を使わない。
- 期限・Estimate・持ち越し・繰り返し・Area を Tag にしない（→ Task Metadata の文字）。1 行に 3 つ以上並べない。

**Divider** — Card の代わりにグループを区切る、構造の主役。default（`border`）/ soft（`border-soft`、リスト内）/ rule（`ink` 1px、考える領域の上端、1 画面に 1〜2 本）/ label（ラベル付き。グループ見出し）。× 2px 以上の太い罫、二重線、点線。

**Icon** — Lucide の線画。16px（stroke 1.75）と 20px（stroke 1.5）、色は `currentColor`。意味とアイコンの対応は [アイコンと動き](docs/design/foundations.md)。

**Spinner** — 必ず文言と一緒に使う（「見積中」「保存中…」）。300ms 未満の処理と画面全体のローディングには使わない。

**Progress** — 4px（thin は 2px）の線と数値（「7 / 18件」）。トラック `border-soft`、塗り `primary`。必ず数値を併記し、色を段階で変えない。Goal の達成度を数値化しない。件数が分からない間（indeterminate）は数値の代わりに文言（「読み込み中…」）を出し、線は動かさず不透明度だけを変える（reduced motion では線を隠し、文言だけにする）。読み上げは「18件中 7件」。

**Notice** — 画面内に留まる説明・注意・エラー。地は warning / danger が各 `*-subtle`、ほかは `canvas-subtle`。`rounded.sm`、枠なし、アイコン＋タイトル（700）＋本文＋任意の操作。Variant：info（`info` アイコン。データ不足、同期状態、計画案の作成後に Backlog が変わった）/ warning（超過の可能性、見積もりのないタスク）/ danger（読み込みの失敗、`role="alert"`）/ done（`circle-check`。反映済み）/ neutral（補足。状態を示さないのでアイコンなし）。次にできることを書く。読み込み後に現れる Notice は `role="status"` で知らせる。× 左に色の太線、同じ画面に 3 つ以上。

**Toast** — 操作の結果を短く伝え、元に戻す手段を添える。面 `surface`＋`border`、`rounded.md`、`elevation-overlay`。Variant：neutral（「3件を今週に入れました」＋元に戻す）/ done（`circle-check`＋「Sprint 14 を確定しました」）/ danger（「保存できませんでした。入力内容は残っています。」＋再試行、`role="alert"`）。表示 8 秒、操作付き（元に戻す・今日を開く・見る）は読んでから押すまでかかるので 16 秒（閉じるまでは残さない。古い「元に戻す」を残さない）、どちらも hover / focus 中は止める。danger は再試行を失わないよう閉じるまで残す。幅は medium 以上で `toast`（480px。日本語の 1 文が 2 行ほどに収まる）、Drawer（400px）を開いているときは、それに重ならない幅まで（768px で 336px）。compact は幅 100% − 32px。画面を移ったら、前の画面の Toast を閉じる（ナビゲーション・リンク・移った先を開く操作・戻る／進む。「今日を開く」も、押さずに移れば閉じる。絞り込み・日・詳細・段階・Sprint の切り替えだけを変えるときは移ったと数えず、残す。danger は残す）。位置は desktop 左下、compact は下部タブバーの上。下端に固定した追加欄がある画面（Today。compact の Backlog）では、どの幅でも、その追加欄の上に出し、追加欄は動かさない。同じ種類の操作の Toast は積まず、最新の 1 つに置き換える（本文・操作・表示時間が新しくなる。「元に戻す」は最新の操作に効く。グループの一括選択は 1 回の操作なので、その「元に戻す」は残る）。種類の違う Toast は同時に 3 つまで（4 つ目を出すと最も古いものを隠す。「同じ種類」の 3 つ上限の例外）。Toast が出ている間は、スクロール領域の下に Toast の高さ分の余白を足し（画面の下端に届く内容は、その分上がる）、押した行や入力した欄が Toast に隠れないよう最小限スクロールして見える位置に寄せる（隠れる下端の行や追加欄には、スクロールで届く。Toast の位置は動かさない。下端に固定した追加欄がある画面は、上に書いたとおり Toast を追加欄の上に出し、余白は追加欄より前の中身の側に足す。追加欄は下端に固定したまま動かさない）。操作と閉じるボタンは Quiet。入力エラー・確認が必要なこと・タスク完了のたびの通知には使わない。祝福の演出をしない。

**Tooltip** — アイコンだけの操作と省略されたラベルに短い説明。`surface-inverse` の小さな面（`rounded.sm`、12px）、任意で Kbd。hover 400ms 後 / focus で即時に出て、pointer が離れる・blur・Esc で消える（pointer を Tooltip に載せても消えない）。1 行 20 字程度まで。矢印・影・アニメーションで飾らない。必須の情報・エラー・操作可能な内容を載せない。

### 面

**Dialog** — 作業を止めて確認・決定を求めるモーダル。Sprint の確定、振り返りの完了（取り消せないため）、破壊的操作の確認と、領域を編集（作る・名前を変える・アーカイブ。Issue #113。[patterns.md](docs/design/patterns.md) の Backlog）だけ。領域を編集は問いではないので、タイトルは「領域を編集」、フッターは「閉じる」だけにする。
- `scrim`（Blur なし）、面 sm 440 / md 560 / lg 720px、`rounded.lg`、`elevation-modal`。タイトルは問いの形（`heading` 16 / 700）、フッターは `border-soft` の罫の下に右寄せで Secondary → Primary。
- 初期フォーカスは最も安全な操作（確定では「戻って調整」、振り返りの完了では「戻る」）。ボタンは結果を書く。× 「本当によろしいですか？」、Dialog を重ねる、操作のたびに確認する。

**Drawer** — 文脈を残したまま詳細を編集する側面パネル。desktop は右 400px（左に `border`）、compact は Bottom Sheet（上角 `rounded.xl`、グリップ）。ヘッダー（タイトル＋閉じる、下に `border-soft`）、本文（スクロール）、フッター（キャンセル / 保存）。タスクの詳細は欄を離れたときに欄ごとに保存するので、フッターは「閉じる」だけにする。追加・反映していない入力があるときは、閉じずにフッターの上に Notice と「戻る」「破棄して閉じる」（別の行を開くときは「破棄して開く」）を出す（Dialog は使わない。[patterns.md](docs/design/patterns.md) の Backlog Organize）。非モーダルが既定で、背後を操作させない場合だけ modal（`scrim` あり）。タスクの詳細、計画案の差分、medium 幅の Capacity に使う。Drawer の中に Drawer を開かない。

**Popover** — その場で 1〜3 項目を編集する浮いた面（Estimate の編集など）。幅 320px、`rounded.md`、`elevation-overlay`、タイトル＋閉じる、本文、フッター（キャンセル / 保存）。開いたらフォーカスを最初の入力へ移し、Esc・外側のクリック・閉じるで閉じる。保存は Secondary（Popover に Primary を置かない）。Popover から Popover を開かない。

### ナビゲーション

**Navigation** — desktop の左サイドバー（`canvas-subtle`、右に `border`）。項目 36px（20px アイコン＋ラベル＋件数）、現在地は `here` の 4px の縦線＋`ink` 700＋`aria-current`（黄の印と太さで示し、地は塗らない）。768–1439px は `pane-rail`（幅 64px。20px アイコンの下に名前を `meta` で出す。項目は 56px で、下部タブバーと同じ組み方。medium の 2 ペインを保つため medium も rail にする）、compact は下部タブバー（今日 / Sprint / Backlog / 振り返り）。項目は 8 個まで。
- 下部タブバーは `canvas-subtle`＋上に `border`。項目は等幅で、20px アイコンの下にラベル（`meta`）、高さ 56px。現在地は項目の上端の `here` の 4px の横線＋`ink` 700＋`aria-current`。件数は表示せず読み上げだけにする。
- rail の名前はホバーしなくても読める。rail の内側の余白は 4px（8px だと「Backlog」が 48px の幅に収まらない）にし、名前は折り返さず切らない。現在地の太字（700）でも収まる幅を保つ。現在地の縦線は項目の外、rail の余白に引き、名前に重ねない。件数は rail では表示せず、読み上げと Tooltip で伝える。
- rail とタブバーでも件数は読み上げる（「Backlog 42件」）。Disabled の項目はフォーカスでき、`aria-disabled` で使えないことを伝える。

**Tabs** — 同じ場所の表示を切り替える。タブ 40px、ラベルは `button`、選択は `ink` 700 の文字＋`stroke-strong` の下線（色面・Pill にしない）、未選択は `ink-muted` 400（太さでも選択を示す。選んでも幅が変わらないよう 700 の幅を先に取る）、件数は `ink-subtle`。タブは 5 個まで。段階を進めるフロー（→ Sprint Header）と絞り込み（→ Filter）には使わない。

**Filter** — リストを絞り込むトグル。Pill（28px、`border`）＋任意の Area の路線記号（`area-badge` 20px。記号は読み上げず、ラベルの Area 名を読む）＋ラベル＋件数。Selected は `here-subtle` の地、`ink` の 2px の枠（`stroke-strong`。内側に取り、大きさを変えない）、ラベルの 700、`aria-pressed`。チェックは付けない（選んでも幅を変えず、後ろの Filter を動かさないため。太字の幅は先に取る）。0 件は disabled（フォーカスでき、「0件」を読める）。ただし選択中の Filter は 0 件になっても外せるよう disabled にしない。compact 幅では見た目の 28px を保ったまま当たり判定を 44px にし、折り返した行の間を 16px 空けて当たり判定を重ねない。

**Sprint Header** — Sprint の画面の見出し。Status Tag、タイトル（`display-l`「Sprint 14」）、期間（`body` `ink-muted`）、右に操作（Primary は 1 つ）、段階表示（路線図のように段階を線でつなぎ、番号付きの駅として並べる。`nav`＋`ol`、現在の段階は `here` の印＋「現在」、`aria-current="step"`）。段階表示は目安で、どの段階にも戻れる。段階がすべて済んでいる（完了した Retro）ときは、「現在」と `here` の印を出さず、開いている段階を太字だけにして `aria-current="page"` にする。
- 前後の移動：タイトルの左右に、前の Sprint・次の Sprint へ移る矢印（`chevron-left` / `chevron-right`、IconButton と同じ Quiet の見た目のリンク、Tooltip と読み上げは「前の Sprint（Sprint 13）」）。端で行き先がなければ、矢印を無効の形（`ink-disabled`）で同じ位置に残す。
- 呼び名：今と比べた呼び名（「先週」「今週」「来週」）があれば、期間の前に `ink` の太字で添える（「来週 · 10/5 (月) – 10/11 (日)」）。呼び名の規則は `docs/design/content.md`「週の呼び名」。
- Planning：選ぶ / 整える / 確かめる（PRD §5.B の Pick / Shape / Check）
- 実行中：Status「実行中」、段階なし
- 振り返り中・完了の Sprint の画面：Status「振り返り中」/「完了」（`done`）、段階なし、確定時の計画と結果を読み取り専用で出す
- 次の週（計画を始める前）：Status なし、操作は「Sprint N の計画を始める」
- Retro：事実を見る / 振り返る / 引き継ぐ（PRD §5.D）。完了した Retro も同じ段階を読み取り専用で出し、「現在」は出さない

### タスク

**Task Row** — タスク 1 件の行。Backlog・Sprint・Today で同じ構造。
- 左から：ドラッグハンドル（hover / focus 時のみ、compact は非表示）、コントロール（□ 選ぶ / ○ 完了 / なし。Backlog の繰り返しの Task は、回ごとに完了するので ○ の位置に `repeat` の印を置く。押せず、読み上げは「完了は回ごと」。Issue #171）、タイトル（`task`。compact は 2 行まで、medium 以上は 1 行で省略）、Task Metadata、Estimate（右端 `num-s`）、行の操作 `…`（Backlog は常時。Backlog 以外の行は hover / focus 時、compact は常時。Backlog は「今日へ」を探す行なので hover の裏に置かない。Issue #164）。
- Planning の Backlog ペイン（選ぶ・整える・確かめる）の行は、列が細いので、medium 以上でもタイトルを 1 行で省略しない（Issue #158）。選ぶは compact と同じ 2 行まで、整える・確かめるのタイトルだけの細い列は全文を折り返して、切れたタイトルを作らない。Estimate（Agent の提案を含む）はタイトルの右ではなく、タイトルの下の Task Metadata と同じ行の右端に置き、入らなければ次の行の右端に回す。タイトルの幅を Estimate に削らせない。
- layout stacked（既定、約 52px）/ inline（40px、`row-task` は最小高さ）。区切りは `border-soft`、行間 0、角丸・影なし、Card で囲まない。
- 状態：Selected（`here-subtle`＋チェック）、In progress（Today で開始した行。先頭の端に `here` の 4px の縦線＋タイトル 700＋メタデータの「作業中 · 10:12 から」。ナビの現在地と同じ印で「今やっているもの」を示す。Issue #163）、Done（○ を `primary` で塗り、タイトル `ink-subtle`＋取り消し線）、Skipped（○ に「−」＋「スキップ」）、Dragging（`surface`＋`elevation-drag`＋`border`）、Loading（Estimate が「見積中」）、Error（行内に「保存できませんでした · 再試行」）、Disabled（アーカイブ済み、`ink-disabled`）。
- Today の「今日やる」の行は、日次の操作（開始 / 完了 / 今日はここまで / 今日は見送る / 今日の予定から外す / 繰り返しのスキップ）を持つ。強い操作を常時並べすぎず、完了（○）以外は行の操作 `…` と詳細から出す（PRD §12）。例外として、見送り・外した・スキップの行は `…` の位置に「取り消す」（`undo-2` の IconButton、`…` と同じ大きさ）をどの幅でも常に出す（誤操作から戻る手段を hover の裏に置かない。ドメインモデル F19・F37、Issue #101）。「今週の残り」「昨日の続き」の行は □ ではなく、行の先頭に常に見える「今日へ」のボタンで選ぶ（□ は今週へ選ぶ意味なので使わない）。
- × メタ情報を Badge / Pill にする、□ と ○ を入れ替える、Goal に紐づかない行を薄くする。

**Task Metadata** — タスクの属性を Badge ではなく文字とアイコンで 1 行に並べる（`meta` 12px、要素間 `spacing.3`）。順に Area Indicator（グループ化していない一覧だけ）、Deadline、優先度（高と低だけ「優先度 高」「優先度 低」と語で出す。通常は値がない扱いで出さない。色・アイコンで強調せず、並びも変えない。Issue #97）、持ち越し、繰り返し、サブタスク（Backlog の行だけ。アイコンなしの注記。「サブタスク 2件 · 1h（計画には使わない）」。計画に使う時間がサブタスクの合計のときは「サブタスクの合計」。Issue #171）、Goal（`target`＋Goal 文を省略。領域ごとにまとめ、見出しに Goal 文がある一覧では、Goal 文の代わりに「目標に紐づく」、紐づかない Task には同じ調子で「目標に紐づかない」と出す。Issue #159）、注記（`ink-subtle`）。値がない属性は出さない（「—」で埋めない）。グループ見出しと同じ情報を行に重ねない。

**Task Quick Add** — 画面を中断せずにタイトルだけでタスクを追加する入力。`plus` の接頭アイコン、視覚ラベルなし（`aria-label` あり）。`aria-label` とプレースホルダーには同じ語で入り先を書く（Backlog「Backlog にタスクを追加」、Today「今日やるタスクを追加」、Planning「今週のタスクを追加」。週の語は週の呼び名に従う）。任意で Area の Select（既定は直前に使った Area）、Secondary の「追加」ボタン（すべての画面・すべての幅に置く。compact では 44px。空のときに押しても何も起きない）、ヒント（Enter で追加 / Esc で取り消し。compact には出さない）。ボタンも Enter も同じ追加で、追加後も入力にフォーカスを残す。768px 以上では、入力・Area の Select・ボタンを 1 行に並べる。compact と Planning の Backlog の枠（細いので）では、入力を 1 行目に広げ、2 行目に Select とボタンを置く（プレースホルダーが切れないように）。Backlog 上部、Planning、Today の下部（幅に関係なく下端に固定（sticky）。compact はタブバーの上）で同じ形。モーダルで追加させない。

**Estimate** — タスクを終えるまでの作業時間。本人の値と提案を見た目と語で区別する。

| Variant | 表示 | 意味 |
| --- | --- | --- |
| user（既定） | 「3h」実線・ラベルなし | 本人の Estimate（点の値） |
| suggestion | 「Agent の提案 2–4h」破線枠（`rounded.xs`） | EstimateSuggestion（未確定の幅） |
| planned | 「計画 5h」実線 | この Sprint の PlanningValue（確定時・追加時に固定。幅のこともある） |
| unset | 「見積もりなし」 | 0h と書かない。合計に含めない |

- 1h 未満は分（30m）、それ以上は h（1.5h）、範囲は en dash。「約」「〜くらい」と書かない。
- 状態：Loading（スピナー＋「見積中」）/ Error（「推定できません」＋手入力を促す）。
- 過去の実績からコードが作った幅も EstimateSuggestion として扱い、suggestion の見た目で出所（「過去の実績から」）を添える。4 つ目の時間の値を作らない（ドメインモデルの時間は Estimate・提案・計画値の 3 つ）。
- 計画値の元が幅（提案）のときは、元と計画値を並べる（「Agent の提案 3–5h」と「計画 5h」、ドメインモデル Scenario A）。点の Estimate とサブタスク合計には計画基準が効かない（不変条件 9）。サブタスク合計で一部のサブタスクに見積もりがなければ、合計に「（見積もりなしが 1件）」を添える（「2.5h（見積もりなしが 1件）」、不変条件 8）。Task の行では、件数を値の下の行に `meta` `ink-muted` で「見積もりなしが 1件」と出し、タイトルの幅を残す（ラベルの中など 1 行で出す場所では括弧のまま）。compact の Planning の行では、提案と計画値を縦に積む。確定後に本人が Estimate を変え、固定した計画値と違ったときも両方を並べる（不変条件 16・18）。
- 読み上げは「見積もり 3時間」「Agent の提案（未確定）: 2〜4時間」。

**EstimateRange** — 提案の幅を 0〜8h の目盛り上の帯で見せる。数値（「2–4h」「中央 3h」）、1h ごとの `border` の刻み、提案の帯（破線＋`canvas-subtle`）、中央値のマーカー（`ink` 2px）、目盛りの数値（0 / 4h / 8h）。同じ値を必ず数値でも示す。行内では使わない（→ Estimate）。確率・confidence を % で出さない。

**Deadline** — 日付＋曜日＋相対表現。upcoming（`calendar`＋「10/5 (月)」`ink-muted`）/ soon（2日以内）・today（`clock`＋「あと2日」「今日まで」`warning`）/ overdue（`circle-alert`＋「2日超過」`danger`）。色だけで超過を示さない。

**持ち越し（CarryOverIndicator）** — `corner-down-right`＋「持ち越し 1回（Sprint 13から）」`ink-muted`。3 回以上は `warning`＋「持ち越し 3回 · 分割を検討」。`danger` と「遅れ」「失敗」の語を使わない。

**繰り返し（RecurringIndicator）** — `repeat`＋ルール（「毎週 土」「毎週 月・木」「平日」）＋任意で今週の回（「今週 2/5」）。ルールと回を区別する（ルールを変えても確定済みの Sprint の回は変わらない）。Backlog の行では `repeat` を行の先頭（○ の位置）に置き、ルールの語の前には重ねない（Issue #171）。

**Area Indicator** — Area を路線記号（`area-badge` 20px の `rounded.sm` の四角に、Area 名の先頭 1 文字を `on-area` の 12px / 700 で白抜き）とラベルで示す。label（既定：記号＋名前 12px / 700 `ink-muted`）/ badge（記号だけ。凡例がある場所のみ、名前は読み上げる）/ heading（グループ見出し：記号＋名前 14px / 700 `ink`＋件数）。Sprint の画面（Planning / Today / Retro）では Sprint 確定時の Area 名、Backlog では現在の名前を出す。× 記号を 20px 以外の大きさにする、文字・背景・枠を Area の色にする、記号に 2 文字以上入れる。

### 計画と振り返り

**Goal** — Sprint × Area の「今週どんな状態にしたいか」。
- 上端の罫（`border`）、見出し（Area Indicator heading＋タスク数と時間＋自己判定の Tag）、Goal 文（`goal`、`measure-read`）とその直下の編集（Quiet sm、文の左端に揃える。何を変えるかが分かるように、見出しではなく文の近くに置く）、その Area の選んだタスク。
- set（確定）/ empty（「+ 目標を書く」。計画中は「この領域の目標は任意です。」を添える。確定後は添えない、Issue #155。Goal も Task もない Area は、名前と「+ 目標を書く」を 1 行にし、案内は添えない。Issue #161）/ editing（`body-l` の Textarea＋保存 / キャンセル）/ 自己判定済み（できた = done の Tag、一部できた・できなかった・判断しない = neutral）。
- Goal の間は `spacing.8`。× Card で囲む、Goal がない Area を警告色で示す、Goal 文を太字・大見出しにする、全体 Goal を作る。

**Capacity Indicator** — 使える時間（Sprint.availableHours）と計画値の合計の差を、幅のまま示す。
- 最上段に残り（`num-l`。下限でも超える場合は「超過」`danger`。差が 0 をまたぐ場合は、範囲の代わりに「下限なら 2.25h 残る」「上限なら 0.75h 超える」を 2 行で出し、数字だけを `num-l` にする。`danger` は使わない）、その下に状態の文（アイコン＋語。最上段の数字を繰り返さない）、計画値の合計（幅。見積もりのない件数はここに添えず、直下の文で示す）、見積もりのないタスクの件数（合計の直下の文。「見積もりのないタスク 1件は合計に含まれていません。」。合計が低く見えないよう、注記の小さい文字にせず `body` の `ink` で出す）、使える時間（本人が入力。合計の直下に置き、選びながら最初の画面で入れられるようにする。ラベルは「使える時間」で、単位は入力欄の末尾の「h」で示す。Planning の確かめるでは、入力欄を中央の要約にだけ置く）、バー（Area ごとの 8px セグメント。セグメントの間には 2px の `canvas` のアキを入れ、似た色の Area が隣り合っても境目が分かるようにする。Goal に紐づかない Task もその Area に含める＋提案の幅は破線＋残り `border-soft`＋使える時間のマーカー `ink` 2px＋使える時間を超える部分の下線：下限でも超える場合は `danger` の実線、上限側だけ超える可能性がある場合は `warning` の破線）、Area ごとの内訳、計画値の説明（内訳の後。「計画値：今回の計画に使う時間。見積もりは変わりません。」。計画値が最初に出る場所なので、ここで 1 行だけ説明する）。
- 状態：ok（`ink-muted`「使える時間の範囲に収まっています。」。見積もりのないタスクがあるときは、判定がその分を含まないと分かるよう「見積もりのある分は、使える時間の範囲に収まっています。」）/ tight（上限側だけ超える：`warning`「超える可能性」）/ over（下限でも超える：`danger`「下限でも超える」）/ unknown（「使える時間を入力すると、計画との差を表示します。」）。tight と over の数字は最上段で示し、状態の文では繰り返さない。最上段のない場所（Planning の確かめるの要約、確定の Dialog）では、状態の後に最上段の文を続けた 1 行にする（「超える可能性：下限なら 2.25h 残る · 上限なら 0.75h 超える」「下限でも超える：超過 3 〜 5h」）。
- Planning の確かめるでは、残り・状態・合計・見積もりのない件数・使える時間を中央の要約にだけ出し、右の Capacity はバー・Area ごとの内訳・計画値の説明だけにする（同じ数字を画面に 2 回出さない。Issue #165）。
- バーは `aria-hidden`、数値と状態の文が正（`role="status"`）。超過でも確定を止めない。Today と Backlog には出さない。× ドーナツ・円グラフ・ゲージ、見積もりのないタスクを 0h として足す。

**Sprint Summary** — Retro の「事実を見る」の最上部で、Sprint の結果を静かな表で示す。上端 `ink` 1px・下端 `border` の罫、項目（ラベル `meta`、値 `num-l`、単位、補足）、項目間の縦罫 `border-soft`。実績は入力済みのものだけを集計したと補足に書く。持ち越しの項目はラベルに `corner-down-right`（12px）を付け、1 件以上なら件数を押せる（下線付き。押すと持ち越しの行へ移る）。× 統計 Card を並べる、点数化、ランキング、Goal に紐づかないタスクの完了率を Goal 達成の代わりに置く。

**改善策（Retro Improvement）** — Retro で決める「次の Sprint で 1 つだけ変えてみること」。上端 `ink` 1px・下端 `border` の罫、ラベル（「次に試す変更」/「前回決めた改善策」）と出所、本文（確定後は `goal`、下書きは `body-l`）。下書き（破線の Tag）→「改善策として確定」。次の Planning の最初（選ぶ段階の右ペインの上部）に表示だけで戻る。改善策そのものに判定や「反映した」の記録はない（ドメインモデル RetroImprovement）。× 複数並べる、達成率で評価する。

**計画基準（Planning Criterion）** — 改善策から作った「提案の幅のどこで計画するか」のルール。名前は「研究：提案の幅の上限で計画する」（すべての領域なら「提案の幅の上限で計画する」）。Planning の選ぶ・整える段階では、前回の改善策の直下に `info` のアイコン＋名前だけを 1 行（`body`、`ink-muted`）で出す。確かめる段階で初めて `canvas-subtle` の地の枠にし、ラベル「計画基準」、`info` のアイコン＋名前、説明「前の振り返りで決めた、提案の幅のどこで計画するかのルール。」、「今回の計画に使う」Switch（説明に「見積もりは変わりません。」）、効果（「研究の幅のあるタスク 1件を上限で計画しています（合計の下限 +2h）。」）を同じ値から出す（不変条件 39）。計画基準がなければ、どの段階でも何も出さない（Issue #105 のオーナー決定 R3）。選んだ Task に基準が効くもの（幅のある計画値で、基準の対象の Area）が 1 件もないときも、Planning ではどの段階にも出さない（確定ダイアログも同じ。確定時に使うかどうかの記録は変えない。Issue #161）。確定後は Switch を読み取り専用にし、確定時に使って基準が効いた計画値がなかった Sprint では枠にせず `help` `ink-muted` の 1 行（「計画基準「研究：提案の幅の上限で計画する」 · 対象なし」）にする（不変条件 37。Issue #161）。Retro では、CriterionUse がある Sprint（確定時に Active な基準があった Sprint）に「続ける / 終える / 置き換える」の RadioGroup を出し、選ぶまで Retro を完了できない（不変条件 36。理由は求めない）。

**振り返りの材料（RetroInsight）** — Retro の 1 つの気づき。fact（「事実」：記録から言えること、`body`＋根拠の列挙）/ reflection（本人の言葉、`reflection`）/ agent（Agent の見立て：破線枠＋折りたたみの根拠＋振り返りに加える / 編集して加える / 却下）。事実には「振り返りに使う」の印を付けられる。× Agent の見立てを本人が加える前に `reflection` で表示する、評価・点数。

### Agent

破線・語・根拠の構造で区別し、別世界の見た目にしない。振る舞いと文言は [Agent UI](docs/design/agent-ui.md)。

**Agent 提案（AgentSuggestion）** — Estimate の提案、Goal の文案、計画案の入口。
- 破線の枠（`proposal-border`、`rounded.md`、`surface`）、ヘッダー（「Agent 提案」`kicker`＋種類＋出所と時刻）、対象、提案の値（EstimateRange / suggestion の Estimate / `body` の文）、根拠、操作。
- Estimate の提案は、下限・中央・上限のどれかを本人の Estimate として **採用** できる（PRD §5.A）。採用は Secondary、編集して採用・却下は Quiet。
- 状態：pending / loading（「過去の類似タスクを調べています…」＋取り消す）/ insufficient（幅を広く、不確実な点に理由）/ error（「提案を作れませんでした。手入力でそのまま計画を続けられます。」＋もう一度試す）/ 採用・編集・却下の後（実線の `canvas-subtle` の 1 行＋元に戻す）。

**根拠（AgentRationale）** — 「根拠 / 不確実な点 / 参照していない情報」の 3 行。columns（既定）/ stacked（狭い場所）/ collapsible（「根拠を見る」）。根拠がないときは「根拠となるデータがありません」。× confidence を % で出す、「高精度」と書く。

**計画案の差分（ProposalDiff）** — Agent の計画案と今の計画の差を、行ごとに選んで反映する。要約（追加 / 除外 / 変更の件数、計画値の合計の前後、使える時間）、行（□ 反映する＋記号と語「＋追加 / −除外 / →変更」＋タスク名＋Area と理由＋値）、フッター（「選んだ N件を計画に反映」Secondary / すべて却下 /「反映しても Sprint は確定されません」）。除外と変更前の値は取り消し線。desktop は右 Drawer、compact は全画面。× 追加を緑・除外を赤に塗る。

## Do's and Don'ts

### Do

- 構造は罫と余白で作る（Border first → Divider first → Shadow last）。
- 選択・状態・Area・エラー・提案は、色に加えてチェック・アイコン・語・形・破線のどれかで示す。
- 現在地は黄、確定は墨、計画中は破線。本人が確定した言葉（Goal、改善策、振り返り）は `goal` / `reflection` で一段大きく組む。数値は `num-*`。
- 幅のある時間は幅のまま示し、見積もりのないものは合計に含めないことを書く。
- Agent の値は破線と「提案」で示し、採用は Secondary、編集して採用・却下は Quiet にして、Primary で誘導しない。
- 持ち越し・見送り・未達は事実として中立に書く。

### Don't

- 大きな Soft Shadow、Glassmorphism、装飾目的の Blur、Glow、Gradient 主体の面。
- 12px 以上の角丸（例外：compact の Bottom Sheet 上角）、巨大な角丸 Card、Card inside Card。
- 何でも Pill・何でも Badge（メタ情報は文字とアイコンで並べる）、過剰なアイコン。
- Sparkle・魔法の杖・紫のグラデーションなど「AI は特別」という表現、チャットバブル、アバター。
- Product 画面の Hero section、装飾イラスト、巨大な統計数字の Card 並び。
- ベージュを敷くだけの「手帳風」、紙のテクスチャ、ノートのリング、手書きフォント、文具の擬物表現、駅の看板の擬物（金属の質感、照明、実在の路線名や路線記号の流用）。
- 淡い地と低彩度の色だけで作る雰囲気、明朝やセリフ体、パステルの Area 色、500 / 600 の中間の太さ。
- 色付きの左ボーダーで Card を飾ること（選択・Area・注意のどれにも使わない）。

### 条件付きで使う

- **Pill**：Filter / Tag / Status / Radio / 完了サークルだけ。Button・Tabs・入力には使わない。
- **Card**（`border` で囲んだ独立面）：Dialog、Drawer、Popover、Menu、Toast、Agent 提案だけ。単なるグルーピングは余白・Divider・見出し・`canvas-subtle` の背景差で行う。
- **Shadow**：浮いている・重なっている面だけ（`elevation-overlay` `elevation-modal` `elevation-drag`）。
- **Area の色**：路線記号の地、Capacity バーのセグメント、Filter の路線記号だけ。
- **黄（`here`）**：現在地（今日・今の段階・選んだもの・作業中の行）だけ。
