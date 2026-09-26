---
name: design-references
description: デジタル庁デザインシステム（DADS）と Apple Human Interface Guidelines（HIG）の一次資料を取得して、Itera の UI 設計・実装・レビューの根拠にする。フォーム、アクセシビリティ、モーダル、フィードバック、レイアウト、入力操作などの判断で、DESIGN.md だけでは決めきれないときに使う。
---

# DADS / HIG を参照する

Itera の UI の正本は `DESIGN.md`（トークン・部品・禁止事項）と `docs/design/design-context.md`（参照方針）。DADS と HIG は、その判断の根拠を確かめたり、DESIGN.md に書かれていない細部を決めたりするための一次資料として使う。記憶で引用せず、毎回ページを取得してから使う。

## 優先順位

1. `docs/requirements/prd.md` と `docs/domain/domain-model.md` の意味論（何を表示・操作させるか）
2. `DESIGN.md`（見た目・部品・レイアウト）と `docs/design/`（パターン、Agent UI、文言と用語、アクセシビリティ、アイコンと動き）
3. DADS / HIG（上の 2 つが決めていない細部、または根拠の確認）

DESIGN.md の「参照元と役割」の表で**取り入れない**とされたもの（DADS の行政配色や黄＋黒のフォーカス、HIG の Liquid Glass・Blur・Floating Toolbar・巨大な Navigation Title など）は、一次資料に書かれていても採用しない。DADS と HIG の意見が分かれたら、操作感は HIG、日本語フォームとアクセシビリティは DADS を優先する。

## DADS（デジタル庁デザインシステム）

静的 HTML なので WebFetch でそのまま読める。ページ一覧は `https://design.digital.go.jp/dads/sitemap-0.xml`。

Itera でよく使うページ：

| 論点 | URL |
| --- | --- |
| 色のアクセシビリティ・コントラスト | https://design.digital.go.jp/dads/foundations/color/accessibility/ |
| 文字組み・テキストスタイル | https://design.digital.go.jp/dads/foundations/typography/ 、`.../typography/text-style/` |
| 余白・レイアウト・ブレークポイント | https://design.digital.go.jp/dads/foundations/spacing/ 、`.../foundations/layout/` |
| アイコンの使い方 | https://design.digital.go.jp/dads/foundations/icon/ |
| アクセシビリティ全般 | https://design.digital.go.jp/dads/guidance/accessibility/ |
| 文言・表記 | https://design.digital.go.jp/dads/guidance/style-guides/ |
| 部品（いつ使う / 使わない） | https://design.digital.go.jp/dads/components/ 配下（例: `modal-dialog/`、`switch/`、`tab/`、`chip-tag/`、`combobox/`、`notice-block/`） |

フォーム部品の実装例は React 版サンプル部品集 https://github.com/digital-go-jp/design-system-example-components-react にある。構造（ラベル → サポートテキスト → 入力 → エラー、`aria-describedby` の結び方）を参考にし、スタイルは DESIGN.md のトークンに置き換える。コードを丸ごと持ち込まない。

## Apple HIG

公開ページはクライアント側で描画されるため、WebFetch では本文が取れない。同梱スクリプトで DocC JSON から Markdown に変換して読む。

```sh
node .agents/skills/design-references/scripts/hig.mjs --list            # トップの分類
node .agents/skills/design-references/scripts/hig.mjs --list patterns   # 分類内のページ
node .agents/skills/design-references/scripts/hig.mjs modality          # 本文
```

Itera でよく使うページ（slug）：`modality`、`undo-and-redo`、`feedback`、`entering-data`、`loading`、`searching`、`drag-and-drop`、`layout`、`accessibility`、`typography`、`buttons`、`lists-and-tables`、`sheets`、`popovers`、`text-fields`、`toggles`、`keyboards`、`pointing-devices`。存在しない slug は 404 になるので、`--list <分類>` で確かめる。

HIG は Apple プラットフォーム向けの資料なので、Web に当てはめるときは原則（階層・明快さ・フィードバック・モーダルの節度・直接操作と Undo・入力方式の同等性）を取り、プラットフォーム固有の部品名や見た目は取らない。

## 使った根拠を残す

- 一次資料で判断した場合は、PR 本文やレビュー結果に URL（HIG は `https://developer.apple.com/design/human-interface-guidelines/<slug>`）と該当箇所を短く書く。
- 繰り返し使う判断になったら、`DESIGN.md` か `docs/design/design-context.md` への追記を提案する。一次資料の長文を repo に貼らない。
- 取得に失敗したら、記憶で補わずに失敗したことを報告する。
