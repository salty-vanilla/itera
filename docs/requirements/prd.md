# Personal Sprint PRD v0.2

作成日: 2026-09-26  
状態: **Frontend 実装開始時点のプロダクト基準**。UI v0.1（Backlog / Planning / Today / Retro）と Domain Model v0.2 Final を反映する。  
位置づけ: 画面の細部は実装・実利用で調整してよいが、本書のプロダクト原則・主要フロー・意味論は変更理由を明示せずに崩さない。

## 0. v0.2 で確定した方向

- 初期利用者は作者自身。ただし作者固有の職種・ツール・AI 契約には最適化しない。
- MVP の Sprint は **1 週間**を基本とする。
- プロダクトの中心は `Backlog → Planning → Today → Retro → 次の Planning` の循環である。
- 最重要体験は Sprint Planning。Retro は次回 Planning の質を少しずつ改善するための体験として同等に重要である。
- Goal は **Sprint × Area** ごとに置く。全体 Goal は持たない。
- Task は Goal を恒久的には持たない。Sprint 内で Goal に紐づくかどうかを決める。
- Backlog は Task の保存先ではなく、未完了の Task を見るためのビューとして扱う。Task は Sprint / Today に入っても Backlog から消えない。
- タイトルだけの Task を正常な状態として扱い、領域・期限・Estimate の入力を追加時に強制しない。
- 所要時間は **Estimate（本人） / Estimate Suggestion（製品の提案） / Planning Value（今回の計画値）** を分ける。
- 製品内 AI の最初の重点は Task 単位の Estimate 支援。AI がなくても全フローを完了できる。
- Retro Improvement は自然文、Planning Criterion は機械適用できるルールとして分離する。
- MVP の Planning Criterion は「Estimate の幅を下限 / 中央 / 上限のどこで Planning に使うか」だけを扱う。
- 繰り返し Task は Rule と各 Occurrence を分け、今週発生する回は Planning 開始時に既定で Sprint に含める。不要な回は本人が外せる。
- Today は日次計画ツールやタイムトラッカーにしない。今日やる Task の選択と、完了・見送り・途中終了・割り込みの軽い記録に集中する。
- Planning / Today / Retro の Sprint 中の Area 表示名は Sprint 確定時の名前で固定し、Backlog では現在の Area 名を表示する。
- 前 Sprint の Retro が未完了でも次 Sprint の Planning 下書きは作れるが、前 Sprint を Close するまで次 Sprint を確定できない。
- UI v0.1 は設計の基準であり、Frontend 実装では情報密度・余白・文言・インタラクションを実機で検証しながら手修正する。

## 1. プロダクトの要約

仕事、研究、学習、私生活など複数の領域を並行する個人が、1 週間ごとに「何を達成したいか」と「どこまでなら現実的か」を決め、日々実行し、結果から次の計画方法を少し改善するアプリ。

Personal Sprint は Scrum の儀式を個人向けに再現するものではない。通常の ToDo 管理に、**週単位の意図・日々の選択・振り返り・次回への改善**を一貫して残すことを目的とする。

仮の製品名: **Personal Sprint**。

## 2. 背景と解く問題

- 個人の予定は領域をまたぎ、割り込み・体調・見積もり誤差によって週の計画が簡単に崩れる。
- 一般的な ToDo では「何をしたか」は残っても、「その週に何を達成したかったか」「どの判断で選んだか」「次に何を変えるか」が残りにくい。
- Planning、日々の選択、振り返りが分断されるため、同じ過密計画・過小見積もり・先送りを繰り返しやすい。
- AI にタスク操作を任せるだけでは、本人の Planning の仕方そのものは改善しない。
- 高機能な管理ツールは入力負荷が大きく、個人の日常利用では維持しにくい。

## 3. 想定利用者とジョブ

**想定利用者**: 複数の活動を一人で進め、週ごとの成果と実行可能な範囲を自分で決めたい個人。仕事、研究、学習、家事、創作など領域は問わない。

**初期検証**: 作者自身による継続利用を中心に、異なる生活・仕事の文脈を持つ少数の個人へ Planning / Today / Retro の主要フローを試してもらう。

> 今週使える時間の範囲で達成したいことを決め、毎日は必要なものだけ選び、週末には結果を見て次回の計画を一つだけ良くしたい。

## 4. プロダクト原則

1. **成果から考える**  
   Backlog の Task と Area ごとの Goal を行き来しながら、「今週どんな状態にしたいか」を言語化する。Task から先でも Goal から先でもよい。

2. **本人の判断を中心にする**  
   Agent / AI は候補・根拠・差分を出す。Task、Goal、計画値、Improvement、Criterion の確定は本人が行う。

3. **現実との差を隠さない**  
   持ち越し、見送り、途中終了、Sprint 中追加、割り込み、可用時間や Goal の変更を失敗として消さず、次回の判断材料にする。

4. **入力を増やしすぎない**  
   Task はタイトルだけで成立する。日々の完了や見送りに理由入力を強制しない。実績時間も任意とする。

5. **観測と推定を分ける**  
   本人の Estimate、製品の提案、今回の計画値、実績時間を混同しない。参照していない実績を Agent が参照したように説明しない。

6. **履歴を意味のある単位で残す**  
   「この Task」「この Sprint」「この日」「この繰り返し回」を分ける。現在値の上書きだけで過去の判断を失わない。

7. **AI がなくても成立する**  
   AI / Agent は便利さと改善を追加するが、Backlog・Planning・Today・Retro の完了条件ではない。

8. **成績表にしない**  
   生産性スコアや点数化された個人評価は作らない。Goal 達成も本人が自己判定する。

## 5. コア体験

### A. Backlog — 残して、必要なものだけ整える

Backlog は `active` な Task を眺めるビューである。Task が Sprint や Today に入っても Backlog から消えない。

#### Capture

- タイトルだけですぐ Task を追加できる。
- Area、期限、Estimate、優先度は後から設定でき、未設定でも正常である。
- 追加後に編集フォームを強制せず、続けて Task を入力できる。
- PC / スマートフォンのどちらでも quick capture を完了できる。

#### Browse

- Area で絞り込める。
- 少なくとも `すべて / 期限が近い / 期限超過 / 持ち越し / 繰り返し / 領域なし` の切り口を持つ。
- 一覧には情報が存在するものだけ表示し、空欄を `—` で埋めない。
- 既に現在 Sprint に入っている Task は `今週` と分かる。
- 優先度だけを根拠に既定順序を決めない。

#### Organize

Task 詳細では必要に応じて以下を編集できる。

- タイトル、説明
- Area
- 期限
- 優先度
- Estimate
- Recurrence Rule
- Subtask
- アーカイブ

PC は一覧を見失わないサイドパネル、スマートフォンは下から開く詳細を基本とする。

#### Estimate

- 本人が確定した点の値を **Estimate** とする。
- 製品が出す幅付き候補を **Estimate Suggestion** とし、本人の Estimate を自動で上書きしない。
- Suggestion の下限 / 中央 / 上限を本人の Estimate として**採用**できる。値を直してから採用する（**編集して採用**）こともでき、その Estimate は元の提案を覚えておく。
- Suggestion には必要に応じて根拠と不確実な点を表示する。
- Estimate がなくても Task は正常であり、Planning で必要になった時点で補える。

#### Sprint / Today との接続

- Sprint 外の Task を Backlog から `今日へ` 入れると、1 操作で現在 Sprint に mid-sprint addition として追加し、Today にも選択する。
- この追加は Goal に自動で紐付けない。
- Backlog から現在 Sprint の Task を完了した場合は、その Sprint と当日の完了にも反映する。

### B. Sprint Planning — 一週間を考える

Planning は **ひとつの workspace が Pick → Shape → Check と自然に変化する**構成とする。Step 1/3 のような強制ウィザードにはしない。

#### Pick — 今週に持ってくる

- Backlog、持ち越し、期限、今週発生する繰り返し Task を眺める。
- Task を今週へ選び、その場で新規追加・編集もできる。
- Goal の入力をこの段階で強制しない。
- 前回 Retro Improvement と有効な Planning Criterion を確認できる。
- Capacity は主役にせず、選んだ Task の合計と本人が入力した可用時間を控えめに表示する。
- 今週発生する繰り返し Occurrence は既定で選択済み。不要な回は本人が外せる。

#### Shape — Goal と Task を整える

- Area ごとに Goal と選んだ Task を同時に見ながら編集する。
- Goal は「今週どんな状態にしたいか」を表す自然文とする。
- 全 Area に Goal は必要ない。
- Task は `Goal に紐づく / 紐づかない` を選べる。
- Chore・定常 Task・Sprint 中追加など Goal に紐づかない Task も正常であり、時間合計に含める。
- Task を見て Goal を書き、Goal を書いた後に Task を増減できる。
- AI による Goal 文案は小さな補助として提供できるが、自動確定しない。

#### Check — 現実的か確認する

- Area ごとの時間と Sprint 全体の時間を可用時間と比較する。
- 幅がある場合は「何が上振れすると超過するか」を説明する。
- 調整案は必要時に開く段階表示とし、強制的な推奨にはしない。
- Sprint を確定する前に、Task、Goal、Planning Criterion の適用を本人が確認する。
- 前 Sprint の Retro が未完了なら下書き編集はできるが、Sprint を確定できない。

#### Estimate / Planning Value

- Estimate Suggestion を本人の Estimate として**採用**する操作と、Planning Criterion を**適用**して今回の Planning Value を作る操作は別である。
- Criterion を適用しても Task の Estimate は変わらない。
- MVP の Criterion は以下のみ。
  - scope: すべて / 特定 Area
  - range policy: 下限 / 中央 / 上限
- Sprint 確定時に Planning Value とその根拠を固定する。
- Sprint 中に追加した Task も追加時点で Planning Value を固定する。Criterion を使うかは Sprint 確定時の適用判断に従う。
- Sprint 中追加によって Capacity を超えても、Today / Backlog では警告を出さない。Retro で計画時との差として確認できる。

#### 確定後の変更

- Goal 文と可用時間は Sprint 中にも変更できる。Sprint 中に Goal を新しく書くこともできるが、消すことはできない。
- 確定後に Sprint から外した Task は、同じ Sprint に戻せる。繰り返し Task を外した場合、その Sprint の残りの Occurrence は外した回として扱い、Today にも Retro の未処理にも出さない。
- 計画時の値は保持し、変更履歴を Retro で確認できる。
- Planning Criterion の適用有無は Sprint 確定後には変更しない（MVP）。
- Sprint 中の Area 改名はその Sprint の Planning / Today / Retro には反映せず、次 Sprint から反映する。

### C. Today — 今日動く

Today は毎日使う軽量画面であり、日次 Planning や詳細なタイムトラッキングを目的としない。

#### 画面の主役

- 今週の Area Goal を背景として見せつつ、主役は `今日やる Task` とする。
- Sprint の何日目かを軽く表示する。
- 今日の残 Task 数と見込み時間合計を表示してよいが、日次 Capacity を入力させたり超過判定したりしない。
- Planning Criterion 自体は目立たせず、必要な Task の詳細を開いたときに `Estimate 3–5h / 今回は 5h で計画` のように分かる。

#### Today への選択

- 今週の残 Task から本人が `今日へ` 選ぶ。
- Today から外しても Sprint には残る。
- 前日に `今日はここまで` となった Task は翌朝 `昨日の続き` として候補上部に出すが、自動で Today には入れない。
- 当日発生する繰り返し Occurrence は、Planning で外されていなければ自動で Today に現れる。

#### Task の日次操作

- `開始`
- `完了`
- `今日はここまで`
- `今日は見送る`
- `今日から外す`
- 繰り返し Occurrence の `スキップ`

意味は以下のとおり。

- **今日はここまで**: 作業したが未完了。任意で実績時間を残せる。
- **今日は見送る**: 今日やらないと本人が決めた。連続見送りの対象。
- **今日から外す**: 選び直し。見送りには数えない。
- 何も操作しないまま日付が変わった選択は未処理として記録し、見送りには数えない。Retro を始めた時点で開いたままの選択も同じく未処理になる。
- `今日はここまで` `今日は見送る` `今日から外す` にした Task も、その日のうちに終えたら完了として記録できる（Today・Backlog のどちらからでも）。同じ日に選び直すことはできない。
- 繰り返し Occurrence は、同じ Sprint のほかの日にも `今日へ` 選べる（前倒し・後ろ倒し）。
- 完了とスキップは取り消せる。見送りなどの後に完了した Task の完了を取り消すと、元の見送りなどに戻る。

同じ Task を Today に選んだ機会で Deferred が連続した場合、`N回続けて見送り` と中立的に表示する。選ばなかった日と未処理（Unresolved）は無視し、Paused / Done / Removed / 繰り返しの Skipped が挟まると連続は途切れる。

#### 実績時間

- 実績時間は任意。
- 完了後、または `今日はここまで` のときに軽く追記できる。
- ストップウォッチを必須にしない。
- 実績入力がなくても完了・見送り・Retro を妨げない。

#### Sprint 中追加と割り込み

- Today からタイトルと Area 程度ですぐ Task を追加できる。
- 追加した Task は mid-sprint addition として Sprint に入り、Retro の事実に残る。
- 予定外の出来事は **Interrupt** として短いメモと任意の時間を残せる。
- Interrupt は Task とは別物であり、記録しても Today の予定を自動で組み替えない。

### D. Sprint Retro — 一週間から学ぶ

Retro は反省文や成績表ではなく、**今週の事実から次の Sprint で試す変更を一つ決める場所**とする。

同じ workspace が `事実を見る → 振り返る → 引き継ぐ` と自然に変化する。

#### 事実を見る

Sprint の最終日から本人が Retro を始められ、終了日を過ぎるとシステムが Retro の状態にする。繰り返し Task は持ち越しにせず、回ごとの完了 / スキップ / 未処理で見せる。Retro 中（完了前）も実績時間を後から足せる。

Area ごとに以下を確認できる。

- Sprint Goal
- Goal の自己判定: `できた / 一部できた / できなかった / 判断しない`
- 完了・持ち越し
- Goal に紐づかなかった Task
- 繰り返し Occurrence の完了 / スキップ / 未処理
- Sprint 中追加
- Today での見送り / 今日はここまで
- Interrupt
- Planning 時の Estimate / Planning Value
- 実績時間（入力がある場合のみ）
- Goal / 可用時間を Sprint 中に変更した場合の計画時との差

Planning で明示的に外した繰り返し Occurrence は通常の Retro 事実には出さない。

#### 振り返る

- 気になった事実を選び、右側の振り返り材料として集められる。
- 長い KPT を必須にしない。
- 入力は基本的に以下の 2 つでよい。
  - 気になったこと（任意）
  - 次の Sprint で 1 つだけ変えてみること
- AI は事実を根拠に問いや文案を出してよいが、原因を本人の代わりに断定しない。

#### Retro Improvement

- 次の Sprint で試す変更を **Retro Improvement** として自然文で 1 件残す。
- Improvement はそのまま次の Planning に表示する。
- Improvement が機械適用できる場合のみ、任意で Planning Criterion を作れる。

#### Planning Criterion の引き継ぎ

- 今回 Criterion を使った / 適用しなかった場合、Retro 完了前に以下を本人が決める。
  - 次回も続ける
  - 今回で終える
  - 新しい Criterion に置き換える
- 理由入力は求めない。
- 次回に有効な Criterion は MVP では最大 1 件。
- Criterion を作らなくても Retro は完了できる。
- Criterion の設定、効果説明、次回 Planning プレビューは同じ状態から生成し、食い違わせない。

#### Retro 完了

- Retro 完了によって前 Sprint が Closed になり、次 Sprint を確定できる。
- 次 Planning の入口には、前回 Retro Improvement と有効な Criterion を表示する。

## 6. ToDo と繰り返しの基本機能

### Task

- Task は User に属する恒久的な「やること」。
- `active / completed / archived` を持つ。
- Task の Sprint 参加、Today 選択、繰り返し Occurrence は Task の lifecycle と分けて扱う。
- アーカイブしても過去 Sprint の記録から消さない。

### Subtask

- Task は Subtask を持てる。
- Planning の時間計算は `親 Task の Estimate` または `Subtask の Estimate 合計` のどちらか一方を使い、二重計上しない。
- Subtask の Estimate は点の値とする。一部の Subtask が未見積なら、見積りのある分を合計し、未見積の件数を示す。Planning Criterion は Subtask の Estimate 合計には作用しない。
- MVP では Subtask 単位で Sprint へ参加させない。

### Recurrence

- `毎日 / 平日 / 毎週 / 毎月` の基本ルールを扱う。毎週は曜日を複数指定できる（例：毎週 月・木）。
- Rule と各 Occurrence を分ける。
- 今週発生する Occurrence は Planning 開始時に生成し、既定で Sprint に含める。
- Planning で外した Occurrence は Today に出さず、通常の Retro 事実にも含めないが、履歴としては残す。
- Rule を変更しても確定済み Sprint の Occurrence は動かさない。
- Active Sprint 中に Rule を変更した場合も、今 Sprint の計画は変えず、まだ確定していない次 Sprint から新 Rule を使う。次 Sprint の Planning draft がすでに Occurrence を生成していれば、その Occurrence を新 Rule で作り直す。Planning 中に新しく Rule を作った場合も、その draft の Occurrence を生成して既定で含める。
- Backlog では Rule ごとに 1 行を表示し、未来の Occurrence を大量に並べない。

## 7. AI / Agent の役割

### 製品内 AI

MVP の第一候補は Task 単位の Estimate 支援。

- Estimate Suggestion は幅、根拠、不確実な点を提示する。
- 曖昧な Task には具体化や分解を提案できる。
- Goal 文案や Retro Improvement 文案は小さな補助として追加できる。
- AI の Suggestion は本人の値を自動で上書きしない。

Jev / LLM の具体的な採用は検証対象であり、プロダクト成立条件ではない。同じ入力例で手入力、単純な履歴ベース、LLM、Jev 併用等を比較し、精度だけでなく入力負荷・採用率も評価する。

### 外部 Agent

- 外部 Agent は Backlog や Planning 情報を読み、**Plan Proposal** を作れる方向を維持する。
- Proposal は Sprint を直接確定・上書きしない。
- 追加 / 除外 / Goal 変更など差分単位で本人が採否を決める。
- Agent が参照した情報、提案、採否を識別できるようにする。
- MCP は接続方法であり、プロダクトロジックそのものにはしない。
- 画面内の汎用チャットは MVP の必須要件にしない。

## 8. 端末方針

- PC Web を設計・実装の基準とする。
- Today と Backlog はスマートフォンでの利用頻度が高いため、モバイル操作を初期から必須とする。
- Planning / Retro は PC 中心でもよいが、主要サイクルをスマートフォンだけでも完了できる方向を維持する。
- スマートフォンでは Today の完了 / 見送り、Quick Capture、Task 詳細、Interrupt 記録を片手で行いやすくする。
- PC 画面を単純縮小しただけのモバイル UI にはしない。

## 9. MVP 完了条件

1. タイトルだけで Task を追加し、後から Area・期限・Estimate・繰り返し等を整理できる。
2. Backlog を見て Task を Sprint に選び、Planning 中にも Task を追加・編集できる。
3. Area ごとに Goal を書き、Task を Goal に紐づける / 紐づけないを選べる。Goal のない Area も許容する。
4. 本人の Estimate、製品の Estimate Suggestion、今回の Planning Value を区別して表示・記録できる。
5. 本人が入力した Sprint の可用時間と Planning Value 合計を比較でき、Capacity 超過の原因を確認できる。
6. Planning Criterion を使う場合、Task の Estimate 自体を書き換えず今回の Planning Value にだけ反映できる。
7. 今週発生する繰り返し Occurrence が Planning に既定で現れ、外す・完了する・スキップする・次回へ進む履歴が矛盾なく残る。
8. Today で今日やる Task を選び、開始、完了、今日はここまで、今日は見送る、今日から外す、繰り返しのスキップを記録できる。
9. 未完了でも `今日はここまで` から任意の Actual Time を記録できる。
10. Sprint 外の Task を `今日へ` 入れた場合、Sprint 中追加として現在 Sprint と Today に同時追加できる。
11. Interrupt を Task と分けて短く記録できる。
12. Sprint 終了時に Area Goal の自己判定、持ち越し、見送り、Sprint 中追加、Interrupt、Estimate / Planning Value / Actual Time を事実として確認できる。
13. Retro Improvement を 1 件確定し、次の Planning に表示できる。
14. Criterion がある場合は Retro で継続 / 終了 / 置換を決め、次回 Planning に一貫して反映できる。
15. 前 Sprint の Retro が未完了でも次 Planning の下書きは作れるが、Retro 完了前に次 Sprint を確定できない。
16. Goal / 可用時間を Sprint 中に変更しても計画時の値が失われず、Retro で差分を確認できる。
17. Goal や AI の設定なしでも、Task の追加から Today の完了、Retro まで一周できる。
18. Agent が参照していない予定・実績を参照したように説明しない。

## 10. 検証方法と成功指標

### 定性的検証

- 作者が最低 4 週連続で実際の Sprint を回す。
- 各週で Backlog / Planning / Today / Retro を実運用し、入力負荷と画面のノイズを記録する。
- 背景の異なる 3〜5 人に初回 Planning と Today の基本操作を試してもらう。
- UI は完成モックの忠実再現ではなく、実装して触った結果から情報密度・文言・操作数を削る。

### 観察する指標

- Planning 完了率
- Retro 完了率
- Retro Improvement を次週 Planning で確認した割合
- Goal 自己判定の入力率
- 持ち越し / Sprint 中追加 / 見送りが Retro の材料として確認された割合
- Estimate Suggestion の採用 / 編集 / 却下
- Planning Criterion の継続 / 終了 / 置換
- Quick Capture から実際の Planning / Today に使われた Task の割合
- Today の主要操作に要するステップ数と主観的な負荷

完了 Task 数や総稼働時間を増やすこと自体は成功指標にしない。

### Estimate の評価

Actual Time が入力された Task だけを対象に、以下を比較する。

- 本人の Estimate
- 単純な履歴ベース
- LLM / Jev 等を使った Estimate Suggestion

評価観点は、誤差、過小見積もり率、Suggestion 採用率、追加入力の負荷、Task 種別ごとの偏り。履歴が少ない段階で高精度を約束しない。

### ポートフォリオとして残す証拠

- 4 週以上の継続利用結果
- 初期 UI から実装後に削った要素と理由
- Planning / Today / Retro の改善前後
- Estimate Suggestion と Planning Criterion の採否例
- Agent Proposal の根拠・差分・承認フロー
- 代表的な失敗ケースと修正

## 11. 対象外（MVP）

- チーム Scrum、担当割当、権限階層、共同編集。
- カレンダー・GitHub 等との双方向同期。
- 外部サービスへの Agent の自動書き込み。
- 常時自律実行、複数 Agent 構成、複雑な長期記憶。
- 詳細なタイムトラッキング、ストップウォッチ中心の時間管理。
- 生産性スコア、点数化された個人評価。
- 全体 Goal の入力・達成判定。
- 複雑な Task 依存関係。
- 高度な繰り返し条件や Occurrence の個別日付編集。
- 通知、ファイル添付、外部カレンダー同期。
- 収益化、課金プラン、組織管理。

## 12. Frontend 実装時の設計ガードレール

- UI v0.1 は情報構造と主要フローの基準であり、見た目をピクセル単位で固定するものではない。
- 説明文・Badge・Pill・Card nesting を必要以上に増やさない。
- AI の操作を通常操作より目立たせない。
- helper text は常時表示が本当に必要かを実装時に再評価する。
- 赤は原則としてエラーに限定し、持ち越し・見送り・超過可能性を人格評価のように見せない。
- Goal / Improvement のような「考える文章」と、数値 / Estimate のような補助情報の視覚階層を分ける。
- Task Row では常時表示する強い Action を増やしすぎず、hover / tap / detail へ段階開示する。
- Mobile では主要操作を thumb zone に置き、キーボード・safe area を含めて実機確認する。
- Fixture / mock data で Pick / Shape / Check、Today 朝 / 日中 / 割り込み、Retro 開始 / 振り返り / 完了直前、Backlog Capture / Detail / Recurrence を再現し、Backend 前に操作感を検証する。

## 13. リスクと設計上の注意

- 入力項目を増やすほど利用が止まりやすい。新しい記録を追加する前に、その情報が Planning / Today / Retro の判断に本当に必要か確認する。
- Domain Model の厳密さを UI の複雑さとして露出させない。内部では状態を分けても、本人に毎回分類を要求しない。
- Estimate Suggestion と Planning Value が混同されると、本人の見積もりを AI が勝手に変えたように見える。`採用` と `適用` の違いを守る。
- Planning Criterion を増やしすぎると Rule Engine 化する。MVP は Estimate の幅の扱いだけに限定する。
- Recurrence は Rule / Occurrence / Sprint 参加を分けるが、利用者には「今週の回」として自然に見せる。
- 履歴を残す目的は説明可能性と Retro であり、監査ログをユーザーへ常時見せることではない。
- Agent Native の見せ場を増やしすぎず、通常の ToDo と週次サイクルが先に成立することを優先する。
- 機微な仕事・私生活の情報を扱うため、Agent に渡すデータ、保存・削除・エクスポート方針は Backend 実装前に確定する。

## 14. 未決定・後続判断

### Frontend 実装を止めない未決定事項（決定済み）

v0.2 で残した 3 件は、2026-09-27 に次のとおり決めた（Issue #18、ドメインモデル F7〜F9）。

1. **Recurrence Rule と次 Sprint draft の境界**
   未確定の次 Sprint の Planning draft がすでに Occurrence を生成していれば、新 Rule で作り直す。draft で外した選択は引き継がない。確定済み Sprint の Occurrence は動かさない。

2. **連続見送りと Unresolved / Skipped**
   Unresolved は選ばなかった日と同じく無視する（数えず、途切れさせない）。繰り返しの Skipped は連続を途切れさせる。

3. **Active Sprint 中に新しい Area を作った場合**
   SprintAreaSnapshot にない Area が Sprint 中に初めて現れた時点の名前を、SprintAreaSnapshot に足して固定する。

### API の実行基盤・DB・認証（決定済み）

2026-09-27 に次のとおり決めた（Issue #25、`docs/architecture/adr/0004-api-platform-and-auth.md`）。

- API は Hono で書き、Cloudflare Workers で動かす。
- DB は Cloudflare D1、ORM は Drizzle。障害・誤操作からの復元は D1 の Time Travel に任せる。
- 認証は Better Auth（自前でホストする OSS）。利用者とセッションを D1 に置き、ログイン画面は自前で作る。最初のサインイン方法はパスキーと Google だけ（2026-09-30 に変更。Issue #121、ADR 0004）。

### クライアントとデータの方式（決定済み）

2026-09-28 に次のとおり決めた（Issue #45、ADR 0005）。

- オンラインでの利用を前提にし、オフラインでの利用には対応しない。
- 記録の変更の判定と保存はサーバー（`services/api`）が行う。ドメインの規則の正本は `packages/domain` で、これを使うのはサーバーだけとする。
- クライアントは Web・iOS・Android の 3 つ。MVP は Web のみで、iOS（Swift）と Android（Kotlin）は MVP の後にネイティブアプリとして同じリポジトリに追加する。優先度は Web、iOS、Android の順。
- API の契約は OpenAPI の仕様を先に書き、各クライアントはそこから型とクライアントを生成する。
- 入力に合わせて即座に変わるプレビュー（計画値、合計と容量、計画基準を適用したときの見え方、繰り返しの要約と次の日付）は、通信せずに各クライアントがそれぞれの言語で計算する。確定時に固定する値はサーバーが計算する。
- プレビューの一覧と、サーバーの規則から作った共通のテストケースを契約の隣に置く。全クライアントの実装が一覧を満たし、同じ結果になることを CI で確かめる。

### プロダクトとして後続で決める事項

- 一般公開の時期と対象範囲。
- 外部 Agent / MCP を MVP の初回リリースへ含めるか。
- Jev を Estimate Suggestion のどの判断に採用するか。
- データの削除・エクスポートの方式。
- API の個々の operation とテーブル設計（契約の書き方は上記で決定済み）。
- 価格・収益化・公開日。

## 15. 関連設計文書

- **Personal Sprint Domain Model v0.2 Final**: Task / SprintTask / DailySelection / Occurrence、Estimate / PlanningValue、Criterion、履歴などの意味論と不変条件を定義する。
- **UI v0.1**: Backlog / Planning / Today / Retro の主要画面と状態を定義する。

PRD は「何を成立させるか」、Domain Model は「その意味をどう矛盾なく表すか」、UI は「利用者がどう操作するか」を担う。3 つが食い違う場合は、画面をそのまま実装するのではなく、どの文書を更新するかを決めてから変更する。
