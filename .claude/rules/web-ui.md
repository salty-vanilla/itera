---
paths:
  - "apps/web/**"
---

# Web UI

- 実装前に `DESIGN.md`（YAML のトークン、Components、Do's and Don'ts）と、該当する `docs/design/patterns.md` の画面のパターンを読む。文言は `docs/design/content.md`、アクセシビリティは `docs/design/accessibility.md`、Agent の表現は `docs/design/agent-ui.md`、アイコンと動きは `docs/design/foundations.md`。
- トークンは DESIGN.md の YAML を Tailwind 4 の `@theme` の CSS 変数に写す（dark は `-dark` の値を `data-theme="dark"` に）。`rounded.*` → `--radius-*`、`typography.*` → `--text-*`、`spacing` の数値と寸法 → `--spacing-*`、`bp-*` → `--breakpoint-*`、`measure-read` → `--container-measure-read`。YAML にない elevation・layer・stroke（DESIGN.md の Elevation & Depth と Shapes の表）と duration・easing（`docs/design/foundations.md`）は、表から `--shadow-*`・`--z-*`・`--duration-*`・`--ease-*` として写す。色・余白・角丸・影はトークンで指定し、16 進値を直書きしない。数値の書式（tabular-nums、1h 未満は `30m`、合計は h、範囲は en dash、負を含む範囲は `〜`）は自前で実装する。
- 部品は shadcn（base-ui）+ Tailwind 4 で作り、見た目は DESIGN.md の Components に合わせる。shadcn は `pnpm agent:shadcn <command> --cwd apps/web` で追加する。
- Primary Button は 1 画面に 1 つ。Agent 提案の「採用」系ボタンは Secondary / Quiet にし、Primary で誘導しない。Agent・AI の値は破線と「提案」の語で区別する。Card inside Card、装飾の Shadow / Gradient / Blur、AI を特別に見せる表現は使わない。
- 状態は色だけで示さない（アイコンと語を添える）。フォーカスの outline を消さない。ターゲットは 24px 以上、compact 幅では 44px 以上。
- fixture は `packages/domain` の型で記録（Task、SprintTask、DailySelection、Occurrence など）だけを持つ。確定済みの Sprint の PlanningValue は SprintTask.planSnapshot として固定された記録なので fixture に持つ（不変条件 16）。ドメインモデルの Scenario A〜C を基にし、PRD §12 に挙がった状態（Pick / Shape / Check、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence）を再現できるようにする。連続見送り・持ち越し回数・Retro の事実・計画時との差分・昨日の続き、および Planning（draft）中の計画値のプレビューは fixture に書かず、`packages/domain` の関数で計算する。UI 側で計算し直さない。
- DESIGN.md と docs/design で決めきれない操作・アクセシビリティの判断は `design-references` Skill で DADS / HIG を確かめる。
- UI を変えたら `pnpm agent:playwright` で実際に操作し、compact（768px 未満）・medium（768〜1199px）・wide（1200〜1439px の rail と 1440px 以上）を確認する。仕上げの点検には `impeccable` Skill の critique / audit / polish を使ってよい。
