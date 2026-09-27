# 文言と用語

更新：2026-09-26（DESIGN.md v0.2 から分離し、PRD v0.2 / ドメインモデル v0.2 Final の用語に合わせた）。

用語の意味の正本は [ドメインモデル](../domain/domain-model.md) の「用語」表。ここは画面での書き方を決める。

## 語り口

- 丁寧体（です・ます）で短く。感嘆符、絵文字、煽り（「今すぐ」「最強」）を使わない。
- 本人を主語にする（「あなたが決めます」「本人が確定するまで反映されません」）。Agent は「Agent」と呼び、擬人化しない。
- 失敗を責めない。持ち越しは「持ち越し」、自己判定は「できなかった」。「失敗」「遅れ」と書かない。
- 結果を言い切る Toast（「3件を今週に入れました」「Sprint 14 を確定しました」）。次にできることを添える（「元に戻す」）。
- 表記は「Sprint 14」。欧文を大文字だけで組んだ飾りのラベル（「SPRINT 14」）は使わない。
- 和文と欧文の間は半角スペース（「Goal を書く」）。数字と助数詞・単位は詰める（「3件」「2日」「1.5h」）。範囲は en dash でスペースなし（「2–4h」「9/28–10/4」）。可用時間との差（残り・超過）は、正負にかかわらず前後にスペースを入れた「〜」（「残り 1 〜 3h」「残り −1 〜 1h」「超過 3 〜 5h」）。曜日付き日付の範囲だけ前後にスペース（「9/28 (月) – 10/4 (日)」）。

## 用語

| 画面の語 | モデル | 意味と表記 |
| --- | --- | --- |
| Sprint | Sprint | 1 週間の計画単位。「Sprint 14」。カタカナにしない |
| Backlog | Backlog（ビュー） | active な Task の一覧。Sprint や Today に入っても消えない。今の Sprint に入っている Task には「今週」 |
| 領域 | Area | 仕事・研究など、本人が作る領域。画面では各 Area の名前を出し、「カテゴリ」と呼ばない。未設定は「領域なし」 |
| Goal | SprintGoal | Sprint × 領域の「今週の終わりにどんな状態にしたいか」。「〜な状態にする」「〜を終える」。任意 |
| Goal に紐づく / 紐づかない | SprintTask.goalLink | 短く出すときは「Goal なし」でもよい。紐づかない Task も時間に含める |
| Estimate | Estimate | 本人が確定した点の値。「3h」「30m」 |
| 提案 | EstimateSuggestion | 製品が出す幅。「提案 2–4h」（破線） |
| 採用 | Estimate.source ほか | Agent の提案を本人の値にすること。Estimate では提案の下限・中央・上限のどれかを選ぶ（「上限 4h を採用」、source に記録）。Goal の文案や計画案の項目にも使う |
| 計画値 | PlanningValue | この Sprint の時間の判断に使う値。「今回は 5h で計画」。Sprint 確定時（追加分は追加時）に固定 |
| 計画基準 | PlanningCriterion | Estimate の幅を計画値のどこで使うかのルール。「研究の推定幅 → 上限を計画値に」 |
| 適用 | CriterionUse.appliedAtConfirm | 計画基準を今回の計画値に使うこと。Estimate は変わらない |
| 可用時間 | Sprint.availableHours | 今週、計画に使える時間（本人が入力）。「可用時間 18h」 |
| 計画値の合計 | — | 計画値の合計（幅のまま）。「16.5–18.5h」 |
| 残り / 超過 | — | 可用時間 − 計画値の合計。「残り −1 〜 1h」「超過 3 〜 5h」 |
| 持ち越し | SprintTask = CarriedOver | Sprint 終了時に未完了。「持ち越し 2回（Sprint 13から）」 |
| 繰り返し | RecurrenceRule / Occurrence | ルールで発生する Task と、その回。「毎週 土」「毎週 月・木」「平日 · 今週 2/5」 |
| 未処理 | DailySelection = Unresolved / Occurrence = Missed | 選んだまま日付が変わった / 繰り返しの回が Sprint 終了時に未処理。見送りには数えない |
| 昨日の続き | 前日の DailySelection = Paused（派生） | Today の候補の上に出す。自動では今日に入れない |
| 未見積 | 計画値の元がない | 「未見積」。0h と書かず、合計に含めない |
| 未見積のサブタスク | サブタスク合計で、見積りのないサブタスクがある | 見積りのある分の合計に件数を添える。「2.5h ＋ 未見積 1」 |
| 今日へ / 今日やる | DailySelection | 今日やると選ぶこと |
| 開始 / 完了 | DailySelection = Started / Done | — |
| 今日はここまで | DailySelection = Paused | 作業したが未完了。翌日「昨日の続き」 |
| 今日は見送る | DailySelection = Deferred | 今日はやらないと決めた。「N回続けて見送り」 |
| 今日から外す | DailySelection = Removed | 選び直し。見送りに数えない |
| スキップ | Occurrence / DailySelection = Skipped | 繰り返しの回だけ |
| Sprint 中の追加 | SprintTask.origin = midSprint | 確定後に Sprint に入った Task |
| 割り込み | InterruptNote | 予定外の出来事のメモ。Task ではない |
| 確定 | Sprint = Active | 本人が Sprint を確定すること。「Sprint 14 を確定」。Agent には使わない |
| Retro | Retro / Sprint = review | 事実を見る → 振り返る → 引き継ぐ。Sprint Header の Status の語は Retro の最初の実装 Issue で決める |
| できた / 一部できた / できなかった / 判断しない | SprintGoal.selfAssessment | Goal の自己判定。未選択は「未判定」 |
| 改善策 | RetroImprovement | 次の Sprint で 1 つだけ変えてみること（自然文、1 件） |
| 続ける / 終える / 置き換える | CriterionUse.retroDecision | 計画基準の Retro での決定 |
| Agent 提案 | EstimateSuggestion / PlanProposal | Agent が作った未確定の値・文・計画案 |

## 日付と時刻

- 日付は「9/28 (月)」。見出しの日付は「9月29日（火）」（全角括弧）。範囲は「9/28 (月) – 10/4 (日)」。
- 相対は「あと2日」「今日まで」「2日超過」。「明日」「昨日」は 24 時間以内の記録にだけ使う。
- 時刻は 24 時間表記（「14:02」）。「2分前」は 1 時間以内だけ、それ以降は時刻。

## ボタンの文言

- 動詞で終える（「Sprint 14 を確定」「追加」「保存」「差分を確認」「元に戻す」）。
- 「OK」「はい / いいえ」を使わない。確認 Dialog のボタンは結果を書く（「戻って調整」「Sprint 14 を確定」）。
