---
paths:
  - "apps/web/**"
---

# Web UI

- 実装前に `DESIGN.md`（YAML のトークン、Components、Do's and Don'ts）と、該当する `docs/design/patterns.md` の画面のパターンを読む。文言は `docs/design/content.md`、アクセシビリティは `docs/design/accessibility.md`、Agent の表現は `docs/design/agent-ui.md`、アイコンと動きは `docs/design/foundations.md`。
- トークンは DESIGN.md の YAML から写す。値は `:root`（light）と `[data-theme="dark"]`（`-dark` の値）に生の CSS 変数として置き、Tailwind 4 には `@theme inline` で対応づける（例：`--color-canvas: var(--canvas)`）。shadcn の初期化が作る `.dark` は `[data-theme="dark"]` に合わせる。
  - Tailwind の theme に写すもの：色 → `--color-*`、`rounded.*` → `--radius-*`、`typography.*` → `--text-*`（と `--text-*--line-height` などの付属値）、書体 → `--font-sans`（LINE Seed JP の 1 系列）、`spacing` の数値と寸法 → `--spacing-*`、`bp-*` → `--breakpoint-*`、`measure-read` → `--container-measure-read`、elevation → `--shadow-*`、easing → `--ease-*`。
  - Tailwind の theme に名前空間がないもの（layer の z-index、duration、stroke）は生の CSS 変数のまま置き、`z-(--layer-dialog)`・`duration-(--duration-fast)` のように使う。
  - トークンは `apps/web/src/styles/tokens.css`（生の CSS 変数）と `globals.css`（`@theme`）にある。Tailwind の既定のテーマは消してあるので、DESIGN.md にない値のユーティリティは生成されない。トークンを足すときは DESIGN.md → CSS → `src/lib/utils.ts`（`cn` に教える名前）→ `src/foundations/token-lists.ts`（Storybook の一覧）の順に直す。DESIGN.md と CSS・一覧のずれは `src/styles/tokens.test.ts` が検出する。アプリと Storybook の実行時に DESIGN.md を読まない（ADR 0003）。
  - 書体は LINE Seed JP の 1 系列（`font-sans`）。数字はプロポーショナルで `tabular-nums` が効かないので、数字の列は右揃えにする。時間の書式（1h 未満は `30m`、合計は h、範囲は en dash、負を含む範囲は `〜`）は DESIGN.md の原則 4 と Estimate に従って自前で実装する。色・余白・角丸・影はトークンで指定し、16 進値を直書きしない。
- 部品は shadcn（base-ui）+ Tailwind 4 で作り、見た目は DESIGN.md の Components に合わせる。shadcn は `pnpm agent:shadcn <command> --cwd apps/web` で追加し、生成されたクラス（`bg-background`・`text-muted-foreground`・`rounded-lg` など）を DESIGN.md のトークンに書き換える。部品ごとに Storybook の Story（variant・サイズ・「共通の状態」の必須状態）を置く。Storybook は `pnpm --filter @itera/web storybook`。
- Primary Button は 1 画面に 1 つ。Agent 提案の「採用」系ボタンは Secondary / Quiet にし、Primary で誘導しない。Agent・AI の値は破線と「提案」の語で区別する。Card inside Card、装飾の Shadow / Gradient / Blur、AI を特別に見せる表現は使わない。
- 状態は色だけで示さない（アイコンと語を添える）。フォーカスの outline を消さない。ターゲットは 24px 以上、compact 幅では 44px 以上。
- fixture は `packages/domain` の型で記録（Task、SprintTask、DailySelection、Occurrence など）だけを持つ。確定済みの Sprint の PlanningValue は SprintTask.planSnapshot として固定された記録なので fixture に持つ（不変条件 16）。ドメインモデルの Scenario A〜C を基にし、PRD §12 に挙がった状態（Pick / Shape / Check、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence）を再現できるようにする。連続見送り・持ち越し回数・Retro の事実・計画時との差分・昨日の続き、および Planning（draft）中の計画値のプレビューは fixture に書かず、`packages/domain` の関数で計算する。UI 側で計算し直さない。
  - これは fixture の段階（Issue #45 まで）の規則。移行後は、記録と派生値を API（OpenAPI の契約）から得て、プレビューだけを `apps/web` の中で計算する。`packages/domain` はブラウザ内モック以外から import しない（PRD §14「クライアントとデータの方式」、ADR 0005）。
  - #39〜#42 では、画面の部品から `store.run`・`Change`・`Records` を直接使わず、画面ごと・操作ごとのフックを通す（ADR 0005）。
- DESIGN.md と docs/design で決めきれない操作・アクセシビリティの判断は `design-references` Skill で DADS / HIG を確かめる。
- UI を変えたら `pnpm agent:playwright` で実際に操作し、compact（768px 未満）・medium（768〜1199px）・wide（1200〜1439px の rail と 1440px 以上）を確認する。仕上げの点検には `impeccable` Skill の critique / audit / polish を使ってよい。
