# デザインの参照方針

更新：2026-09-26。

## 何を正本にするか

見た目・部品・レイアウトの決定は [DESIGN.md](../../DESIGN.md) を正本にする。意味・状態・用語は PRD とドメインモデルが優先し、DESIGN.md v0.1 との既知の食い違いと読み替えは [DESIGN.md v0.1 の食い違い](design-md-v0.1-gaps.md) にまとめている。DESIGN.md 自体は Design System アーティファクトの 1 ファイル版で、このリポジトリではこれを正本として扱う。方向は「Quiet, precise personal planning tool」。迷ったら DESIGN.md 冒頭の 3 つの判断基準（Border first → Divider first → Shadow last、Sans で操作し明朝で考える、破線は「まだ本人が決めていない」）に戻る。

DESIGN.md が参照している `tokens.css`・`components/bundle.js`・「Screens」は Design System アーティファクト側のもので、このリポジトリにはない。`apps/web` ではトークンを Appendix A から CSS 変数として写し、部品は Appendix B を仕様として shadcn（base-ui）で作る。

## 外部の一次資料

DESIGN.md の「参照元と役割」の表で、取り入れるもの・取り入れないものを決めている。一次資料はその範囲で、DESIGN.md が決めていない細部を決めるときや根拠を確かめるときに使う。取得の手順は `design-references` Skill（`.agents/skills/design-references/`）にまとめた。

| 資料 | 主に使う場面 |
| --- | --- |
| [デジタル庁デザインシステム（DADS）](https://design.digital.go.jp/dads/) | 日本語フォームの構造（ラベル → サポートテキスト → 入力 → エラー）、必須表示、色だけに頼らない状態表示、コントラスト、ターゲットサイズ、文言・表記、部品の「いつ使う / 使わない」 |
| [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines) | 操作感の原則。階層と明快さ、フィードバック、モーダルの節度、直接操作と Undo、本人の主導権、pointer / touch / keyboard の同等性 |

両者の意見が分かれたら、操作感は HIG、日本語フォームとアクセシビリティは DADS を優先する（このリポジトリでの決め。DESIGN.md はアクセシビリティの下限を DADS の品質基準（WCAG 2.2 AA）としている）。HIG は Apple プラットフォーム向けなので、Web には原則だけを当てはめ、プラットフォーム固有の部品や見た目（Liquid Glass、Blur、Floating Toolbar、巨大な Navigation Title）は取らない。

## UI v0.1 モック

`.tools/references/ui-v0.1.pdf`（元のファイル名は `Personal Sprint.pdf`。21 ページ。Planning の Pick / Shape / Check、Today、Retro など）は最初の当たり付けで、見た目の正本ではない。PRD は UI v0.1 を「情報構造と主要フローの基準」としているので、その範囲で参考にし、情報密度・余白・文言・インタラクションは実装して触りながら削る（PRD §12）。

- 容量が大きく一時的な資料なので Git には入れない。オーナーの手元の `.tools/references/ui-v0.1.pdf` にだけある（Orca の worktree には `.worktreeinclude` で複製される）。ほかの環境では見られないので、PDF がないことを理由に作業を止めない。
- デザインが固まったら削除してよい。そのとき、モックから採用した判断は DESIGN.md か PRD に残っていることを確認する。
