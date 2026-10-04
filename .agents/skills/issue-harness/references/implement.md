# 実装担当

1. Issue が実装の対象になるか（SKILL.md のオーナー条件）を確かめる。Issue と合意の根拠を読み、目的・範囲・観察できる受け入れ条件・重要な未決を短く確認する。既存の Issue / PR / ブランチを探し、重複を避ける。着手できるなら局所設計を自分で行う。
2. `CONTRIBUTING.md` に沿った Issue 番号付きブランチを使う（Orca なら worktree を分ける）。他者や別セッションの未コミット変更を自分の成果として扱わない。開始時刻と上限を確かめる。
3. 必要な領域の文書と共有 Skill だけを読む。UI なら `DESIGN.md` と `docs/design/` の該当する文書（パターン、文言と用語、アクセシビリティなど）、必要に応じて `design-references` / `shadcn` / `impeccable` Skill。画面の文言を書く・変えるときは、先に `ui-copy` Skill を読む。ドメインなら `docs/domain/domain-model.md` の該当する状態遷移と不変条件。重要な不確実性は論点を絞って `harness-planner` に相談する。
4. 変更に合った検証を実行し、コマンドと結果を控える。UI は `pnpm agent:playwright` で実際に操作し、compact（768px 未満）・medium（768〜1199px）・wide（1200〜1439px と 1440px 以上）を確認する。要件を弱めたり既存の検査を無効化して合格させない。画面の文言を変えたら `pnpm copy:lint` の警告を読み、変えた文言の警告を直すか、残す理由を PR に書く。
   見た目が変わるときは、`visual` のレビュー用に、変えた画面と状態（エラー・空・長い文字列など、変更が関わるもの）を最低限次のとおり撮る：390・1000・1440px の light と、1440px の dark（`<html data-theme="dark">`）。撮影の前に開発用メニュー（DevMenu）を隠す。保存先は `.tools/harness/issue-<番号>/<実行ID>/head-<短い SHA>/`、名前は `<画面>-<状態>-<幅>[-dark].png`。
5. SKILL.md の「レビューの構成」で区分を決める。編集を止め、対象を固定して、必要な観点の `harness-reviewer` を並列で起動する（Agent tool で `subagent_type: harness-reviewer`、依頼の先頭に観点を書く。`acceptance` は `model: sonnet` を指定する）。会話の全文、PR 説明、実装理由の説明、「合格にしてほしい」という結論は渡さない。
6. 指摘を SKILL.md の「指摘の扱い」に沿って修正または却下する。製品判断や文書の矛盾は要件整理へ、環境不足は `blocked` へ分ける。修正後は検証をやり直し、同じ Reviewer を `SendMessage` で再開して、新しい head と、却下した `MUST` があればその理由を伝える。`visual` から画像の追加を頼まれたら、撮り足して同じ Reviewer を再開する。`copy` の指摘で語を変えたら、PR の旧 → 新の表も直す。

レビュー依頼に含めるもの：観点、Issue URL、確認した条件と根拠、base / head と未コミット差分の有無、変更ファイルの一覧、実行した検証のコマンドと終了結果、証拠の場所（画面の文言を変えて `pnpm copy:list` で一覧を作ったなら、その置き場も）、未確認事項。

PR のレビュー行に書くもの：区分と理由、起動した観点（`acceptance` を Sonnet で起動したらその旨）、観点ごとの判定とその対象の head、`MUST` / `SHOULD` / `NOTE` の件数、修正・却下の件数、修正しなかった構造上の `SHOULD` の理由。

完了報告：変更の要点 / 条件ごとの検証根拠 / 対象コミットまたは差分 / 未確認事項 / レビュー結果 / 残る push・PR・マージ操作。取得できない数値を推定で埋めない。
