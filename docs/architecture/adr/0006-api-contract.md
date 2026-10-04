# ADR 0006: API の契約（OpenAPI）

- 状態：採用
- 日付：2026-10-03
- 関連：Issue #265、#45（範囲の分け方は #262）、先行 #264、後続 #266・#272
- 改訂：2026-10-03（互換の規則を書き直す。型のテストが失敗したときの直し方。ADR 0007）
- 改訂：2026-10-03（利用者と設定の読み取り `getMe`、設定がないときのエラー、本文の大きさの上限。Issue #266）
- 改訂：2026-10-03（経路を資源（ドメインの名詞）から付け、HTTP のメソッドで表し、kebab-case にそろえる。Sprint は ID で経路に置く。状態の遷移はスラッシュの動作。Issue #295。初めの案 A は取り下げた）
- 改訂：2026-10-03（`getMe` の `sprints.next` に `end` と `week` を足す。Issue #274）
- 改訂：2026-10-04（利用者の設定を作る `PUT /me/settings`。契約の operation を足すだけなので `info.version` は 0.2.0 のまま。Issue #279）
- 改訂：2026-10-04（エラーを Problem Details（RFC 9457）にする。応答の項目を消して名前を変える壊す変更なので `info.version` を 0.3.0 にする。Issue #319）
- 改訂：2026-10-04（すべての書き込みに必須のヘッダー `Idempotency-Key` を置き、422 `/problems/idempotency-key-reused` を足す。要求に必須の項目を足す壊す変更なので `info.version` を 0.4.0 にする。409 は「この書き込みはしていない」だけになる。Issue #320）
- 改訂：2026-10-04（値を置き換える書き込み（PATCH の 10 面）に、記録ごとの版の `If-Match` を置き、412 `/problems/precondition-failed`・428 `/problems/precondition-required` を足す。記録の DTO に出力専用の `etag`、書き込みの応答に `ETag`。要求に必須のヘッダーを足す壊す変更なので `info.version` を 0.5.0 にする。クライアントが送り返す `InterruptNote` に必須の `etag` を足したのも壊す変更（読み取りの note をそのまま `restoreInterrupt` の本文にすると、未知のキーで 400）。Issue #321）
- 改訂：2026-10-04（今日の選択と割り込みの読み取りに、出力専用の必須の `capabilities`（`can<操作>` の真偽値、ADR 0007「操作の可否」）を足す。`TodayRow`・`DayRecord`・`BacklogItem.today` に `DailySelectionCapabilities`、`TodayItem` に省略できる `removedTodayCapabilities`、今日と過去の日の割り込みを `InterruptItem`（`InterruptNote` と `InterruptNoteCapabilities`）にする。応答に必須の項目を足すだけなので `info.version` は 0.5.0 のまま。Issue #322）
- 改訂：2026-10-04（残りの記録の読み取りに、出力専用の必須の `capabilities` を足す（ADR 0007「操作の可否」）。`BacklogItem` の `canAddToToday`・`canAddToWeek`・`canComplete` を `TaskCapabilities` に移す。応答から項目を消す壊す変更なので `info.version` を 0.6.0 にする。`RecurringCandidate.occurrences` は `OccurrenceItem`（`Occurrence` と `OccurrenceCapabilities`）にする。Issue #323）
- 改訂：2026-10-04（Task の繰り返しの規則を置く `PUT /tasks/{taskId}/recurrence`（`setRecurrence`）も、規則の版で条件つきにする。規則があれば `If-Match`、なければ `If-None-Match: *`。`BacklogItem.rule` に出力専用の必須の `etag`、応答に `ETag`。`endRecurrence`（DELETE）は対象にしない。要求に条件を足す壊す変更なので `info.version` を 0.7.0 にする。Issue #330）
- 改訂：2026-10-05（振り分けの規則を、送る側の `sending.ts`（`@itera/api-contract/sending`。Valibot とスキーマを import しない。Web が使う）と、読む側も持つ `requests.ts` に分ける。Web の本番ビルドに Valibot を入れないため。Issue #356）

## 背景

ADR 0005「API への移行」は、操作を名前と入力で表す契約（OpenAPI）を書き、判定をサーバーの `packages/domain` だけで行うと決めた。#45 でオーナーは「独立した OpenAPI の仕様ファイルを正本にし、Hono のルート定義から出力しない」と決め（2026-09-27）、PRD §14「クライアントとデータの方式」は、Web と後の iOS・Android が同じ契約から型とクライアントを生成するとしている。派生値は API から返す（2026-10-03 オーナー決定）。

#264 で、利用者の操作（`packages/application` の `operations`、65 個）と読み取り（`*-view.ts` など）が、そのまま契約にできる形になった。この ADR は、契約の置き場所・書き方・経路の形・エラー・生成の道具と生成物の扱いを決める。

## 決定

### 道具と版

依存は ADR 0001 と同じく完全一致で固定する。版と使い方は 2026-10-03 に Context7 と各公式の文書で確かめた。

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| 仕様 | OpenAPI | 3.1.1 | JSON Schema 2020-12 と同じ書き方（`const`、`type: 'null'`）で、domain の union と省略できる属性をそのまま書ける |
| 仕様の lint と 1 ファイルへのまとめ | `@redocly/cli`（devDependencies） | 2.57.0 | `recommended-strict`（警告もエラー）。`bundle` で分けたファイルを 1 つにまとめる。利用状況の送信は `redocly.yaml` の `telemetry: off`、更新の確認は `REDOCLY_SUPPRESS_UPDATE_NOTICE` で止める |
| 生成 | `@hey-api/openapi-ts`（devDependencies） | 0.99.0 | AGENTS.md の候補。型・Valibot のスキーマ・fetch のクライアント・TanStack Query の options を 1 つの仕様から出せる。クライアントの実行時のコードは生成物に入り、実行時の依存が増えない |
| 検証 | `valibot`（dependencies） | 1.5.0 | AGENTS.md の候補。サーバーの入力の検証と、テストでの応答の検証に使う |
| 取得結果のキャッシュ | `@tanstack/react-query`（devDependencies・peerDependencies） | 5.104.1 | AGENTS.md の候補。生成した options の型の検査に使う。`apps/web` は #272 で同じ版を入れる |
| React | `react`・`@types/react`（devDependencies・peerDependencies） | 19.3.0 | TanStack Query の型が求める。`apps/web` と同じ版（ADR 0003） |

Spectral（`@stoplight/spectral-cli`）は使わない。lint だけなら足りるが、生成の前に分けたファイルを 1 つにまとめる道具が別に要り、Redocly なら 1 つで済む。

### 置き場所と書き方

- 契約は `packages/api-contract`（`apps/web` と `services/api` のどちらにも属さない）。仕様は `openapi/`：
  - `openapi.yaml`：info、`servers`（`/api`）、`security`、tags、`paths` の一覧（各 path は下のファイルを `$ref` で指す）。
  - `paths/`：資源ごとの path item（`area`・`task`・`sprint`・`retro`・`planning-criterion`・`me`）と、複数の記録にまたがる読むだけの資源（`reads.yaml`：Backlog と日）。同じ経路の読み取りと書き込みは 1 つの path item に置く（例：`/sprints/{sprintId}` の GET と PATCH は `sprint.yaml`）。
  - `schemas/`：`common.yaml`（ID・日付・時計・エラー）、`records.yaml`（domain の記録）、`values.yaml`（domain の派生値）、`views.yaml`（application の読み取りの結果）。
  - `responses.yaml`：エラーの応答。
- 説明（summary・description）は英語で書く（生成したコードの JSDoc になり、コードのコメントと揃える）。画面の語は使わない。
- 記録の DTO は、今は domain の型と同じ形にする（写像は恒等。ADR 0007「アプリケーション層の読み取りと API の DTO」）。省略できる属性はキーを省き、`null` にしない（domain の `exactOptionalPropertyTypes`）。`null` を値として使うのは、domain がそう決めている入力（`saveTask` の本文の `areaId`・`due`、時間の消去など）と、`AreaTotal` などの `areaId: null`（領域なし）だけ。
- ID は TypeID（ADR 0004「ID の形式」）。種類ごとに schema（`TaskId` など）を置き、接頭辞と、UUIDv7 の version（11 文字目が e か f）と variant（14 文字目が 89abrstv のどれか）までを正規表現で決める。`parseId` が受け付けるものと同じであることをテストで確かめる。
- `LocalDate` は `format: date`、`Instant` は `format: date-time` に domain と同じ正規表現（UTC・ミリ秒つき）を足す。Valibot の書式の検査は暦の上で実在するか（2 月 30 日など）までは見ないので、サーバーは入力の検証の段階で、入力の日付と日時を domain の `parseLocalDate`・`parseInstant` でも確かめ、実在しなければ 400 `/problems/validation-failed` にする（形の誤りとして扱い、操作の入力でも読み取りのパラメータでも同じ）。
- 契約が検証するのは形と書式（型、必須、ID と日付の書式、列挙）だけにする。値の規則（正の時間、空でない題名、状態の遷移）は domain の規則で、422 で返す。規則を契約と domain に二重に持たないため。
- 要求の本文の最上位は `additionalProperties: false`（Valibot の `strictObject`）。綴りの誤りなどの未知のキーは 400 になる。応答と共有する入れ子（`InterruptNote`・`RetroPin`・`Estimate`・`RecurrencePattern`・`CriterionPolicy`）は未知のキーを許し、Valibot の `object` が出力から落とす。サーバーは、要求の本文ではなく検証の出力だけを application に渡す。応答は未知のキーを許す（クライアントが後から足した項目で壊れないように）。応答の余分な・欠けたキーは、下の型のテストで止める。
- 一覧（`BacklogData.items`・`RetroData.sprintAreas` など、ID をキーにする表）は `additionalProperties` で書き、`propertyNames` は使わない（Hey API 0.99.0 は `propertyNames` があると値を検証しない `v.object({})` を出す）。値が `$ref` の表も、0.99.0 の Valibot の出力では同じく `v.object({})` になる（Valibot のプラグインが `$ref` の値を読まない）。これは下の「生成物」の patch で直す。

### 経路の形

2026-10-03 オーナー決定（Issue #295）。次の「決定」「決定の過程」「拠り所」は、Issue のコメントのとおり記録する。

#### 決定

1. **資源を起点にする**。経路はドメインの名詞（Area・Task・Sprint・計画基準など）から付け、クライアントの表示の単位（画面）を資源にしない。派生値は「誰の属性か」で置く：1 件の記録の属性は、その資源の出力専用の項目にする。複数の記録にまたがる集約は、ドメインの名詞の読むだけの資源にする（例：日 `/days/{date}`）。
2. **Sprint は ID で指す**。通し番号（「Sprint 14」）は利用者ごとの表示の値なので、資源の鍵にしない。番号は属性と、一覧の絞り込みの条件（`GET /sprints?number=…`）にする。
3. **Sprint の中身は Sprint の下に置く**（案 d）。例：`/sprints/{sprintId}/sprint-tasks/{sprintTaskId}`。SprintTask は Task と別の記録（`sprint_task` テーブル、自分の ID と状態を持つ）なので、鍵は SprintTask の ID、集合の名前は `sprint-tasks`（`tasks` にすると Task の ID と取り違える）。
4. **状態の遷移は、スラッシュの形の動作にする**：`POST /tasks/{taskId}/complete`。状態の項目は出力専用にし、PATCH では変えない。動作の段は動詞、子の資源は名詞で名付け、lint で区別する。
   - 実装：動作の段（`archive`・`complete`・`undo-complete` など）と子の資源の段（`sprint-tasks`・`retro` など）は、`packages/api-contract/src/requests.test.ts` の一覧で区別して確かめる（動作は POST で、資源の ID か 1 つしかない子の資源（`retro`）の後の、最後の段にだけ置く。資源の段は名詞）。一覧にない段を足すとテストが失敗する。

#### 決定の過程

- 2026-10-03、案 A（REST の形を借りた経路）に対し、オーナーが「起点が画面と操作になっている（`/planning`・`/today`・`/running`・`/retro`）」と指摘した。
- 今の実装を見せずに、新しいコンテキストの REST の専門家（Opus の subagent。人間ではない。指針は Web で確認）に 2 回助言を求めた。1 回目は依頼文に画面の語が入り、画面ごとの読み取り（BFF の形）に寄った。そのため、画面の語を外して頼み直した（2 回目）。
- 2 回目の案は、SprintTask などを最上位（`/sprint-tasks/{id}`）に置いていた。オーナーと次の 2 案を比べ、d を選んだ：
  - a `/sprint-tasks/{sprintTaskId}`：ID だけで辿れ、Sprint をまたぐ問い合わせが素直。ただ、所有の関係が経路から読めず、Sprint の中身の置き方が 2 通りになる。
  - d `/sprints/{sprintId}/sprint-tasks/{sprintTaskId}`：所有の関係が経路で読め、テーブル（`sprint_task.sprint_id`）とドメインの集約（Sprint が根）に対応し、「Sprint の中身は Sprint の下」の 1 つの規則で済む。代わりに、参照から辿るときに Sprint の ID も要り、親と ID の照合（食い違えば 404）が要る。
  - Task の ID を鍵にする案（`/sprints/{id}/tasks/{taskId}`）は採らない。繰り返しの Task は、外した回を週の途中で戻すと 1 つの Sprint に SprintTask が複数でき、鍵が一意でなくなるため。
- 動作の書き方は、`:` と `/` を比べて `/` を選んだ：
  - `:`（Google AIP-136 のカスタムメソッド。Microsoft Azure の指針も `…/<resource-collection>/<resource-id>:<action>`、指針の ID `actions-url-pattern-for-resource-action`）：動作と子の資源の区別が形で決まる。ただ、Hono は `:` をパラメーターの記号に使うので逃がしが要り、生成器（Hey API）と lint（Redocly）での扱いも確かめていない。
  - `/`：どのルーター・生成器でもそのまま動く。使用例：Stripe `POST /v1/payment_intents/{id}/confirm`、GitHub `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge`。動作と子の資源の区別は、名付けの規則（動作は動詞、子の資源は名詞）と lint で得る。
  - （訂正：途中の比較で「Microsoft は `/`」と書いたが、Azure の指針は `:` である。上のとおり記録する。）
- 対応表（v2）をオーナーが了承した（2026-10-03）。あわせて決めた 7 点：
  - W1：`POST /sprints/{sprintId}/sprint-tasks` を 1 つにし、計画中なら下書き、実行中なら週の途中の追加として、サーバーが Sprint の状態で domain のコマンドを選ぶ。新しい Task を作って実行中の Sprint に入れる操作は、今の画面にないので足さない。
  - W2：`DELETE /sprints/{sprintId}/sprint-tasks/{sprintTaskId}`（1 件）に加えて、まとめて外す `DELETE /sprints/{sprintId}/sprint-tasks?ids=…`（全部か何もしないか）を置く。選んだ直後に複数をまとめて取り消すとき、一部だけ残らないようにするため。
  - W3：今日の選択は本文に `date` を入れ、追いつき後の今日でなければ 422 にする。日付が変わった後に古い表示から書く取り違えを防ぐため。
  - W4：サブタスクの完了は属性として `PATCH`（副作用のない行き来のチェック）。
  - R1：今の Sprint の参照は `/me` に入れる。日付の処理（#271）を走らせてから答える。
  - R2：選ぶ候補（Sprint に入っていない Task）を Sprint の表現に入れず、`/sprints/{sprintId}/candidates` に分ける（画面の形を資源に残さないため）。
  - R3：今日・過去・先の日を 1 つの資源 `/days/{date}` にし、日付の種類で判別する。
  - worker が domain から埋めた点：Sprint の中の操作は `sprintId` を受け取り、暗黙の選択をやめる（Sprint の状態が合わなければ domain・application が 422）。同じ意味の操作をまとめる（計画中と実行中の目標・使える時間・実績：`setGoal`・`setAvailableHours`・`recordActualTime`。domain のコマンドがもとから両方を受ける）。取り消しは `…/undo-<元の動作>` にそろえ、`undoCloseSelection` は `undo-defer`・`undo-remove` に分ける（domain にもとから 2 つのコマンドがある）。過去の日の取り消し（`undoPastDay`）は `undo-complete`・`undo-skip` に入れる（選択の日付で今日か過去かが決まる）。

#### 拠り所

- Google AIP-122（資源の名前・入れ子）、AIP-124、AIP-136（カスタムメソッド）、AIP-216（状態は出力専用）
- Microsoft Azure REST API Guidelines（actions の URL の形：`:<action>`）
- Zalando RESTful API Guidelines [145]（入れ子は所有がはっきりしているとき）
- Stripe API Reference（PaymentIntent の confirm）、GitHub REST API（pulls の merge）

#### 規則

- 経路はすべて `/api` の下（ADR 0004「API の経路」）。仕様の `servers` が `/api` で、生成したクライアントは同じ origin の `/api` を呼ぶ。`/api/health`・`/api/auth/*` はこの契約の外にある。
- 経路の段（資源の名前と動作）と query の名前は kebab-case。path の値の名前（`{sprintId}` など）と JSON の項目名と operationId は camelCase（生成する関数名が TypeScript の慣習に合う）。
- 作る：`POST /<集まり>` → 201（作った ID。何も返さないものは本文なし）。属性を変える：`PATCH`（省いた項目は変えない）。子の資源を置く・置き換える（冪等）：`PUT`。消す・外す（冪等）：`DELETE`（本文は持たない。RFC 9110 で意味が決まっていない）。状態の遷移：`POST …/<動詞>`。取り消し：`POST …/undo-<元の動作>`（domain の取り消しは元の動作ごとに別のコマンドで、条件も違う。逆の動詞にすると何を取り消すかが読めない）。値を返すなら 200、返さないなら 204。変わった後の読み取りは返さない（下の「操作の応答に読み取りを含めない」）。
- 操作は `packages/application` の `operations` の名前と入力で表す（ADR 0005）。判定は `packages/domain` だけが行う。面（1 つのメソッドと 1 つの経路）ごとに operationId が 1 つで、1 つの操作だけを受ける面は操作の名前をそのまま operationId にする。いくつかの操作を受ける面は新しい名前にし、要求が運ぶもの（本文のどの項目があるか、query の件数）で操作を選ぶ（W1 の Sprint の状態での選び分けは application の操作の中）。別の操作の項目を一緒に送ると 400（本文は `oneOf` の `strictObject`）。
- 経路の子（SprintTask・選択・割り込み・目標など）が経路の Sprint にないときは 404。Sprint の状態に合わない操作は 422 `/problems/invalid-transition`。
- 振り分けの規則は `packages/api-contract/src/` の 2 つのモジュールに、両方向を並べて置く（#356 で分けた。それまでは `requests.ts` の 1 か所）。
  - 送る側の `sending.ts`（`@itera/api-contract/sending`）：面ごとのメソッド・経路・通ったときのステータス（`routes`）と、`requestOf(名前, 入力)`（操作の要求、つまり面と path・query・本文を作る。Web）。契約の型だけを使い、Valibot とスキーマを import しない（Web の本番ビルドに Valibot を入れないため。ADR 0005「本番ビルド」）。
  - 読む側も持つ `requests.ts`（`@itera/api-contract/requests`）：`routes` に面のスキーマと `operation` を足した `surfaces`。`readRequest` が受け取った要求を面のスキーマで path・query・本文の順に確かめてから、面の `operation` で操作と入力を作る（サーバーとブラウザ内モック。確かめ方とエラーの返し方だけをそれぞれが渡す。サーバーは暦の上の日付も確かめる）。query の文字列を宣言した型に変える `queryInput` も置き、読み取りと書き込みで使う。`sending.ts` のものをすべて export し直すので、サーバーとモックは `/requests` だけを使う。
  - どちらも application に型だけで依存する。

#### 書き込みの面（55 面で 60 操作）

| メソッド・経路 | operationId | 受ける操作（選び方） | 成功 |
| --- | --- | --- | --- |
| `POST /areas` | `createArea` | 同名 | 201 |
| `PATCH /areas/{areaId}` | `renameArea` | 同名 | 204 |
| `POST /areas/{areaId}/archive`・`/restore` | `archiveArea`・`restoreArea` | 同名 | 204 |
| `POST /tasks` | `createTask` | 同名 | 201 |
| `PATCH /tasks/{taskId}` | `saveTask` | 同名（属性と `estimate`。`estimate` 以外が `update`） | 204 |
| `POST /tasks/{taskId}/archive`・`/restore`・`/complete`・`/undo-complete` | `archiveTask`・`restoreTask`・`completeTask`・`undoCompleteTask` | 同名 | 204 |
| `PUT` / `DELETE /tasks/{taskId}/recurrence` | `setRecurrence` / `endRecurrence` | 同名（繰り返しの規則は Task の子の記録） | 200 |
| `POST /tasks/{taskId}/subtasks` | `addSubtask` | 同名 | 201 |
| `PATCH /tasks/{taskId}/subtasks/{subtaskId}` | `updateSubtask` | `done` → `setSubtaskDone`（W4）、`hours` → `setSubtaskEstimate` | 204 |
| `POST /tasks/{taskId}/estimate-suggestions/{suggestionId}/adopt` | `adoptEstimateSuggestion` | `bound` → `adoptSuggestion`、`hours` → `adoptEditedSuggestion` | 204 |
| `POST …/estimate-suggestions/{suggestionId}/undo-adopt`・`/reject`・`/undo-reject` | `undoAdoption`・`rejectSuggestion`・`undoRejection` | 同名 | 204 |
| `POST /sprints` | `beginPlanning` | 同名（計画を始める。始まりの日は domain が決める） | 201 |
| `PATCH /sprints/{sprintId}` | `setAvailableHours` | 同名（計画中も実行中も） | 204 |
| `POST /sprints/{sprintId}/confirm` | `confirmSprint` | 同名 | 204 |
| `PATCH /sprints/{sprintId}/goals/{areaId}` | `updateGoal` | `text` → `setGoal`、`assessment` → `assessGoal` | 204 |
| `POST /sprints/{sprintId}/sprint-tasks` | `addToSprint` | `taskIds` → `addSprintTasks`（W1）、`title` → `createAndChooseTask`（計画中だけ） | 201 |
| `DELETE /sprints/{sprintId}/sprint-tasks?ids=…` | `removeSprintTasks` | 同名（全部か何もしないか。W2） | 204 |
| `DELETE /sprints/{sprintId}/sprint-tasks/{sprintTaskId}` | `removeSprintTask` | `removeSprintTasks`（1 件） | 204 |
| `PATCH /sprints/{sprintId}/sprint-tasks/{sprintTaskId}` | `setGoalLink` | 同名 | 204 |
| `POST /sprints/{sprintId}/sprint-tasks/{sprintTaskId}/exclude-occurrences` | `excludeAllOccurrences` | 同名 | 204 |
| `PUT` / `DELETE /sprints/{sprintId}/included-occurrences/{occurrenceId}` | `includeOccurrence` / `excludeOccurrence` | `setOccurrenceIncluded`（true / false） | 204 |
| `POST /sprints/{sprintId}/included-occurrences` | `includeOccurrences` | 同名（まとめて戻す） | 204 |
| `POST /sprints/{sprintId}/daily-selections` | `chooseForDay` | `sprintTaskId` → `chooseForToday`、`taskId` → `addTaskToToday`、`title` → `createTaskForToday`（どれも `date` は今日。W3） | 201 |
| `POST /sprints/{sprintId}/daily-selections/{selectionId}/start`・`/pause`・`/defer`・`/undo-defer`・`/remove`・`/undo-remove`・`/complete`・`/undo-complete`・`/skip`・`/undo-skip` | 同名の 10 個（`removeFromToday`・`undoRemoveFromToday` など） | 同名（`undo-complete`・`undo-skip` は過去の日も） | 204 |
| `POST /sprints/{sprintId}/actual-times` | `recordActualTime` | 同名（実行中と Review 中。ID を返さない） | 204 |
| `POST /sprints/{sprintId}/interrupts` | `noteInterrupt` | 同名 | 201 |
| `PATCH` / `DELETE` / `PUT /sprints/{sprintId}/interrupts/{interruptNoteId}` | `editInterrupt` / `deleteInterrupt` / `restoreInterrupt` | 同名 | 204 |
| `POST /sprints/{sprintId}/retro` | `beginRetro` | 同名（振り返りを作る。本文なし） | 201 |
| `PATCH /sprints/{sprintId}/retro` | `updateRetro` | `reflection` → `setReflection`、`improvement` → `setImprovement` | 204 |
| `POST /sprints/{sprintId}/retro/complete` | `completeRetro` | 同名（Sprint が閉じる） | 204 |
| `PUT` / `DELETE /sprints/{sprintId}/retro/pins/{pin}` | `pinFact` / `unpinFact` | 同名 | 204 |
| `PATCH /sprints/{sprintId}/criterion-use` | `decideCriterion` | 同名（この Sprint で使った計画基準の扱い） | 204 |
| `POST /planning-criteria` | `draftCriterion` | 同名（`sourceSprintId` の改善から下書き） | 201 |
| `PATCH` / `DELETE /planning-criteria/{criterionId}` | `setDraftPolicy` / `dropCriterionDraft` | 同名（下書きのときだけ） | 204 |

- 回（Occurrence）の含める・外すは Sprint の下に置く。回そのものは Task の繰り返しの規則が作る記録だが、Sprint に含めるかは Sprint の計画の決定で（不変条件 33）、含め直すと新しい SprintTask を作ることがある（domain の `includeInPlan`）。そのため SprintTask の下ではなく、Sprint の「含めた回」の集まりにする。1 つの SprintTask の回をすべて外す操作は、その SprintTask の動作（`exclude-occurrences`）。
- 振り返りの印は、domain の `togglePin` を `pinFact`・`unpinFact` に分けた。付いている印を付ける・付いていない印を外すときは何も変えない。`{pin}` は印の付いた記録の ID（SprintTask・選択・回・割り込み、Goal は Area の ID）か `available-hours` で、記録の種類は TypeID の接頭辞から決まる。
- 割り込みを戻す `restoreInterrupt` は ID を残すので、その ID を path に置く `PUT`（下の「消した記録を戻す操作の照合」）。割り込みの編集（`PATCH`）は本文と分を置き換えるので、`minutes` を必須にし、分がないことは `null` で表す（domain の入力では省略。`sending.ts` と `requests.ts` が変える）。

#### 読み取り（8 面）

| operationId | 経路 | application | 結果がないとき |
| --- | --- | --- | --- |
| `getMe` | `/api/me` | `currentSprints`（と利用者・設定はサーバー） | — |
| `listAreas` | `/api/areas` | `areaList` | — |
| `getBacklog` | `/api/backlog?view=&area=` | `backlogData` | — |
| `listSprints` | `/api/sprints?number=` | `sprintList` | 空の一覧 |
| `getSprint` | `/api/sprints/{sprintId}?apply-criterion=` | `sprintView`（計画中は計画、確定後は経過。`state` で判別） | 404 |
| `listSprintCandidates` | `/api/sprints/{sprintId}/candidates` | `sprintCandidates` | 計画中でない Sprint は `null`、ない Sprint は 404 |
| `getSprintRetro` | `/api/sprints/{sprintId}/retro` | `sprintRetro` | 振り返りの前は `null`、ない Sprint は 404 |
| `getDay` | `/api/days/{date}` | `dayView`（`today`・`past`・`future` で判別） | — |

- 経路・path と query のスキーマ・呼ぶ application の関数・ない Sprint の 404 は、API とブラウザ内モックが同じ表から使う（`requests.ts` の `readSurfaces` と application の `reads`。`getMe` の応答は `meResponse`。#350、ADR 0005「ブラウザ内モック」）。
- 応答は `{ clock, view }`。`clock` は、サーバーがその応答のために決めた「今日」と現在時刻（ADR 0005「時計」）。`view` は、今は application の関数の結果そのもので（写像は恒等。ADR 0007）、結果がない（`undefined`）ときは `null`（TanStack Query は `undefined` をデータにできない）。
- query の数と真偽（`number`・`apply-criterion`）は、通信の上では文字列。サーバーは宣言した型に変えてから、生成したスキーマで検証する（`queryInput`。同じ名前を繰り返した値は、配列の項目なら全部、それ以外は検証で 400）。
- **利用者**：`GET /api/me`（`getMe`）は、サインインしている利用者の ID と設定（表示名・タイムゾーン・週の始まり。domain の `User` から ID を除いたもの）を返す。設定をまだ作っていなければ `settings` は `null` で、日付が変わったときの処理（#271）を走らせずに答える（設定がない間もこの読み取りだけは答え、クライアントは設定を作る画面を出す。#279、#266）。設定があれば、処理を走らせてから、`clock` と今の Sprint の参照（`sprints`：実行中・Review 中・計画中のそれぞれと、次に計画を始める週）も返す（R1）。次に計画を始める週（`next`）は、開始日・終了日・番号と、その週の名前（`week`。Sprint の `week` と同じ。省略可）を持つ。Sprint がまだない週を画面が開くのに要る（#274）。`end` は必須で足した（下の「壊さない変更」の、応答に必須の項目を足す規則）。
- **利用者の設定を作る**：`PUT /api/me/settings`（`setSettings`。本文は `{ displayName, timeZone, weekStartsOn }`）。設定がなければ作り（201）、あれば表示名だけを書き直す（204。同じ値をもう一度送っても 204 で、何も書かない）。タイムゾーンと週の始まりを別の値で送ると 422 `/problems/invalid-input` で断る。理由：「今日」はタイムゾーンで、Sprint の期間は週の始まりで決まるので、すでにある Sprint がある利用者の値を変えると、それらの Sprint が動く。変えたときに既存の Sprint をどうするかは決まっていない。戻す条件：設定を後から変える画面の Issue が、その扱いを決めたとき（2026-10-03 司令塔の判断。オーナーへ要確認として Issue #279 に記録）。タイムゾーンは名前で、契約のスキーマは文字列としか見ないので、実在する名前かは domain の `parseTimeZone` が確かめ（なければ 422 `/problems/invalid-input`）、表示名は前後の空白を除いて空なら同じく 422。201 は作った設定を返す（表示名は前後の空白を除くので、送った値と違いうる）。ここだけ「作る → 201 は作った ID」の規則（本文のない 201 は生成物が `unknown` になり、`generated.test.ts` が断る）から外れる例外で、書き直し（204）や再送には本文がないので、クライアントはこの本文に頼らない（今の Web は使わない）。タイムゾーンは `Intl` の綴り（`asia/tokyo` は `Asia/Tokyo`）にそろえて保存・比べる。操作ではなく読み取りでもないので、`surfaces`（操作の面）には入れず、`requests.ts` の `settingsSurface` に置く。記録がなくても作れる唯一の書き込みで、サーバーは `flow.setUp` が受け持つ（読み込み → `settingsChange` → 最初の保存。ほかの書き込みと同じく版を確かめ、Activity は残さない）。
- 以前の画面ごとの読み取り（`getOverview`・`getSprintChoice`・`getPlanning`・`getRunning`・`getToday`・`getRetro`・`getNextPlanning`）はなくした。画面が開く Sprint とその前後は `/me` の参照と `/sprints` の一覧（番号の並び、週の名前の出力専用の項目）から求まる。ナビの Backlog の件数は `/backlog` の件数。application のこれらの関数（`appOverview`・`sprintChoice`・`planningData`・`runningData`・`todayData`・`dayData`・`retroData`・`nextPlanningOf`）は、store のままの画面が使うので残していた。画面を移し終えたので、#277 で index の export から外した（`coverage.test.ts` の一覧も消した）。

### 操作の応答に読み取りを含めない

操作は、その操作の結果（作った ID、操作が決めた値）だけを返し、画面は TanStack Query の無効化で読み直す（Issue #265 の推奨どおり）。

- 理由：読み取りは 8 種類あり、1 つの操作が変える読み取りは画面によって違う。操作ごとにどの読み取りを返すかを契約に持たせると、操作と画面の結合が強くなり、iOS・Android の画面の違いも契約に入ってしまう。読み直しの往復は 1 回増えるが、利用者は 1 人で、読み取りは 1 回の `batch()` で済む（ADR 0004「操作と読み取りの処理」）。
- どの操作の後にどの読み取りを読み直すか（Query のキーと無効化の方針）は #272 で決める。

### 消した記録を戻す操作の照合

消した割り込みを戻す `restoreInterrupt` は、ID を残す。クライアントは、消す前の読み取りで得た note の値（ID・時刻・本文・分。読み取りが足す `etag` は送らない。#321）を送り（ID は `PUT /sprints/{sprintId}/interrupts/{interruptNoteId}` の path に、ほかは本文に）、domain の `restoreInterrupt` が「同じ ID の note がない（利用者のほかの Sprint の note も含めて）」「今より後に記録されたものでない」「Sprint の期間の日に記録されたものである（利用者のタイムゾーンの日付で）」「本文が空でない」を確かめて、時刻の順の位置に戻す（F38）。ほかの Sprint の note の ID と時間帯は、domain の入力として `packages/application` が記録から渡す（#269）。

- 戻せるのは、利用者がその Sprint から消した割り込みだけにする（#315）。サーバーは保存の前に、利用者自身の Activity にその Sprint からその ID を消した記録（`interruptDeleted`）があるかを確かめ（ADR 0004「Activity を読む 1 つの例外」）、なければ domain に渡さず 404 `/problems/not-found` で断る。ほかの利用者の割り込みの ID と、誰も持たない ID は、利用者自身の Activity にないという点で同じなので、状態・`type`・本文（ID を含めない固定の文）が同じ応答になる。ID は全体の主キーなので、この確かめがないと、ほかの利用者の ID は保存の主キーの衝突（500）になり、ID がほかの利用者にあるかどうかが応答で分かった。消していない割り込みや、別の Sprint から消した割り込みを戻す操作も、同じ 404 になる。ブラウザ内モック（ADR 0005）は Activity を残さないので、この確かめをしない（消していない割り込みも戻す。画面は消した直後にしか戻さないので、見える違いはない）。
- 内容で照合する案（サーバーが消した note の内容を覚えておき、本文と時刻で探す）は採らない。Activity の `interruptDeleted` は ID しか持たず、内容を別に保つには domain の記録か Activity の項目を変える必要があるため（ドメインモデルの正本の変更。別の Issue で決める）。内容は今までどおりクライアントが送った値で、domain が値の規則だけを確かめる。ID は TypeID で、接頭辞と書式を契約で確かめる。
- 同じ考えで、`undoAdoption` の `previous`（採用する前の Estimate）も、クライアントが採用の前の読み取りで持っていた値を送る。Task は今の Estimate だけを持つため（packages/domain）。
- 内容は自分が消した ID の note としてだけ戻せるので、作り話の内容を戻されても困るのは本人だけ。

### エラー

形は 1 つ：Problem Details（RFC 9457）。メディアタイプは `application/problem+json`、本文は `{ type, title, status, detail }`（2026-10-04 オーナー決定「標準的なものに合わせる」、Issue #319。それまでの `{ code, message }` は #319 でなくした）。

- `type` は問題の種類を表す相対の URI 参照 `/problems/<kebab-case の名前>` で、クライアントはこれだけで振る舞いを決める（RFC 9457 が `type` を主な識別子とするため。識別子を 2 つ持つと食い違いうるので `code` は残さない）。解決できる文書は置かない（Zalando RESTful API Guidelines 規則 176。文書は OpenAPI にある）。クライアントは `type` を解決せず（base URI と合わせて絶対 URI にしない）、文字列のまま比べる。本番の公開する URL がまだ決まっていない（ADR 0004「デプロイ」）ので、絶対 URI にしない。
- `title` は種類ごとに固定の英語、`detail` はその回の説明。どちらも開発者向けで、画面に出さない（画面の文言は `docs/design/content.md` に従ってクライアントが作る）。クライアントは `detail` を解析しない。`title` は契約では文字列とだけ書き、値は `packages/api-contract/src/problems.ts` の表に置く（言い回しを直しても壊す変更にしない）。
- `status` は HTTP のステータスと同じ値（RFC 9457 では参考の値）。
- `instance` は今は使わない（要求の ID でログと結びつけるときに改めて決める）。
- クライアントは知らない項目を無視する（RFC 9457 §3.2）。種類に項目を足すのは、壊さない変更（下の「互換の規則」）。

| HTTP | `type` | いつ |
| --- | --- | --- |
| 400 | `/problems/validation-failed` | 要求が契約と合わない（形・書式・必須）。誤りの場所を `errors` に持つ（下） |
| 401 | `/problems/unauthenticated` | 有効なセッションがない |
| 403 | `/problems/forbidden-origin` | 書き込みの Origin が違う（ADR 0004「書き込みの API の CSRF への備え」） |
| 404 | `/problems/not-found` | 要求が指す記録が利用者の記録にない（domain の `notFound`）。消した割り込みを戻す操作では、利用者がその Sprint から消していない ID（ほかの利用者の ID、存在しない ID を含む。どれも同じ応答）。契約にない `/api/*` の経路とメソッドも同じ（Better Auth の `/api/auth/*` を除く。#319） |
| 409 | `/problems/revision-conflict` | ほかの書き込みが先に入り、この書き込みはしていない（ADR 0004「同時の書き込み」）。保存は確定したのに DB の応答が失われたときは、冪等キーの記録から保存した応答を返し、409 にしない（下の「冪等キー」、#320） |
| 412 | `/problems/precondition-failed` | 値を置き換える書き込みの `If-Match` が、記録の今の版と合わない（ほかの端末が先に変えた）。目標・繰り返しの規則を作る書き込みの `If-None-Match: *` で、目標・規則がもうある。何もしない（下の「記録ごとの版」、#321） |
| 413 | `/problems/payload-too-large` | 操作の本文が上限（64 KiB）を超える（#266） |
| 422 | `/problems/invalid-input`・`/problems/invalid-transition`・`/problems/recurring-task-cannot-complete` | domain が操作を受け付けない（値の規則、状態の遷移、繰り返しの Task の完了）。domain の `code` との対応は `problems.ts` の `DOMAIN_PROBLEMS`（サーバーとブラウザ内モックが使う） |
| 422 | `/problems/user-not-set-up` | 利用者の設定（タイムゾーン・週の始まり）がまだなく、「今日」が決まらない。`getMe` のほかの操作と読み取りはすべてこれで断る（#266） |
| 422 | `/problems/idempotency-key-reused` | 書き込みの `Idempotency-Key` を、24 時間の内に別の要求（メソッド・経路・query・本文）で使った。何もしない（下の「冪等キー」、#320） |
| 428 | `/problems/precondition-required` | 値を置き換える書き込みに `If-Match`（目標では `If-None-Match` も）がない。何もしない（#321） |
| 500 | `/problems/internal-error` | 予期しない失敗 |

400 の `errors`（拡張の項目。RFC 9457 §3 の例と同じ名前）は、契約と合わない場所ごとに 1 つの `{ detail, …場所 }` の配列（1 つ以上）。場所は次のどれか 1 つで表す（#319。SmartBear の problem registry の `validation-error` と同じ書き方。RFC 9457 §3 の例は本文だけ）。

- 本文：`pointer`。JSON Pointer を URI の fragment の形（RFC 6901 §6）で書く：`#/title`、`#/previous/setAt`。本文全体（JSON でない本文など）は `#`。RFC 9457 §3 の例と registry に合わせた（2026-10-04 司令塔の判断、#319）。
- path と query：`parameter`。契約の名前のまま（`taskId`、`apply-criterion`）。
- ヘッダー：`header`。ヘッダーの名前。書き込みの `Idempotency-Key`（下の「冪等キー」、#320）と、記録ごとの版の `If-Match`・`If-None-Match`（下の「記録ごとの版」、#321）で使う。

本文は `@itera/api-contract/problems`（手で書く。サーバーとブラウザ内モックが使う）の `problemOf`・`validationProblem` で作る。Valibot の誤りから場所を作るのも同じ module（`valibotIssues`・`issueAt`）。サーバーは `services/api/src/errors.ts` の `ApiError` と `errorResponse` の 1 か所で応答にする。Workers Logs に残すもの（ADR 0004）は変えない。

- 各 operation の応答に書く：操作は 400・401・403・404・409・413・422・500、値を置き換える 10 面は 412・428 も（#321。#320 から、すべての書き込みが `Idempotency-Key` を持つので、path の値・query・本文のない `beginPlanning` も 400 を書く）。読み取りは 400（パラメータのある読み取り）・401・409・422・500。`getMe` は 401・409・500（設定があれば追いつきを走らせるので 409 がありうる。#295 R1）。読み取りの 409 は、読み取りの前の追いつき（#271）の書き込みが、ほかの書き込みとぶつかったとき。操作の 422 は domain の 3 つの種類と `/problems/user-not-set-up`・`/problems/idempotency-key-reused` のどれか、読み取りの 422 は `/problems/user-not-set-up` だけ。
- `/problems/user-not-set-up` は domain の規則ではなく、記録を読み込んだときに設定の行がないことで決まる。判定はサーバーの流れの 1 か所（`services/api/src/handlers/flow.ts`）に置く。設定を作る `PUT /api/me/settings`（#279）は、記録を読む前に分かれるので、この種類で断らない（`flow.setUp`）。
- 本文の大きさの上限は 64 KiB（書き込みのすべての面に Hono の `bodyLimit`。#295 までは `/api/operations/*`）。いちばん大きい本文は Task の説明を含む `saveTask` で、文章を書く欄として十分に大きく、D1 の文字列・行の上限（2 MB）より小さい。`Content-Length` があれば本文を読まずに 413 を返す（ない要求は上限まで読んでから 413）。上限は `info.version` を変えずに広げてよい（狭めるのは壊す変更）。
- `requireAuth` の 401、Origin の 403、本文の大きさの 413（middleware が返すもの）も、この形にした（#266、#319）。
- 422 にしたのは、要求の形は正しく、記録の今の状態や値の規則で受け付けられないことを、形の誤り（400）と分けるため。409 は版の衝突だけに使い、クライアントは 409 なら読み直す（ADR 0004）。
- **断られた操作の後も、クライアントは読み直す**（2026-10-03 司令塔の判断、#295）。400・403・404・413・422 で断られた操作は何も保存していないが、送った値が古かったことがある：日付が変わった後の古い「今日」（W3 の 422）、週が終わって Review に入った後の古い実行中の Sprint（422 `/problems/invalid-transition`）など。読み直せば、クライアントは今の記録（`/me` の時計と今の Sprint）に戻る。Web は `apps/web/src/api/query-client.ts` で、操作が断られたら読み直してから失敗を返す。iOS・Android も同じ規則に従う。画面の文言は、断られたことを伝えるもの（記録は変わっていない）のまま。
  - W3 のための専用の種類（`/problems/day-changed` など）は今は足さない。原因を文言で伝えたくなったら後から足せる（開いた列挙なので壊さない変更）。

### 冪等キー（Issue #320、2026-10-04）

書き込みの結果が分からない失敗（通信の失敗、5xx）を、同じ要求として安全に送り直せるようにする（2026-10-04 オーナー決定。#295 で別に分けた 4 つの 1 つ）。RFC 9110 §9.2.2 は、要求が冪等だと知る手段か部分的な失敗から戻る手段がない限り、冪等でないメソッドの要求を自動で送り直すべきでない（SHOULD NOT）とする。冪等キーがその手段になる。

- ヘッダー：すべての書き込み（POST・PUT・PATCH・DELETE。`PUT /me/settings` を含む）に、必須の `Idempotency-Key` を置く（`openapi/parameters.yaml`）。読み取り（GET）には置かない（追いつきの書き込みは時計と記録だけで決まる。ADR 0004「操作と読み取りの処理」）。Better Auth の経路は対象外。すべての書き込みにあり、どの読み取りにもないことは `requests.test.ts` が生成した型で確かめる。
- 名前・書式・エラーのステータスは、IETF httpapi WG の draft「The Idempotency-Key HTTP Header Field」（draft-ietf-httpapi-idempotency-key-header-07、2025-10-15。WG Document のまま失効していて、RFC ではない）に合わせる。値は Structured Field の String（RFC 9651）で、UUID を二重引用符で囲む（`"8e03978e-40d5-43e8-bc93-6894a57f9324"`）。受け付けるのは UUID だけ（Google AIP-155 と同じ）。16 進の大文字と小文字は同じキーとして扱い、サーバーは小文字にそろえる。後ろに付いたパラメータ（`;a=1`）は読み飛ばす（RFC 9651 §2.3 は、知らないパラメータを誤りにしないよう勧める。形は確かめない）。パラメータの部品の名前は `IdempotencyKeyHeader`、値のスキーマは `IdempotencyKey`（同じ名前にすると、まとめたときに生成物に番号付きの別名ができる）。作る関数は `@itera/api-contract/sending` の `idempotencyKeyHeaders`（クライアントとテスト）、読む関数は `@itera/api-contract/requests` の `readIdempotencyKey`（サーバー）。Web は `run` ごとに `crypto.randomUUID()` で作る（ADR 0005「エラーと送信中」）。
- 誤り：キーがない、書式が違う → 400 `/problems/validation-failed`（`errors` の場所は `header: Idempotency-Key`）。同じキーを別の要求に使った → 422 `/problems/idempotency-key-reused`。どちらも何もしない。要求が同じかは、メソッド・経路・query・本文を届いたままつないだ SHA-256（指紋）で比べる。クライアントは同じ要求を同じバイト列で送り直すので、JSON の並べ方の違いは別の要求とみなす。
- 同じキーと同じ要求：24 時間の内なら、最初の応答（ステータスと本文）を、操作を実行せずに返す（Stripe、AIP-155、Zalando 規則 230 と同じ）。処理は ADR 0004「操作と読み取りの処理」の 4・7 と「同時の書き込み」。
- 保存するのは、書き込みを確定した結果（2xx）だけ。400・404・422 など何も書かなかった失敗は保存しないので、同じキーで送り直すともう一度実行する（Stripe と同じ）。
- 何も変えなかった操作（書く行も Activity もない。同じ設定をもう一度送る `PUT /me/settings` など）も、キーを残さない（#320 で決めた）。理由：残すには、それだけのための書き込みが要り、版を上げればほかの端末の同時の書き込みを 409 にし、版を確かめずに書けば記録とキーが同じ時点のものでなくなる。送り直すともう一度実行するが、1 回目は何も変えていないので、効果は多くても 1 回で、2 回効くことは起きない。その間に記録が変わっていれば、応答は 1 回目と違いうる（断られることもある）。戻す条件：何も変えなかった応答も同じに返す必要がクライアントにできたとき。
- 期限：24 時間（Stripe の先例。draft は期限をリソースが決めるとする）。過ぎたキーは新しい要求として扱う。cron は足さず、期限を過ぎた行は、その利用者の次の書き込みの `batch()` で消す（ADR 0004「記録のテーブル」）。
- 処理中の同じキー：draft の「最初の要求の処理中に同じキーが来れば 409」は採らない。後から来た要求が、最初の要求の確定の前に記録を読み込んでも、その保存は版の衝突になり、衝突の後にキーの記録を読み直すので、最初の結果を返せるため（ADR 0004「同時の書き込み」）。どちらの要求も操作を実行するが、書き込みは版で 1 つだけが通る。戻す条件：外部への副作用（LLM の呼び出しなど）を `batch()` の外で行う操作ができ、重ねて実行すること自体を避けたくなったとき。
- draft とのほかの違い：キーが要る操作でキーがなければ 400 は draft のとおり（§2.7、SHOULD）。draft は期限切れのキーの扱いを決めておらず、ここでは新しい要求として扱う。draft は 400 と 422 の本文に関係する文書へのリンクを勧める（SHOULD）が、この契約の `type` は解決しない相対の URI 参照なので（上の「エラー」）、文書は OpenAPI の説明に置く。
- ブラウザ内モック（ADR 0005）はキーを確かめない（版の衝突と同じ扱い）。
- 互換：要求に必須の項目を足す壊す変更（下の「互換の規則」）なので、`info.version` を 0.4.0 にした。デプロイの前に開いたタブの書き込みは 400 になり、読み直しの後の操作から通る（利用者が 1 人の間は足りる。下の「壊す変更をするとき」）。

### 記録ごとの版（Issue #321、2026-10-04）

同じ利用者が PC とスマホから書く（ADR 0004「同時の書き込み」）。利用者ごとの版は、1 つの要求の読み込みと書き込みの間を守るが、クライアントが古い表示をもとに書いたことは分からない。状態の遷移は domain が今の状態で判定するので古い表示から押しても 422 になるが、値を置き換える操作は通り、ほかの端末で書いた値を黙って上書きする。値を置き換える操作だけを、対象の記録の版で条件つきにする（2026-10-04 オーナー決定。RFC 9110 §13.1.1 `If-Match`、RFC 6585 §3、Google AIP-154、Zalando 規則 182）。

- 利用者ごとの版をクライアントが送る形は採らない：ほかの端末の無関係な書き込みでも、日付が変わった後の最初の読み取りの追いつき（ADR 0004）でも版が上がるので、別の端末で開いただけで次の書き込みが 409 になる。記録の行ごとの版なら、断られるのは同じ行の値が変わったときだけになる（同じ行の別の項目、たとえば振り返りの「気づいたこと」と「次に試すこと」は同じ行なので断られる）。
- **版**：記録の行の `revision`（ADR 0004「記録のテーブル」）。その行の値を最後に書いた保存の利用者ごとの版。利用者ごとの版は上がるだけなので、消して作り直した行でも前の版と重ならない。位置（`position`）だけが変わった行は版を上げない（前の行を外したときに、後ろの行が 412 にならないように）。
  - 繰り返しの規則（#330）は、値が規則の行ではなく、版の行（`recurrence_rule_version`）と曜日の行（`recurrence_rule_version_day`）にある。版と曜日は規則の部分で、自分の版を持たず、規則の版は全体の版にする：規則・版・曜日の行の `revision` の最大。曜日を減らすと行が消えるだけで、残る行の `revision` は変わらない（最大が変わらない）ので、部分の行を足す・変える・消す保存は、規則の行の `revision` もその保存の版にする（`saveRecords`。ADR 0004「記録のテーブル」）。最大を読むのは、規則の行を書くようになる前の行（#321 から #330 まで）にも合うように。ブラウザ内モックは規則を版ごと 1 つの値として比べ（`nextVersions`）、同じ版になる（`fixture-records.test.ts` で確かめる）。
- **etag**：値を置き換える書き込みが対象にする記録の DTO（`Task`・`Subtask`・`Sprint`・`SprintGoal`・`SprintTask`・`InterruptNote`・`Retro`・`CriterionUse`・`PlanningCriterion`、領域の一覧の `EditableArea`、Backlog の行の規則 `BacklogItem.rule`（#330。規則の DTO はなく、Task の詳細もこの行を使う））に、出力専用の必須の `etag` を置く（AIP-154 の形）。値は強い entity-tag（RFC 9110 §8.8.3）。今は版の番号を二重引用符で囲む（`"42"`）が、契約は entity-tag の形（`^"[!#-~]*"$`）としか決めず、クライアントは中身を読まず、まるごと比べるだけにする（表し方を後で変えても壊す変更にしないため。#321 の Contract のレビュー）。これは記録の版で、同じ経路の読み取り（`GET /sprints/{sprintId}` など）の表現の validator ではない（読み取りの表現は入れ子と派生値を含み、この etag が同じでも変わる）。読み取りの `If-None-Match`（304）を入れるときは、別の validator にするか経路を分ける。Google AIP-154 は項目の意味（出力専用、送り返す、食い違えば ABORTED）を借り、HTTP の振る舞い（`If-Match`、412・428）は RFC 9110 と RFC 6585 に従う。記録がどの読み取りに出ても同じ `etag` を持つ（派生値の中の記録、`CapacityDriver` と `RetroFacts.interrupts` も）。マイグレーションの前に書いた行は版 0（`"0"`）。
- **対象の面**：値を置き換える PATCH の面のすべて（10 面）と、規則をまるごと置く PUT（`setRecurrence`、#330）。PATCH には `If-Match`（`IfMatchHeader`、必須）を置く。

| 面 | operationId | 受ける操作 | 版を比べる記録 |
| --- | --- | --- | --- |
| `PATCH /areas/{areaId}` | `renameArea` | 同名 | Area |
| `PATCH /tasks/{taskId}` | `saveTask` | 同名 | Task（Task の行。サブタスクと提案は別の行） |
| `PATCH /tasks/{taskId}/subtasks/{subtaskId}` | `updateSubtask` | `setSubtaskDone`・`setSubtaskEstimate` | Subtask（完了も値の置き換え：送った値にする） |
| `PATCH /sprints/{sprintId}` | `setAvailableHours` | 同名 | Sprint（Sprint の行） |
| `PATCH /sprints/{sprintId}/goals/{areaId}` | `updateGoal` | `setGoal`・`assessGoal` | SprintGoal（下の「目標」） |
| `PATCH /sprints/{sprintId}/sprint-tasks/{sprintTaskId}` | `setGoalLink` | 同名 | SprintTask |
| `PATCH /sprints/{sprintId}/interrupts/{interruptNoteId}` | `editInterrupt` | 同名 | InterruptNote |
| `PATCH /sprints/{sprintId}/retro` | `updateRetro` | `setReflection`・`setImprovement` | Retro（改善も同じ行） |
| `PATCH /sprints/{sprintId}/criterion-use` | `decideCriterion` | 同名 | CriterionUse |
| `PATCH /planning-criteria/{criterionId}` | `setDraftPolicy` | 同名 | PlanningCriterion |
| `PUT /tasks/{taskId}/recurrence` | `setRecurrence` | 同名 | RecurrenceRule（Task の規則。版と曜日を含む全体。下の「繰り返しの規則」） |

- **目標**：`updateGoal` は目標がないとき目標を作る（domain の `setGoalText`）。ない記録に etag はないので、`If-Match` は必須にせず、目標があれば `If-Match`、なければ `If-None-Match: *`（RFC 9110 §13.1.2。ないと思って作る要求が、ほかの端末が先に作った目標を上書きしない）を送る。どちらもなければ 428（2026-10-04 司令塔の判断）。利用者の持たない領域の目標は、条件を比べずに 404（`setGoal` が領域を確かめる。#321 で足した。それまでは domain が領域を確かめず、持たない領域の目標の行ができた）。`OptionalIfMatchHeader` と `IfNoneMatchHeader`。
- **繰り返しの規則**（#330、2026-10-04）：`setRecurrence` は、Task に規則がなければ作り（domain の `createRuleForNextSprint`）、あれば次の Sprint から変える。目標と同じく、Task の規則（`task.recurrenceRuleId`）があれば `If-Match`（`BacklogItem.rule.etag`）、なければ `If-None-Match: *` を送り、どちらもなければ 428。終わる規則（「繰り返しをやめる」の後、最後の日まで表示する。F41）は Task から外れているので Task の規則ではなく、`BacklogItem.rule` に出ていても、規則を置く書き込みは新しい規則を作る `If-None-Match: *` で送る（その etag の `If-Match` は 412）。Task がなければ条件を比べずに 404、Task が指す規則がなければ 404（操作が答える）。比べるのは Task の規則の版で、Task の行の版ではない（Task の題名を変えても規則の書き込みは 412 にならない）。
- **対象にしないもの**と戻す条件（2026-10-04 司令塔の判断。オーナーの確認を待つ）：
  - 状態の遷移（`POST …/<動詞>`）と取り消し（`undo-…`）：domain が記録の今の状態で判定するので、同じ記録の無関係な項目が変わっただけでは断らない。戻す条件：遷移の結果が状態以外の項目に左右される操作ができたとき。`undoAdoption` も取り消しの遷移で、提案の状態で domain が守る。
  - `endRecurrence`（`DELETE /tasks/{taskId}/recurrence`、#330 で決めた）：規則を次の Sprint の前で終える（回がまだなければ消す。F41）状態の遷移で、結果（終える・消す、終わる日）は回と Sprint の今の状態で domain が決め、規則の値（どの曜日か）に左右されない。ほかの端末が規則を変えた後に古い表示から押しても、「この Task の繰り返しをやめる」という意図は同じに通る。ほかの端末が先に終えていれば、domain が 422 で断る。上の状態の遷移の基準のとおり対象にしない。戻す条件：終え方が規則の値に左右されるようになったとき（たとえば、選んだ版だけを終える操作ができたとき）。
  - `setSettings`（`PUT /me/settings`）：設定を作る面で、今の画面は最初の設定でしか送らない。戻す条件：表示名を後から変える画面ができたとき。
  - `restoreInterrupt`（`PUT`）：消した行の版は残らないので比べられない。下の「既知の制約」はそのまま残る。
  - ほかの PUT・DELETE（回を含める・外す、印、まとめて外す）：結果が 1 つに決まる置く・外す。
- 条件を求めない面に `If-Match` が付いていても、書式を確かめるだけで比べない（状態の遷移は domain が今の状態で判定する）。
- 冪等キーの指紋（上の「冪等キー」）は `If-Match` を含まない。同じキー・同じ本文で `If-Match` だけ違う送り直しは、1 回目の応答を返す（自分の書き込みの送り直しを 412 にしないため）。
- **比べ方**：`If-Match` は `*` か、entity-tag の一覧（`EntityTagList`）。強い比較で、弱い entity-tag（`W/"…"`）はどれとも合わない。`If-None-Match` は `*` だけを受ける（`AnyEntityTag`）。書式が違えば 400 `/problems/validation-failed`（`errors` の場所は `header`）。読むのは `@itera/api-contract/requests` の `readCondition`、送るのは `@itera/api-contract/sending` の `conditionHeaders`（`MadeFrom`：`{ etag }` か `{ none: true }`）。どの操作が条件を要るか、記録のどこを比べるかは `packages/application` の `checkCondition`（`conditions.ts`。API とブラウザ内モックが使う）。面が `If-Match` を持つ操作の型（`ConditionalName`）と application の `ConditionalOperation` が同じことを型のテストで、PATCH の面だけが `If-Match` を持つことを `requests.test.ts` で確かめる。
- **順序**：RFC 9110 §13.2.1 のとおり、条件を除いた要求の応答が本文を処理する前に 2xx・412 以外になるなら、条件より先に答える。400（形と書式）・401・403・413 → 冪等キーの照合（#320。自分の書き込みの送り直しは 412 にせず 1 回目の応答を返す）→ 404（要求が指す記録がない。`checkCondition` は対象のない操作を通し、操作が答える）→ 428・412 → domain の 422。比べる版は、追いつき（ADR 0004 #271）の前の、読み込んだ版（利用者が読んだもの）。412 でも 428 でも何も書かない。
- **応答の `ETag`**：値を置き換える書き込みが通ったら、記録のその後の etag を `ETag` ヘッダーで返す（`headers.yaml` の `RecordETag`。記録を消した書き込み、目標を空にしたときは返さない）。同じキーで送り直した要求にも同じ値を返す（冪等キーの記録に置く。ADR 0004「記録のテーブル」）。クライアントは、同じ記録への次の書き込みを、読み直しを待たずにこの値で送れる（同じ形の 2 つの欄を続けて保存するとき、自分の 1 回目で 2 回目が 412 にならないように。ADR 0005「エラーと送信中」）。
- ブラウザ内モックも同じに振る舞う（ストアが保存のたびに版を進め、`checkCondition` で比べ、`ETag` を返す。ADR 0005「ブラウザ内モック」）。
- 確かめ：アプリ越しのテスト（`services/api/src/handlers/record-versions.test.ts`）で、古い `etag` の `saveTask` が 412 で記録を変えないこと、`If-Match` なしが 428、今の `etag` なら通り後の読み取りの `etag` が変わること、別の記録への書き込み（今日の選択の完了）と日付が変わった後の追いつきで Task の `etag` が変わらず後の `saveTask` が通ること、1 回目が保存されていれば同じキーの送り直しが 412 でなく 1 回目の応答（と同じ `ETag`）を返すこと、404 が 412 より先で 412 が 422 より先なこと、目標の `If-None-Match: *` を確かめた。規則（#330）は、同じテストで、規則の `etag` の `setRecurrence` が通り応答の `ETag` が後の読み取りの `etag` と同じこと、曜日を減らしても `etag` が変わること、古い `etag` が 412・条件なしが 428・規則があるときの `If-None-Match: *` が 412 で記録を変えないこと、規則のない Task は `If-None-Match: *` で作れて 2 回目は 412 なこと、`endRecurrence` が条件なしで通り、その後は新しい規則を `If-None-Match: *` で作れること（終わる規則の `etag` の `If-Match` は 412）を確かめた。DB の版とブラウザ内モックの版が同じことは `fixture-records.test.ts`（規則を作る・変える・終える、曜日を減らす）。
- 互換：要求に必須のヘッダーを足す壊す変更（下の「互換の規則」）なので、`info.version` を 0.5.0 にした。デプロイの前に開いたタブの値を置き換える書き込みは 428 になり、読み直しの後の操作から通る（利用者が 1 人の間は足りる）。

### 生成物

- `pnpm contract:generate` が、Redocly で `openapi/` を 1 ファイルにまとめ（一時ディレクトリ）、Hey API で `packages/api-contract/src/generated/` に生成する。生成物はコミットする。分けたファイルのまま Hey API に渡すと、別ファイルの path と応答の参照から中身のない型（`CreateArea = unknown` など）が出るため、まとめてから渡す。
- `pnpm contract:check`（`pnpm check` の中）は、仕様を lint し、一時ディレクトリに生成し直して、コミットした生成物とファイルの一覧と中身が同じかを確かめる。違えば失敗する（CI でも同じ）。
- 出力：`@hey-api/typescript`（型）、`valibot`（定義・要求・応答のスキーマ）、`@hey-api/client-fetch` と `@hey-api/sdk`（fetch のクライアント）、`@tanstack/react-query`（Query と Mutation の options）。生成の入口ファイルは作らず、次の 3 つの入口で出し分ける。
  - `@itera/api-contract`：型と Valibot のスキーマだけ。`services/api` はこれだけを使う。Web の本番のコードは型だけを import する（値を import するとスキーマと Valibot が本番ビルドに入る。ADR 0005「本番ビルド」）。
  - `@itera/api-contract/client`：fetch のクライアント（Web）。関数は契約の operation と読み取りだけにする（一覧のテストが、関数の export を operation として数える）。
  - `@itera/api-contract/create-client`：別のクライアントを作る `createClient`・`createConfig`。Web はデータの出どころ（API、ブラウザ内モック）ごとにクライアントを作る（#272、ADR 0005「Web のクライアントとブラウザ内モック」）。
  - `@itera/api-contract/react-query`：TanStack Query の options（Web）。React に依存する。
  - `@itera/api-contract/sending`：操作と面の振り分けの送る側（上の「経路の形」、#295・#356）。`routes`・`requestOf`、書き込みのヘッダーを作る `idempotencyKeyHeaders`・`conditionHeaders`。Valibot とスキーマを import しない。生成物ではなく手で書く。Web が使う。
  - `@itera/api-contract/requests`：操作と面の振り分けの両方向（`/sending` のものに、要求を読む `surfaces`・`readRequest`・`readIdempotencyKey`・`readCondition` と `queryInput` を足す）。Valibot とスキーマを使う。生成物ではなく手で書く。サーバー・ブラウザ内モックが使う。
  - `@itera/api-contract/problems`：エラーの本文（種類ごとのステータスと `title`、domain の拒否との対応、`errors` の場所の作り方。上の「エラー」、#319）。生成物ではなく手で書く。サーバー・ブラウザ内モック・Web（`failureOf` の型、テストの応答）が使う。domain には依存しない（ADR 0007）。domain の拒否の `code` は、表のキーとして契約が自分で名前を持ち、サーバーとモックが `DomainError` の `code` で引く。domain に `code` が増えると、引く側が型の検査で失敗する。
  - `@itera/api-contract/testing`：テストの道具（操作ごとの入力の例 `OPERATION_EXAMPLES` など）。テストだけが使う。
  - `services/api` から `client`・`create-client`・`react-query` の import を ESLint の `no-restricted-imports` で止める。API が React に依存しない。
- Hey API がそのまま写す fetch の実行時のコード（`src/generated/client/`・`core/`）は `exactOptionalPropertyTypes` を前提に書かれておらず、`apps/web` はこの .ts を自分の設定で型検査する。そこで生成の後処理で、この 2 つのディレクトリのファイルにだけ `// @ts-nocheck` を付ける。契約から生成したコード（型・スキーマ・SDK・Query の options）は型検査の対象のまま。Hey API がこの設定に対応したら外す。
- Hey API 0.99.0 の Valibot のプラグインは、`additionalProperties` の値が `$ref` だと値を読まず、`v.record` の代わりに何も検証しない `v.object({})` を出す（`BacklogData.items`、`RetroData.sprintAreas`）。仕様の書き方（`allOf`・`anyOf`・`type` を並べる）では避けられなかった。そこで `pnpm patch` で、その条件の 1 行（`$ref` の値も読む）だけを直す（`patches/@hey-api__openapi-ts@0.99.0.patch`、`pnpm-workspace.yaml` の `patchedDependencies`）。
  - 境界：Valibot のプラグインの `additionalProperties` の扱いの 1 行だけ。ほかの出力は変えない。
  - 検査：生成した Valibot に `v.object({})`・`v.unknown()` があればテストが失敗し、2 つの表が `v.record` で値を検証していることもテストで確かめる（`src/generated.test.ts`）。版を上げて patch が当たらなくなったときも、ここで止まる。
  - 戻す条件：Hey API が `$ref` の値の表に `v.record` を出すようになったら、版を上げて patch を消す。
- 生成物は Prettier と ESLint の対象外（`.prettierignore`、`eslint.config.js` の ignores）。正しさは `contract:check` と下のテストで確かめる。

### 契約と実装の一致

`packages/api-contract` のテストで確かめる。

- 一覧：生成したクライアントの operation が、`surfaces` の面、読み取りの 8 個（`getMe` を含む）、設定を作る `setSettings`（`settingsSurface`）に一致し、`operations` のすべての名前が面のどれかに行く。`@itera/application` の関数の export のうち、読み取りでも操作の道具でもないものがあれば失敗する（読み取りを足したら契約にも足す）。
- 往復（`src/requests.test.ts`）：操作ごとの入力の例（`OPERATION_EXAMPLES`。省略できる項目の有無を含む）を `requestOf` で要求にし、面のスキーマで検証して `operation` に通すと、同じ操作と入力に戻る。面のメソッドと経路が、生成したクライアントの関数が送るものと同じ。面のスキーマのすべての項目を、どれかの操作の要求が使う。すべての経路と query の名前が kebab-case。
- 型：各操作の入力と要求は `sending.ts` の中で（受け取った要求から作る操作の入力は `requests.ts` の中で）生成した型に対して型検査する。出力と応答（1 つの操作だけの面は同じ型、いくつかの操作の面は各出力が応答に合い、合わせて応答の項目になる）、各読み取りの結果と応答の `view`（`undefined` は `null`）と `clock` が、型として同じ（片方への代入ができるだけでなく、余分な・欠けたキーもない）。比べる前に、両方から brand（ID・日付）と `readonly` を外す。`pnpm typecheck` で確かめる。このテストは、今は application の結果から DTO への写像が恒等であることを確かめるもので、application の形が契約の正本であることを示すものではない（契約の正本は `openapi/`）。内部の変更で型が合わなくなったら、意図した契約の変更でない限り、契約は直さずに `services/api` に写像を置く（ADR 0007「アプリケーション層の読み取りと API の DTO」）。
- fixture：PRD §12 の 12 状態で、すべての読み取り（Backlog の絞り込みごと、すべての Sprint の番号と次の週、昨日と明日）の結果を JSON にして `{ clock, view }` で包み、生成した応答のスキーマで検証する。
- エラー：`problems.ts` が作る本文が、種類ごとに契約のスキーマを通る（`src/problems.test.ts`）。生成した型で、すべての operation のエラーの応答が `unknown` でなく Problem の型になる（`src/generated.test.ts`。Hey API 0.99.0 は `application/problem+json` の応答も `application/json` と同じく読む）。サーバーのテストは、エラーの応答の `Content-Type`・本文の `status`・そのステータスのスキーマを確かめる（`services/api/src/test-problems.ts`）。
- ID：各種類の ID のスキーマが、`parseId` と同じものを受け付ける。型のテストは ID を文字列として比べるので、各操作の入力のどこがどの種類の ID を取るかは別に確かめる：application の入力の型から求めた種類の表（`pnpm typecheck` で型と照合）に沿って、例の入力の ID を別の種類の ID に替えると、その要求を面のスキーマが断る（`src/id-kinds.test.ts`）。

## 検討した代替案

- **TS の型から仕様を出力する**（Hono のルート定義、型からの JSON Schema 生成）：#45 のオーナーの決定（仕様が正本）のとおり採らない。iOS・Android が使う契約が TypeScript の実装に従うことになる。
- **操作を 1 つの経路にまとめる**（`POST /api/operations` に `{ name, input }`）：operation ごとの型・スキーマ・クライアントの関数が生成できず、OpenAPI で契約にする意味が薄れる。
- **すべての操作を `POST /api/operations/{名前}` にする**（#265〜#268 の形。#295 で改めた）：HTTP のメソッドで冪等さ・取り消しを表せず、経路の書き方もそろっていなかった（操作は camelCase、読み取りは kebab-case）。iOS・Android が同じ契約を使う前に、資源とメソッドの形にした。判定は今も domain だけにあり、資源の形にしても判定がクライアントに寄ることはない（面は操作の名前と入力に戻すだけ）。
- **画面と操作を起点にした経路**（#295 の案 A。`/planning`・`/today`・`/running`・`/retro` に、サーバーが暗黙に選ぶ Sprint の操作を置く）：取り下げた。起点が画面と操作で、ドメインの資源になっていない（オーナーの指摘。上の「決定の過程」）。
- **SprintTask などを最上位に置く**（案 a、`/sprint-tasks/{sprintTaskId}`）と **Task の ID を鍵にする**（`/sprints/{id}/tasks/{taskId}`）、**動作を `:` で書く**（AIP-136、Azure）：上の「決定の過程」のとおり採らない。
- **Sprint を番号で経路に置く**（`/sprints/14`）：番号は利用者ごとの表示の値で、資源の鍵にしない（上の「決定」2）。
- **状態の遷移も PATCH の状態の項目にまとめる**（#295 の案 B）：選択の `resolution`、提案の `state` などを PATCH で送り、今の状態と求める状態から domain の操作を選ぶ。採らない：どの遷移を選ぶかの知識が写像（または application）にも要り、domain と 2 か所に分かれる。取り消しの行き先は今の状態で決まる（完了の取り消しは中断に戻ることもある）ので、結果の状態と一致しない値（「取り消す」）を送ることになり、写像も記録を読んでからでないと選べない。
- **読み取りの応答をそのまま結果にする**（包まない）：結果がないとき（`undefined`）を 404 にすると、空の状態がエラーとして扱われる。今日と現在時刻を応答に含める必要もある（ADR 0005「時計」）。
- **生成物をコミットせず、CI とインストールのたびに生成する**：`pnpm install` の後に生成の手順が増え、差分のレビューで契約の変化が見えない。

## 既知の制約

- query の数と真偽は文字列で届くので、サーバーで変換が要る（#266）。
- query は空の配列を運べないので、`DELETE /sprints/{sprintId}/sprint-tasks?ids=` は `minItems: 1` とし、`requestOf` も空の配列を断る（1 つも外さないときは送らない）。
- 印の `{pin}` は記録の ID から種類を決める。クライアントが別の種類として送った ID も、その ID の種類の印として扱う（契約が受け付ける ID の種類の中で）。印を付けられるのは、その Sprint の事実だけで、ほかの Sprint や存在しない ID は domain が `notFound`（404。経路の子が経路の Sprint にないとき、と同じ）で断る（#270、不変条件 40）。
- `PUT`・`DELETE` の 2 回目を、domain が `/problems/invalid-transition`（422）で断る操作がある（含めた回をもう一度含める `PUT …/included-occurrences/{occurrenceId}` など）。記録は変わらないので状態としては冪等だが、応答は 1 回目と同じにならない。同じ要求の送り直し（同じ `Idempotency-Key`）は 1 回目の応答を返すので、これは別のキーで同じ操作をもう一度したときだけになる（#320）。直すなら domain の変更。
- 応答のスキーマは未知のキーを許すので、Valibot の検証だけでは余分なキーを見つけられない。型のテストで止めている。
- `restoreInterrupt` と `undoAdoption` は、クライアントが前の読み取りの値を送る。利用者ごとの版はサーバーが読み込んだ時点のものなので、クライアントの読み取りが古いことは 409 では分からない。記録ごとの版（上の「記録ごとの版」、#321）も、消した行の版が残らないので `restoreInterrupt` には使えない（`undoAdoption` は取り消しの遷移で対象にしていない）。`undoAdoption` は domain の確かめ（提案の状態）で守られるが、`restoreInterrupt` は消した後の内容を覚えていないので、古い note（別の端末で直した後の、直す前の本文など）でも、消した ID のものなら受け付ける。直すには、消した割り込みの内容をサーバーが持つ必要がある（`interruptDeleted` が内容を持つ Activity の変更か、domain の記録。ドメインモデルの正本の変更で、別の Issue）。
- `restoreInterrupt` が domain で確かめる ID の重複は、利用者自身の Sprint の中だけ（#269）。ほかの利用者の割り込みの ID は、保存の前の確かめ（上の「消した記録を戻す操作の照合」、#315）で 404 になり、保存の主キーの衝突は起きない。`interrupt_note.id` に主キーの衝突を起こしうるのは、クライアントが新しい行の ID を決める経路だけで、契約ではこの操作だけ（#315 で、path と本文に ID を持つすべての操作を確かめた：ほかの操作の ID は既存の記録を指し、新しい行の ID はサーバーが作る）。クライアントが新しい行の ID を決める操作を足すときは、同じ確かめを `services/api/src/handlers/preconditions.ts` に足す。
- 文字列・配列の長さに、契約では上限を置いていない。本文の大きさは 64 KiB で止める（上の「エラー」、#266）ので、1 つの値が D1 の上限を超えることはない。

## 互換の規則

契約を変えても、すでに動いているクライアントが壊れないようにする（ADR 0007）。

- 版のずれは、どのクライアントにもある。iOS・Android には古い版が長く残る。Web は API と同じ Worker で配信するので一緒に入れ替わるが、デプロイの前に開いたタブは、古いコードのまま新しい API を呼ぶ。この規則は Web にも当てはめる。
- 契約が変わるのは、`openapi/` を直したときだけにする。application と domain の内部の変更で、通信の形を変えない（ADR 0007「アプリケーション層の読み取りと API の DTO」）。

### 列挙

列挙は 2 種類に分け、どちらなのかを仕様の `description` に書く。

- **開いた列挙**：値が増えることを前提にする列挙。エラーの `type`（#319 までは `code`）。値を足すのは壊さない変更。操作の可否は列挙ではなく、記録ごとの `capabilities` の真偽値の項目にした（ADR 0007「操作の可否」、#322）。`can…` を足すのは、応答に項目を足す変更（下の「壊さない変更」）で、クライアントは知らない `can…` を読み飛ばし、その操作は出さない。
  - 受け取る側（すべてのクライアントと、そこで使う生成した型と検証）は、知らない値を受理しなければならない。知らない値で、読み込み（decode）も応答の検証も失敗させない。知らない `type` は一般の失敗として扱う。知らない HTTP のステータス（#266 で足した 413 のように、後から足すもの）も、一般の失敗として扱う。
  - iOS・Android の生成した型がこれを満たすこと（知らない値を表す場合を持つか、文字列として受ける）を、生成の道具を選ぶ条件にする。満たさない道具は使わない。
  - 今の仕様は、`type` をエラーごとに `const` で書いている（domain の 3 つの種類の `RuleViolationError` だけ `enum`）。操作の 422 は `RuleViolationError`・`UserNotSetUpError`・`IdempotencyKeyReusedError` の `oneOf`（#266。3 つ目は #320）。エラーの本文の `oneOf` のように、枝が `type` の値だけで分かれ、形がどれも Problem Details（`{ type, title, status, detail }` と種類ごとの拡張）のものは、開いた列挙として扱う。枝を足すのは `type` の値を足すのと同じで、壊さない変更。開いた列挙の仕様での書き方（拡張の印、`anyOf` で文字列を足すなど）は、iOS に着手する前に生成の道具と一緒に決め、そのとき `type` も書き直す。Web が応答を実行時に検証するようにするなら、それより前に決める。
- **閉じた列挙**：値ごとに意味が違い、知らない値では正しく表示できないもの。状態の名前、union の判別子（`base`・`kind` など）、`SprintWeek` など。値を足すのは壊す変更。判別子が閉じた列挙の union に種類（`oneOf` の枝）を足すのも同じ（エラーの本文の `oneOf` は上の開いた列挙）。
- 閉じた列挙でも、知らない値で読み込み全体を失敗させないことが望ましい（その部分を一般の形で出すか、アプリの更新を促す）。ただし、これに頼って閉じた列挙に値を足さない。

### 壊さない変更

- operation を足す。
- 応答に、省略できる項目を足す（応答は未知のキーを許す。上の「置き場所と書き方」）。ただし、クライアントが前の読み取りの値を送り返す入れ子（`restoreInterrupt` の `InterruptNote`、`undoAdoption` の `Estimate`。上の「消した記録を戻す操作の照合」）は、古いクライアントがその項目を落として送り返しても意味が変わらないときに限る。変わるなら壊す変更として扱う。
- 応答に、必須の項目を足す。応答は未知のキーを許すので（上の「置き場所と書き方」）、動いているクライアントは足した項目を読み飛ばすだけで壊れない。クライアントを新しく作るときに生成した型で必須になるので、サーバーがいつも返せる値（ほかの項目から決まる値など）に限る。あとで省略できる項目に戻すのは壊す変更になる（下の「壊す変更」）。クライアントが送り返す入れ子の項目には当てはめない（上の項目の但し書き）。
- 要求に、省略できる項目を足す。省いたときの振る舞いは、足す前と同じにする。
- 要求の必須の項目を省略できるようにする（省いたときの振る舞いは今と同じにする）。応答の省略できる項目を、必ず返すようにする。
- 開いた列挙に値を足す。
- 判別子のない `oneOf` に `discriminator` を足す（通信の形は変わらない）。

### 壊す変更

- 閉じた列挙に値を足す。union に種類を足す。
- 要求に必須の項目を足す。要求の省略できる項目を必須にする。
- 要求から項目を消す。要求の本文は未知のキーを 400 にするので、古いクライアントが送る項目を消すと、その要求が失敗する。
- 応答から項目を消す。応答の必須の項目を省略できるようにする。
- 項目の名前や型を変える（例：`SprintAreaLabel.color` の、色の番号か `none` という形を変える）。
- 省略・空・`null` を入れ替える（例：「ない」と「空」を分けている SprintTask の `occurrenceIds`）。
- 形が同じでも、意味や単位を変える（時間の単位や丸め、日付と日時の取り違えなど）。
- operation を消す、名前を変える。
- 消した項目や operation の名前を、別の意味で使い直す。

### 壊す変更をするとき

- `info.version` の major を上げ、ADR に書く。
- ただし最初の本番の公開（統合ブランチを main に入れて CD でデプロイするとき）までは、SemVer（§4）の major 0（初期の開発中）として扱い、壊す変更で minor を上げる。最初の本番の公開で 1.0.0 にし、その後は major を上げる（2026-10-03 司令塔の判断、#295）。#295 の経路の変更で 0.2.0、#319 のエラーの形の変更で 0.3.0、#320 の冪等キーで 0.4.0、#321 の記録ごとの版で 0.5.0、#323 の操作の可否（`BacklogItem` の `can…` を `capabilities` に移した）で 0.6.0、#330 の規則の版で 0.7.0 にした。
- 版の上げ方（経路、ヘッダー、受け付ける最低の版）と、古いクライアントの扱いは、iOS に着手するまでに決める。それまでは Web だけなので、壊す変更を入れた直後は、開いたままのタブの要求が失敗しうる（400 など）。利用者が 1 人の間は、読み直しで足りる。

### 決めていないこと（iOS に着手する前に決める）

- 時間（h）の数の表し方（今は JSON の数。分の整数にするかなど）と丸め。後から変えると壊す変更になる。
- 版の上げ方と、古いクライアントの扱い。
- iOS・Android の生成の道具。開いた列挙の知らない値と応答の知らないキーで読み込みを失敗させないこと、省略と空を分けられること、型の混ざった `oneOf`（例：`SprintAreaLabel.color` の数と `none`）を扱えること、判別子のない `oneOf` の要求の本文（どの項目があるかで枝が決まる。`updateSubtask`・`updateGoal`・`addToSprint`・`chooseForDay`・`adoptEstimateSuggestion`・`updateRetro`、#295）と、path の値の `oneOf`（印の `{pin}`：ID の種類の union と `available-hours`）を扱えることを条件にして選ぶ。開いた列挙の仕様での書き方も、このとき決める。

## 影響

- `services/api`（#266）は、`@itera/api-contract` のスキーマで入力を検証し、この ADR の割り当てでエラーを返す。書き込みは `@itera/api-contract/requests` の面をすべて登録し（#295）、読み取りは `reads.ts` の登録表に足す。契約のすべての面と読み取り（`getMe` のほか）が登録されていることはテストで確かめる（#270 で全部の領域がそろい、未実装の一覧はなくなった）。
- `apps/web`（#272）は、`@itera/api-contract/client` と `/react-query` を使い、`@tanstack/react-query` 5.104.1 を入れる。操作は `useOperation('<名前>')` で、`@itera/api-contract/sending` を通して送る（#295。#356 で `/requests` から分けた）。
- iOS・Android は、`openapi/` を 1 ファイルにまとめたもの（`redocly bundle`）から生成できる。セッションの Cookie と書き込みの Origin の検査（ADR 0004）は、Origin を送らないネイティブのクライアントでは 403 になるので、ネイティブの認証の方式は iOS に着手するときに決める。
- 契約を変えるときは、`openapi/` を直し、`pnpm contract:generate` を実行して、生成物と一緒にコミットする。
