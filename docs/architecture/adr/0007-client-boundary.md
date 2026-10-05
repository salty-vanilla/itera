# ADR 0007: クライアントの境界（Web・iOS・Android）

- 状態：採用
- 日付：2026-10-03
- 関連：PRD §14「クライアントとデータの方式」、ADR 0004、ADR 0005、ADR 0006、Issue #45・#262・#265
- 改訂：2026-10-04（操作の可否の形を、記録ごとの出力専用の `capabilities`（`can<操作>` の真偽値）に決める。domain のコマンドの前提を `check…` として切り出し、今日の選択と割り込みに当てる。Web の今日の画面と Task の詳細の選択の操作は、3 つ目の例外から外れた。Issue #322。ほかの記録は #323）、2026-10-04（残りの記録（Backlog の Task・提案・サブタスク・領域・Sprint・Goal・SprintTask・計画の候補と回・振り返り・計画基準・過去の日の記録）に `capabilities` を当て、3 つ目の例外から操作の可否を外す。ほかの記録の操作を置く場合、1 つの面が受ける 2 つの操作、入れ子の記録、状態で断らない操作の扱いを決める。Issue #323）、2026-10-05（振り分けの送る側を `@itera/api-contract/sending` に分け、Web はそれを使う。Issue #356）、2026-10-05（Sprint の開始日より前であることを、今日と実行中の Sprint の読み取りの `opensOn` で返す。記録を作る操作は `capabilities` に置かないまま。Issue #347）

## 背景

PRD §14 は次のとおり決めた（2026-09-28）。記録の変更の判定と保存はサーバーが行う。クライアント（Web・iOS・Android）は OpenAPI の契約から型とクライアントを生成する。入力に合わせて即座に変わるプレビューだけを、各クライアントがそれぞれの言語で計算する。ADR 0005 はそこへの移行の手順と、Web のプレビューの例外（iOS に着手するまで `packages/domain` の関数を使う）を決め、ADR 0006 は契約の書き方を決めた。

iOS（Swift）と Android（Kotlin）は MVP の後に足す。TypeScript の `packages/domain`・`packages/application` は、これらのクライアントとは共有できない。この ADR は、言語をまたいで何を共有し、何を共有しないか、クライアントに許す計算、プレビューの確かめ方、共通の実装（shared core）を検討する条件を決める。

要約：

> Server owns behavior; clients depend only on the contract and compute only listed pure previews.

振る舞いはサーバーが持つ。クライアントは契約だけに依存し、一覧に載せた純粋なプレビューだけを計算する。

## 決定

### 振る舞いはサーバーが持つ

次のことは、サーバー（`services/api` と、それが使う `packages/application`・`packages/domain`）だけが行う。

- 操作の判定（状態の遷移、不変条件）と、記録の保存。
- 「今日」と現在時刻の決定（ADR 0005「時計」）。
- システムの記録（終了日を過ぎた Sprint の Review、その日の始まり。ADR 0004「操作と読み取りの処理」）。
- 確定時に固定する値（planSnapshot）と、記録からの派生値（持ち越し回数、連続見送り、Retro の事実、昨日の続きなど）の計算。
- 記録の ID の生成（ADR 0004「ID の形式」）。

`packages/domain` の TypeScript の実装は、振る舞いの参照実装（authoritative implementation）である。ただし、その出力が仕様を決めるのではない。意味の正本はドメインモデルと ADR で、実装がそれと食い違えば、実装の誤りとして直す。PRD §14 と AGENTS.md の「規則の正本は `packages/domain`」は、規則を実装して実行する唯一の場所（この参照実装）という意味で読む。

### 正本は 3 つ

| 正本 | 何の正本か | 対象 | 使う実装 |
| --- | --- | --- | --- |
| ドメインモデルと ADR（`docs/domain/domain-model.md`、`docs/architecture/adr/`） | 意味の正本（semantic authority）：何が正しいか | Entity と値、状態遷移、不変条件、派生値の意味 | `packages/domain`（サーバー）。仕様ケースの期待値もここから書く |
| OpenAPI（`packages/api-contract/openapi/`、ADR 0006） | 通信の正本（wire authority）：何を送受信するか | operation、要求と応答の形、エラーの `type`（Problem Details）、互換の規則 | `services/api`、すべてのクライアント（生成した型とクライアント） |
| プレビューの一覧と共通のテストケース（下の「プレビュー」。iOS に着手するときに置く） | クライアントの計算の正本（client-computation authority）：クライアントが何を計算してよいか、その計算の意味 | 一覧に載せた関数と、その入力・出力・意味の出典、仕様ケースと生成ケース | すべてのクライアント |

- 3 つ目が決める計算の意味は、1 つ目から来る。一覧は関数ごとに意味の出典（ドメインモデルの節、不変条件の番号、ADR）を持ち、1 つ目と食い違えば、1 つ目に合わせて一覧とテストケースを直す。
- 言語に依存しない operation の定義を、OpenAPI と別には作らない。iOS・Android は operation を実装しないので、作っても、TypeScript の実装しか読まない、もう 1 つの正本になる。

### 依存の向き

Web を契約に移し終えた後（ADR 0005、#272〜#277）の形：

```text
services/api ───────────────▶ packages/application ──▶ packages/domain
services/api ───────────────▶ packages/api-contract（型と検証）
apps/web ───────────────────▶ packages/api-contract（生成したクライアントと型、sending の振り分け）
packages/api-contract/sending・requests ─(型だけ)─▶ packages/application（操作の名前と入力。#295。requests は読み取りの名前と入力も。#350）
apps/web のブラウザ内モック ─▶ packages/application ──▶ packages/domain（開発ビルドだけ）
apps/web のプレビューの例外 ─▶ packages/domain（iOS に着手するまで。ADR 0005）
iOS・Android ───────────────▶ packages/api-contract/openapi/ から生成したもの
```

- Web を特別扱いしない。Web も契約だけに依存し、iOS・Android にない近道（`packages/application` の読み取りを直接呼ぶなど）を持たない。最初のクライアントである Web で、契約の欠けとずれを見つけるため。
- 例外は次の 3 つで、どれも過渡的なもの。終わる時期は例外ごとに決める。
  - ADR 0005「プレビューの例外」：Web のプレビューは `packages/domain` の関数を使う。戻す条件（iOS に着手するとき）も ADR 0005 のとおり。
  - 操作の名前と入力（#295、2026-10-03）：Web は `packages/application` の操作の名前と入力で操作を呼ぶ（Issue #295 の範囲 3。ADR 0005「操作は名前と入力」）。その名前と入力の型は、`@itera/api-contract/sending`（振り分けの規則の送る側、ADR 0006「経路の形」。サーバーとモックは両方向の `/requests`）を通して application から来る。
    - 境界：依存するのは `packages/api-contract/src/sending.ts` と `requests.ts` が application の型を import することだけ。実行時の依存はない（ESLint の `@typescript-eslint/no-restricted-imports` の `allowTypeImports` で、型だけの import に限る）。`openapi/` と生成したものは依存しない。画面は `sending` の型を使い、application を import しない（ADR 0005）。テストの道具 `@itera/api-contract/testing` は application と domain を実行時に使うが、本番のコードから import できない（ESLint）。
    - 理由：要求の組み立ての規則を、サーバー・ブラウザ内モック・Web で 1 か所に置くため。名前と入力は application が正本で、契約に写すと二重になる。
    - iOS・Android は影響を受けない。`openapi/` から生成し、操作の名前と入力では呼ばない（面の operationId で呼ぶ）。
    - 戻す条件：iOS に着手するときに、Web も面の operationId と生成した型で呼ぶ形にするか、操作の名前と入力を契約の側に置くかを決める。
  - 値の規則：プレビューの一覧を決めるまで、Web は値の規則（空でない名前、置き換えには新しい計画基準が要る、など）を送る前に検査してよい。下の「クライアントに許す計算」は目標の形で、iOS・Android は初めからこれに従う。戻す条件：プレビューの一覧を決めるとき（iOS に着手するとき）。
    - 操作の可否は、この例外から外れた（#322 で今日の選択と割り込み、#323 で残りの記録）。Web は `capabilities` が真の操作だけを出し、状態の名前から操作の可否を決めない（下の「操作の可否」）。
- パッケージの名前での import は、各パッケージの `package.json` の依存が決める。相対パスでほかのパッケージ（`packages/*`・`services/api`・`apps/web`）に入る import は、pnpm の解決では止まらないので、製品のコードでは ESLint の `no-restricted-imports` が向きを問わず止める（`eslint.config.js` の `relativeToOtherPackagePattern`、Issue #371。テストと `testing.ts` の helper は対象外）。
- Web の依存は ESLint の `no-restricted-imports` で検査する（ADR 0005）。iOS・Android は言語が違うので、TypeScript の実装には依存できない。
- 契約は内部より上流に置く。`openapi/` と、そこから生成したものは、`packages/application`・`packages/domain` に依存しない。`packages/api-contract` が `packages/application` を使うのは、テスト（契約と実装が合っているかを確かめる。ADR 0006「契約と実装の一致」）と、上の例外の `sending.ts`・`requests.ts` の型だけ。

### アプリケーション層の読み取りと API の DTO

- application の読み取りの結果と、API の応答（DTO）は、別のものとして扱う。契約の正本は `openapi/` で、application の結果が契約を決めるのではない。
- 今は application の結果をそのまま応答にしている（ADR 0006。写像は恒等）。これを続けてよいのは、両者が同じ形でいられる間だけ。
- 内部の形は変えたいが、通信の形は変えたくないときは、`services/api` に、application の結果から DTO への写像を置く。通信の形を変えるのは、意図して契約を変えるときだけにし、ADR 0006「互換の規則」に従う。
- ADR 0006「契約と実装の一致」の型のテスト（両方向で同じ型）は、今は写像が恒等であることを確かめるテストで、application の形が契約の正本であることを示すものではない。内部の変更でこのテストが失敗したら、意図した契約の変更でない限り、契約は変えずに写像を置く。写像を置いたら、型のテストは写像の入力と出力を確かめる形に替え、`services/api` に移す。

### クライアントに許す計算

許す：

- 表示：時間と日付の書式、文言、週の語（前・今・次を「先週」「今週」「来週」に）、ID から記録を引く関数。
- プレビューの一覧に載せた関数（下の「プレビュー」）。
- 入力の形の検査（必須、書式、列挙）。契約のスキーマと同じ内容に限る。サーバーでも検査し直す。値の規則（正の時間、空でない題名など）は、ADR 0006 のとおり domain の規則なので、クライアントで先に検査するなら、プレビューの一覧に載せる。

許さない：

- 状態の遷移と不変条件の判定。操作の可否も自分で判定せず、サーバーが返す値を使う（下の「操作の可否」）。
- 確定時に固定する値と、記録からの派生値の計算。
- システムの記録、「今日」の決定、記録の ID の生成。

判定の基準：クライアントで新しく計算したいものは、次の 3 つを満たすときだけ、プレビューの一覧に足せる。満たさないものは、この ADR を改めてから足す。

1. クライアントが持っているデータ（応答と、入力途中の値）だけで決まる、純粋な関数である。時計・乱数・端末の設定を読まない。「今日」とタイムゾーンは引数で受け取る。
2. 結果を、正しい値としてサーバーに送らない。サーバーは確定するときに計算し直す。
3. 一覧に載っていて、共通のテストケースがある。

### 操作の可否

クライアントに状態機械を持たせないため、読み取りの応答の記録に、今の利用者がその記録に今できる操作を返す（2026-10-04 オーナー決定、Issue #322）。

形：

- 記録の DTO に、出力専用（`readOnly`）の `capabilities` オブジェクトを置く。中身は `can<操作>` の真偽値。先例は Google Drive API の File の `capabilities`（`canEdit`・`canTrash` など）。
- 名前は契約の操作の名前（operationId）から、記録の名詞を除いて付ける（`startSelection` → `canStart`、`removeFromToday` → `canRemove`、`editInterrupt` → `canEdit`）。1 つの面がいくつかの操作を受けるときは、操作ごとに分ける。どの operationId に当たるかは、スキーマの各項目の `description` に書く。
- 記録の種類ごとにスキーマを分ける（`DailySelectionCapabilities`・`InterruptNoteCapabilities`）。持つ項目は記録の種類で決まり、状態では変わらない（押せないものも `false` で返す）。
- その記録を対象にする操作だけを置く。記録を作る操作（`chooseForDay`・`noteInterrupt`）と、記録を対象にしない操作（`recordActualTime` は SprintTask の日を対象にする）は置かない。
- 真は「例の値を与えれば通る」、偽は「断られる（422、または記録が見つからなければ 404）」。操作が受け取る値（正の時間、空でない本文）は、入力がないと決まらないので、判定に入れない。押せない理由は返さない。今ある `blockers`（確定、振り返りの完了）はそのまま。
- 押せない操作を隠すか、押せない状態で出すかは、今の画面のとおり（今の画面は、メニューとボタンの操作を隠す。今日の行の ○ はいつも出し、`canUndoComplete` が真なら完了の取り消し、そうでなければ完了を送る）。どの操作をどこに出すか（メニュー、主なボタン）も画面が決める（例：Web は繰り返しの回に「今日は見送る」を出さず、スキップを出す。#233）。選択の操作でないもの（「かかった時間を記録」の `recordActualTime`）を、完了・中断の行に出すのも画面の配置で、操作の可否ではない。

`availableActions`（操作の名前の開いた列挙）、HATEOAS のリンク、遷移を問い合わせる別の経路は採らない。生成したクライアントはどの経路を呼ぶかを知っているのでリンクは要らず、問い合わせの経路は一覧で往復が増える（2026-10-04、オーナーへの説明）。真偽値の項目は、生成した型で名前の誤りがコンパイルで見つかる。

互換：

- `can…` を足すのは、応答に項目を足す変更（ADR 0006「壊さない変更」）。後から足すものは省略できる項目にし、古いクライアントは知らない `can…` を読み飛ばす。クライアントは知らない `can…` で読み込みを失敗させず、知らない操作は出さない（Web はテストで確かめる）。
- 既にある `can…` を消すこと、意味を変えることは壊す変更。

判定の置き場所：

- サーバーは、domain のコマンドと同じ判定から作る。domain は、コマンドの前提のうち記録の状態で決まる部分を、コマンドとは別に呼べる関数（`check<コマンド>`、例：`checkStartSelection`・`checkCompleteSelection`・`checkEditInterrupt`）として export し、コマンドもまずその関数で判定する。完了・取り消し・スキップの判定は、選択の Task か回の状態まで含む（`checkCompleteTask`・`checkCompleteOccurrence` など、それぞれのコマンドの判定）。
- `packages/application`（`capabilities.ts`）は、操作が読むのと同じ記録（実行中の Sprint、選択、選択の Task か回）で、操作が使うのと同じ関数（`sprintIn`、`selection-of.ts` の `subjectOf`・`undoRouteOf`）を通してその関数を呼び、読み取りの記録に `capabilities` を足す。Backlog からの完了で作った選択の完了の取り消しは、今日の分も過去の日の分も Backlog の取り消し（F29、F33）なので、`undoCompleteSelection` はその経路で `undoCompleteFromBacklog` を呼び、`canUndoComplete` も `checkUndoCompleteFromBacklog` から作る（今日の分では、取り消しの後に「その日の始まり」を走らせない。#346 までは過去の日だけで、今日の分は Web が origin を見て `undoCompleteTask` を送り分けていた）。application のテストは、fixture のすべての状態と、操作で作った状態（今週の残りに戻した選択、見送った選択、今日と過去の日の Backlog からの完了、スキップした回）で、真の操作が通り偽の操作が断られること、どの `can…` も真と偽の両方が出ることを確かめる。
- ほかの記録の操作（#323）：この記録を引数に取り、行き先の記録を対象にする操作のうち、読み取りの行から出すものは、この記録の `capabilities` に置く。Backlog の Task の今日へ（今動いている Sprint の今日に `chooseForDay`）・今週へ（同じ Sprint に `addToSprint`）は、Issue #323 の指定のとおり名前を行き先で付ける（`canAddToToday`・`canAddToWeek`）。計画の候補の選ぶ（`addToSprint`）は `SprintCandidateCapabilities.canAdd`。どの operationId のどの使い方かは `description` に書く。
- 1 つの operationId が 2 つの操作を受けるときは、2 つの前提が違いうるときだけ分け、application の操作の名前から記録の名詞を除いて付ける（`updateGoal` の文は計画中と実行中、自己判定は Review の間：`canSet`・`canAssess`）。前提が同じなら 1 つにする（`updateRetro` の気づいたことと次に試すこと：`canUpdate`。`adoptEstimateSuggestion` の値と直した時間：`canAdopt`。`updateSubtask` の完了と時間：`canUpdate`）。
- 入れ子の記録：Task の中の提案とサブタスクは、Task の記録（`Task`）を変えずに、行の隣に ID ごとの対応表で置く（`BacklogItem.suggestionCapabilities`・`subtaskCapabilities`）。行が別のスキーマの記録を名指すときも同じ（`CandidateRow.chosenCapabilities`、`RetroData.goalCapabilities`・`sprintTaskCapabilities`）。記録の配列そのものに置くときは、`InterruptItem` と同じく読み取りの項目を別のスキーマにする（`OccurrenceItem`）。Sprint と Area の組の行（`AreaPlan`・`RunningAreaPlan`）は、Goal を書く前も Goal の `capabilities` を持つ（`goalCapabilities`。領域なしの行はすべて偽）。
- 状態で断らない操作（`saveTask`・`addSubtask`・`updateSubtask`・`renameArea`）も、記録の種類で項目を決めるので置く。domain の `check…` はいつも `ok` を返し（`checkUpdateTask()` など）、後から前提が足されたときにも判定の置き場所が変わらない。読み取りの記録がいつも同じ状態のもの（Backlog の Task は Active だけなので、`canArchive`・`canSetRecurrence` はいつも真）も同じ。application のテストは、これらを「真と偽の両方が出る」の対象から外す。読み取りに出ない状態でしか真にならない操作（Backlog の `restoreTask`・`undoCompleteTask`）は置かない。直前の操作の元に戻す（Toast、提案の結果の行）は、その操作の結果から出し、記録の状態から決めない。
- 状態の名前で決めてよいのは、表示だけ（`SprintView` の計画中と確定後の出し分け、終わった Sprint と完了した振り返りを記録として読む表示（終わった Sprint の行は詳細を開かない、完了した振り返りは「振り返りを完了」の代わりに書いた内容と次の計画への入口を出す）、表示する提案（提示中のもの）、状態の語）。どの操作をどこに出すか（今日の行の「かかった時間を記録」を完了・中断の行に出すなど）も画面が決める。Task の詳細を開けるかは、Backlog にその行があるか（Active の Task だけがある）で決め、Task の状態では決めない（`screen-data/use-backlog.ts` の `hasDetail`）。過去の日の「取り消しは Sprint の画面から」の案内も、その日の記録の `canUndoComplete`・`canUndoSkip` から出す。
- Sprint の開始日より前：domain は記録を作る操作（`chooseForDay`・`noteInterrupt`）を Sprint の期間の日だけ通す。この 2 つは `capabilities` に置かないので、開始日より前であることは読み取りの値で返す。今日の `TodayData.opensOn` と実行中の Sprint の `RunningData.opensOn` は、開始日より前の間だけ、その最初の日を持つ（application の `sprint-day.ts` の `opensOn`）。クライアントは今日と開始日を比べず、この値があれば、今日の画面を読むだけの表示（今週の目標と計画）にし、Sprint の画面に「今日を開く」を出さない（2026-10-05 オーナー判断、Issue #347。先例は Backlog の項目の `todayOpensOn`、#59）。
- 繰り返しをやめた Task（規則の最終日まで Backlog に「〜まで」と出る間）は、規則が Task から外れた単発の Task なので、domain は `setRecurrence` を通し、画面は `canSetRecurrence` のとおり「繰り返しにする」を、規則がない Task と同じ選択欄から出す（2026-10-04 オーナー判断、#323）。新しい規則は次の確定していない Sprint から効き、それはやめた規則の最終日（effectiveTo）の後なので、ドメインモデル F41 の「effectiveTo より後の Sprint では…もう一度繰り返しにもできる」と同じ意味になる。
- 当てた記録（#322）：今日の行と今日閉じた行（`TodayRow`）、今週の残りに戻した今日の選択（`TodayItem.removedTodayCapabilities`。選択は `removedToday` の ID でだけ出るので、その隣に置く）、過去の日の記録（`DayRecord`）、今日と過去の日の割り込み（`InterruptItem`。`InterruptNote` は Sprint の記録と派生値にも出て、そこでは可否を計算しないので変えず、読み取りの項目を別のスキーマにした）、Backlog の項目の今日の選択（`BacklogItem.today`）。
- 当てた記録（#323）：Backlog の項目の Task（`BacklogItem.capabilities`。`canAddToToday`・`canAddToWeek`・`canComplete` はここに移した壊す変更で、`info.version` を 0.6.0 にした）と提案・サブタスク、領域（`EditableArea`）、Sprint（`SprintItem`・`SprintPlan`・`RunningData`、今日の `TodayData.sprintCapabilities`）、Goal（`AreaPlan`・`RunningAreaPlan` の `goalCapabilities`、`RetroData.goalCapabilities`）、SprintTask（`PlannedTask`・`RunningTask`・`CandidateRow.chosenCapabilities`・`RetroData.sprintTaskCapabilities`）、計画の候補（`CandidateRow`）と回（`OccurrenceItem`）、振り返り（`RetroData`）とその計画基準（`used`・`draft`）、実行中の Sprint の過去の日の記録（`PastDayRecord`）。application のテスト（`record-capabilities.test.ts`）は、#322 と同じく、fixture のすべての状態と操作で作った状態で、真の操作が通り偽の操作が断られることを確かめる。domain の `check…` は `record-checks.test.ts` で、状態遷移の図の状態ごとにコマンドと一致することを確かめる。

### プレビュー

- プレビューの一覧（manifest）を契約の隣に置く。関数ごとに、ID、入力と出力のスキーマ（JSON Schema）、意味の出典（ドメインモデルの節、不変条件の番号、ADR）を持つ。今の候補は、PRD §14 の 4 つ（計画値、合計と容量、計画基準を適用したときの見え方、繰り返しの要約と次の日付）と、それらが使う日付の関数。
- 共通のテストケースは 2 種類にする。
  - **仕様ケース**：ドメインモデルと ADR で決めた意味から、人が期待値を書く。月末、曜日、タイムゾーン、省略と空、丸め、並び順など、仕様の上で大事な境界を対象にする。TypeScript・Swift・Kotlin のすべての実装が、このケースに従う。TypeScript の実装が通らないときは、実装か仕様ケースのどちらが誤っているかを決めて直す。TypeScript の出力に合わせて期待値を書き換えない。
  - **生成ケース**：TypeScript の参照実装から生成する。組み合わせの網羅と、回帰の検出のため。出力は一覧の出力スキーマに従って正規化し、内部のオブジェクトをそのまま保存しない（例：`PlanningValue` の `computedAt` は、プレビューで比べる対象に入れない）。CI で生成し直して、差分がないことを確かめる。差分が出たら、意図した振る舞いの変更かどうかを PR で確かめる。

  ```text
  ドメインモデル・ADR ───▶ 仕様ケース ───▶ TypeScript・Swift・Kotlin
  TypeScript の参照実装 ─▶ 生成ケース ───▶ Swift・Kotlin とのずれを見つける
  ```

- 各クライアントのテストは、一覧のすべての ID のすべてのケースを回し、実装のない ID があれば失敗にする（ADR 0005）。
- 形式は JSON。テストケースのファイルの形にも JSON Schema を置く（ID、関数、入力、期待値、比べ方）。比べ方（並びを比べるか、省略と `null` を分けるか、数で許す誤差）は、ケースごとに書く。
- 作る時期は、ADR 0005 の例外のとおり iOS に着手するとき。置き場所とファイルの形の細部は、そのとき決める。

### 言語をまたぐときに固定すること

仕様ケースで必ず押さえ、一覧のスキーマで形を決める。

- **時刻**：`LocalDate` は `YYYY-MM-DD`、`Instant` は UTC でミリ秒つき（ADR 0006）、タイムゾーンは IANA の名前。文字列ではなく値で比べる。プレビューは「今日」とタイムゾーンを引数で受け取り、端末の時計を読まない。夏時間の切り替わりのように、端末の tz データの版で結果が変わりうるケースは、意図して置くときだけ置く。
- **曜日**：domain は 0 が日曜、6 が土曜。言語ごとの番号（`java.time.DayOfWeek` は 1 が月曜、Swift の `Calendar` は 1 が日曜）に変えるところを、仕様ケースで確かめる。
- **毎月の日付**：29〜31 日の指定で、その月にその日がないときは末日にする（packages/domain README）。言語の日付ライブラリの既定に任せない。
- **数**：時間（h）の表し方、丸め、合計を足す順。数の表し方は ADR 0006「互換の規則」の決めていないこと（iOS に着手する前に決める）。
- **省略・空・`null`**：ADR 0006 の規則（省略できる属性はキーを省く）に従う。domain が「ない」と「空」を分けるもの（例：SprintTask の `occurrenceIds`）は、生成したクライアントでも分けられることを確かめる。
- **並びと文字列**：Backlog の既定の並びや連続見送りのように、domain が同時刻の記録を ID の順に並べるところがある（packages/domain README）。ID はバイトの順で比べ、ロケールに依存する比べ方を使わない。文字数を数えるなら、数える単位（UTF-16 の単位、書記素など）を決める。

### 共通の実装（shared core）

- 今は採らない。Rust、Kotlin Multiplatform、端末の JavaScript エンジンなど、具体的な技術も決めない。
- 共通の実装は、サーバーも同じ実装を使わない限り、実装の数を減らさない（TypeScript のサーバーと共通の実装の 2 つが残る）。検討するときは、サーバーの domain をどうするかも一緒に決める。

再検討の条件（どれか 1 つを満たしたとき）：

1. オフラインでの利用（PRD §14 で対象外）か、端末の記録を正とする方式を採ると決めたとき。
2. 状態や履歴が要る計算（状態の遷移、操作の可否の判定、履歴からの派生値）を、クライアントで計算したくなったとき。
3. プレビューのずれが、共通のテストケースをすり抜けて利用者に届いたとき。
4. domain を変えるたびに、Swift と Kotlin の変更がいつも要るようになったとき。
5. 4 つ目のクライアント（ウィジェット、Watch など）が、同じ規則を要るようになったとき。
6. サーバーを TypeScript・Workers から移すとき（TypeScript に参照実装を置く前提が変わる）。

## 検討した代替案

- **共通の実装（Rust など）を最初から入れる**：セットアップ、FFI、生成、ビルドとデバッグの手間がかかる。一方で、今クライアントで重ねて書くのは、プレビューの 4 つと日付の関数だけで、得るものが小さい。サーバーも使わない限り、重複も減らない。
- **プレビューもサーバーで計算する**（入力のたびに API を呼ぶ）：重複はなくなるが、PRD §14 の「通信せずに計算する」と合わず、入力のたびに往復が要る。
- **言語に依存しない operation の定義を、OpenAPI と別に置く**：上の「正本は 3 つ」のとおり、TypeScript の実装しか読まない、もう 1 つの正本になる。
- **domain のコマンドと application の操作のテストケースも、言語をまたいで共有する**：クライアントはこれらを実装しないので、比べる相手がいない。TypeScript の vitest に残す。クライアントが操作の結果を予測する必要が出たら（楽観的な更新など）、その操作に限って一覧に足すかどうかを、上の判定の基準と再検討の条件で決める。
- **TypeScript の出力をそのまま正解にする**（生成ケースだけにする）：TypeScript の誤りが、そのまま仕様になる。

## 決めていないこと

- iOS・Android の生成の道具と版、ネイティブの認証の方式（ADR 0006「影響」）。道具は、ADR 0006「互換の規則」の条件（開いた列挙の知らない値と、応答の知らないキーで読み込みを失敗させない。省略と空を分けられる）を満たすものから選ぶ。
- プレビューの一覧と共通のテストケースの置き場所と、ファイルの形の細部（iOS に着手するとき）。
- 楽観的な更新の方式。判定はサーバーが行い、失敗したとき（409・422）に表示を元に戻して読み直す形なら、この ADR と矛盾しない（409 で自動ではやり直さない。ADR 0004「同時の書き込み」）。記録を作る操作は、ID をサーバーが作るので、クライアントで ID を作る形にはしない。
- 共通の実装の技術。

## 影響

- `apps/web`：#272〜#277 で契約に移した後は、近道を持たない。操作の可否は、#322 と #323 で `capabilities` に移した。残る例外は値の規則だけ。
- `services/api`：application の結果と DTO の形が離れたら、写像を置く。
- `packages/api-contract`：iOS に着手するとき、プレビューの一覧と共通のテストケースを、ここ（または隣）に置く。
- iOS・Android：`openapi/` から生成したクライアントを使い、プレビューの一覧を実装して、共通のテストケースを CI で回す。
