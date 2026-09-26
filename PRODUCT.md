# Product

<!-- impeccable:product-schema 1 -->

> このファイルは `docs/requirements/prd.md`（PRD v0.2）から要約した Impeccable 用の製品文脈。PRD と食い違ったら PRD が正しい。PRD を変えたら、ここも合わせて直す。

## Platform

web

## Users

仕事・研究・学習・家事・創作など、複数の活動を一人で並行して進める個人。週ごとの成果と、実行できる範囲を自分で決めたい人。最初の利用者は作者自身だが、作者の職種・ツール・AI 契約には最適化しない。

ジョブ：今週使える時間の範囲で達成したいことを決め、毎日は必要なものだけ選び、週末には結果を見て次回の計画を一つだけ良くしたい。

## Product Purpose

1 週間の Sprint ごとに `Backlog → Planning → Today → Retro → 次の Planning` を回し、週単位の意図・日々の選択・振り返り・次回への改善を一貫して残す。Scrum の儀式を個人向けに再現するものではなく、通常の ToDo 管理に「その週に何を達成したかったか」「どの判断で選んだか」「次に何を変えるか」を足す。

最重要の体験は Sprint Planning。Retro は次回の Planning の質を少しずつ上げる体験として同じくらい重要。成功は完了 Task 数や稼働時間ではなく、Planning / Retro の継続、Retro Improvement が次の Planning で確認されること、入力負荷の低さで見る。

## Positioning

見積もりを 3 つに分けて扱う：本人の Estimate、製品の Estimate Suggestion（幅）、今回の Planning Value。提案を Estimate に「採用」する操作と、計画基準を「適用」して計画値を作る操作を分ける。Retro Improvement（自然文）と Planning Criterion（機械適用できるルール）を分け、次の Planning に引き継ぐ。持ち越し・見送り・割り込み・Sprint 中の追加を失敗として消さず、次の判断材料として残す。

## Operating Context

- PC Web を設計の基準にする。Planning と Retro は PC 中心でもよいが、主要サイクルをスマートフォンだけでも完了できる方向を維持する。Today と Backlog はスマートフォンでの利用頻度が高く、完了・見送り、Quick Capture、Task 詳細、割り込みの記録を片手で行いやすくする。
- Planning は 1 つの画面が Pick → Shape → Check と変化する。ウィザードにしない。
- Retro は「事実を見る → 振り返る → 引き継ぐ」。長い KPT を求めない。
- Goal は Sprint × 領域（Area）ごとに置く。全体 Goal は持たない。

## Capabilities and Constraints

- Task はタイトルだけで成立する。領域・期限・Estimate・繰り返しは後から。
- 繰り返しは毎日 / 平日 / 毎週 / 毎月。Rule と各回（Occurrence）を分ける。
- Today の操作：開始 / 完了 / 今日はここまで / 今日は見送る / 今日から外す / 繰り返しのスキップ。実績時間は任意。割り込み（Interrupt）は Task と別に記録する。
- AI / Agent は候補・根拠・差分を出すだけで、確定は本人がする。AI がなくても全フローを完了できる。
- MVP の対象外：チーム機能、外部カレンダー等との同期、通知、生産性スコア、全体 Goal、複雑な依存関係、課金。
- 未決：認証方式、データの保存・同期・削除・エクスポート、外部 Agent / MCP を初回リリースに含めるか。

用語と意味の詳細は `docs/domain/domain-model.md`。

## Brand Commitments

製品名は Itera（このリポジトリでの決め。PRD の「Personal Sprint」は仮称）。見た目・トークンは `DESIGN.md`（Quiet, precise personal planning tool）、語り口と用語は `docs/design/content.md`（丁寧体で短く、失敗を責めない）に従う。

## Evidence on Hand

実際の利用データ、利用者の声、事例はまだない。デザインの当たり付けとして UI v0.1 モック（オーナーの手元のみ）がある。存在しない実績・数値・引用を作らない。

## Product Principles

1. 成果から考える：Task と領域ごとの Goal を行き来しながら「今週どんな状態にしたいか」を言葉にする。
2. 本人の判断を中心にする：Task、Goal、計画値、Improvement、Criterion を確定するのは本人。
3. 現実との差を隠さない：持ち越し・見送り・割り込み・計画の変更を次回の判断材料にする。
4. 入力を増やしすぎない：Task はタイトルだけで成立する。日々の完了や見送りに理由入力を強制せず、実績時間も任意にする。
5. 観測と推定を分ける：本人の Estimate、製品の提案、今回の計画値、実績時間を混同しない。参照していない実績を参照したように説明しない。
6. 履歴を意味のある単位で残す：「この Task」「この Sprint」「この日」「この繰り返し回」を分け、現在値の上書きで過去の判断を失わない。
7. AI がなくても成立する：AI / Agent は便利さを足すが、フローの完了条件ではない。
8. 成績表にしない：点数化した評価を作らず、Goal の達成も本人が判定する。

## Accessibility & Inclusion

`docs/design/accessibility.md` の基準に従う（DADS の品質基準・WCAG 2.2 AA を下限、状態を色だけに頼らない、compact 幅でターゲット 44px 以上）。
