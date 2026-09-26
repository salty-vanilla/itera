# 開発への参加

最初に [README](README.md) と [文書の入口](docs/README.md) を確認する。AI Agent を使う作業は [AGENTS.md](AGENTS.md) と [Agent 環境](docs/development/agent-setup.md) も参照する。

## Issue から始める

作業の前に Issue を作り、目的・範囲・完了条件を書く。小さな修正や文書の変更も対象にする。

- **不具合**：再現手順、期待する挙動、実際の挙動
- **開発タスク**：合意した作業と完了条件。基盤整備・調査・文書にも使う
- **提案・相談**：未合意の案や判断が必要な事項。Issue を作っただけでは採用済みと扱わない

AI Agent（`issue-harness`）が実装の対象にするのは、オーナーが起票した Issue か、オーナーが受け入れ条件をコメントで確認した Issue だけ。

製品機能の追加・変更は、PRD・ドメインモデルの該当箇所、または合意を記録した Issue を根拠にする。Issue で合意して要件が変わる場合は、PRD・ドメインモデルにも反映する。

## ブランチ

`main` と短命の作業ブランチで運用する。作業ブランチは Issue 番号を含める。

```text
<種別>/<Issue番号>-<短い説明>

feat/12-backlog-quick-capture
fix/18-deferred-streak
docs/20-domain-open-questions
chore/3-monorepo-foundation
```

種別は `feat`（機能）、`fix`（不具合）、`docs`（文書）、`chore`（基盤・保守）。説明は英小文字・数字の kebab-case。

## Pull Request

マージ先は `main`。PR タイトルは `<種別>(<対象>): <内容>`。対象は `web`、`domain`、`api`、`docs`、`repo` など。

```text
feat(domain): PlanningValue の計算と計画基準の適用
chore(repo): Claude Code の Agent 環境を整備
```

[PR テンプレート](.github/pull_request_template.md) に目的・変更内容・確認結果・関連 Issue を書く。

- Issue が完了する PR は `Closes #12`、一部対応なら `Refs #12`。
- 実行した検証のコマンドと結果、未実施の検証とその理由を書く。
- UI の変更は変更前後の画像（compact・medium・wide の各幅）を添付する。画像を Git に入れない。
- `main` への force push と削除はしない。マージは Squash merge で行い、コミットタイトルも PR タイトルの形式に揃える。
