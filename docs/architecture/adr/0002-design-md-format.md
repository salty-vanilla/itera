# ADR 0002: DESIGN.md を公式形式にし、製品固有の指針を docs/design に分ける

- 状態：採用
- 日付：2026-09-26
- 関連：Issue #2

## 背景

DESIGN.md v0.1 は Claude Design の Design System アーティファクトから書き出した 1 ファイル版で、PRD v0.2 / ドメインモデル v0.2 Final より古く、用語と操作の意味が食い違っていた（Domain と Area、Backlog の意味、Estimate と計画値、Goal の自己判定、Sprint Review、改善策の判定、Today の操作など 12 件）。また、トークン・部品の見た目に加えて、画面のパターン・Agent UI・文言・アクセシビリティ・存在しない部品バンドルの API まで 1 ファイルに入っていた。

## 決定

- このリポジトリの `DESIGN.md` を正本にする。Design System アーティファクトは当たり付けとして扱い、同期しない（オーナーの合意、Issue #2）。
- `DESIGN.md` は公式の DESIGN.md format spec（google-labs-code/design.md、version alpha）に従う。先頭の YAML がトークン（colors・typography・rounded・spacing・components）の正で、本文は Overview / Colors / Typography / Layout / Elevation & Depth / Shapes / Components / Do's and Don'ts の順に書く。dark theme は同じ名前に `-dark` を付けたトークンで持つ。
- spec に収まらない製品固有の指針は `docs/design/` に移す：`patterns.md`（Backlog / Planning / Today / Retro）、`agent-ui.md`、`content.md`（文言と用語）、`accessibility.md`、`foundations.md`（アイコンと動き）、`design-context.md`（参照元と一次資料）。
- 食い違いは PRD / ドメインモデルに合わせて解消した。「このリポジトリの読み」とした 2 点も PRD を優先した（Retro に持ち越しの理由を入れない、compact の Planning で段階を必ず順に通らせない）。領域の概念は Area だけにし、色トークンを `area-1`〜`area-7` / `area-none` に改名した。
- v0.1 の部品バンドルの API（`h(PersonalSprint.*)` の Props）と Screens は、存在しないものの説明なので削除した。部品の見た目・状態・使い方は Components に残した。

## 検証

- `pnpm design:lint`（`@google/design.md` 0.4.0 の `designmd lint`）で、トークンの値と参照を検査する。値が不正なら失敗する。「部品から参照されないトークン」の warning は、トークンがデザインシステムそのものなので許容する。
- CLI はセクションの順序を検査しないため、`tooling/checks/design-md.test.mjs` で、使ってよいセクションと順序を検査する。
- どちらも `pnpm check` と CI に含める。

## 影響

- 実装とレビューは DESIGN.md（見た目）と `docs/design/`（パターン・振る舞い）の両方を読む。入口は `docs/README.md` と `.claude/rules/web-ui.md`。
- Impeccable は spec 形式の DESIGN.md をそのまま読める。
- DESIGN.md を変えるときは spec の形を保ち、合わない内容は `docs/design/` に置く（`.claude/rules/source-docs.md`）。
