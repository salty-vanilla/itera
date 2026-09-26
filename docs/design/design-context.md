# デザインの参照方針

更新：2026-09-26。

## 何を正本にするか

見た目・部品・レイアウトの決定は [DESIGN.md](../../DESIGN.md) が正本。公式の DESIGN.md spec（google-labs-code/design.md）に従い、先頭の YAML がトークンの正、本文の 8 セクションがその使い方。spec に収まらない製品固有の指針は、この `docs/design/` に置く（[パターン](patterns.md)、[Agent UI](agent-ui.md)、[文言と用語](content.md)、[アクセシビリティ](accessibility.md)、[アイコンと動き](foundations.md)）。意味・状態・用語は PRD とドメインモデルが優先する。

Claude Design の Design System アーティファクト（v0.1 の出どころ）は当たり付けとして扱い、同期しない（Issue #2 の合意）。v0.1 にあった `tokens.css`・`components/bundle.js`・Screens はこのリポジトリにはなく、`apps/web` ではトークンを DESIGN.md の YAML から CSS 変数に写し、部品は Components を仕様として shadcn（base-ui）で作る。

## 参照元と役割

DESIGN.md を作るときに取り入れたもの・取り入れなかったもの。

| 参照元 | 取り入れたもの | 取り入れないもの |
| --- | --- | --- |
| デジタル庁 DADS | ラベル → サポートテキスト → 入力 → エラーの順序、必須表示、状態を色だけに依存させない、48rem の主ブレークポイント、44px ターゲット、「いつ使う / 使わない」の書き方 | 行政サービスの配色、黄色＋黒のフォーカス（輪郭の強さの考え方だけ採用） |
| Apple HIG | 階層・明快さ・フィードバック、モーダルの節度、直接操作と Undo、本人の主導権、pointer / touch / keyboard の同等性 | Liquid Glass、Blur、Floating Toolbar、巨大な Navigation Title |
| MUJI DESIGN.md（fork 元） | 白と無彩中心、純黒でない暗灰、罫線で構造を作る、影をほぼ使わない、小さな角丸、余白、装飾ではなく情報を主役に | きなり・ベージュの面、MUJI Red |
| Kakimori DESIGN.md | 明朝と Sans の役割分担、低彩度、控えめなアクセント、罫線と余白、palt を使わない素の組版 | 文具店としての擬物、ブランドオレンジ |
| SmartHR DESIGN.md | Semantic color の分離、フォームの状態、高密度でも読める階層、部品の状態の網羅 | 游ゴシックの指定、ブランドブルー |
| KOKUYO DESIGN.md | 分類（Itera では Area）ごとに色を持つ考え方、明度・彩度を揃えた色群 | カラーパネルの面使い、高彩度 |

## 外部の一次資料

DESIGN.md と `docs/design/` が決めていない細部を決めるときや根拠を確かめるときに、上の表の範囲で使う。取得の手順は `design-references` Skill（`.agents/skills/design-references/`）にまとめた。

| 資料 | 主に使う場面 |
| --- | --- |
| [デジタル庁デザインシステム（DADS）](https://design.digital.go.jp/dads/) | 日本語フォームの構造、必須表示、色だけに頼らない状態表示、コントラスト、ターゲットサイズ、文言・表記、部品の「いつ使う / 使わない」 |
| [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) | 操作感の原則。階層と明快さ、フィードバック、モーダルの節度、直接操作と Undo、本人の主導権、pointer / touch / keyboard の同等性 |

両者の意見が分かれたら、操作感は HIG、日本語フォームとアクセシビリティは DADS を優先する（このリポジトリでの決め。アクセシビリティの下限は DADS の品質基準 = WCAG 2.2 AA）。HIG は Apple プラットフォーム向けなので、Web には原則だけを当てはめる。

## UI v0.1 モック

`.tools/references/ui-v0.1.pdf`（元のファイル名は `Personal Sprint.pdf`。21 ページ。Planning の Pick / Shape / Check、Today、Retro など）は最初の当たり付けで、見た目の正本ではない。PRD は UI v0.1 を「情報構造と主要フローの基準」としているので、その範囲で参考にし、情報密度・余白・文言・インタラクションは実装して触りながら削る（PRD §12）。

- 容量が大きく一時的な資料なので Git には入れない。オーナーの手元の `.tools/references/ui-v0.1.pdf` にだけある（Orca の worktree には `.worktreeinclude` で複製される）。ほかの環境では見られないので、PDF がないことを理由に作業を止めない。
- デザインが固まったら削除してよい。そのとき、モックから採用した判断が DESIGN.md・`docs/design/`・PRD のどれかに残っていることを確認する。
