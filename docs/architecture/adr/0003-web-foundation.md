# ADR 0003: Web の土台とデザインシステムの置き場所

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #6

## 背景

`apps/web` の画面（Backlog・Planning・Today・Retro）を作る前に、DESIGN.md のトークンと基底部品を部品の単位で確認できる状態にしたい。ADR 0001 は「React / Vite / Tailwind など Web 側の依存は、手順 4 で別の ADR として決める」としており、PRD §14 でも技術スタックは未決なので、導入する依存と版をここに記録する。Storybook は AGENTS.md の技術スタックの候補になかったため、採用理由もここに書く。

## 決定

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| ビルド | Vite + `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | Vitest と同じ変換を使える。SPA で足り、SSR は必要ない |
| UI | React | 19.3.0 | AGENTS.md の候補。shadcn（base-ui）が前提にする |
| スタイル | Tailwind CSS（`@tailwindcss/vite`） | 4.3.3 | トークンを CSS 変数と `@theme` で持てる。既定のテーマは `--*: initial` で消し、DESIGN.md のトークンだけをユーティリティにする |
| 部品の土台 | shadcn（base-ui、style `base-nova`）+ `@base-ui/react` | CLI 4.21.0 / 1.8.0 | 部品をソースとして持ち、DESIGN.md の Components に合わせて書き換えられる。追加は `pnpm agent:shadcn add <部品> --cwd apps/web`。`shadcn` パッケージは `globals.css` が読む `shadcn/tailwind.css`（base-ui の `data-*` 状態の variant）のために apps/web の dependencies に入る（shadcn init の既定） |
| クラスの結合 | `cn`（shadcn 公式、tailwind-merge 互換）と class-variance-authority | 0.4.0 / 0.7.1 | shadcn の既定。DESIGN.md のトークン名（`text-body`・`shadow-overlay`・`h-control-md` など）を `apps/web/src/lib/utils.ts` で教えないと、文字色と取り違えて消される |
| アイコン | lucide-react | 1.48.0 | docs/design/foundations.md が Lucide だけを使うと決めている |
| 部品カタログ | Storybook（`@storybook/react-vite`、addon-docs・addon-a11y・addon-themes）＋ storybook-addon-pseudo-states | 10.6.0 | 画面を作る前に、トークンと部品の状態（Hover・Focus・Active・Disabled・Loading）を light / dark と compact / medium / wide で単体に確認できる。pseudo-states で Hover などを強制表示し、状態の一覧を 1 つの Story にまとめられる |
| 部品のテスト | Vitest（jsdom）+ Testing Library | vitest 5.0.2（ADR 0001 と同じ）/ jsdom 30.1.1 / @testing-library/react 16.3.3 / user-event 14.6.7 | 役割・名前・`aria-*` とキーボード操作をブラウザなしで検査する |
| React の型 | @types/react・@types/react-dom | 19.3.0 | React と同じ版に揃える |
| Lint | eslint-plugin-react-hooks・eslint-plugin-storybook | 7.1.1 / 10.6.0 | ルートの `eslint.config.js` に `files` 付きで足す（ADR 0001） |
| トークンの照合 | yaml | 2.9.1 | `tokens.test.ts` が DESIGN.md の YAML を読むためだけに使う（devDependencies） |
| 型 | TypeScript（apps/web の devDependencies） | 6.0.3 | ルートと同じ版。`typecheck` script が apps/web の `tsc` を使う |
| 書体 | LINE Seed JP（Google Fonts、OFL） | 400 / 700 | DESIGN.md v0.3。BIZ UDPゴシックと並べて比べ、オーナーが選んだ（2026-09-27）。数字はプロポーショナルで `tabular-nums` が効かないが、範囲記号とマイナスがハイフンと見分けられ、1 系列で済む |

依存は ADR 0001 と同じく完全一致で固定する。

### トークンの置き場所と DESIGN.md との関係

- アプリと Storybook が読むのは `apps/web/src/styles/tokens.css`（テーマで変わる生の CSS 変数）と `globals.css`（Tailwind の `@theme`）だけ。実行時・ビルド時に DESIGN.md を読まない。
- DESIGN.md の YAML と CSS が一致することは `apps/web/src/styles/tokens.test.ts` が CI で確かめる。DESIGN.md を読むのはこのテストだけにする（2026-09-27 オーナー確認）。文書の書式に実行時の依存を持たせず、ずれは CI で止める。
- DESIGN.md の YAML から CSS を生成する方式は採らない。ビルドが文書に依存し、YAML にない値（elevation・layer・motion）を別の経路で足すことになるため。
- 文字の大きさと行の高さ（`typography.*`）は、YAML の px を 16 で割った rem で CSS に写す。ルートの font-size はブラウザの設定のままにし、本文の大きさは `body` に置く。ブラウザの文字の大きさの設定で文字だけが大きくなる（WCAG 1.4.4。2026-10-05 オーナー判断、Issue #393）。余白・寸法・ブレークポイントは px のまま写す。`tokens.test.ts` は rem × 16 を YAML の px と照らす。

### 部品の置き場所

基底部品は `apps/web/src/components/ui/` に置く。`packages/ui` に分けるのは、Web 以外に使う先ができたときに改めて決める。

## 影響

- `pnpm --filter @itera/web storybook` で Storybook を起動する（http://localhost:6006）。Foundations（色・タイポグラフィ・形・余白・奥行き）と部品の Story がある。
- Tailwind の既定のテーマを消しているので、`bg-blue-500`・`p-7`・`rounded-2xl` などは生成されない。値が必要になったら DESIGN.md にトークンを足してから使う。
- shadcn で部品を足したら、生成されたクラス（`bg-background`・`text-muted-foreground` など）は DESIGN.md のトークンに書き換える。shadcn 既定の色名の別名は用意していない。
- フォントは DESIGN.md の指定どおり Google Fonts から読み込む（`index.html` と `.storybook/preview-head.html`）。見た目の世界は DESIGN.md v0.3（駅の公共サインの文法。2026-09-27 に Impeccable の方向決めで選択、Issue #6 のコメントに記録）。自前で配信するかは公開の方針（PRD §14）と合わせて決める。
