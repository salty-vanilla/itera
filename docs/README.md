# Itera の文書

## 正本

| 文書 | 役割 |
| --- | --- |
| [PRD](requirements/prd.md) | 何を成立させるか。プロダクト原則、コア体験、MVP 完了条件、対象外、未決事項 |
| [ドメインモデル](domain/domain-model.md) | 意味をどう矛盾なく表すか。Entity / VO、状態遷移、不変条件、シナリオ |
| [DESIGN.md](../DESIGN.md) | 見た目と部品。トークン、部品の状態、パターン、レイアウト、文言のトーン・表記 |

意味・状態・用語はドメインモデル → PRD が優先する。DESIGN.md v0.1 との既知の食い違いと読み替えは [DESIGN.md v0.1 の食い違い](design/design-md-v0.1-gaps.md)。それ以外の食い違いは、どの文書を更新するかを決めてから変更する。

## 作業別の読み順

- **ドメインロジック**：ドメインモデル（該当する状態遷移と不変条件）→ PRD の該当するコア体験
- **画面の実装・レビュー**：PRD の該当するコア体験 → [DESIGN.md v0.1 の食い違い](design/design-md-v0.1-gaps.md) → DESIGN.md（Quick reference、Visual guardrails、該当する Patterns）→ [デザインの参照方針](design/design-context.md)
- **要望の整理・Issue 化**：PRD（原則、対象外、未決事項）→ ドメインモデル（未決事項）→ `CONTRIBUTING.md`
- **Agent 環境の変更**：[Agent 環境](development/agent-setup.md)

## その他

- [PRODUCT.md](../PRODUCT.md)：Impeccable 用に PRD を要約した製品文脈（PRD が優先）

- [デザインの参照方針](design/design-context.md)：DADS / Apple HIG / UI v0.1 モックの扱い
- [DESIGN.md v0.1 の食い違い](design/design-md-v0.1-gaps.md)：PRD / ドメインモデルとのずれと実装での読み替え
- [Agent 環境](development/agent-setup.md)：Claude Code の設定、共有 Skill、ハーネス、更新手順
