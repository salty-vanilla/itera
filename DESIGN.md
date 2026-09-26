# DESIGN.md — Personal Sprint Design System v0.1

> Claude / Coding Agent に渡すための 1 ファイル版。正本は Design System アーティファクト（README・guide・components）。

Personal Sprint Design System **v0.1**。仕事・研究・学習・生活を並行する個人が、短い Sprint ごとに「何を達成するか」を決め、実行し、Review / Retro で計画の立て方を改善するための道具のデザインシステムです。方向は **Quiet, precise personal planning tool**。手帳の装飾ではなく、紙面が持つ「情報の秩序・余白・罫線・タイポグラフィ・静けさ」をプロダクト UI に翻訳します。

このファイルは人と Coding Agent の両方に渡す前提で書いています。曖昧な形容詞ではなく、トークン名・数値・許可/禁止で判断してください。迷ったら **Border first → Divider first → Shadow last**、**Sans で操作し、明朝で考える**、**破線は「まだ本人が決めていない」** の 3 つに戻ってください。

## Design Principles

### 1. Clarity — 今何を決めているかが分かる
- 画面ごとに「決めていること」を 1 つだけ見出しにする（例: 「今週、何を達成するか」）。Planning の段階は Sprint Header の段階表示で常に示す。
- 選択は `primary-subtle` の背景 **と** チェック状態で示す。色だけで示さない。
- 残り時間は Capacity Indicator の「残り」を最上段に、`num-l` で示す。幅がある見積もりは幅のまま出す（`−1 〜 1h`）。

### 2. Agency — 決めるのは本人
- AI / Agent の値は **破線（`stroke-hairline` dashed `proposal-border`）＋「提案」「Agent 提案」の語** で区別する。本人の値は実線・ラベルなし。
- 重要な変更は **Review → Edit → Confirm**。「採用」「編集して採用」「却下」を同じ重さ（Secondary / Quiet）で並べ、Primary で採用を誘導しない。
- Agent は Sprint を確定しない。計画案の反映後も「反映しても Sprint は確定されません」と明示する。

### 3. Calmness — 注意を奪わない
- Gradient / Glow / Blur / 大きな Soft Shadow / Sparkle / 紫の AI 表現を使わない。動きは `duration-slow`（240ms）以下。
- Primary Button は 1 画面に 1 つ。色面は Status と選択状態だけ。Domain color は 8px の印だけ。
- 考える領域（Goal / Capacity / Review / Retro）には意図的に余白（`space-6`〜`space-12`）を取る。

### 4. Precision — 小さな数値ほど丁寧に
- 数値は必ず `.ps-num`（tabular-nums）。時間は `formatHours`（1h 未満は `30m`）、合計は `formatTotal`（常に h）、範囲は en dash（`2–4h`）、負を含む範囲は `〜`。
- 未見積・未入力は「0」ではなく「未見積」「—」と書き、合計に含めないことを明示する。
- 期限は日付＋曜日＋相対表現（「あと2日」「2日超過」）。色だけで期限切れを示さない。

### 5. Continuity — Planning → Today → Review → Retro → 次の Planning
- 同じ Task Row・Goal・Estimate・Domain Indicator をすべての画面で使う。画面ごとに別の見た目を作らない。
- Retro で確定した Improvement Action は、次の Planning の最上部に `variant="reminder"` で現れる。
- 明朝体は Sprint 見出し・Goal・Review 要約・Retro の振り返りに一貫して使い、「考えた言葉」の連続性を作る。

### 6. Accessibility — 最初から設計に含める
- テキストは全テーマ・全地で 4.5:1 以上、操作部品の輪郭・フォーカス・意味のある印は 3:1 以上（トークンの usage に地を明記）。
- フォーカスは全要素共通で `outline: 2px solid var(--focus); outline-offset: 2px`。消さない。
- pointer のターゲットは 24px 以上、compact 幅（768px 未満）は 44px 以上。文字は 200% 拡大で崩れないよう rem/行の折り返しで組む。

## Quick reference（Agent 向け）

| 項目 | 値 |
| --- | --- |
| 地 | `canvas` #ffffff / 二次領域 `canvas-subtle` #f6f6f4 / 独立面 `surface` + `border` |
| 文字 | `ink` #2b2b29 / `ink-muted` #5b5b56 / `ink-subtle` #6a6a64（純黒禁止） |
| 罫線 | 構造 `border` #dcdcd7 / 行間 `border-soft` #ebebe7 / 操作部品 `border-strong` #8a8a84 |
| Primary | `primary` #2a4a6e（ブルーブラック）1 色のみ。文字は `on-primary` |
| フォーカス | `focus` #3269b0、2px outline、offset 2px |
| Domain | `domain-work` `domain-research` `domain-learning` `domain-life`（8px 四角の印だけ） |
| Semantic | `success` `warning` `danger` `info`（必ずアイコン＋語） |
| 書体 | 操作 = `--font-sans`（Noto Sans JP）/ 考える = `--font-serif`（Zen Old Mincho） |
| 本文 | `text-body` 14/22、Task は `text-task` 14/20、メタは `text-meta` 12/16（最小） |
| 余白 | 4px 基準。Task density `space-1`〜`space-4`、Thinking space `space-5`〜`space-16` |
| 角丸 | `radius-s` 4px（Button/Input）、`radius-m` 6px（浮く面）、`radius-l` 8px（Dialog）。Pill は Filter/Tag/Status/Radio/完了サークルのみ |
| 影 | `elevation-overlay`（Menu/Popover/Toast）と `elevation-modal`（Dialog/Drawer）だけ |
| 高さ | Button/Input 36px、small 28px、compact 幅 44px。Task Row 40px 以上 |
| 動き | 100 / 160 / 240ms、`easing-standard`。reduced motion で 0ms |

## Visual guardrails

### 使わない（禁止）
- 大きな Soft Shadow、Glassmorphism、装飾目的の Blur、Glow、Gradient 主体の面
- 12px 以上の角丸（例外: compact 幅の Bottom Sheet 上角 `radius-xl`）、巨大な角丸 Card、Card inside Card
- 何でも Pill、何でも Badge（メタ情報は文字とアイコンで並べる）、過剰なアイコン
- Sparkle / 魔法の杖 / 紫グラデーションなど「AI は特別」という表現、チャットバブル
- Product 画面の Hero section、装飾イラスト、巨大な統計数字の Card 並び
- ベージュを敷くだけの「手帳風」、紙のテクスチャ、ノートのリング、手書きフォント、文具の擬物表現
- 色付きの左ボーダーで Card を飾ること（選択・Domain・注意のどれにも使わない）

### 条件付きで使う
- **Pill**: Filter / Tag / Status / Radio / 完了サークルのみ。Button・Tabs・入力には使わない。
- **Card**（border で囲んだ独立面）: 意味的に独立した Surface だけ — Dialog、Drawer、Popover、Menu、Toast、Agent Suggestion。単なるグルーピングは spacing・Divider・見出し・`canvas-subtle` の背景差で行う。
- **Shadow**: 浮いている / 重なっている面だけ（`elevation-overlay` `elevation-modal` `elevation-drag`）。
- **明朝**: Sprint 見出し、Goal、Improvement Action、Review 要約、Retro の振り返り。編集中は Sans に戻す。
- **Domain color**: 8px 四角の Domain Mark、Capacity バーのセグメント、Filter の印。文字色・背景の塗り・枠線には使わない。

## 参照元と役割

| 参照元 | 取り入れたもの | 取り入れないもの |
| --- | --- | --- |
| デジタル庁 DADS | ラベル → サポートテキスト → 入力 → エラーの順序、必須表示、状態を色だけに依存させない、48rem の主ブレークポイント、44px ターゲット、「いつ使う / 使わない」の書き方 | 行政サービスの配色、黄色＋黒のフォーカス（輪郭の強さの考え方だけ採用） |
| Apple HIG | 階層・明快さ・フィードバック、モーダルの節度、直接操作と Undo、本人の主導権、pointer / touch / keyboard の同等性 | Liquid Glass、Blur、Floating Toolbar、巨大 Navigation Title |
| MUJI DESIGN.md（fork 元） | 白と無彩中心、純黒でない暗灰、罫線で構造を作る、影をほぼ使わない、小さな角丸、余白、装飾ではなく情報を主役に | きなり・ベージュの面、MUJI Red |
| Kakimori DESIGN.md | 明朝と Sans の役割分担、低彩度、控えめなアクセント、罫線と余白、palt を使わない素の組版 | 文具店としての擬物、ブランドオレンジ |
| SmartHR DESIGN.md | Semantic color の分離、フォーム状態、高密度でも読める階層、コンポーネント状態の網羅 | 游ゴシックの指定、ブランドブルー |
| KOKUYO DESIGN.md | カテゴリ（Domain）ごとに色を持つ考え方、明度・彩度を揃えた色群 | カラーパネルの面使い、高彩度 |

## Content fundamentals

- 語り口は丁寧体（です・ます）で短く。感嘆符、絵文字、「！」、煽り（「今すぐ」「最強」）を使わない。
- 本人を主語にする。「あなたが決めます」「本人が確定するまで反映されません」。Agent は「Agent」と呼び、擬人化しない（「考えています」ではなく「調べています」「提案を作れませんでした」）。
- 失敗を責めない。持ち越しは「持ち越し」、未達は「未達」。「失敗」「遅れ」と書かない。
- 結果を言い切る Toast: 「3件を Sprint 14 に入れました」「Sprint 14 を確定しました」。次にできることを添える（「元に戻す」）。
- 用語は固定する: Sprint / Backlog / Goal / Estimate / Chore / 可用時間 / 見積もり合計 / 持ち越し / 繰り返し / Review / Retro / 改善策 / Agent 提案。
- 和文と欧文単語の間は半角スペース（「Goal を書く」）。数字と助数詞・単位は詰める（「3件」「2日」「1.5h」）。範囲は en dash、スペースなし（「2–4h」「9/28–10/4」）。曜日付き日付の範囲だけ前後にスペース（「9/28 (月) – 10/4 (日)」）。

## Using the system

- 色・余白・角丸などは `tokens.css` の CSS 変数（`var(--canvas)` など）で参照する。16 進値を直書きしない。
- 書体は Google Fonts を読み込む: `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Zen+Old+Mincho:wght@400;500;600&display=swap`。
- コンポーネントは `components/bundle.js`（`window.PersonalSprint`、React 18）と `components/bundle.css`（クラス接頭辞 `ps-`）。ソースは `components/src/index.jsx`。
- テーマは `<html data-theme="light|dark">`。未指定は light。
- 新しい画面を作るときは、まず Patterns のセクションで該当するパターンを読み、Screens の Sprint Planning / Today を基準にレイアウトを合わせる。


---

## Foundations — Color

画面の 9 割は **Neutral 6 色**（`canvas` `canvas-subtle` `surface` `ink` `ink-muted` `border`）で成立させる。色は「意味がある場所」にだけ置く。

### 役割

| 層 | トークン | 使う場所 | 使わない場所 |
| --- | --- | --- | --- |
| 地 | `canvas` | 紙面：Sprint 本体、Today、Review / Retro の本文 | — |
| 地 | `canvas-subtle` | Backlog ペイン、ナビゲーション、表ヘッダー、読み取り専用入力 | 考える領域の主面 |
| 面 | `surface` | Dialog、Drawer、Popover、Menu、Toast、Agent Suggestion | 単なるグルーピング |
| 状態 | `surface-hover` / `surface-pressed` | hover / 押下 | 選択状態（選択は `primary-subtle`） |
| 文字 | `ink` / `ink-muted` / `ink-subtle` | 本文 / 補足 / 三次（件数・完了済み） | `ink-disabled` を情報に使うこと |
| 罫 | `border` / `border-soft` | 構造の罫 / 行区切り | 操作部品の輪郭 |
| 罫 | `border-strong` | 入力・Checkbox・Radio・Switch・Secondary Button の輪郭（3:1） | 装飾の罫 |
| Primary | `primary` 系 | Primary Button、オン状態、選択の印、Progress、リンク | 大きな面、見出しの文字色 |
| Focus | `focus` | フォーカスリングのみ | それ以外すべて |
| Semantic | `success` `warning` `danger` `info` ＋ `*-subtle` | 状態の文字・アイコン・Status Tag・Notice | Domain の識別、装飾 |
| Domain | `domain-*` | 8px の Domain Mark、Capacity バーのセグメント、Filter の印 | 文字色、背景の塗り、枠線、左ボーダー |
| Agent | `proposal-border` | Agent 提案・未確定値の 1px 破線 | 確定済みの値 |

### Primary は 1 色

`primary`（#2a4a6e、ブルーブラック）だけ。万年筆のインクの色として、選択・確定・進捗に使う。

- Primary Button は 1 画面に 1 つ（Planning では「Sprint 14 を確定」）。
- 選択状態 = `primary-subtle` の背景 + チェック。Tabs の選択は `ink` の下線（ナビゲーションは色で示さない）。
- dark では `primary` が明るくなるので、塗りの上の文字は必ず `on-primary` を使う（白を直書きしない）。

### Domain color

KOKUYO のカテゴリ色の考え方を、面ではなく **印** として使う。色は明度・彩度を揃え、どの地でも 3:1 以上。

| Domain | トークン | Light | Dark |
| --- | --- | --- | --- |
| Work | `domain-work` | #a45f36 弁柄 | #d69b74 |
| Research | `domain-research` | #2d7773 青磁の濃色 | #6dbcb6 |
| Learning | `domain-learning` | #7b5a8e 葡萄 | #bd9dcd |
| Life | `domain-life` | #687a2c 苔 | #abba6c |
| 5 番目以降 | `domain-5` `domain-6` `domain-7` | 臙脂 / 鉄紺 / 煤竹 | — |
| 未分類 | `domain-none` | #8a8a84 | #8f8f89 |

- Domain は **必ずラベルと併記**（`DomainIndicator`）。四角（`radius-xs`）で描き、Semantic の丸いアイコンと形で区別する。
- 同じ画面に Domain color を 8 種類以上並べない。ユーザー定義 Domain は `domain-5` から順に割り当てる。

### Semantic と Domain を混同しない

- Semantic は **アイコン＋語** とセットで、文字・アイコン・Status Tag・Notice にだけ使う。
- Domain は **四角い印＋ラベル**。Semantic の色で Domain を塗らない。`domain-work`（弁柄）を danger の代わりに使わない。
- 「未達」「持ち越し」は失敗ではないので danger にしない（未達は neutral、持ち越し 3回以上だけ warning）。

### コントラスト（検証済み）

- テキストトークン（`ink` `ink-muted` `ink-subtle` `primary` `success` `warning` `danger` `info`）は light / dark とも `canvas` `canvas-subtle` `surface` `surface-hover` `primary-subtle` 上で 4.5:1 以上。Semantic は各 `*-subtle` 上でも 4.5:1 以上。
- `on-primary` は `primary` / `primary-hover` / `primary-active` 上で 4.5:1 以上。
- `border-strong` `focus` `primary` `domain-*` は上記の地で 3:1 以上。
- 新しい色を足すときは、同じ表を light / dark で埋めてから使う。

### Dark theme

`[data-theme="dark"]` で切り替える。地は #1b1b1a（純黒にしない）、文字は #ebebe6（純白にしない）。影は弱くせず、面の差は `surface`（一段明るい）と `border` で作る。


---

## Foundations — Typography

**Sans で操作し、明朝で考える。** 書体は 2 ファミリーまで。

| 役割 | ファミリー | CSS 変数 | 使う場所 |
| --- | --- | --- | --- |
| 操作 | Noto Sans JP（→ Hiragino Sans → Yu Gothic UI → system-ui） | `--font-sans` | Button、Input、Task、Navigation、Estimate、数値、メタ情報、ラベル、Dialog |
| 考える | Zen Old Mincho（→ Hiragino Mincho ProN → Yu Mincho） | `--font-serif` | Sprint 見出し、Goal、Improvement Action、Review 要約、Retro の振り返り |
| 補助 | ui-monospace | `--font-mono` | キーボードショートカット（Kbd）のみ |

読み込み: `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600&family=Zen+Old+Mincho:wght@400;500;600&display=swap`。ウェイトは 400 / 500 / 600 だけ（700 以上を使わない）。

### スケール

| スタイル | 書体 | サイズ / 行送り | ウェイト | 字間 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `text-display-l` | 明朝 | 32 / 44 | 500 | 0.02em | Sprint Header のタイトル（1 画面 1 つ） |
| `text-display-m` | 明朝 | 24 / 36 | 500 | 0.02em | 考える領域のセクション見出し |
| `text-goal` | 明朝 | 18 / 30 | 500 | 0.02em | Goal 文、Improvement Action |
| `text-reflection` | 明朝 | 16 / 30 | 400 | 0.02em | Review 要約、Retro の本文 |
| `text-heading` | Sans | 16 / 24 | 600 | 0 | ペイン見出し、Dialog タイトル |
| `text-subheading` | Sans | 14 / 20 | 600 | 0 | グループ見出し、Popover タイトル |
| `text-body-l` | Sans | 16 / 28 | 400 | 0.02em | 説明文、compact 幅の入力文字 |
| `text-body` | Sans | 14 / 22 | 400 | 0.01em | UI の標準 |
| `text-task` | Sans | 14 / 20 | 400 | 0 | Task Row のタイトル |
| `text-label` | Sans | 13 / 20 | 600 | 0 | フォームラベル |
| `text-help` | Sans | 13 / 20 | 400 | 0 | Help・エラー |
| `text-meta` | Sans | 12 / 16 | 400 | 0 | メタ情報（最小サイズ） |
| `text-kicker` | Sans | 12 / 16 | 500 | 0.04em | 小見出し、Agent 提案ラベル |
| `num-l` / `num-m` / `num-s` | Sans + tabular | 24/32 · 16/24 · 12/16 | 500 | 0 | 残り時間 / 合計 / 行の Estimate |

### ルール

- 12px 未満の文字を作らない（例外: EstimateRange の目盛り 11px は補助表示で、同じ値を 16px でも示す）。
- 見出しを太くして階層を作らない。階層は **書体（明朝 / Sans）・サイズ・余白・罫** で作る。
- `font-feature-settings: "palt"` を使わない。素のメトリクスで組む（MUJI / Kakimori と同じ判断）。
- 数値は `.ps-num` を付け、桁を揃える。時間・件数・日付が並ぶ列は必ず右揃え。
- 明朝の本文は 1 行 38 字程度（`measure-read` 38em）まで。Sans の UI 文は 1 行に収まらなければ折り返してよいが、Task タイトルは 1 行で省略（`title` 属性と詳細で全文）。
- 本文は `line-break: strict`、`overflow-wrap: anywhere`。禁則は OS 標準に任せる。
- 編集中の Goal は Sans（Textarea）。保存すると明朝で「清書」される。未確定の Agent 提案も Sans。**明朝 = 本人が確定した考え** という意味を崩さない。

### 使い分けの例

- ○ Sprint Header「Sprint 14」＝明朝 32 ／ 期間「9/28 (月) – 10/4 (日)」＝Sans 14 muted
- ○ Goal「評価データを整え、ベースライン実験を 1本回す」＝明朝 18
- × Button「Sprint を確定」を明朝にする
- × Estimate「3h」を明朝にする、Capacity の数字を明朝にする


---

## Foundations — Spacing & Density

4px 基準。**Task density と Thinking space を同じ spacing で組まない。**

| トークン | 値 | 主な用途 |
| --- | --- | --- |
| `space-1` | 4px | アイコンとラベル、ラベルと入力 |
| `space-2` | 8px | コントロール内部、メタ情報どうし、行の上下 padding |
| `space-3` | 12px | コントロール・行の左右 padding、関連フィールド間 |
| `space-4` | 16px | Task density のペイン padding、フィールド間 |
| `space-5` | 20px | Thinking space のブロック内部 |
| `space-6` | 24px | Thinking space のペイン padding、Dialog 左右 |
| `space-8` | 32px | Goal と Goal の間、考える領域のセクション間 |
| `space-10` | 40px | ページヘッダーの上下 |
| `space-12` | 48px | Review / Retro の大セクション間 |
| `space-16` | 64px | Retro 読み物の上端（最大） |

### Task density（Backlog、Today、Sprint のタスク一覧）

- 行は `row-task` 40px 以上（メタ情報付きは約 52px）。行間の余白は 0、区切りは `border-soft` の 1px。
- 行内: 左右 `space-2`〜`space-3`、要素間 `space-2`、メタ情報どうし `space-3`。
- 1 画面（1080px 高）の Backlog に 15 行以上が見えること。
- グループ見出しはラベル付き Divider（`text-kicker` 相当）で、上に `space-2` だけ空ける。Card で囲まない。

### Thinking space（Goal、Capacity、Agent 提案、Review、Retro）

- ペイン padding `space-6`〜`space-8`、ブロック間 `space-8`、ブロック内 `space-2`〜`space-5`。
- 見出しの上に `border`（またはセクション罫 `ink` 1px）を引き、罫と余白で区切る。
- 明朝の本文は `measure-read`（38em）を超えて横に伸ばさない。

### レイアウト寸法

| トークン | 値 | 用途 |
| --- | --- | --- |
| `pane-nav` | 224px | ナビゲーション（≥1440px） |
| `pane-rail` | 64px | アイコンだけのナビゲーション（1200–1439px） |
| `pane-list` | 384px | Planning の Backlog ペイン |
| `pane-side` | 336px | Planning の Capacity ペイン |
| `control-sm` / `control-md` / `control-lg` | 28 / 36 / 44px | コントロールの高さ |
| `row-task` / `row-touch` | 40 / 48px | Task Row の最小高さ（desktop / compact） |
| `target-min` / `target-touch` | 24 / 44px | 最小ターゲット（pointer / touch） |


---

## Foundations — Radius, Border, Elevation

**Small radius · Flat · Border first · Divider first · Shadow last.**

### Radius

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `radius-xs` | 2px | Checkbox、Domain Mark、Progress、Switch のつまみ、Estimate の提案枠 |
| `radius-s` | 4px | Button、Icon Button、Input、Select、Textarea、Switch のトラック、Tooltip、メニュー項目、Notice |
| `radius-m` | 6px | Popover、Menu、Toast、Agent Suggestion |
| `radius-l` | 8px | Dialog（通常 UI の最大） |
| `radius-xl` | 12px | compact 幅の Bottom Sheet 上角のみ |
| `radius-pill` | 9999px | Filter、Tag / Status、Radio、完了サークル、Sprint Header の段階番号 |

- 行（Task Row、Capacity の内訳、Diff の行）は角丸 0。
- Button に Pill を使わない。Switch も四角いトラック（`radius-s`）にする。

### Border

| トークン | 値 | 使う場所 |
| --- | --- | --- |
| `stroke-hairline` | 1px | すべての罫、枠、行区切り、Agent 提案の破線 |
| `stroke-strong` | 2px | フォーカスリング、選択中タブの下線、可用時間マーカー |

- 構造の罫 = `border`、リスト内 = `border-soft`、操作部品 = `border-strong`、考える領域のセクション上端 = `ink` 1px（編集的な罫。1 画面に 1〜2 本）。
- **実線 = 確定、破線 = 未確定（Agent 提案・下書き）**。破線を装飾や読み取り専用に使わない。
- 左ボーダーのアクセント（色付きの縦線で Card を飾る）は使わない。

### Elevation

| トークン | 用途 |
| --- | --- |
| `elevation-0` | 既定。行、Card 相当の面、Button、Input |
| `elevation-overlay` | Menu、Popover、Toast、非モーダル Drawer（必ず `border` と併用） |
| `elevation-modal` | Dialog、モーダル Drawer、Bottom Sheet（`scrim` と併用） |
| `elevation-drag` | ドラッグ中の Task Row |

- 影で「押せそう」を表現しない。hover は背景色の変化だけ。
- `scrim` は半透明の色だけ。背景をぼかさない（Blur 禁止）。
- z-index は `layer-*` トークンだけを使う（sticky 10 / drawer 30 / popover 40 / dialog 50 / toast 60 / tooltip 70）。


---

## Foundations — Iconography

- アイコンは **Lucide**（ISC License）の線画。`Icon` コンポーネントに必要なものだけを同梱している。新しいアイコンは Lucide から追加し、別のセットを混ぜない。
- サイズは `icon-s` 16px（12–14px の文字の横）と `icon-m` 20px（ボタン・ナビゲーション）。メタ情報の中だけ 12px。
- 線の太さは 16px 以下で 1.75、20px で 1.5（描画上は約 1.2px — hairline と揃える）。塗りのアイコンを使わない。
- 色は隣の文字と同じ（`currentColor`）。アイコンだけ別の色にしない（Semantic の Status を除く）。

### いつ使うか

- **使う**: ナビゲーション項目、状態（期限・持ち越し・繰り返し・警告）、操作の種類が一目で分かる場合（追加・編集・閉じる・元に戻す）。
- **使わない**: 見出しの飾り、すべてのボタンへの付与、Goal や明朝の本文の横、Domain の代わり（Domain は四角の印）。
- アイコンだけのボタンは `IconButton`（`aria-label` 必須、hover / focus で Tooltip にラベル）。

### 意味の固定

| 意味 | アイコン |
| --- | --- |
| 期限（通常 / 近い / 超過） | `calendar` / `clock` / `circle-alert` |
| 持ち越し | `corner-down-right` |
| 繰り返し | `repeat` |
| Goal への紐づけ | `target` |
| 元に戻す | `undo-2` |
| 変更履歴 | `history` |
| Agent 提案・下書き | `circle-dashed`（破線の円 = 未確定） |
| 成功 / 注意 / エラー / 情報 | `circle-check` / `triangle-alert` / `circle-alert` / `info` |

**禁止**: Sparkle（✨）、魔法の杖、ロボット、脳など「AI らしさ」を示すアイコン。Agent は語（「Agent 提案」）と破線で示す。絵文字を UI に使わない。


---

## Foundations — Motion

動きは **状態が変わったことを伝える** ためだけに使う。演出・誘導・装飾のアニメーションを作らない。

| トークン | 値 | 用途 |
| --- | --- | --- |
| `duration-fast` | 100ms | hover / press の色、Checkbox・Switch の切り替え |
| `duration-base` | 160ms | Menu・Popover・Tooltip の出現、行の追加・除外、Toast の出現 |
| `duration-slow` | 240ms | Dialog・Drawer の出入り（最大） |
| `duration-toast` | 8000ms | Toast の表示時間（hover / focus 中は停止） |
| `easing-standard` | cubic-bezier(0.2, 0, 0, 1) | 既定 |
| `easing-enter` | cubic-bezier(0, 0, 0.2, 1) | 出現 |
| `easing-exit` | cubic-bezier(0.4, 0, 1, 1) | 退場 |

### ルール

- 動かしてよいプロパティ: `opacity`、`transform`（8px 以内の移動）、`background-color`、`border-color`、`color`。サイズ・レイアウトを動かさない。
- Backlog から Sprint に入れたとき: 行の背景が `primary-subtle` に変わる（`duration-fast`）＋ Toast「〜を Sprint 14 に入れました · 元に戻す」。行を飛ばすアニメーションは作らない。
- 完了: サークルが塗られる（`duration-fast`）。紙吹雪・チェックの跳ねなどの祝福演出を作らない。
- Loading: 300ms 未満で終わる処理にはスピナーを出さない。スピナーは必ず文言（「見積中」「保存中…」）と一緒に。
- `prefers-reduced-motion: reduce` では、すべての transition / animation を 0ms にする（bundle.css が `ps-` 要素に適用済み）。indeterminate Progress は静止し、文言で状態を伝える。


---

## Foundations — Accessibility

DADS の品質基準（WCAG 2.2 AA）を下限にする。後から足すのではなく、コンポーネントの仕様に含める。

### 色とコントラスト
- テキスト 4.5:1、24px 以上または 19px 太字は 3:1。操作部品の輪郭・フォーカス・意味のある印は 3:1。すべて light / dark の両方で満たす（Color セクションの表）。
- **状態を色だけで伝えない**: 選択 = 背景＋チェック、期限超過 = 色＋アイコン＋「2日超過」、Agent 提案 = 破線＋「提案」、Domain = 印＋ラベル、エラー = 色＋アイコン＋文。
- `forced-colors: active` では Domain Mark と Capacity セグメントの色を保持し、操作部品の輪郭は `CanvasText` にする（bundle.css 対応済み）。

### フォーカス
- 全要素共通: `outline: 2px solid var(--focus); outline-offset: 2px`（`:focus-visible`）。リスト内・タブ・メニュー項目は `outline-offset: -2px`。
- フォーカスを消すスタイル（`outline: none` だけ）を書かない。
- Dialog / モーダル Drawer は開いたらフォーカスを中に移し（最初の入力、なければ最も安全な操作）、Tab を閉じ込め、閉じたら呼び出し元に戻す。Esc で閉じる。

### キーボード
| 場所 | 操作 |
| --- | --- |
| 全体 | Tab / Shift+Tab で移動、Enter / Space で実行 |
| Tabs | ← → で移動、Home / End |
| Menu | ↓ ↑ で移動、Home / End、Enter で実行、Esc で閉じてトリガーに戻る |
| Backlog / Today のリスト | Space: 選ぶ（□）/ 終える（○）、Enter: 詳細、E: Estimate 編集、Alt+↑↓: 並べ替え、Delete: アーカイブ（Undo 付き） |
| Planning | N: タスク追加欄へ、⌘/Ctrl+Enter: Sprint を確定（確認 Dialog を開く） |
| Tooltip | focus で即表示、Esc で閉じる |

- ドラッグで並べ替えられるものは、必ずキーボード（Alt+↑↓）とメニュー（「上へ」「下へ」）でも同じことができる。
- ショートカットは 1 文字キーを入力欄の中では無効にする。

### ターゲットと拡大
- pointer: 24px 以上（`target-min`）。行内の小さな操作は 28px の見た目で、周囲に余白を確保する。
- compact 幅（< 768px）: 44px 以上（`target-touch`）。Checkbox / 完了サークルは 44px の当たり判定を持つ。
- 文字の 200% 拡大、1 行 320px 幅でも情報が欠けない。Task タイトルは省略するが、詳細（Drawer）で全文を読める。

### フォーム（DADS の構造）
- 順序は **ラベル → サポートテキスト（help）→ 入力 → エラー**。help とエラーは `aria-describedby` で入力に結ぶ。
- 必須は「必須」の語で示す（色だけ・記号だけにしない）。Personal Sprint では任意項目が多いので、任意を示す場合は「任意」。
- エラーは入力の直下に、アイコン＋「何が問題で、どう直すか」を書く（「数値で入力してください（例: 1.5）」）。送信時に最初のエラーへフォーカスを移す。
- プレースホルダーをラベルの代わりにしない（検索欄とクイック追加だけ、視覚ラベルを省略し `aria-label` を付ける）。
- 無効化したボタンは理由を近くに書く。可能なら無効化せず、押したときに理由を示す。

### スクリーンリーダー
- Agent 提案の値は「Agent の提案（未確定）: 2〜4時間」のように読み上げる（`Estimate` 対応済み）。
- 動的な結果（Toast、Capacity の状態、保存エラー）は `role="status"` / `role="alert"` で通知する。
- 装飾アイコンは `aria-hidden`。意味を持つアイコンだけに `aria-label`。


---

## Foundations — State design

すべての操作部品は以下の状態を定義する。**Focus は省略しない。**

| 状態 | 共通の表現 | 注意 |
| --- | --- | --- |
| Default | 既定の地・輪郭 | — |
| Hover | 背景 `surface-hover`（Primary は `primary-hover`）、輪郭は `ink-muted` | 影・拡大・移動をしない。touch では発生しない前提で、情報を hover だけに置かない |
| Focus | `focus` の 2px outline、offset 2px | 全要素共通。hover と同時に起きても両方見える |
| Active（押下中） | `surface-pressed` / `primary-active` | 100ms |
| Selected | `primary-subtle` の背景＋チェック / `aria-selected` / `aria-pressed` | 色だけにしない |
| Disabled | 地 `canvas-subtle`、文字 `ink-disabled`、輪郭 `border`、`cursor: not-allowed` | 理由を近くに書く。可能なら無効化しない |
| Loading | スピナー＋文言、`aria-busy`、幅を変えない | 300ms 未満は出さない。取り消しできるなら「取り消す」 |
| Error | `danger` の輪郭（2px 相当）＋アイコン＋文、`aria-invalid` | 入力内容を消さない。再試行の手段を示す |
| Read-only | 地 `canvas-subtle`、輪郭 `border` | 破線にしない（破線は Agent 提案専用） |
| Proposal（未確定） | 1px 破線 `proposal-border`＋「提案」 | Agent の値と下書きだけ |

### コンポーネント別の必須状態

| コンポーネント | Default | Hover | Focus | Active | Selected | Disabled | Loading | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button / Icon Button | ● | ● | ● | ● | Icon Button の pressed | ● | ● | — |
| Text Input / Textarea / Select | ● | ● | ● | — | — | ● | —（外側で表示） | ● |
| Checkbox / Radio / Switch | ● | ● | ● | — | checked / indeterminate | ● | — | ● |
| Tabs / Filter / Navigation | ● | ● | ● | — | ● | ● | — | — |
| Menu item | ● | ● | ● | — | checked | ● | — | —（danger 項目あり） |
| Task Row | ● | ●（ハンドルと操作を表示） | ●（focus-within） | dragging | selected / done / skipped | ● | Estimate の見積中 | 保存エラー |
| Estimate | 値 | — | 編集時 | — | — | — | 見積中 | 推定できません |
| Agent Suggestion | pending | — | 内部の Button | — | accepted / edited / dismissed | — | loading（取り消す） | error（もう一度試す・手入力で続行） |
| Capacity Indicator | ok | — | 可用時間の入力 | — | — | — | — | tight / over / unknown |


---

## Foundations — Responsive

Desktop（Planning）を中心に設計し、スマートフォンでは **Today・タスク完了・タスク追加・Sprint の進捗** を完結させる。

| 幅 | 名前 | レイアウト |
| --- | --- | --- |
| ≥ 1440px | wide | ナビ 224px ＋ Planning 3 ペイン（Backlog 384 / Sprint / Capacity 336） |
| 1200–1439px | wide（rail） | ナビをアイコンだけの `pane-rail` 64px にし、3 ペインを保つ |
| 768–1199px（`bp-medium`〜） | medium | 2 ペイン（Backlog ／ Sprint）。Capacity は Sprint の上に要約 1 行（残り時間＋状態）を sticky 表示し、クリックで右 Drawer |
| < 768px | compact | 1 カラム。下部タブバー（今日 / Sprint / Backlog / 振り返り）。Planning は段階ごとの画面に分ける |

### compact（スマートフォン）の原則
- コントロールは `control-lg` 44px、Task Row は `row-touch` 48px、入力文字は 16px（iOS のズーム回避、bundle.css 対応済み）。
- 画面下に「タスクを追加」の入力（sticky）＋下部タブバー。Floating Action Button を置かない。
- 行の操作メニュー（…）は常に表示する（hover がないため）。ドラッグハンドルは出さず、並べ替えはメニューから。
- Planning は Sprint Header の段階表示を「段階ごとの画面」に変える: ① Backlog を選ぶ → ② Goal を書く → ③ 時間を確認 → ④ 確定。各段階の下部に「次へ」、上部に戻る。desktop と同じく、どの段階にも戻れる。
- Capacity は ② ③ の画面上部に 1 行（「残り −1 〜 1h · 超える可能性」）で常に見せる。
- Dialog は幅 100% − 32px、Drawer は Bottom Sheet（上角 `radius-xl`）。

### medium（タブレット・小さなノート PC）
- Backlog と Sprint の 2 ペイン。Capacity の要約を Sprint ペイン上部に固定し、詳細は Drawer。
- Agent 提案は Capacity Drawer の中に置く（Sprint ペインを狭めない）。

### 変えないもの
- 書体の役割（明朝 / Sans）、色、角丸、破線の意味、Task Row の構造はすべての幅で同じ。
- 情報を幅で消さない。畳む（Drawer・要約）だけ。


---

## Agent UI

AI / Agent は **通常の Product UI の延長** として表現する。別世界（Gradient、Sparkle、紫、Glow、チャットバブル）にしない。区別は **破線・語・根拠の構造** で行う。

### 視覚ルール

| 対象 | 表現 |
| --- | --- |
| Agent 提案（未確定） | 1px 破線 `proposal-border`、ラベル「Agent 提案」（`text-kicker`）、種類（Estimate / Goal / 計画案）、出所（製品内の見積もり支援 / 外部 Agent（MCP））と時刻 |
| 提案された値 | `Estimate source="agent"`（破線枠＋「提案」）または Sans の文。明朝にしない |
| 本人が採用した値 | 実線・ラベルなし。「Agent 提案を採用」の履歴は変更履歴に残す |
| 実績からの参考値（コードが計算） | 「参考」ラベル、実線なし。Agent 提案と混ぜない |
| 根拠 | `AgentRationale`: 根拠 / 不確実な点 / 参照していない情報 |

### 情報構造（例: Estimate）

```
Agent 提案 · Estimate                         製品内の見積もり支援 · 2分前
対象: 評価用データセットを整備する
2–4h  中央 3h  提案      [0 ——[==|==]—————— 8h]
根拠           過去の類似タスク 3件（実績 2h / 2.5h / 4h）、タスクの説明
不確実な点      調査範囲（対象データの件数が未定）
参照していない情報  カレンダーの予定（未接続）
[✓ 採用]  編集して採用  却下
```

### 振る舞い

- **自動で適用しない。** 採用・編集して採用・却下のどれかを本人が選ぶまで、確定値・合計・Sprint 状態を変えない（Capacity に含めるかは「提案を合計に含める」の表示で明示する。既定は提案の幅をそのまま合計に含め、破線セグメントで示す）。
- 採用系のボタンは Secondary、それ以外は Quiet。Primary を使わない（本人の判断を誘導しない）。
- 採用・却下の後は、その場に 1 行の結果（「Estimate 3h を採用しました（Agent 提案 2–4h）· 元に戻す」）を残す。
- 計画案（複数の変更）は `ProposalDiff` で **行ごとに選んで** 反映する。反映しても Sprint は確定しない。計画案作成後に Backlog が変わったら「計画案の作成後に Backlog が変わりました。差分を再確認してください」を Notice（info）で出す。
- データ不足: 幅を広く出し、「類似タスクの履歴がありません」を不確実な点に書く。数値を捏造しない。本人の概算入力を促す。
- 失敗: 「提案を作れませんでした。手入力でそのまま計画を続けられます。」＋「もう一度試す」。Planning を止めない。
- Loading: 「過去の類似タスクを調べています…」＋「取り消す」。
- **参照していないものを参照したように書かない。** 使っていないデータは「参照していない情報」に列挙する。
- confidence（確率）を時間予測の精度として表示しない。「高精度」と書かない。

### 文言

- 「Agent 提案」「提案」「根拠」「不確実な点」「参照していない情報」「採用」「編集して採用」「却下」「元に戻す」で統一する。
- Agent を擬人化しない（「考えています」「おすすめです！」は使わない）。

### やらないこと
- 画面内の汎用チャット、ストリーミング表示の吹き出し、アバター。
- Agent の出力だけ別の書体・別の背景色・グラデーション枠にすること。
- Sparkle アイコン、「AI」バッジの多用。Agent の由来は出所の文字で示す。


---

## Patterns — Sprint Planning

最重要体験。**Backlog を見る → 選ぶ（その場で追加）→ 領域ごとの Goal を書く → Estimate / Chore / 可用時間を確認 → Goal とタスクを調整 → 本人が確定。** どの段階にも戻れる（非線形）。基準画面は Screens の `SprintPlanningScreen`。

### 画面構成（wide）

| 領域 | 密度 | 中身 |
| --- | --- | --- |
| Sprint Header | — | kicker「Sprint Planning」＋ Status Tag「計画中 · 未確定」（破線）、明朝タイトル「Sprint 14」、期間、段階表示、操作（変更履歴 / Agent に計画案を依頼 / **Sprint 14 を確定** = 唯一の Primary） |
| Backlog（左, `canvas-subtle`） | Task density | 件数と選択数、クイック追加、検索、Filter、グループ（持ち越し → Domain 別）、`TaskRow mode="select"` |
| Sprint（中央, `canvas`） | Thinking space | 前回の改善策（reminder）、明朝見出し「今週、何を達成するか」、Domain ごとの `Goal`＋選んだタスク |
| 時間の見通し（右） | Thinking space（狭い） | `CapacityIndicator`（可用時間の入力、残り、内訳）、Agent 提案（Estimate / 計画案） |

### Backlog selection
- **□（Checkbox）= Sprint に入れる。** 選ぶと行が `primary-subtle` になり、中央の該当 Domain に即座に現れ、Capacity が再計算される。Toast「〜を Sprint 14 に入れました · 元に戻す」。
- 最初のグループは「持ち越し · Sprint 13 から」。次に「今週の繰り返し」、その後 Domain 別。期限の近いものは期限表示で目立たせる（並べ替えは Menu から）。
- 一括選択: グループ見出しの Checkbox（indeterminate あり）。
- 選択の解除は中央の行メニュー「今週から外す」でも可能。どちらも Undo 付き。

### Add task during planning
- Backlog 上部の `TaskQuickAdd`: タイトルだけで Enter 追加。Domain は直前に使ったもの（Select で変更）。**Planning を中断しない**（モーダルを開かない）。
- 追加したタスクは選択済みで Sprint に入る（Planning 中に追加する＝今週やる前提）。Estimate は「未見積」で入り、Capacity に「未見積 1件は合計に含まれていません」が出る。
- 詳細（期限・繰り返し・説明）は行の「詳細を編集」から右 Drawer で。
- Backlog が空の初回は、Backlog ペインの代わりにクイック追加を大きく（`control-lg`）表示して始める。

### Define Goal
- Goal は **Domain ごとに任意**。全体 Goal の入力欄は作らない。
- 空の Domain は「+ Goal を書く」とヘルプ「この領域の Goal は任意です。タスクだけでも計画できます。」
- 編集は Sans の Textarea（ラベル「Goal（今週の終わりにどんな状態にしたいか）」、help「〜な状態にする」の形の推奨）。保存すると明朝で表示。
- Goal を書いた後にタスクを入れ替えてよい。Goal に紐づかないタスクには「Goal なし」を小さく示すが、優先度を下げたり除外を促したりしない。
- Agent の Goal 文案は `AgentSuggestion kind="Goal"` で Goal の直下に出す（採用しても Sans → 保存で明朝）。

### Capacity check
- 可用時間は本人が入力（右ペイン上部の入力）。未入力なら状態「可用時間を入力すると、計画との差を表示します。」
- 見積もり合計は幅のまま（`23–25h`）。残りは `−1 〜 1h`。状態は 4 つ: ok（muted）/ tight（warning「上限側では 1h 超える可能性があります。」）/ over（danger「超過 3 〜 5h」）/ unknown。
- 内訳は Domain ごと（Goal のない Domain には「Goal なし」）。未見積は合計に含めず件数を示す。
- 超過していても確定はできる。止めずに、確定 Dialog で再提示する。

### Review Agent proposal
- 「Agent に計画案を依頼」または外部 Agent（MCP）から届いた計画案は、右ペインに `AgentSuggestion kind="計画案"`（要約＋「差分を確認」）で出る。
- 「差分を確認」で右 Drawer（desktop）に `ProposalDiff`: 追加 / 除外 / 変更を行ごとに選び「選んだ 3件を計画に反映」。反映後も Sprint は未確定。Capacity は反映後の値で再計算。
- 計画案の作成後に Backlog が変わった場合は Notice（info）で再確認を促す。

### Confirm Sprint
- Primary「Sprint 14 を確定」（⌘/Ctrl+Enter）→ Dialog（`Dialog size="md"`）で要約: Goal（領域）、タスク件数（うち Goal なし）、見積もり合計、可用時間、注意（tight / over、未見積）。
- ボタン: Secondary「戻って調整」、Primary「Sprint 14 を確定」。初期フォーカスは「戻って調整」。
- 確定後: Toast「Sprint 14 を確定しました」、Status Tag を「実行中」（実線）に、Today へ導線。確定後の変更も可能で、変更履歴に残る（「確定後も変更できます」と Dialog に明記）。


---

## Patterns — Today

日々の実行。スマートフォンで完結すること。基準画面は Screens の `TodayCompactScreen`。

- 上部: kicker「SPRINT 14 · 2日目 / 7日」、明朝の日付「9月29日（火）」、Progress「今週の完了 5 / 18件」（thin でなく通常の 4px）。
- 今週の Goal を明朝 15px で 1〜3 行ずつ（Domain の印付き）。Goal がない Domain は出さない。
- 「今日」リスト: `TaskRow mode="complete"`。**○ = 終える**。完了すると ○ が塗られ、タイトルが `ink-subtle`＋取り消し線、Toast は出さない（静かに）。Undo は同じ ○ をもう一度押す。
- 繰り返しタスクは発生回ごと: 完了 / スキップ（メニュー「今回はスキップ」→ ○ が「−」、「スキップ」表示）。スキップも履歴に残る。
- 「今週の残り」: 件数と時間の幅。タップで今週のタスク一覧を開き、今日やるものを選ぶ（□）。
- 追加: 画面下部の sticky 入力「タスクを追加」＋「追加」。追加先は今日（今週の Sprint に入る）。
- 割り込みの記録: 行メニュー「割り込みメモ」→ 1 行のメモ（Bottom Sheet）。
- desktop の Today も同じ構造を 1 カラム（最大 720px）で表示し、右に Sprint の Goal と Capacity の要約を置く。


---

## Patterns — Sprint Review / Retro

Planning に次ぐ重要体験。**事実を見て、短く振り返り、次に試す変更を 1 つ決める。** Thinking space（明朝の見出しと本文、`space-8`〜`space-12` の余白、読み物レイアウト 720px）。

### Sprint Review
1. Sprint Header（kicker「Sprint Review」、Status「Review」）。
2. `SprintSummary`: Goal の達成（自己判定）/ 完了 / 持ち越し / 計画と実績。**実績は入力済みのものだけ**と明記する。Chore の完了率を Goal 達成の代わりにしない（表に並べない）。
3. Domain ごとの `Goal`（`review` 付き）: Goal 文（明朝）の下に `RadioGroup`「達成 / 一部達成 / 未達」で自己判定。達成だけ success の Tag、一部達成・未達は neutral。全体 Goal の判定は求めない。
4. 持ち越しの一覧: `TaskRow` に「持ち越しの理由」の短い入力（任意）。
5. 計画時間と実績時間の差は、Domain ごとに数値で（グラフで誇張しない）。

### Retro
1. `RetroInsight kind="fact"`: データから言える事実（Sans）。根拠を列挙。
2. `RetroInsight kind="reflection"`: 本人の振り返り（明朝）。Textarea で書き、保存で明朝。
3. `RetroInsight kind="agent"`（任意）: Agent の見立て（破線）。「振り返りに加える / 編集して加える / 却下」。根拠は折りたたみ。
4. `ImprovementAction`: 「次に試す変更」を **1 つだけ** 確定する（下書き → 「改善策として確定」）。
5. 保存すると次の Planning の最上部に `ImprovementAction variant="reminder"` が出る。前回の改善策の結果（続ける / やめる）もここで選ぶ。

### ルール
- 失敗の言葉を使わない（未達・持ち越し・超過は事実として書く）。
- 数値の比較は「計画 27h → 実績 24.5h（入力済み 11件）」の形。割合や点数で個人を評価しない。
- Retro は数分で終えられる量にする。必須は改善策 1 つだけ。


---

## Writing — 用語と表記

| 用語 | 意味 | 表記ルール |
| --- | --- | --- |
| Sprint | 短い期間（既定 1週間）。番号で呼ぶ | 「Sprint 14」。「スプリント」とカタカナにしない |
| Backlog | まだ Sprint に入っていないタスクの置き場 | 「Backlog」 |
| Goal | Domain ごとに「週の終わりにどんな状態にしたいか」 | 「〜な状態にする」「〜を終える」。任意 |
| Domain | Work / Research / Learning / Life などの領域。利用者が定義 | 画面上は Domain 名だけ。「カテゴリ」と呼ばない |
| Estimate | 1 つのタスクを終えるまでの作業時間 | 「3h」「30m」「2–4h」。予定表の空き時間と混同しない |
| 可用時間 | 今週、計画に使える時間の合計（本人が入力） | 「可用時間 24h」 |
| 見積もり合計 | 選んだタスクの Estimate の合計（幅のまま） | 「23–25h」 |
| 残り / 超過 | 可用時間 − 見積もり合計 | 「残り −1 〜 1h」「超過 3 〜 5h」 |
| Chore | Goal に紐づかない定常タスク。時間には含める | 画面では「Goal なし」と表示してよい |
| 持ち越し | 前の Sprint から残ったタスク | 「持ち越し 2回（Sprint 13から）」 |
| 繰り返し | ルールで発生するタスク。発生回ごとに完了 / スキップ | 「毎週 土」「平日 · 今週 2/5」 |
| 確定 | 本人が Sprint の計画を確定すること | 「Sprint 14 を確定」。Agent には使わない |
| Agent 提案 | Agent が作った未確定の値・文・計画案 | 「Agent 提案」「提案」。採用 / 編集して採用 / 却下 |
| 改善策 | Retro で決める「次に試す変更」 | 1 Sprint に 1 つ |

### 日付と時刻
- 日付: 「9/28 (月)」。見出しの日付は「9月29日（火）」（全角括弧）。範囲は「9/28 (月) – 10/4 (日)」。
- 相対: 「あと2日」「今日まで」「2日超過」。「明日」「昨日」は 24 時間以内の記録にだけ。
- 時刻: 24 時間表記「14:02」。「2分前」は 1 時間以内だけ、それ以降は時刻。

### ボタンの文言
- 動詞で終える: 「Sprint 14 を確定」「追加」「保存」「差分を確認」「元に戻す」。
- 「OK」「はい / いいえ」を使わない。確認 Dialog のボタンは結果を書く（「戻って調整」「Sprint 14 を確定」）。


---

## Appendix A — Tokens

### Color

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `canvas` | `#ffffff` | `#1b1b1a` | 紙面。メイン作業領域（Sprint 本体・Today リスト・Review 本文）の地。ほとんどの画面はこの地と罫線だけで成立させる。 |
| `canvas-subtle` | `#f6f6f4` | `#222221` | 二次領域の地。Backlog ペイン、ナビゲーション、表ヘッダー、読み取り専用入力の背景。グルーピングは Card ではなくこの背景差で行う。ベージュではなく無彩に近いニュートラル。 |
| `surface` | `#ffffff` | `#262625` | 意味的に独立した面（Dialog / Drawer / Popover / Menu / Toast）の背景。必ず border と組み合わせる。単なるグルーピングには使わない。 |
| `surface-hover` | `#efefec` | `#2f2f2d` | 行・Quiet ボタン・メニュー項目の hover 背景。canvas / canvas-subtle / surface いずれの上でも使う。 |
| `surface-pressed` | `#e6e6e2` | `#383835` | 押下中（:active）の背景。hover より一段濃い。 |
| `surface-inverse` | `#2b2b29` | `#e9e9e4` | Tooltip とキーボードショートカット表示の背景。これ以外には使わない。文字は ink-inverse。 |
| `ink` | `#2b2b29` | `#ebebe6` | 本文・見出し・タスク名。純黒は使わない。canvas / canvas-subtle / surface / surface-hover / primary-subtle 上で 4.5:1 以上（light 14.2:1）。 |
| `ink-muted` | `#5b5b56` | `#b8b8b1` | 二次テキスト：ラベル補足、Help、メタ情報、非選択のタブ。上記すべての地で 4.5:1 以上。 |
| `ink-subtle` | `#6a6a64` | `#a0a099` | 三次テキスト：件数、タイムスタンプ、完了済みタスク名、プレースホルダー。上記すべての地で 4.5:1 以上（light canvas-subtle 上 5.0:1）。これより薄いテキスト色は作らない。 |
| `ink-disabled` | `#a8a8a2` | `#696964` | 無効状態のテキストとアイコンのみ（WCAG のコントラスト要件対象外）。情報を伝える文字には使わない。 |
| `ink-inverse` | `#ffffff` | `#1b1b1a` | surface-inverse 上の文字（Tooltip）。 |
| `border` | `#dcdcd7` | `#3b3b38` | 構造の罫線：ペイン境界、ヘッダー下の罫、Dialog / Popover の外枠、セクション区切り。装飾ではなく構造を示す主役。 |
| `border-soft` | `#ebebe7` | `#2f2f2d` | リスト内の行区切り（Task Row 間）、同一グループ内の細い区切り。border より一段弱い。 |
| `border-strong` | `#8a8a84` | `#7d7d77` | 操作できる部品の輪郭：Text Input / Select / Checkbox / Radio / Switch / Secondary Button。canvas・canvas-subtle・surface 上で 3:1 以上（非テキストのコントラスト要件）。 |
| `primary` | `#2a4a6e` | `#a3bfe2` | 唯一の Primary（ブルーブラック）。Primary Button の塗り、Checkbox / Radio / Switch のオン、選択中の印、Progress の塗り、リンク文字。1 画面で Primary Button は 1 つまで。as text: canvas 上 9.1:1。 |
| `primary-hover` | `#223d5b` | `#b7cdea` | Primary Button の hover。 |
| `primary-active` | `#1b3149` | `#cad9ef` | Primary Button の押下中。 |
| `primary-subtle` | `#edf1f6` | `#233142` | 選択状態の背景：Sprint に入れた Backlog 行、選択中の Filter、選択中のメニュー項目。ink / ink-muted / ink-subtle / primary を上に置いても 4.5:1 以上。 |
| `on-primary` | `#ffffff` | `#14202d` | primary / primary-hover / primary-active の塗りの上の文字とアイコン。dark では暗色になる（白を直書きしない）。 |
| `link` | `{primary}` | `{primary}` | テキストリンク。primary のエイリアス。下線を常に付ける（色だけでリンクを示さない）。 |
| `focus` | `#3269b0` | `#82b3f0` | キーボードフォーカスのリング（outline 2px + offset 2px）。canvas / canvas-subtle / surface / primary-subtle 上で 3:1 以上。選択（primary-subtle）と区別できるよう primary より明るい青にしている。 |
| `success` | `#2d6a45` | `#82c79a` | 成功・完了・達成の文字とアイコン。必ずアイコンか語（「達成」「保存しました」）を伴う。すべての地と success-subtle 上で 4.5:1 以上。Domain color と混同しないため四角マーカーには使わない。 |
| `success-subtle` | `#ebf3ed` | `#1e2e24` | success の Status Tag / Notice の背景。面積を広げない。 |
| `warning` | `#855800` | `#e3b95e` | 注意：容量の上限超過の可能性、期限が近い、持ち越し 3 回以上。文字・アイコン・細い印に使う。必ず語を伴う。すべての地と warning-subtle 上で 4.5:1 以上。 |
| `warning-subtle` | `#faf2de` | `#322916` | warning の Status Tag / Notice の背景。 |
| `danger` | `#b02a22` | `#f2918a` | エラー、期限超過、確定的な容量超過、破壊的操作。必ずアイコンと語を伴う。すべての地と danger-subtle 上で 4.5:1 以上。 |
| `danger-subtle` | `#fbeceb` | `#3a2321` | danger の Status Tag / Notice の背景。 |
| `on-danger` | `#ffffff` | `#1b1b1a` | danger の塗り（破壊的操作の確認ボタン）上の文字。 |
| `info` | `#2f5f94` | `#94b9e6` | 中立的なお知らせ（例：データ不足の説明、同期状態）。文字・アイコン。すべての地と info-subtle 上で 4.5:1 以上。 |
| `info-subtle` | `#ecf2f8` | `#1f2b3a` | info の Notice の背景。 |
| `domain-work` | `#a45f36` | `#d69b74` | Domain: Work（弁柄）。8px 四角の Domain Mark、Capacity バーのセグメント、Filter の印にのみ使う。文字色・面の塗りには使わない。すべての地で 3:1 以上。 |
| `domain-research` | `#2d7773` | `#6dbcb6` | Domain: Research（青磁の濃色）。用途は domain-work と同じ。 |
| `domain-learning` | `#7b5a8e` | `#bd9dcd` | Domain: Learning（葡萄）。用途は domain-work と同じ。紫だが AI 表現には使わない。 |
| `domain-life` | `#687a2c` | `#abba6c` | Domain: Life（苔）。用途は domain-work と同じ。 |
| `domain-5` | `#a8526a` | `#dc8fa3` | ユーザー定義 Domain の 5 番目（臙脂）。 |
| `domain-6` | `#5a6d88` | `#9dafc6` | ユーザー定義 Domain の 6 番目（鉄紺）。 |
| `domain-7` | `#7a6a58` | `#b5a48f` | ユーザー定義 Domain の 7 番目（煤竹）。 |
| `domain-none` | `#8a8a84` | `#8f8f89` | Domain 未設定 / Inbox、Chore 合計のセグメント。 |
| `proposal-border` | `{border-strong}` | `{border-strong}` | Agent 提案・未確定値の破線（1px dashed）。破線は「まだ本人が確定していない」ことだけを意味する。border-strong のエイリアス。 |
| `scrim` | `#1f1f1d52` | `#000000a3` | Dialog / モーダル Drawer の背後の暗幕。Blur は使わない。 |

### Type

| Style | Family | Size / LH | Weight | Letter spacing | Usage |
| --- | --- | --- | --- | --- | --- |
| `text-display-l` | serif | 32px / 44px | 500 | 0.02em | Sprint Header のタイトル。1 画面に 1 つ。 |
| `text-display-m` | serif | 24px / 36px | 500 | 0.02em | 考える領域のセクション見出し（Goal 群、Review、Retro）。 |
| `text-goal` | serif | 18px / 30px | 500 | 0.02em | 確定した Goal 文、Improvement Action の本文。編集中は Sans の Textarea に戻す。 |
| `text-reflection` | serif | 16px / 30px | 400 | 0.02em | Review 要約と Retro の振り返り本文。1 行 38 字程度（measure-read）で組む。 |
| `text-heading` | sans | 16px / 24px | 600 | 0 | ペイン見出し、Dialog / Drawer のタイトル。 |
| `text-subheading` | sans | 14px / 20px | 600 | 0 | リスト内のグループ見出し、Popover のタイトル。 |
| `text-body-l` | sans | 16px / 28px | 400 | 0.02em | 考える領域の説明文、Dialog の説明、compact 幅での入力文字（iOS のズーム回避）。 |
| `text-body` | sans | 14px / 22px | 400 | 0.01em | UI の標準テキスト。desktop の入力文字、メニュー、説明。 |
| `text-task` | sans | 14px / 20px | 400 | 0 | Task Row のタイトル。1 行のリズムを優先した行間。 |
| `text-label` | sans | 13px / 20px | 600 | 0 | フォームのラベル、ボタン以外の操作ラベル。 |
| `text-help` | sans | 13px / 20px | 400 | 0 | Help テキストとエラーメッセージ。 |
| `text-meta` | sans | 12px / 16px | 400 | 0 | Task Metadata、タイムスタンプ、件数。最小サイズ。これより小さい文字は使わない。 |
| `text-kicker` | sans | 12px / 16px | 500 | 0.04em | タイトル上の小見出し、Agent 提案ラベル、段階表示。欧文は大文字可、和文はそのまま。 |
| `num-l` | sans | 24px / 32px | 500 | 0 | Capacity の残り時間、Sprint Summary の主要値。Hero 数字にはしない。 |
| `num-m` | sans | 16px / 24px | 500 | 0 | 合計値、Estimate 編集欄。 |
| `num-s` | sans | 12px / 16px | 500 | 0 | Task Row の Estimate、件数。 |
| `text-code` | mono | 12px / 16px | 400 | 0 | キーボードショートカット表示（kbd）のみ。 |

Families: `--font-sans`: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, system-ui, sans-serif; `--font-serif`: "Zen Old Mincho", "Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif; `--font-mono`: ui-monospace, "SF Mono", Menlo, Consolas, monospace

### spacing

| Token | Value | Usage |
| --- | --- | --- |
| `space-1` | `4px` | アイコンとラベルの間、ラベルと入力の間。 |
| `space-2` | `8px` | コントロール内部、メタ情報どうし、Task Row の上下 padding。 |
| `space-3` | `12px` | コントロールと行の左右 padding、関連するフィールド間。 |
| `space-4` | `16px` | Task density のペイン padding、フォームのフィールド間。 |
| `space-5` | `20px` | Thinking space のブロック内部の間隔。 |
| `space-6` | `24px` | Thinking space のペイン padding、Dialog の左右 padding。 |
| `space-8` | `32px` | Goal と Goal の間、考える領域のセクション間。 |
| `space-10` | `40px` | ページヘッダーの上下余白。 |
| `space-12` | `48px` | Review / Retro の大セクション間。 |
| `space-16` | `64px` | Retro の読み物レイアウトの上端余白。最大値。 |

### radius

| Token | Value | Usage |
| --- | --- | --- |
| `radius-xs` | `2px` | Checkbox、Domain Mark、Progress、Switch のつまみ、Estimate の提案枠。 |
| `radius-s` | `4px` | Button、Icon Button、Text Input、Select、Textarea、Switch のトラック、Tooltip、メニュー項目。 |
| `radius-m` | `6px` | Popover、Menu、Toast、Agent Suggestion。 |
| `radius-l` | `8px` | Dialog、Drawer の開放側の角。これが通常 UI の最大。 |
| `radius-xl` | `12px` | compact 幅の Bottom Sheet 上角のみ。 |
| `radius-pill` | `9999px` | Filter、Tag（Status を含む）、Radio、完了サークルのみ。Button には使わない。 |

### stroke

| Token | Value | Usage |
| --- | --- | --- |
| `stroke-hairline` | `1px` | すべての罫線・枠線・行区切り・破線（Agent 提案）。 |
| `stroke-strong` | `2px` | フォーカスリング、選択中タブの下線、Capacity の可用時間マーカー、編集的なセクション罫。 |

### shadow

| Token | Value | Usage |
| --- | --- | --- |
| `elevation-0` | `none` | 既定。ほぼすべての要素。 |
| `elevation-overlay` | `light: 0 1px 2px #1f1f1d14, 0 6px 16px #1f1f1d14 / dark: 0 1px 2px #00000066, 0 6px 16px #00000066` | Menu、Popover、Toast、非モーダル Drawer。border と併用。 |
| `elevation-modal` | `light: 0 2px 6px #1f1f1d14, 0 16px 40px #1f1f1d24 / dark: 0 2px 6px #00000080, 0 16px 40px #00000099` | Dialog、モーダル Drawer、Bottom Sheet。scrim と併用。 |
| `elevation-drag` | `light: 0 2px 8px #1f1f1d24 / dark: 0 2px 8px #000000a3` | ドラッグ中の Task Row のみ。 |

### size

| Token | Value | Usage |
| --- | --- | --- |
| `control-sm` | `28px` | Small Button、Filter、行内の Icon Button（見た目）。desktop のみ。 |
| `control-md` | `36px` | 標準の Button、Text Input、Select。 |
| `control-lg` | `44px` | compact 幅のすべてのコントロール、Dialog の確定ボタン。 |
| `row-task` | `40px` | Task Row（1 行）の最小高さ。2 行（メタ情報付き）は 52px 前後になる。 |
| `row-touch` | `48px` | compact 幅（Today など）の Task Row の最小高さ。 |
| `target-min` | `24px` | pointer 環境の最小ターゲット（WCAG 2.2 2.5.8）。 |
| `target-touch` | `44px` | touch 環境の最小ターゲット。 |
| `icon-s` | `16px` | テキスト 12–14px に並ぶアイコン。 |
| `icon-m` | `20px` | ボタン・ナビゲーションのアイコン。 |
| `domain-mark` | `8px` | Domain Mark の一辺。 |
| `pane-nav` | `224px` | ナビゲーション幅（1440px 以上）。 |
| `pane-rail` | `64px` | アイコンだけのナビゲーション幅（1200–1439px、ラベルは Tooltip）。 |
| `pane-list` | `384px` | Planning の Backlog ペイン幅。 |
| `pane-side` | `336px` | Planning の Capacity ペイン幅。Drawer は 400px。 |
| `measure-read` | `38em` | 明朝本文（Review / Retro）の最大行長。約 38 字。 |

### duration

| Token | Value | Usage |
| --- | --- | --- |
| `duration-fast` | `100ms` | hover / press の色変化、Checkbox の切り替え。 |
| `duration-base` | `160ms` | Menu・Popover・Tooltip の出現、行の追加・除外。 |
| `duration-slow` | `240ms` | Dialog・Drawer の出入り。これより長い動きは作らない。 |
| `duration-toast` | `8000ms` | Toast の表示時間。hover / focus 中は止める。操作を含む Toast は閉じるまで残してもよい。 |

### easing

| Token | Value | Usage |
| --- | --- | --- |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 既定の状態変化。 |
| `easing-enter` | `cubic-bezier(0, 0, 0.2, 1)` | 出現（減速）。 |
| `easing-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 退場（加速）。 |

### layer

| Token | Value | Usage |
| --- | --- | --- |
| `layer-sticky` | `10` | 固定ヘッダー、compact 幅の下部タブバー・追加バー。 |
| `layer-drawer` | `30` | Drawer。 |
| `layer-popover` | `40` | Menu、Popover。 |
| `layer-dialog` | `50` | Dialog と scrim。 |
| `layer-toast` | `60` | Toast。 |
| `layer-tooltip` | `70` | Tooltip。 |

### breakpoint

| Token | Value | Usage |
| --- | --- | --- |
| `bp-medium` | `768px` | これ未満が compact（スマートフォン）：1 カラム、下部タブバー、44px ターゲット。 |
| `bp-wide` | `1200px` | これ以上が wide：Planning を 3 ペイン（Backlog / Sprint / Capacity）で同時表示。 |

---

## Appendix B — Components

### AgentRationale

Agent 提案の根拠を「根拠 / 不確実な点 / 参照していない情報」の 3 行で示す。

#### Variants

| Variant | 用途 |
| --- | --- |
| columns（既定） | 左に項目名、右に内容 |
| stacked | 狭い場所で縦積み |
| collapsible | 「根拠を見る」で開閉（Retro の Agent の見立て） |

#### Usage

**使う**

- AgentSuggestion、RetroInsight（agent）

#### Do / Don't

- ✓ 根拠がないときは「根拠となるデータがありません」と書く
- ✗ confidence を % で出す
- ✗ 「高精度」と書く

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.AgentRationale, { basedOn: [], uncertainty: [], notUsed: [], layout: 'columns' | 'stacked', collapsible, defaultOpen })
```


### AgentSuggestion

Agent の提案（Estimate・Goal 案・計画案）を、本人が確認・編集・確定するための面。破線と「Agent 提案」の語で本人の値と区別する。

#### Anatomy

1. 破線の枠（`proposal-border`、`radius-m`、`surface`）
2. ヘッダー: 「Agent 提案」（`text-kicker`）・種類・出所と時刻
3. 対象（「対象: 評価用データセットを整備する」）
4. 提案の値（EstimateRange / Estimate agent / Sans の文）
5. AgentRationale（根拠・不確実な点・参照していない情報）
6. 操作: 採用（Secondary）/ 編集して採用（Quiet）/ 却下（Quiet）

#### States

| 状態 | 表現 |
| --- | --- |
| pending | 操作 3 つ |
| loading | 「過去の類似タスクを調べています…」＋取り消す |
| insufficient | データ不足。幅を広く、不確実な点に理由 |
| error | 「提案を作れませんでした。手入力でそのまま計画を続けられます。」＋もう一度試す |
| accepted / edited / dismissed | 実線・`canvas-subtle` の 1 行＋元に戻す |

#### Usage

**使う**

- Estimate の提案、Goal 文案、外部 Agent の計画案の入口（`actions` で「差分を確認」）

**使わない**

- チャット形式の応答
- 自動適用

#### Do / Don't

- ✓ 出所を書く（製品内の見積もり支援 / 外部 Agent（MCP））
- ✓ compact（狭いペイン）では根拠を縦積み
- ✗ Primary で採用を誘導
- ✗ Sparkle・紫・グラデーション
- ✗ 参照していないデータを根拠に書く

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.AgentSuggestion, { kind: 'Estimate', target, source, time, state, value, text, rationale: { basedOn, uncertainty, notUsed }, onAccept, onEdit, onDismiss, onUndo, onRetry, onCancel, acceptLabel, compact, actions, resolvedText })
```


### Button

操作を実行するボタン。既定は Secondary で、Primary は 1 画面に 1 つだけ。

#### Anatomy

1. コンテナ（高さ `control-md` 36px、`radius-s`、1px 枠）
2. 先頭アイコン（任意、16px）
3. ラベル（Sans 14px / 500、動詞で終える）
4. 末尾アイコン（任意、`chevron-down` など）

#### Variants

| Variant | 用途 |
| --- | --- |
| primary | 画面の主操作 1 つ（「Sprint 14 を確定」）。塗り `primary`、文字 `on-primary` |
| secondary（既定） | 通常の操作。`surface` + `border-strong` の枠 |
| quiet | 補助操作（キャンセル、編集して採用、却下）。枠なし |
| danger | 取り消せない / 影響の大きい操作の入口（アーカイブ）。`danger` の枠と文字 |
| danger-solid | 破壊的操作の確認 Dialog の実行ボタンのみ |
| size sm / md / lg | 28 / 36 / 44px。sm は行内・Popover、lg は compact 幅と Bottom Sheet |

#### States

| 状態 | 表現 |
| --- | --- |
| Hover | `surface-hover`（primary は `primary-hover`） |
| Focus | `focus` 2px outline、offset 2px |
| Active | `surface-pressed` / `primary-active` |
| Disabled | `canvas-subtle` の地、`ink-disabled`。理由を近くに書く |
| Loading | 先頭にスピナー、ラベルを「確定中…」などに。`aria-busy`、クリック無効、幅は保つ |

#### Usage

**使う**

- 画面遷移ではなく「操作」を実行するとき
- 確認 Dialog の選択肢（結果を書いたラベルで）

**使わない**

- 画面の移動（リンクを使う）
- Filter や Tag の代わり
- Agent 提案の採用を Primary で誘導すること

#### Do / Don't

- ✓ ラベルは結果が分かる動詞（「Sprint 14 を確定」「差分を確認」）
- ✓ Primary は右端、Secondary / Quiet はその左
- ✓ compact 幅では `size="lg"`
- ✗ Pill 型にする、影を付ける、グラデーションにする
- ✗ 「OK」「はい」
- ✗ 1 画面に Primary を 2 つ以上置く
- ✗ アイコンだけの Button（→ IconButton）

#### Accessibility

- `<button type="button">`。送信は `type="submit"`
- ショートカットがある場合は Tooltip に Kbd で示す

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Button, { variant: 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-solid', size: 'sm' | 'md' | 'lg', icon, iconAfter, loading, loadingLabel, disabled, onClick }, 'Sprint 14 を確定')
```


### CapacityIndicator

可用時間と見積もり合計の差を、幅のまま正確に示す。Planning の「残り時間はいくらか」に答える部品。

#### Anatomy

1. 残り（最上段、`num-l`。超過時は「超過」`danger`）
2. 可用時間（本人が入力）と見積もり合計（幅）
3. 状態の文（アイコン＋語）
4. バー: Domain ごとのセグメント（8px、Domain 色）＋提案の幅（破線）＋残り（`border-soft`）＋可用時間マーカー（`ink` 2px）＋超過部分の下線（`danger`）
5. 内訳（Domain・Goal なし・時間）
6. 未見積の件数（合計に含めない）

#### States

| 状態 | 表現 |
| --- | --- |
| ok | 「可用時間の範囲に収まっています。」`ink-muted` |
| tight | 上限側だけ超える: `warning`「上限側では 1h 超える可能性があります。」 |
| over | 下限でも超える: `danger`「超過 3 〜 5h」 |
| unknown | 可用時間が未入力: 「可用時間を入力すると、計画との差を表示します。」 |

#### Usage

**使う**

- Planning の右ペイン、medium 幅の Sprint 上部の要約、Confirm Dialog の要約

**使わない**

- ドーナツ・円グラフ、ゲージ

#### Do / Don't

- ✓ 幅のある見積もりは幅のまま合計する
- ✓ 超過でも確定を止めない
- ✗ 未見積を 0h として足す
- ✗ バーを太く・カラフルにする

#### Accessibility

- バーは `aria-hidden`。数値と状態の文が正（`role="status"`）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.CapacityIndicator, { available: 24, editable, onAvailableChange, segments: [{ domain, hours } | { domain, min, max, goal: false }], chore: { hours }, unestimatedCount, showList })
```


### CarryOverIndicator

前の Sprint から持ち越したことを示す。失敗ではなく判断材料として出す。

#### Variants

| Variant | 用途 |
| --- | --- |
| 1〜2回 | `corner-down-right`＋「持ち越し 1回（Sprint 13から）」`ink-muted` |
| 3回以上 | `warning`＋「持ち越し 3回 · 分割を検討」 |

#### Usage

**使う**

- TaskMetadata、Backlog の「持ち越し」グループ

#### Do / Don't

- ✗ danger 色、「遅れ」「失敗」の語

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.CarryOverIndicator, { count: 1, from: 'Sprint 13' })
```


### Checkbox

□ は「選ぶ」。Backlog のタスクを Sprint に入れる、設定をオンにする、複数選択に使う。

#### Anatomy

1. 当たり判定 24px（compact 44px）
2. 16px の四角（`radius-xs`、`border-strong`）
3. チェック / 一部選択（−）
4. ラベル（任意で説明）

#### States

| 状態 | 表現 |
| --- | --- |
| Checked | `primary` の塗り＋`on-primary` のチェック |
| Indeterminate | `primary` の塗り＋横線（グループの一部選択） |
| Hover | 枠 `ink-muted` |
| Focus | 四角に共通リング |
| Disabled | `canvas-subtle`、ラベル `ink-disabled` |
| Invalid | 枠 `danger`＋外側のエラー文 |

#### Usage

**使う**

- Backlog の選択（`TaskRow mode="select"`）
- ProposalDiff の行ごとの反映
- フォームの同意・オプション

**使わない**

- タスクの完了（→ ○ の完了サークル）
- 即時に反映される設定（→ Switch）

#### Do / Don't

- ✓ 行内ではラベルを視覚的に隠し「Sprint に入れる: タスク名」を読ませる
- ✗ □ と ○ の意味を入れ替える

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Checkbox, { label, description, checked, defaultChecked, indeterminate, disabled, invalid, hideLabel, onChange })
```


### Deadline

期限を日付＋曜日＋相対表現で示す。近い・超過は色だけでなく語とアイコンで伝える。

#### Variants

| Variant | 用途 |
| --- | --- |
| upcoming | `calendar`＋「10/5 (月)」`ink-muted` |
| soon（2日以内） | `clock`＋「あと2日」`warning` |
| today | `clock`＋「今日まで」`warning` |
| overdue | `circle-alert`＋「2日超過」`danger` |

#### Usage

**使う**

- TaskMetadata

**使わない**

- 期限のないタスクに「—」を表示すること（何も出さない）

#### Do / Don't

- ✗ 日付の色だけで超過を示す

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Deadline, { date: '2026-10-02', today: '2026-09-26', status })
```


### Dialog

作業を止めて確認・決定を求めるモーダル。Sprint の確定、破壊的操作の確認にだけ使う。

#### Anatomy

1. scrim（`scrim`、Blur なし）
2. 面（最大 440 / 560 / 720px、`radius-l`、`elevation-modal`）
3. タイトル（Sans 16px / 600、問いの形）＋説明
4. 本文（要約・注意）
5. フッター（`border-soft` の罫、右寄せ: Secondary → Primary）

#### Variants

| Variant | 用途 |
| --- | --- |
| sm / md / lg | 440 / 560 / 720px |

#### States

| 状態 | 表現 |
| --- | --- |
| Open | フォーカスを最も安全な操作へ（確定では「戻って調整」） |
| Close | Esc、閉じる、Secondary。フォーカスを呼び出し元へ |

#### Usage

**使う**

- Sprint を確定
- アーカイブ・削除の確認

**使わない**

- 情報の表示だけ（→ インライン / Notice）
- 長い編集（→ Drawer）
- 操作のたびに確認する

#### Do / Don't

- ✓ ボタンは結果を書く（「Sprint 14 を確定」）
- ✓ 取り消せない場合だけ `danger-solid`
- ✗ 「本当によろしいですか？」
- ✗ Dialog を重ねる

#### Accessibility

- `role="dialog"`（破壊的確認は `alertdialog`）、`aria-modal`、フォーカストラップ

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Dialog, { open, title, description, onClose, size: 'sm' | 'md' | 'lg', actions: h(React.Fragment, null, secondaryBtn, primaryBtn) }, children)
```


### Divider

罫線。Card の代わりにグループを区切る、構造の主役。

#### Variants

| Variant | 用途 |
| --- | --- |
| default | `border`: ペイン・セクションの区切り |
| soft | `border-soft`: リスト内 |
| rule | `ink` 1px: 考える領域のセクション上端（編集的な罫。1 画面に 1〜2 本） |
| label | ラベル付き（「持ち越し · Sprint 13 から」）。リストのグループ見出し |

#### Usage

**使う**

- グループ・セクションの区切り

**使わない**

- 同じ場所に余白と罫を二重に使うこと

#### Do / Don't

- ✓ Card で囲む前に Divider と余白で足りないか考える
- ✗ 2px 以上の太い罫、二重線、点線

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Divider, { variant: 'default' | 'soft' | 'rule', label })
```


### DomainIndicator

Domain を 8px の四角い印とラベルで示す。色は印にだけ使う。

#### Variants

| Variant | 用途 |
| --- | --- |
| label（既定） | 印＋名前（12px / 500、`ink-muted`） |
| mark | 印だけ（名前は視覚的に隠して読ませる。凡例がある場所のみ） |
| heading | グループ見出し（14px / 600、`ink`）＋件数 |

#### Usage

**使う**

- Goal の見出し、グループ見出し、Filter、Capacity の内訳

**使わない**

- 文字色・背景・枠線を Domain 色にする

#### Do / Don't

- ✓ 四角（`radius-xs`）で描く。丸は Semantic / Radio / 完了と紛らわしい
- ✗ 印を 8px より大きくする
- ✗ 色だけで Domain を示す

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.DomainIndicator, { domain: 'work' | 'research' | 'learning' | 'life' | '5' | '6' | '7' | 'none', label, variant: 'label' | 'mark' | 'heading', count })
```


### Drawer

画面の文脈を残したまま詳細を編集する側面パネル。compact 幅では Bottom Sheet。

#### Anatomy

1. 面（右 400px、左に `border`）
2. ヘッダー（タイトル＋閉じる、下に `border-soft`）
3. 本文（フォーム、スクロール）
4. フッター（キャンセル / 保存）

#### Variants

| Variant | 用途 |
| --- | --- |
| right | desktop: タスクの詳細、計画案の差分、medium 幅の Capacity |
| bottom | compact: タスク追加・編集（上角 `radius-xl`、グリップ） |
| modal | 背後を操作させない場合だけ（scrim あり） |

#### States

| 状態 | 表現 |
| --- | --- |
| Open / Close | `duration-slow` で 16px スライド。reduced motion で即時 |

#### Usage

**使う**

- タスクの詳細編集
- ProposalDiff の確認

**使わない**

- 短い確認（→ Dialog）

#### Do / Don't

- ✓ 非モーダルを既定にし、背後の Planning を見ながら編集できるようにする
- ✗ Drawer の中に Drawer

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Drawer, { open, title, onClose, side: 'right' | 'bottom', modal, footer }, children)
```


### Estimate

タスクを終えるまでの作業時間。本人の値、Agent 提案、実績からの参考値を見た目と語で区別する。

#### Anatomy

1. 値（`num-s` / size m は `num-m`、tabular）
2. 出所ラベル（「提案」「参考」）
3. 提案の破線枠（`proposal-border`、`radius-xs`）

#### Variants

| Variant | 用途 |
| --- | --- |
| user（既定） | 「3h」実線・ラベルなし |
| agent | 「提案 2–4h」破線枠。未確定 |
| history | 「参考 2.5h」実績からコードが計算した値 |
| unset | 「未見積」（0h と書かない） |
| size m | 編集欄・Agent 提案の値 |

#### States

| 状態 | 表現 |
| --- | --- |
| Loading | スピナー＋「見積中」 |
| Error | 「推定できません」（手入力を促す） |

#### Usage

**使う**

- TaskRow の右端、Popover の編集、Agent 提案

**使わない**

- 予定表の空き時間・Sprint 全体のキャパシティ（→ CapacityIndicator）

#### Do / Don't

- ✓ 1h 未満は分（30m）、それ以上は h（1.5h）、範囲は en dash（2–4h）
- ✗ Agent の値を実線で表示する
- ✗ 「約」「〜くらい」と書く（範囲で示す）

#### Accessibility

- 「見積もり 3時間」「Agent の提案（未確定）: 2〜4時間」と読ませる

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Estimate, { value: 3 } | { min: 2, max: 4, source: 'agent' } | { value: 2.5, source: 'history' } | { state: 'unset' | 'loading' | 'error' }, size: 's' | 'm')  // helpers: PersonalSprint.formatHours / formatRange / formatTotal
```


### EstimateRange

Estimate の幅を 0〜8h の目盛り上の帯で見せる。Agent 提案の不確かさを誇張せず正確に伝える。

#### Anatomy

1. 数値（「2–4h」＋「中央 3h」＋出所）
2. 目盛り（1h ごとの `border` の刻み）
3. 帯（提案は破線＋`primary-subtle`、本人は実線 `primary`）
4. 中央値のマーカー（`ink` 2px）
5. 目盛りの数値（0 / 4h / 8h）

#### Usage

**使う**

- Agent Suggestion（Estimate）の値
- タスク詳細での本人の幅入力

**使わない**

- 行内（→ Estimate）

#### Do / Don't

- ✓ 同じ値を数値でも必ず示す
- ✗ 確率・confidence を % で出す

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.EstimateRange, { min: 2, max: 4, point: 3, scaleMax: 8, source: 'agent' | 'user', note })
```


### Filter

リストを絞り込むトグル。Pill を使ってよい数少ない部品。

#### Anatomy

1. Pill（28px、`border`）
2. 選択時のチェック
3. 任意の Domain Mark
4. ラベル
5. 件数

#### States

| 状態 | 表現 |
| --- | --- |
| Selected | `primary-subtle` の地、`primary` の枠、チェック（`aria-pressed`） |
| Hover | `surface-hover` |
| Focus | 共通リング |
| Disabled | 件数 0 のとき |

#### Usage

**使う**

- Backlog の Domain・条件（期限あり / 持ち越し / 未見積）

**使わない**

- 1 つだけ選ぶ切り替え（→ Tabs）
- タスクの属性表示（→ TaskMetadata）

#### Do / Don't

- ✓ 件数を付け、0 件は disabled
- ✗ Filter を Button として使う

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Filter, { label, selected, count, domain, onClick, disabled })
```


### Goal

Domain ごとの「週の終わりにどんな状態にしたいか」。確定した Goal は明朝で清書し、編集中は Sans に戻す。

#### Anatomy

1. 上端の罫（`border`）
2. 見出し: DomainIndicator heading ＋ タスク数と時間 ＋ 判定 Tag（Review）＋ 編集
3. Goal 文（`text-goal` 明朝 18/30、`measure-read`）
4. 子要素: その Domain の選んだタスク（TaskRow）

#### Variants

| Variant | 用途 |
| --- | --- |
| set | 確定した Goal |
| empty | 「+ Goal を書く」＋「この領域の Goal は任意です。」 |
| editing | Textarea（Sans）＋保存 / キャンセル |
| review | 判定 Tag: 達成（success）/ 一部達成・未達（neutral） |

#### Usage

**使う**

- Planning の中央、Today の上部（簡略表示）、Review

**使わない**

- 全体 Goal を作る
- Card で囲む

#### Do / Don't

- ✓ Goal の間は `space-8`、罫と余白で区切る
- ✓ Agent の Goal 案は直下に AgentSuggestion で
- ✗ Goal がない Domain を警告色で示す
- ✗ Goal 文を太字・大見出しにする

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Goal, { domain, label, text, state: 'set' | 'empty' | 'editing', review: 'achieved' | 'partial' | 'missed', taskCount, hours, onEdit, onAdd, onSave, onCancel, draft }, taskRows)
```


### Icon

Lucide の線アイコン。16px（stroke 1.75）と 20px（stroke 1.5）、文字と同じ色。

#### Usage

**使う**

- 状態・操作の種類の補助（Iconography セクションの対応表に従う）

**使わない**

- 見出しの飾り
- Domain の代わり
- Sparkle などの AI 表現

#### Accessibility

- 既定で `aria-hidden`。単独で意味を持つときだけ `label`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Icon, { name: 'repeat', size: 16, label })  // 同梱: check plus minus x chevron-* calendar clock repeat corner-down-right search list-filter ellipsis triangle-alert circle-alert circle-check info undo-2 pencil trash-2 grip-vertical sun list history settings arrow-right loader-circle circle-dashed skip-forward inbox calendar-days rotate-ccw panel-right circle-slash archive target book-open
```


### IconButton

アイコンだけで操作を示すボタン。ラベルは必須で、hover / focus 時に Tooltip で表示する。

#### Anatomy

1. コンテナ（36px または 28px の正方形、`radius-s`）
2. アイコン（20px / 16px、`ink-muted`）
3. Tooltip（ラベル、任意でショートカット）

#### Variants

| Variant | 用途 |
| --- | --- |
| quiet（既定） | 行内・ヘッダーの補助操作（…、編集、閉じる） |
| secondary | 枠付き。単独で置くとき |
| pressed | トグル（Capacity ペインの表示など）。`primary-subtle` + `primary` |
| size sm | 行内・Popover の閉じる |

#### States

| 状態 | 表現 |
| --- | --- |
| Hover | `surface-hover`、アイコン `ink` |
| Focus | 共通フォーカスリング |
| Pressed | `aria-pressed="true"` |
| Disabled | アイコン `ink-disabled` |

#### Usage

**使う**

- 意味が広く共有されたアイコン（閉じる、…、編集、検索）
- スペースが限られた行内

**使わない**

- 意味が曖昧な操作（ラベル付き Button にする）
- 主操作

#### Do / Don't

- ✓ `label` に動作を書く（「Goal を編集」）
- ✗ Tooltip を消す
- ✗ 同じ行に 3 つ以上並べる（Menu にまとめる）

#### Accessibility

- `aria-label` = label。Tooltip は `describe={false}` で重複読み上げしない
- ターゲット 28px 以上（compact は 44px）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.IconButton, { icon: 'pencil', label: 'Goal を編集', variant: 'quiet' | 'secondary', size: 'sm' | 'md', pressed, shortcut, onClick })
```


### ImprovementAction

Retro で決める「次に試す変更」。1 Sprint に 1 つ。次の Planning の最上部に戻ってくる。

#### Anatomy

1. 上端 `ink` 1px・下端 `border` の罫
2. ラベル（「次に試す変更」/「前回決めた改善策」）＋出所＋状態 Tag
3. 本文（確定後は明朝 `text-goal`、下書きは Sans）
4. reminder: 「この計画に反映した」Checkbox

#### Variants

| Variant | 用途 |
| --- | --- |
| draft | 下書き（破線 Tag）＋改善策として確定 |
| committed | 次の Sprint で試す |
| applied | 計画に反映済み |
| kept / dropped | 続ける / やめる（次の Retro で判定） |
| reminder | Planning 最上部の表示 |

#### Usage

**使う**

- Retro の最後、次の Planning の最上部

#### Do / Don't

- ✗ 複数の改善策を並べる
- ✗ 達成率で評価する

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.ImprovementAction, { text, status: 'draft' | 'committed' | 'applied' | 'kept' | 'dropped', origin, variant: 'default' | 'reminder', applied, onAppliedChange, onCommit, onEdit })
```


### Kbd

キーボードショートカットの表示。Tooltip、Menu、クイック追加のヒントで使う。

#### Usage

**使う**

- Tooltip とメニュー項目の右端

**使わない**

- 本文中に多用

#### Do / Don't

- ✗ キーを色で強調

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Kbd, null, '⌘ Enter')
```


### Menu

行やヘッダーの補助操作をまとめるドロップダウン。

#### Anatomy

1. トリガー（`…` IconButton または Secondary の「並び順: 期限 ⌄」）
2. 面（`surface`、`border`、`radius-m`、`elevation-overlay`）
3. 見出し（任意）
4. 項目（32px、アイコン・ラベル・Kbd）
5. 区切り（`border-soft`）
6. 危険な項目（`danger`、最後）

#### States

| 状態 | 表現 |
| --- | --- |
| Item hover / focus | `surface-hover` |
| Checked | チェック＋`primary-subtle`（`menuitemcheckbox`） |
| Disabled | `ink-disabled` |

#### Usage

**使う**

- Task Row の操作（詳細を編集、Estimate を提案してもらう、今週から外す、アーカイブ）
- 並び順・表示の切り替え

**使わない**

- 主要な操作を隠す（主操作は Button）

#### Do / Don't

- ✓ 破壊的な操作は区切りの後、最後に
- ✗ 入れ子のサブメニュー

#### Accessibility

- ↓ ↑ Home End、Enter、Esc でトリガーに戻る。Tab で閉じる

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Menu, { label, icon: 'ellipsis', triggerText, align: 'start' | 'end', size, items: [{ label, icon, shortcut, onSelect, danger, disabled, checked } | { separator: true } | { heading }] })
```


### Navigation

アプリ全体のナビゲーション（サイドバー）。Intentional addition: 画面間の一貫した移動のため。

#### Anatomy

1. 項目（36px、20px アイコン＋ラベル＋件数）
2. セクション見出し（`text-kicker`）

#### States

| 状態 | 表現 |
| --- | --- |
| Current | `surface-pressed` の地、`ink` 600、`aria-current="page"` |
| Hover | `surface-hover` |
| Focus | 内側リング |

#### Usage

**使う**

- desktop の左サイドバー（`canvas-subtle`、右に `border`）。1200–1439px は `pane-rail`（アイコンのみ＋Tooltip）
- compact 幅は下部タブバー（今日 / Sprint / Backlog / 振り返り）

#### Do / Don't

- ✓ 項目は 8 個まで
- ✗ 現在地を色だけで示す

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Navigation, { label, items: [{ label, icon, href, current, count } | { section }] })
```


### Notice

画面内に留まる説明・注意・エラー。Intentional addition: DADS の Notification Banner に相当。

#### Anatomy

1. 地（`*-subtle`、`radius-s`、枠なし）
2. アイコン
3. タイトル（600）
4. 本文
5. 操作（任意、右端）

#### Variants

| Variant | 用途 |
| --- | --- |
| info | データ不足・同期状態 |
| warning | 超過の可能性、未見積 |
| danger | 読み込み失敗（`role="alert"`） |
| success | 反映済み |
| neutral | 補足 |

#### Usage

**使う**

- Dialog や ペイン内の注意
- 失敗しても続けられることを伝える

**使わない**

- 一時的な結果（→ Toast）
- 装飾的な強調

#### Do / Don't

- ✓ 次にできることを書く
- ✗ 左に色の太線を付ける
- ✗ 同じ画面に 3 つ以上

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Notice, { tone: 'info' | 'warning' | 'danger' | 'success' | 'neutral', title, action }, '本文')
```


### Popover

その場で小さな編集をする非モーダルの浮いた面。Estimate の編集、フィルタの詳細などに使う。

#### Anatomy

1. 面（幅 320px、`radius-m`、`elevation-overlay`）
2. タイトル＋閉じる
3. 本文（フォーム）
4. フッター（キャンセル / 保存）

#### States

| 状態 | 表現 |
| --- | --- |
| Open | フォーカスを本文の最初の入力へ |
| Dismiss | Esc、外側クリック、閉じる |

#### Usage

**使う**

- 1〜3 項目の編集
- 行内での Estimate 変更

**使わない**

- 長いフォーム（→ Drawer）
- 確認が必要な操作（→ Dialog）

#### Do / Don't

- ✓ 保存は Secondary（Popover に Primary を置かない）
- ✗ Popover の中から Popover を開く

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Popover, { trigger: h(PersonalSprint.Button, null, '3h'), title: 'Estimate を編集', footer, align, width }, children)
```


### Progress

進み具合を 4px（thin は 2px）の線と数値で示す。

#### Anatomy

1. ラベル（`text-label`）
2. 値（`ps-num`、「7 / 18件」）
3. トラック（`border-soft`）と塗り（`primary`）

#### Variants

| Variant | 用途 |
| --- | --- |
| determinate | Sprint の完了数、経過日数 |
| thin | 補助的な進捗 |
| indeterminate | 所要時間が分からない読み込み（文言必須） |

#### Usage

**使う**

- Sprint の完了、Today の進捗

**使わない**

- Goal の達成度（自己判定を数値化しない）
- 円グラフ・リング

#### Do / Don't

- ✓ 必ず数値を併記
- ✗ 色を段階で変える（赤 → 緑）

#### Accessibility

- `role="progressbar"`、`aria-valuetext`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Progress, { label: 'Sprint 14 の完了', value: 7, max: 18, valueText: '7 / 18件', thin, indeterminate })
```


### ProposalDiff

Agent の計画案と現在の計画の差を、行ごとに選んで反映する。反映しても Sprint は確定しない。

#### Anatomy

1. 要約（追加 / 除外 / 変更の件数、見積もり合計の前後、可用時間）
2. 行: □ 反映する ＋ 種類（記号＋語: ＋追加 / −除外 / →変更）＋ タスク名 ＋ Domain と理由 ＋ 値（変更は 前 → 提案）
3. フッター: 「選んだ N件を計画に反映」（Secondary）/ すべて却下 /「反映しても Sprint は確定されません」

#### Usage

**使う**

- 外部 Agent・製品内 Agent の計画案（desktop は右 Drawer、compact は全画面）

**使わない**

- 1 件だけの提案（→ AgentSuggestion）

#### Do / Don't

- ✓ 除外は既定で未選択にしてもよい（本人が意図的に選ぶ）
- ✓ 除外は取り消し線、変更の前の値も取り消し線
- ✗ 追加を緑・除外を赤に塗る（記号と語で示す）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.ProposalDiff, { changes: [{ id, type: 'add' | 'remove' | 'change', task, domain, reason, estimate, before, afterEstimate, selected }], totals: { before, after }, available, onApply, onDismissAll })
```


### Radio

2〜5 個の排他的な選択肢をすべて見せて 1 つ選ぶ（`RadioGroup`）。

#### Anatomy

1. fieldset と legend（`text-label`）
2. 各選択肢: 16px の円（選択時は `primary` の 4px 内枠）＋ラベル＋任意の説明
3. エラー

#### Variants

| Variant | 用途 |
| --- | --- |
| 縦（既定） | 説明付きの選択肢 |
| inline | 短い選択肢（Sprint の長さ） |

#### States

| 状態 | 表現 |
| --- | --- |
| Checked | `primary` の輪 |
| Hover / Focus / Disabled | Checkbox と同じ |

#### Usage

**使う**

- Goal の自己判定（達成 / 一部達成 / 未達）
- Sprint の長さ

**使わない**

- 選択肢が 6 個以上（→ Select）

#### Do / Don't

- ✓ 既定値を置くかは慎重に（自己判定は既定なし）
- ✗ Radio を単独で使う

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.RadioGroup, { legend, options: [{ value, label, description, disabled }], value, defaultValue, onChange, inline, help, error })
```


### RecurringIndicator

繰り返しタスクのルールと今週の発生回を示す。

#### Anatomy

1. `repeat` アイコン
2. ルール（「毎週 土」「平日」）
3. 今週の発生回（「今週 2/5」、任意）

#### Usage

**使う**

- TaskMetadata

#### Do / Don't

- ✓ ルールと発生回を区別する（ルール変更で過去の回は変わらない）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.RecurringIndicator, { rule: '平日', occurrence: '2/5' })
```


### RetroInsight

Retro の 1 つの気づき。事実・本人の振り返り・Agent の見立てを種類で分ける。

#### Variants

| Variant | 用途 |
| --- | --- |
| fact | 「事実」: データから言えること（Sans）＋根拠の列挙 |
| reflection | 「振り返り」: 本人の言葉（明朝 16/30） |
| agent | 「Agent の見立て」: 破線枠＋根拠（折りたたみ）＋振り返りに加える / 編集して加える / 却下 |

#### Usage

**使う**

- Retro、Review の要約

#### Do / Don't

- ✗ Agent の見立てを明朝で表示する（本人が加えるまで Sans）
- ✗ 評価・点数

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.RetroInsight, { kind: 'fact' | 'reflection' | 'agent', text, evidence: [], rationale, onAccept, onEdit, onDismiss })
```


### Select

決まった選択肢から 1 つ選ぶネイティブのプルダウン。

#### Anatomy

1. ラベル / サポートテキスト
2. ネイティブ `<select>`（36px、`border-strong`）
3. `chevron-down` アイコン
4. エラー

#### States

| 状態 | 表現 |
| --- | --- |
| Hover / Focus / Error / Disabled | TextInput と同じ |

#### Usage

**使う**

- Domain、繰り返しルールなど 5〜15 個の選択肢

**使わない**

- 2〜4 個で全部見せたい選択（→ RadioGroup）
- 即時に絞り込む（→ Filter）

#### Do / Don't

- ✓ ネイティブの挙動を活かす（キーボード・スクリーンリーダー・モバイル）
- ✗ 独自のドロップダウンで置き換える

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Select, { label: 'Domain', options: [{ value, label, disabled }] | ['毎日', '平日'], placeholder, value, onChange, help, error })
```


### Spinner

処理中を示す回転アイコン。必ず文言と一緒に使う。

#### Usage

**使う**

- Button の loading、Estimate の見積中、Agent の調査中

**使わない**

- 300ms 未満の処理
- 画面全体を覆うローディング

#### Accessibility

- `label` を渡すと `role="status"`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Spinner, { size: 16, label: '読み込み中' })
```


### SprintHeader

Sprint の画面の見出し。いま何を決めているか（段階）と、唯一の主操作を示す。

#### Anatomy

1. kicker（「Sprint Planning」）＋ Status Tag（計画中 · 未確定 = draft の破線）
2. タイトル（明朝 `text-display-l`「Sprint 14」）
3. 期間（Sans、`ink-muted`）
4. 操作（右: Quiet / Secondary / Primary 1 つ）
5. 段階表示（番号付き、非線形。済 = 塗り、現在 = `ink` 下線、未 = `ink-subtle`）

#### Variants

| Variant | 用途 |
| --- | --- |
| Planning | 段階: Backlog を見る / Goal を書く / 時間を確認 / 確定 |
| Active | Status「実行中」、段階なし、操作「Review を始める」 |
| Review / Retro | kicker を変え、段階: 結果を見る / Goal を判定 / 振り返る / 改善策 |

#### Usage

**使う**

- Planning・Sprint・Review・Retro の最上部

#### Do / Don't

- ✗ 巨大な Navigation Title、Hero 表現
- ✗ 段階表示をウィザード化して戻れなくする

#### Accessibility

- 段階は `nav` ＋ `ol`、現在は `aria-current="step"`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.SprintHeader, { kicker, title, period, status: { tone, label }, steps: [{ label, state: 'done' | 'current' | 'todo' }], onStep, actions })
```


### SprintPlanningScreen

Design System を適用した Desktop（1440px）の Sprint Planning 基準画面。新しい画面はこの密度・余白・書体の使い分けに合わせる。

#### Anatomy

1. ナビゲーション（224px、`canvas-subtle`）
2. Sprint Header（明朝タイトル、段階表示、唯一の Primary「Sprint 14 を確定」）
3. Backlog ペイン 384px（Task density、`canvas-subtle`）: クイック追加、検索、Filter、持ち越し → Domain 別グループ、□ で選択
4. Sprint ペイン（Thinking space、`canvas`、最大 680px）: 前回の改善策、明朝見出し、Domain ごとの Goal とタスク
5. 時間の見通しペイン 336px: Capacity（残り −1 〜 1h、tight）、Agent 提案（Estimate / 計画案）
6. Toast（結果＋元に戻す）

検証ポイント: Primary は 1 つ / Card は Agent 提案と Toast だけ / 影は Toast だけ / Domain 色は印とバーだけ / 明朝はタイトル・見出し・Goal・改善策だけ / 本人の値は実線、Agent の値は破線 / すべての数値が tabular。


### SprintSummary

Review の最上部で Sprint の結果を静かな表で示す。統計 Card を並べない。

#### Anatomy

1. 上端 `ink` 1px・下端 `border` の罫
2. 項目（ラベル `text-meta`、値 `num-l`、単位、補足）
3. 項目間の縦罫（`border-soft`）

#### Usage

**使う**

- Review、履歴の Sprint 詳細

**使わない**

- 点数化、ランキング、前週比の矢印の多用

#### Do / Don't

- ✓ 実績が入力済みのものだけ集計したと補足に書く
- ✓ Goal 達成は自己判定と明記
- ✗ Chore の完了率を Goal 達成の代わりに置く

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.SprintSummary, { items: [{ label, value, unit, detail }] })
```


### Switch

即時に反映される設定のオン / オフ。四角いトラック（Pill にしない）と「オン / オフ」の語で状態を示す。

#### Anatomy

1. トラック 36×20px（`radius-s`）
2. つまみ 14px（`radius-xs`）
3. 状態の語（オン / オフ）
4. ラベルと説明

#### States

| 状態 | 表現 |
| --- | --- |
| On | トラック `primary`、つまみ `on-primary` |
| Off | トラック `surface`、枠とつまみ `border-strong` |
| Hover | 枠 `ink-muted` / `primary-hover` |
| Focus | 共通リング |
| Disabled | `canvas-subtle`、説明に理由 |

#### Usage

**使う**

- 設定画面（Estimate 支援、繰り返しの表示）

**使わない**

- 保存ボタンと一緒に確定するフォーム項目（→ Checkbox）
- Planning 中の選択

#### Do / Don't

- ✓ 説明で「オンにすると何が起きるか」を書く
- ✗ 状態を色だけで示す

#### Accessibility

- `role="switch"` と `aria-checked`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Switch, { label, description, checked, defaultChecked, onChange, disabled })
```


### Tabs

同じ場所の表示を切り替える。下線（`ink` 2px）で選択を示し、Pill にしない。

#### Anatomy

1. タブリスト（下端に `border` の罫）
2. タブ（40px、Sans 14px / 500、件数は `ink-subtle`）
3. 選択中の下線（`stroke-strong`、`ink`）

#### States

| 状態 | 表現 |
| --- | --- |
| Selected | 文字 `ink` 600＋下線 |
| Hover | 文字 `ink`、下線 `border` |
| Focus | 内側リング |
| Disabled | `ink-disabled` |

#### Usage

**使う**

- Today の「今日 / 今週 / 期限超過 / 完了」

**使わない**

- 段階を進めるフロー（→ Sprint Header の段階表示）
- 絞り込み（→ Filter）

#### Do / Don't

- ✓ 件数を付ける
- ✗ タブを 6 個以上並べる
- ✗ 色面で選択を示す

#### Accessibility

- `role="tablist"`、← → / Home / End、roving tabindex。パネルに `id="panel-<id>"`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Tabs, { label, items: [{ id, label, count, disabled }], value, defaultValue, onChange })
```


### Tag

本人が付けるラベル、または状態（Status）を示す小さな Pill。何でも Tag にしない。

#### Anatomy

1. Pill（20px、`radius-pill`）
2. アイコン（Status は必須）
3. 語（1〜2 語）

#### Variants

| Variant | 用途 |
| --- | --- |
| neutral | 本人のラベル、一部達成・未達 |
| success | 達成・保存済み |
| warning | 超過の可能性 |
| danger | 期限超過 |
| info | 同期中・次の Sprint で試す |
| draft | 未確定（破線）: 「計画中 · 未確定」 |

#### Usage

**使う**

- Status（Sprint 状態、Goal の判定）
- 本人が付けたラベル

**使わない**

- 期限・Estimate・持ち越し・繰り返し（→ TaskMetadata の文字）
- Domain（→ DomainIndicator）
- 装飾

#### Do / Don't

- ✓ Status は語で意味が分かるように
- ✗ 1 行に Tag を 3 つ以上並べる
- ✗ Semantic 色を Domain に使う

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Tag, { tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'draft', icon }, '達成')
```


### TaskMetadata

タスクの属性（Domain・期限・持ち越し・繰り返し・Goal）を、Badge ではなく文字とアイコンで 1 行に並べる。

#### Anatomy

1. DomainIndicator（グループ化されていない一覧のみ）
2. Estimate（行の右端に置かない場合のみ）
3. Deadline
4. CarryOverIndicator
5. RecurringIndicator
6. Goal（`target` アイコン＋Goal 文、省略）
7. 注記（「Goal なし」など、`ink-subtle`）

#### Usage

**使う**

- TaskRow の 2 行目、Drawer の見出し下

**使わない**

- 属性ごとに色付きの Pill を並べる

#### Do / Don't

- ✓ 要素間 `space-3`、`text-meta` 12px
- ✗ 同じ情報をグループ見出しと行の両方に出す（Domain 別グループでは Domain を省く）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.TaskMetadata, { domain, estimate, deadline, today, carryOver, recurring, goal, note })
```


### TaskQuickAdd

Planning や Today を中断せずに、タイトルだけでタスクを追加する入力。Intentional addition: 「その場で追加」を全画面で同じ形にするため。

#### Anatomy

1. 入力（`plus` の接頭アイコン、視覚ラベルなし・`aria-label` あり）
2. Domain の Select（任意）
3. ヒント（Enter 追加 / Esc 取消）

#### Usage

**使う**

- Backlog ペイン上部、Today 下部（compact は sticky）

**使わない**

- 詳細項目をここで全部入力させる

#### Do / Don't

- ✓ 追加後も入力にフォーカスを残し、続けて追加できる
- ✓ Planning 中の追加は選択済みで Sprint に入れる
- ✗ モーダルで追加させる

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.TaskQuickAdd, { placeholder, domainOptions, defaultDomain, onAdd: ({ title, domain }) => {} })
```


### TaskRow

タスク 1 件の行。Backlog・Sprint・Today で同じ構造を使い、□ で選び、○ で終える。

#### Anatomy

1. ドラッグハンドル（hover / focus 時のみ、compact では非表示）
2. コントロール: □ 選択（`mode="select"`）/ ○ 完了（`mode="complete"`）/ なし（`mode="plain"`）
3. タイトル（`text-task`、1 行で省略、クリックで詳細）
4. Task Metadata（期限・持ち越し・繰り返し・Goal・注記）
5. Estimate（右端、`num-s`）
6. 行の操作 `…`（hover / focus 時、compact は常時）

#### Variants

| Variant | 用途 |
| --- | --- |
| mode select | Backlog: Sprint に入れる |
| mode complete | Today / 実行中の Sprint: 完了・スキップ |
| mode plain | Planning 中の Sprint 側の一覧 |
| layout stacked（既定） | タイトルの下にメタ情報（約 52px） |
| layout inline | メタ情報が少ない 1 行（40px） |

#### States

| 状態 | 表現 |
| --- | --- |
| Hover | `surface-hover`、ハンドルと操作を表示 |
| Focus | タイトル・コントロールに共通リング、行は focus-within で操作を表示 |
| Selected | `primary-subtle`＋チェック |
| Done | ○ を `primary` で塗り、タイトル `ink-subtle`＋取り消し線 |
| Skipped | ○ に「−」、「スキップ」表示 |
| Dragging | `surface`＋`elevation-drag`＋`border` |
| Loading | Estimate が「見積中」 |
| Error | 行内に「保存できませんでした · 再試行」 |
| Disabled | タイトル `ink-disabled`（アーカイブ済み） |

#### Usage

**使う**

- タスクが並ぶすべての場所

**使わない**

- Card で囲む、行に角丸・影を付ける

#### Do / Don't

- ✓ 区切りは `border-soft`、行間の余白は 0
- ✓ グループ化は Domain 見出し（Divider label）で
- ✗ メタ情報を Badge / Pill にする
- ✗ □ と ○ を入れ替える
- ✗ Goal に紐づかない行を薄くする

#### Accessibility

- □ は「Sprint に入れる: タスク名」、○ は「完了にする: タスク名」（`role="checkbox"`）
- リストのキーボード操作は Accessibility セクション

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.TaskRow, { title, mode: 'select' | 'complete' | 'plain', checked, status: 'open' | 'done' | 'skipped', onCheckedChange, domain, showDomain, estimate: { value } | { min, max, source: 'agent' } | null, deadline: '2026-10-02', today, carryOver: { count, from }, recurring: { rule, occurrence }, goal, note, layout, draggable, actions: menuItems, error, onRetry, onOpen })
```


### TextInput

1 行のテキスト・数値入力。DADS の順序（ラベル → サポートテキスト → 入力 → エラー）で組む。

#### Anatomy

1. ラベル（`text-label`、必須なら「必須」、任意なら「任意」）
2. サポートテキスト（`text-help`、入力の上）
3. 入力（36px、`border-strong`、`radius-s`）
4. 接頭アイコン / 接尾単位（任意、「h」など）
5. エラー（アイコン＋文、入力の下）

#### Variants

| Variant | 用途 |
| --- | --- |
| size sm / md / lg | 28 / 36 / 44px。compact 幅は自動で 44px・16px 文字 |
| prefixIcon | 検索・クイック追加 |
| suffix | 単位（h） |
| hideLabel | 検索・クイック追加のみ（`aria-label` として残る） |

#### States

| 状態 | 表現 |
| --- | --- |
| Hover | 枠 `ink-muted` |
| Focus | 共通リング（offset 1px） |
| Error | `danger` の 2px 相当の枠＋アイコン＋文、`aria-invalid` |
| Disabled | `canvas-subtle`、`ink-disabled` |
| Read-only | `canvas-subtle`、枠 `border`（破線にしない） |

#### Usage

**使う**

- 短い値（タスク名、可用時間、Estimate、検索）

**使わない**

- 複数行（→ Textarea）
- 選択肢が決まっている値（→ Select / RadioGroup）

#### Do / Don't

- ✓ help に単位・例を書く（「0.5時間単位」）
- ✓ エラーは直し方まで書く（「数値で入力してください（例: 1.5）」）
- ✗ プレースホルダーをラベル代わりにする
- ✗ 入力中にエラーを出す（離脱時・送信時に出す）
- ✗ 入力内容を消す

#### Accessibility

- help とエラーは `aria-describedby`
- 数値は `inputMode="decimal"`

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.TextInput, { label: '可用時間', required, optional, help, error, suffix: 'h', prefixIcon, size, hideLabel, value, onChange, ...inputProps })
```


### Textarea

複数行のテキスト入力。Goal の編集、持ち越しの理由、Retro の振り返りに使う。

#### Anatomy

1. ラベル
2. サポートテキスト
3. 入力（最小 88px、縦方向のみリサイズ）
4. 文字数（`maxLength` 指定時、右下）
5. エラー

#### States

| 状態 | 表現 |
| --- | --- |
| Hover / Focus / Error / Disabled / Read-only | TextInput と同じ |

#### Usage

**使う**

- Goal（編集中は Sans。保存後に明朝で表示）
- Retro の振り返り、持ち越しの理由

**使わない**

- 1 行で済む値

#### Do / Don't

- ✓ 上限がある場合は `maxLength` と文字数表示
- ✓ Goal の help に書き方の型を示す
- ✗ 明朝で入力させる

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Textarea, { label, help, error, required, optional, maxLength, rows, value, onChange })
```


### Toast

操作の結果を短く伝え、元に戻す手段を添える一時的な通知。

#### Anatomy

1. 面（`surface`、`border`、`radius-m`、`elevation-overlay`）
2. アイコン（状態がある場合）
3. 結果の文
4. 操作（「元に戻す」「再試行」）
5. 閉じる

#### Variants

| Variant | 用途 |
| --- | --- |
| neutral | 「3件を Sprint 14 に入れました」＋元に戻す |
| success | 「Sprint 14 を確定しました」 |
| danger | 「保存できませんでした。入力内容は残っています。」＋再試行（`role="alert"`） |

#### States

| 状態 | 表現 |
| --- | --- |
| 表示時間 | `duration-toast` 8 秒。hover / focus 中は止める。操作付きは閉じるまで残してもよい |

#### Usage

**使う**

- Backlog 選択・除外・アーカイブなど、元に戻せる操作の結果

**使わない**

- 入力エラー（→ フィールドのエラー）
- 確認が必要なこと
- タスク完了のたびの通知

#### Do / Don't

- ✓ 位置は desktop 左下、compact は下部タブバーの上
- ✗ 同時に 3 つ以上
- ✗ 祝福の演出

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Toast, { tone, action: { label: '元に戻す', icon: 'undo-2', onClick }, onClose, duration: 8000 }, '3件を Sprint 14 に入れました')
```


### TodayCompactScreen

スマートフォン（390px）の Today 基準画面。今日のタスクの完了、追加、Sprint の進捗をこの画面で完結させる。

#### Anatomy

1. kicker（Sprint と経過日）＋明朝の日付
2. Progress（今週の完了）
3. 今週の Goal（明朝 15px、Domain の印）
4. 今日のタスク（○ で完了、48px 行、44px ターゲット、操作は常時表示）
5. 今週の残り（件数と時間の幅）
6. sticky のクイック追加（44px）
7. 下部タブバー（今日 / Sprint / Backlog / 振り返り）

検証ポイント: 44px ターゲット / 入力文字 16px / hover に依存しない / Floating Action Button を置かない / 完了時に祝福演出をしない。


### Tooltip

アイコンだけの操作や省略されたラベルに、短い説明を添える。

#### Anatomy

1. `surface-inverse` の小さな面（`radius-s`、12px 文字）
2. 任意の Kbd

#### States

| 状態 | 表現 |
| --- | --- |
| 表示 | hover 400ms 後 / focus で即時 |
| 非表示 | pointer が離れる、blur、Esc |

#### Usage

**使う**

- IconButton のラベル
- ショートカットの提示

**使わない**

- 必須の情報、エラー、操作可能な内容（→ Popover）

#### Do / Don't

- ✓ 1 行、20 字程度まで
- ✗ 矢印・影・アニメーションで飾る

#### Accessibility

- `role="tooltip"`、`aria-describedby`。Tooltip に pointer を載せても消えない（WCAG 1.4.13）

#### Props（consumer が渡すもの）

```js
h(PersonalSprint.Tooltip, { content, shortcut, placement: 'top' | 'top-start' | 'bottom' }, h(PersonalSprint.Button, null, 'Sprint を確定'))
```

