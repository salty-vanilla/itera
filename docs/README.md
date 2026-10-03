# Itera の文書

## 正本

| 文書 | 役割 |
| --- | --- |
| [PRD](requirements/prd.md) | 何を成立させるか。プロダクト原則、コア体験、MVP 完了条件、対象外、未決事項 |
| [ドメインモデル](domain/domain-model.md) | 意味をどう矛盾なく表すか。Entity / VO、状態遷移、不変条件、シナリオ |
| [DESIGN.md](../DESIGN.md) | 見た目と部品。公式の DESIGN.md spec（YAML のトークン＋ 8 セクション） |
| [docs/design/](design/) | DESIGN.md の形式に収まらない製品固有の指針（パターン、Agent UI、文言と用語＝画面の日本語の原則・語彙・型、アクセシビリティ、アイコンと動き） |

意味・状態・用語はドメインモデル → PRD が優先する。食い違いを見つけたら、どの文書を更新するかを決めてから変更する。

## 作業別の読み順

- **ドメインロジック**：ドメインモデル（該当する状態遷移と不変条件）→ PRD の該当するコア体験
- **画面の実装・レビュー**：PRD の該当するコア体験 → [画面のパターン](design/patterns.md) → DESIGN.md（トークン、Components、Do's and Don'ts）→ 必要に応じて [文言と用語](design/content.md)・[アクセシビリティ](design/accessibility.md)・[Agent UI](design/agent-ui.md)
- **画面の文言を書く・変える**：[文言と用語](design/content.md) の原則 → 語彙（用語・使わない語・「」で囲む語）→ 部品の型
- **要望の整理・Issue 化**：PRD（原則、対象外、未決事項）→ ドメインモデル（未決事項）→ `CONTRIBUTING.md`
- **Agent 環境の変更**：[Agent 環境](development/agent-setup.md)

## その他

- [PRODUCT.md](../PRODUCT.md)：Impeccable 用に PRD を要約した製品文脈（PRD が優先）
- [デザインの参照方針](design/design-context.md)：DESIGN.md の位置づけ、参照元、DADS / Apple HIG、UI v0.1 モックの扱い
- [画面のパターン](design/patterns.md) / [Agent UI](design/agent-ui.md) / [文言と用語](design/content.md) / [アクセシビリティ](design/accessibility.md) / [アイコンと動き](design/foundations.md)
- [Agent 環境](development/agent-setup.md)：Claude Code の設定、共有 Skill、ハーネス、更新手順
- [services/api のデプロイ](operations/deploy.md)：Cloudflare・Google・GitHub で手で行う設定、CD、公開後の確認
- [ADR](architecture/adr/)：決定の記録（[0001 monorepo の土台](architecture/adr/0001-monorepo-foundation.md)、[0002 DESIGN.md の形式](architecture/adr/0002-design-md-format.md)、[0003 Web の土台とデザインシステム](architecture/adr/0003-web-foundation.md)、[0004 API の実行基盤・DB・認証](architecture/adr/0004-api-platform-and-auth.md)、[0005 Web のルーティングと fixture](architecture/adr/0005-web-routing-and-fixture.md)、[0006 API の契約](architecture/adr/0006-api-contract.md)、[0007 クライアントの境界](architecture/adr/0007-client-boundary.md)）
