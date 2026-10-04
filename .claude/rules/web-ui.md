---
paths:
  - "apps/web/**"
---

# Web UI

- 実装前に `DESIGN.md`（YAML のトークン、Components、Do's and Don'ts）と、該当する `docs/design/patterns.md` の画面のパターンを読む。文言は書く前に `ui-copy` Skill を読み、`docs/design/content.md` の原則・語彙・型に沿って書いて `pnpm copy:lint` で確かめる。アクセシビリティは `docs/design/accessibility.md`、Agent の表現は `docs/design/agent-ui.md`、アイコンと動きは `docs/design/foundations.md`。
- トークンは DESIGN.md の YAML から写す。値は `:root`（light）と `[data-theme="dark"]`（`-dark` の値）に生の CSS 変数として置き、Tailwind 4 には `@theme inline` で対応づける（例：`--color-canvas: var(--canvas)`）。shadcn の初期化が作る `.dark` は `[data-theme="dark"]` に合わせる。
  - Tailwind の theme に写すもの：色 → `--color-*`、`rounded.*` → `--radius-*`、`typography.*` → `--text-*`（と `--text-*--line-height` などの付属値）、書体 → `--font-sans`（LINE Seed JP の 1 系列）、`spacing` の数値と寸法 → `--spacing-*`、`bp-*` → `--breakpoint-*`、`measure-read` → `--container-measure-read`、elevation → `--shadow-*`、easing → `--ease-*`。
  - Tailwind の theme に名前空間がないもの（layer の z-index、duration、stroke）は生の CSS 変数のまま置き、`z-(--layer-dialog)`・`duration-(--duration-fast)` のように使う。
  - トークンは `apps/web/src/styles/tokens.css`（生の CSS 変数）と `globals.css`（`@theme`）にある。Tailwind の既定のテーマは消してあるので、DESIGN.md にない値のユーティリティは生成されない。トークンを足すときは DESIGN.md → CSS → `src/lib/utils.ts`（`cn` に教える名前）→ `src/foundations/token-lists.ts`（Storybook の一覧）の順に直す。DESIGN.md と CSS・一覧のずれは `src/styles/tokens.test.ts` が検出する（色・書体・角丸・寸法、`cn` に教える名前、elevation・layer・stroke、docs/design/foundations.md の duration・easing、「コントラスト」の組）。アプリと Storybook の実行時に DESIGN.md を読まない（ADR 0003）。
  - 書体は LINE Seed JP の 1 系列（`font-sans`）。数字はプロポーショナルで `tabular-nums` が効かないので、数字の列は右揃えにする。時間の書式（「30分」「3時間」「2時間15分」、範囲は空白なしの「〜」で「2〜4時間」）は DESIGN.md の原則 4 と Estimate に従って自前で実装する。色・余白・角丸・影はトークンで指定し、16 進値を直書きしない。
- 部品は shadcn（base-ui）+ Tailwind 4 で作り、見た目は DESIGN.md の Components に合わせる。shadcn は `pnpm agent:shadcn <command> --cwd apps/web` で追加し、生成されたクラス（`bg-background`・`text-muted-foreground`・`rounded-lg` など）を DESIGN.md のトークンに書き換える。部品ごとに Storybook の Story（variant・サイズ・「共通の状態」の必須状態）を置く。Storybook は `pnpm --filter @itera/web storybook`。
- Primary Button は 1 画面に 1 つ。Agent 提案の「採用」系ボタンは Secondary / Quiet にし、Primary で誘導しない。Agent・AI の値は破線と「提案」の語で区別する。Card inside Card、装飾の Shadow / Gradient / Blur、AI を特別に見せる表現は使わない。
- 状態は色だけで示さない（アイコンと語を添える）。フォーカスの outline を消さない。ターゲットは 24px 以上、compact 幅では 44px 以上。
- fixture は `packages/domain` の型で記録（Task、SprintTask、DailySelection、Occurrence など）だけを持つ。確定済みの Sprint の PlanningValue は SprintTask.planSnapshot として固定された記録なので fixture に持つ（不変条件 16）。ドメインモデルの Scenario A〜C を基にし、PRD §12 に挙がった状態（Pick / Shape / Check、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence）を再現できるようにする。連続見送り・持ち越し回数・Retro の事実・計画時との差分・昨日の続き、および Planning（draft）中の計画値のプレビューは fixture に書かず、`packages/domain` の関数で計算する。UI 側で計算し直さない。
  - 画面は、記録と派生値を API（OpenAPI の契約）から得る。`packages/domain` を import してよいのは、プレビューと日付の関数をまとめた例外のモジュールとブラウザ内モックだけ。`packages/application` を import してよいのはモックだけ（PRD §14「クライアントとデータの方式」、ADR 0005 の 2026-10-03 の改訂）。
  - 契約に移した画面（Backlog #273、今日 #275、Sprint #274、振り返り #276）の読み取りは、フックが `Read<T>`（`status` が `pending`・`failed`・`ready`）を返し、画面は `ready` でない間 `ReadStatus` を出す。操作は `useOperation` から作った非同期の関数で、結果の `boolean` を待ってから Toast や焦点を動かす。版を持つ編集できる欄（`useDraftField(read, equal, { etag })`）の保存は、`boolean` ではなく保存の版の移りを持つ `Saved`（`savedOf`）を返し、欄の `hold` に渡す（ADR 0005「編集できる欄の状態」、#343）。形は ADR 0005「Backlog・Task の詳細・領域を契約に移す」、日の読み取りと焦点は「今日を契約に移す」。2 つの読み取りを合わせる画面（Sprint）は `useRead2` で `Read<T>` にし、操作のフックは画面が 1 つずつ呼んで部品へ渡す（行ごとに呼ばない）。形は ADR 0005「Sprint（計画・実行中）を契約に移す」。
  - 画面の部品とフックは `RecordStore`・`Change`・`Records` を参照しない（#277 で片づけた）。画面の変更は操作ごとの名前つき関数（`useOperation` から作る）で行い、読み取りは契約のフックを通す。
  - 置き場所：`src/api/` は契約への通信の層（クライアント・読み取りの状態・操作・失敗。画面の形を知らない）、`src/screen-data/` は契約の答えを画面の形にする読み取りと、画面が名前で呼ぶ操作の関数（`screens/` から使い、`api/` を使う）。1 つの画面だけが使うものも、契約の読み取りと操作の関数は `screen-data/` に置く。焦点・選択・Toast など画面の振る舞いのためのフックは画面のフォルダに置く。`api/`・`components/`・`lib/`・`auth/`・`foundations/` から `screen-data/` は import できない（ESLint）。形は ADR 0005「RecordStore と Change の片づけ」。
- DESIGN.md と docs/design で決めきれない操作・アクセシビリティの判断は `design-references` Skill で DADS / HIG を確かめる。
- UI を変えたら `pnpm agent:playwright` で実際に操作し、compact（768px 未満）・medium（768〜1199px）・wide（1200〜1439px の rail と 1440px 以上）を確認する。仕上げの点検には `impeccable` Skill の critique / audit / polish を使ってよい。
