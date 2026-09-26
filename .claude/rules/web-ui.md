---
paths:
  - "apps/web/**"
---

# Web UI

- 実装前に DESIGN.md の「Quick reference」「Visual guardrails」「Foundations — State design」「Foundations — Responsive」「Writing — 用語と表記」と、該当する「Patterns — Sprint Planning」「Patterns — Today」「Patterns — Sprint Review / Retro」を読む。Backlog のパターンは DESIGN.md にないので、PRD §5.A と DESIGN.md の Backlog selection・Task Row・Drawer から組み立てる。
- 用語と操作の意味は `docs/design/design-md-v0.1-gaps.md` の読み替えに従う（Domain → 領域、Sprint Review → Retro の「事実を見る」、Today の 6 つの操作など）。
- DESIGN.md の `components/bundle.js`・`window.PersonalSprint`・`ps-` クラス・「Screens」はこのリポジトリにない。Appendix B は部品の状態と振る舞いの仕様として読み、shadcn（base-ui）+ Tailwind 4 で作る。トークンは Appendix A を CSS 変数として写し、テーマ（`data-theme`）とフォントの読み込みは「Using the system」に従う。`.ps-num` と `formatHours` / `formatRange` / `formatTotal` もないので、数値の書式規則（tabular-nums、1h 未満は `30m`、合計は h、範囲は en dash、負を含む範囲は `〜`）は自前で実装する。
- 色・余白・角丸・影はトークン（CSS 変数）で指定する。16 進値を直書きしない。
- Primary Button は 1 画面に 1 つ。Agent 提案の「採用」系ボタンは Secondary / Quiet にし、Primary で採用を誘導しない。Agent・AI の値は破線と「提案」の語で区別する。Card inside Card、装飾の Shadow / Gradient / Blur、AI を特別に見せる表現は使わない。
- 状態は色だけで示さない（アイコンと語を添える）。フォーカスの outline を消さない。ターゲットは 24px 以上、compact 幅では 44px 以上。
- fixture は `packages/domain` の型で記録（Task、SprintTask、DailySelection、Occurrence など）だけを持つ。確定済みの Sprint の PlanningValue は SprintTask.planSnapshot として固定された記録なので fixture に持つ（不変条件 16）。ドメインモデルの Scenario A〜C を基にし、PRD §12 に挙がった状態（Pick / Shape / Check、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence）を再現できるようにする。連続見送り・持ち越し回数・Retro の事実・計画時との差分・昨日の続き、および Planning（draft）中の計画値のプレビューは fixture に書かず、`packages/domain` の関数で計算する。UI 側で計算し直さない。
- shadcn の部品は `pnpm agent:shadcn <command> --cwd apps/web` で追加し、見た目は DESIGN.md のトークンに合わせる。
- DESIGN.md で決めきれない操作・アクセシビリティの判断は `design-references` Skill で DADS / HIG を確かめる。
- UI を変えたら `pnpm agent:playwright` で実際に操作し、compact（768px 未満）・medium（768〜1199px）・wide（1200〜1439px の rail と 1440px 以上）を確認する。仕上げの点検には `impeccable` Skill の critique / audit / polish を使ってよい。
