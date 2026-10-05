---
paths:
  - "packages/domain/**"
---

# ドメインロジック

- `docs/domain/domain-model.md` を正本とする。関係する Entity・状態遷移・不変条件（番号）を読んでから書く。
- このパッケージは純粋な TypeScript に保つ。React、DB、HTTP、現在時刻（`Date.now()` など）に直接依存しない。現在日時とタイムゾーンは引数で受け取る。ほかのパッケージ（`packages/application`・`services/api`・`apps/web` など）には、名前でも相対パスでも依存しない（相対パスは ESLint が止める。ADR 0007）。
- 状態は概念ごとに持つ（Task.lifecycle、SprintTask.outcome、DailySelection.resolution、Occurrence.state、PlanningCriterion.state、Sprint.state）。1 つの巨大な status にまとめない。
- ドメインモデルの中にも表記の揺れがある（状態名の大文字小文字、DailySelection.resolution に Selected / Started を含めるか、`startedAt` で表すか）。TS での表し方は最初の実装 Issue で 1 つに決めて記録し、以後それに揃える。Occurrence の Projected は保存しないので型の状態に入れず、計算関数の戻り値にする。
- 派生値（連続見送り、持ち越し回数、Retro の事実、計画時との差分、昨日の続き）は保存せず、記録から計算する関数にする。
- 操作（コマンド）は、状態の変更と一緒に追記すべき Activity（actor = 本人 / Agent / システム）を返す。PlanProposal の採用項目も、本人の操作と同じコマンドと検証を通す（不変条件 41）。
- 不変条件ごとにテストを書き、テスト名に番号を入れる（例: `invariant 16`）。ドメインモデルの Scenario A〜C はシナリオテストにする。
- PRD §14 の未決事項 1〜3 は決定済み（ドメインモデル F7〜F9、Issue #18）。該当する関数はその決定と不変条件 18・23・31 に従う。
