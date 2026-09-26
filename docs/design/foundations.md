# アイコンと動き

更新：2026-09-26（DESIGN.md v0.2 から分離）。DESIGN.md の spec に対応する節がないため、ここに置く。

## アイコン

- **Lucide**（ISC License）の線画だけを使い、別のセットを混ぜない。
- サイズは `icon-s` 16px（12–14px の文字の横）と `icon-m` 20px（ボタン・ナビゲーション）。メタ情報の中だけ 12px。
- 線の太さは 16px 以下で 1.75、20px で 1.5（描画上は約 1.2px で hairline と揃う）。塗りのアイコンを使わない。
- 色は隣の文字と同じ（`currentColor`）。アイコンだけ別の色にしない（Semantic の Status を除く）。

### いつ使うか

- **使う**：ナビゲーション項目、状態（期限・持ち越し・繰り返し・警告）、操作の種類が一目で分かる場合（追加・編集・閉じる・元に戻す）。
- **使わない**：見出しの飾り、すべてのボタンへの付与、Goal や振り返りの本文の横、Area の代わり（Area は路線記号）。
- アイコンだけのボタンは IconButton（`aria-label` 必須、hover / focus で Tooltip にラベル）。

### 意味の固定

| 意味 | アイコン |
| --- | --- |
| 期限（通常 / 近い / 超過） | `calendar` / `clock` / `circle-alert` |
| 持ち越し | `corner-down-right` |
| 繰り返し | `repeat` |
| Goal への紐づけ | `target` |
| 元に戻す | `undo-2` |
| 変更履歴 | `history` |
| Agent 提案・下書き | `circle-dashed`（破線の円 = 未確定） |
| 計画基準 | `info` |
| 成功 / 注意 / エラー / 情報 | `circle-check` / `triangle-alert` / `circle-alert` / `info`（成功と情報は墨、注意は `warning`、エラーは `danger`） |

**使わない**：Sparkle、魔法の杖、ロボット、脳など「AI らしさ」を示すアイコン。Agent は語（「Agent 提案」）と破線で示す。絵文字を UI に使わない。

## 動き

動きは **状態が変わったことを伝える** ためだけに使う。演出・誘導・装飾のアニメーションを作らない。

| トークン | 値 | 用途 |
| --- | --- | --- |
| `duration-fast` | 100ms | hover / press の色、Checkbox・Switch の切り替え |
| `duration-base` | 160ms | Menu・Popover・Tooltip の出現、行の追加・除外、Toast の出現 |
| `duration-slow` | 240ms | Dialog・Drawer の出入り（最大） |
| `duration-toast` | 8000ms | Toast の表示時間（hover / focus 中は止める） |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 既定 |
| `easing-enter` | `cubic-bezier(0, 0, 0.2, 1)` | 出現 |
| `easing-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 退場 |

- 動かしてよいプロパティは `opacity`、`transform`（8px 以内の移動）、`background-color`、`border-color`、`color`。サイズとレイアウトを動かさない。
- Backlog から今週に入れたとき：行の背景が `here-subtle` に変わり、チェックが付く（`duration-fast`）＋ Toast「〜を今週に入れました · 元に戻す」。行を飛ばすアニメーションは作らない。
- 完了：サークルが塗られる（`duration-fast`）。紙吹雪・チェックの跳ねなどの祝福の演出を作らない。
- Drawer は `duration-slow` で 16px スライドする。
- Loading：300ms 未満で終わる処理にはスピナーを出さない。スピナーは必ず文言と一緒に（「見積中」「保存中…」）。
- indeterminate の Progress は線を滑らせず、不透明度の明滅（40% ↔ 100%）で示す。
- `prefers-reduced-motion: reduce` では、すべての transition / animation を 0ms にする。indeterminate の Progress は静止し、文言で状態を伝える。
