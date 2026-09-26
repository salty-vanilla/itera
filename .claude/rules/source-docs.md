---
paths:
  - "docs/requirements/**"
  - "docs/domain/**"
  - "DESIGN.md"
---

# 正本文書の編集

- この 3 つ（PRD、ドメインモデル、DESIGN.md）は製品判断の正本。ユーザーの合意なしに意味を変えない。誤字・リンクの修正は例外。
- 変更するときは、理由と、他の 2 文書への影響（更新が必要か）を PR か Issue に書く。食い違いを残したままにしない。
- ドメインモデルに決定を足すときは、「v0.1 からの変更」（1〜13）・「v0.2 Final で決めたこと」（F1〜F6）と同じ形の表に行を足す。不変条件は番号を振り直さず、末尾に追加する。
- PRD を変えたら `PRODUCT.md`（Impeccable 用の要約）も合わせて直す。DESIGN.md の食い違いが解消したら `docs/design/design-md-v0.1-gaps.md` から行を消す。
- DESIGN.md は Design System アーティファクトの 1 ファイル版。このリポジトリでは DESIGN.md を正本として扱い、変更したらアーティファクト側への反映が必要かを PR に書く。
