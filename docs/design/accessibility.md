# アクセシビリティ

更新：2026-09-26（DESIGN.md v0.2 から分離）。

DADS の品質基準（WCAG 2.2 AA）を下限にする。後から足すのではなく、部品の仕様に含める。色のコントラストと状態の見た目は [DESIGN.md](../../DESIGN.md) の Colors と Components。一次資料の引き方は `design-references` Skill。

## 色に頼らない

- テキスト 4.5:1、24px 以上または 19px 太字は 3:1。操作部品の輪郭・フォーカス・意味のある印は 3:1。light / dark の両方で満たす。
- **状態を色だけで伝えない**：選択 = 背景＋チェック、期限超過 = 色＋アイコン＋「2日超過」、Agent 提案 = 破線＋「提案」、Area = 印＋ラベル、エラー = 色＋アイコン＋文。
- `forced-colors: active` では Area の路線記号と Capacity のセグメントの色を保ち、操作部品の輪郭は `CanvasText` にする。背景色で描く線（Divider、Progress の塗りとトラック）と Notice の面の境界も `CanvasText` で描く。

## フォーカス

- 全要素共通：`outline: 2px solid var(--focus); outline-offset: 2px`（`:focus-visible`）。リスト内・タブ・メニュー項目は `outline-offset: -2px`。
- フォーカスを消すスタイル（`outline: none` だけ）を書かない。
- Dialog とモーダル Drawer は、開いたらフォーカスを中に移し（最初の入力、なければ最も安全な操作）、Tab を閉じ込め、閉じたら呼び出し元に戻す。Esc で閉じる。

## キーボード

| 場所 | 操作 |
| --- | --- |
| 全体 | Tab / Shift+Tab で移動、Enter / Space で実行 |
| Tabs | ← → で移動、Home / End |
| Menu | ↓ ↑ で移動、Home / End、Enter で実行、Esc で閉じてトリガーに戻る |
| Backlog / Today のリスト | Space：その行のコントロールを押す（Backlog は □ 今週へ、Today の今日やるは ○ 完了、今週の残り・昨日の続きは「今日へ」）、Enter：詳細、E：Estimate の編集、Alt+↑↓：並べ替え。Backlog では Delete：アーカイブ（元に戻せる） |
| Planning | N：タスク追加欄へ、⌘/Ctrl+Enter：Sprint を確定（確認 Dialog を開く） |
| Tooltip | focus で即表示、Esc で閉じる |

- ドラッグで並べ替えられるものは、キーボード（Alt+↑↓）とメニュー（「上へ」「下へ」）でも同じことができる。
- 1 文字のショートカットは入力欄の中では無効にする。

## ターゲットと拡大

- pointer：24px 以上（`target-min`）。行内の小さな操作は 28px の見た目で、周囲に余白を取る。
- compact 幅（768px 未満）：44px 以上（`target-touch`）。Checkbox と完了サークルは 44px の当たり判定を持つ。
- 文字の 200% 拡大と、幅 320px でも情報が欠けない。Task のタイトルは省略するが、詳細で全文を読める。

## フォーム（DADS の構造）

- 順序は **ラベル → サポートテキスト → 入力 → エラー**。サポートテキストとエラーは `aria-describedby` で入力に結ぶ。
- 必須は「必須」の語で示す（色や記号だけにしない）。Itera は任意項目が多いので、任意を示す場合は「任意」。
- エラーは入力の直下に、アイコン＋「何が問題で、どう直すか」を書く（「数値で入力してください（例: 1.5）」）。送信時に最初のエラーへフォーカスを移す。
- プレースホルダーをラベルの代わりにしない（検索欄とクイック追加だけ、視覚ラベルを省略して `aria-label` を付ける）。
- 無効化したボタンは理由を近くに書く。可能なら無効化せず、押したときに理由を示す。
- 数値の入力は `inputMode="decimal"`。

## スクリーンリーダー

- □ は「今週に入れる: タスク名」、○ は「完了にする: タスク名」と読ませる。
- Agent 提案の値は「Agent の提案（未確定）: 2〜4時間」、Estimate は「見積もり 3時間」と読ませる。
- 動的な結果（Toast、Capacity の状態、保存エラー）は `role="status"` / `role="alert"` で通知する。
- 装飾のアイコンは `aria-hidden`。意味を持つアイコンだけに `aria-label`。
- Menu の選べる項目は `menuitemcheckbox`、Filter の選択は `aria-pressed`、Navigation の現在地は `aria-current="page"`（フォーカスは内側のリング）。
- 部品ごとの role：Dialog は `role="dialog"`（破壊的な確認は `alertdialog`）＋`aria-modal`、Tabs は `role="tablist"` と roving tabindex、Switch は `role="switch"`＋`aria-checked`、Progress は `role="progressbar"`＋`aria-valuetext`、Tooltip は `role="tooltip"` で、pointer を載せても消えない（WCAG 1.4.13）。
