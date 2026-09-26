# DESIGN.md v0.1 と PRD v0.2 / ドメインモデル v0.2 Final の食い違い

更新：2026-09-26。

DESIGN.md v0.1 は PRD v0.2 とドメインモデル v0.2 Final より前に書かれたため、用語と操作の意味にずれがある。意味・状態・用語・操作の種類はドメインモデル → PRD を優先し、DESIGN.md は見た目・部品・トークン・レイアウト・文言のトーンに使う（`AGENTS.md`）。ここに挙げた読み替えで実装を進め、DESIGN.md 自体の更新は Issue で扱う。

この一覧は網羅的ではない。ここにない食い違いを見つけたら、画面やコードで辻褄を合わせず、どの文書を更新するかをオーナーに確認して、この表に追加する。

| DESIGN.md v0.1 | 正（PRD / ドメインモデル） | 実装での扱い |
| --- | --- | --- |
| **Domain**。Work / Research / Learning / Life を名前付きのトークン（`domain-work` など）で持ち、ユーザー定義の Domain は `domain-5` から順に割り当てる | **Area**。ユーザーが定義する領域で、名前・色・並び順を持つ（ドメインモデル Area） | コードは `Area`、画面の語は「領域」。`domain-work`〜`domain-7`（7 色）と `domain-none` は Area に割り当てる色の候補として使い、Work などの名前を固定の領域として扱わない |
| **Backlog** = まだ Sprint に入っていないタスクの置き場 | active な Task のビュー。Sprint や Today に入っても消えない（不変条件 2） | Sprint に入っている Task も Backlog に出し、「今週」と分かるようにする（PRD §5.A） |
| **Estimate** に幅がある（「2–4h」）。見積もり合計は Estimate の合計 | Estimate は本人の点の値。幅は EstimateSuggestion。容量と比べる合計は PlanningValue の合計（PRD §9 の 5）。PlanningValue は lo–hi の幅を持ちうる（Scenario B の「計画値 2–3h」） | EstimateSuggestion は破線と「提案」で表示する。planSnapshot に固定した PlanningValue は、幅があっても実線（確定した値）。合計は幅のまま表示してよい |
| Goal の自己判定「達成 / 一部達成 / 未達」 | 「できた / 一部できた / できなかった / 判断しない」（PRD §5.D）。未選択の間は「未判定」（ドメインモデル SprintGoal） | PRD の 4 択を出す。未判定は初期状態で、選択肢にはしない |
| **Sprint Review** が Retro と別の段階・画面 | Retro の中の「事実を見る → 振り返る → 引き継ぐ」（PRD §5.D）。Sprint.state は終了日を過ぎるか Retro を始めると review、Retro 完了で closed | 独立した Review 画面は作らない |
| 改善策（ImprovementAction）の結果「続ける / やめる」を次の Planning の最上部で決める（applied / kept / dropped）。Retro の必須入力は改善策 1 つだけ | RetroImprovement は自然文 1 件で、決定を持たない。決定は計画基準についてだけで、Active な基準があった Sprint の Retro の中で、完了前に「続ける / 終える / 置き換える」を選ぶ。これを選ぶまで Retro は完了しない（PRD §5.D、不変条件 36） | 計画基準の決定欄は Retro に置き、該当する Sprint では Retro 完了の必須条件にする。次の Planning の reminder には決定欄を置かない |
| Retro で「持ち越しの理由」を短く入力（任意） | SprintTask に理由の属性はない（ドメインモデル SprintTask）。Retro の入力は基本的に「気になったこと」と「次に 1 つ変えること」の 2 つ（PRD §5.D）。入力を足す前に判断に必要かを確かめる（PRD §13） | このリポジトリの読みとして、入力欄は作らない（オーナーの判断待ち）。気になったことは ReflectionNote に書ける |
| Today の操作は完了・スキップ・割り込みメモ | 開始 / 完了 / 今日はここまで / 今日は見送る / 今日から外す / 繰り返しのスキップ（PRD §5.C） | 6 つの操作を用意する。強い操作を常時並べすぎない（PRD §12） |
| 割り込みメモを Task 行のメニューから記録 | InterruptNote は Sprint に属し、Task ではない（不変条件 29） | Task から独立した入口にする |
| compact の Planning は段階ごとの画面と「次へ」（どの段階にも戻れる） | 強制ウィザードにしない。1 つの workspace が Pick → Shape → Check と変化する（PRD §5.B） | このリポジトリの読みとして、compact で段階ごとに分けてもよいが、どの段階にも自由に移れ、「次へ」を必須の順路にしない |
| **Chore** = Goal に紐づかない定常タスク | goalLink = unlinked。Chore・定常 Task・繰り返し・Sprint 中の追加を含む（PRD §5.B、ドメインモデル SprintTask） | 表示は「Goal に紐づかない」（DESIGN.md が許す「Goal なし」でもよい）。Chore は例の 1 つとして扱う |
| `bundle.js`（`window.PersonalSprint`）、`ps-` クラス、`.ps-num`、`formatHours` / `formatRange` / `formatTotal`、Screens | このリポジトリにはない | Appendix B は仕様として読み、shadcn（base-ui）で作る。数値の書式規則（tabular-nums、1h 未満は `30m`、合計は h、範囲は en dash、負を含む範囲は `〜`）は自前で実装する |
