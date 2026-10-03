# ADR 0006: API の契約（OpenAPI）

- 状態：採用
- 日付：2026-10-03
- 関連：Issue #265、#45（範囲の分け方は #262）、先行 #264、後続 #266・#272
- 改訂：2026-10-03（互換の規則を書き直す。型のテストが失敗したときの直し方。ADR 0007）
- 改訂：2026-10-03（利用者と設定の読み取り `getMe`、設定がないときのエラー、本文の大きさの上限。Issue #266）
- 改訂：2026-10-03（経路を資源（ドメインの名詞）から付け、HTTP のメソッドで表し、kebab-case にそろえる。Sprint は ID で経路に置く。状態の遷移はスラッシュの動作。Issue #295。初めの案 A は取り下げた）
- 改訂：2026-10-03（`getMe` の `sprints.next` に `end` と `week` を足す。Issue #274）
- 改訂：2026-10-04（利用者の設定を作る `PUT /me/settings`。契約の operation を足すだけなので `info.version` は 0.2.0 のまま。Issue #279）

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
- `LocalDate` は `format: date`、`Instant` は `format: date-time` に domain と同じ正規表現（UTC・ミリ秒つき）を足す。Valibot の書式の検査は暦の上で実在するか（2 月 30 日など）までは見ないので、サーバーは入力の検証の段階で、入力の日付と日時を domain の `parseLocalDate`・`parseInstant` でも確かめ、実在しなければ 400 `validationFailed` にする（形の誤りとして扱い、操作の入力でも読み取りのパラメータでも同じ）。
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
- 経路の子（SprintTask・選択・割り込み・目標など）が経路の Sprint にないときは 404。Sprint の状態に合わない操作は 422 `invalidTransition`。
- 振り分けの規則は `packages/api-contract/src/requests.ts`（`@itera/api-contract/requests`）の 1 か所に、両方向を並べて置く。`requestOf(名前, 入力)` が操作の要求（面と path・query・本文）を作り（Web）、`readRequest` が受け取った要求を面のスキーマで path・query・本文の順に確かめてから、面の `operation` で操作と入力を作る（サーバーとブラウザ内モック。確かめ方とエラーの返し方だけをそれぞれが渡す。サーバーは暦の上の日付も確かめる）。query の文字列を宣言した型に変える `queryInput` も同じ場所に置き、読み取りと書き込みで使う。`requests.ts` は application に型だけで依存する。

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
- 割り込みを戻す `restoreInterrupt` は ID を残すので、その ID を path に置く `PUT`（下の「消した記録を戻す操作の照合」）。割り込みの編集（`PATCH`）は本文と分を置き換えるので、`minutes` を必須にし、分がないことは `null` で表す（domain の入力では省略。`requests.ts` が変える）。

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

- 応答は `{ clock, view }`。`clock` は、サーバーがその応答のために決めた「今日」と現在時刻（ADR 0005「時計」）。`view` は、今は application の関数の結果そのもので（写像は恒等。ADR 0007）、結果がない（`undefined`）ときは `null`（TanStack Query は `undefined` をデータにできない）。
- query の数と真偽（`number`・`apply-criterion`）は、通信の上では文字列。サーバーは宣言した型に変えてから、生成したスキーマで検証する（`queryInput`。同じ名前を繰り返した値は、配列の項目なら全部、それ以外は検証で 400）。
- **利用者**：`GET /api/me`（`getMe`）は、サインインしている利用者の ID と設定（表示名・タイムゾーン・週の始まり。domain の `User` から ID を除いたもの）を返す。設定をまだ作っていなければ `settings` は `null` で、日付が変わったときの処理（#271）を走らせずに答える（設定がない間もこの読み取りだけは答え、クライアントは設定を作る画面を出す。#279、#266）。設定があれば、処理を走らせてから、`clock` と今の Sprint の参照（`sprints`：実行中・Review 中・計画中のそれぞれと、次に計画を始める週）も返す（R1）。次に計画を始める週（`next`）は、開始日・終了日・番号と、その週の名前（`week`。Sprint の `week` と同じ。省略可）を持つ。Sprint がまだない週を画面が開くのに要る（#274）。`end` は必須で足した（下の「壊さない変更」の、応答に必須の項目を足す規則）。
- **利用者の設定を作る**：`PUT /api/me/settings`（`setSettings`。本文は `{ displayName, timeZone, weekStartsOn }`）。設定がなければ作り（201）、あれば表示名だけを書き直す（204。同じ値をもう一度送っても 204 で、何も書かない）。タイムゾーンと週の始まりを別の値で送ると 422 `invalidInput` で断る。理由：「今日」はタイムゾーンで、Sprint の期間は週の始まりで決まるので、すでにある Sprint がある利用者の値を変えると、それらの Sprint が動く。変えたときに既存の Sprint をどうするかは決まっていない。戻す条件：設定を後から変える画面の Issue が、その扱いを決めたとき（2026-10-03 司令塔の判断。オーナーへ要確認として Issue #279 に記録）。タイムゾーンは名前で、契約のスキーマは文字列としか見ないので、実在する名前かは domain の `parseTimeZone` が確かめ（なければ 422 `invalidInput`）、表示名は前後の空白を除いて空なら同じく 422。201 は作った設定を返す（表示名は前後の空白を除くので、送った値と違いうる）。ここだけ「作る → 201 は作った ID」の規則（本文のない 201 は生成物が `unknown` になり、`generated.test.ts` が断る）から外れる例外で、書き直し（204）や再送には本文がないので、クライアントはこの本文に頼らない（今の Web は使わない）。タイムゾーンは `Intl` の綴り（`asia/tokyo` は `Asia/Tokyo`）にそろえて保存・比べる。操作ではなく読み取りでもないので、`surfaces`（操作の面）には入れず、`requests.ts` の `settingsSurface` に置く。記録がなくても作れる唯一の書き込みで、サーバーは `flow.setUp` が受け持つ（読み込み → `settingsChange` → 最初の保存。ほかの書き込みと同じく版を確かめ、Activity は残さない）。
- 以前の画面ごとの読み取り（`getOverview`・`getSprintChoice`・`getPlanning`・`getRunning`・`getToday`・`getRetro`・`getNextPlanning`）はなくした。画面が開く Sprint とその前後は `/me` の参照と `/sprints` の一覧（番号の並び、週の名前の出力専用の項目）から求まる。ナビの Backlog の件数は `/backlog` の件数。application のこれらの関数（`appOverview`・`sprintChoice`・`planningData`・`runningData`・`todayData`・`dayData`・`retroData`・`nextPlanningOf`）は、store のままの画面が使うので残していた。画面を移し終えたので、#277 で index の export から外した（`coverage.test.ts` の一覧も消した）。

### 操作の応答に読み取りを含めない

操作は、その操作の結果（作った ID、操作が決めた値）だけを返し、画面は TanStack Query の無効化で読み直す（Issue #265 の推奨どおり）。

- 理由：読み取りは 8 種類あり、1 つの操作が変える読み取りは画面によって違う。操作ごとにどの読み取りを返すかを契約に持たせると、操作と画面の結合が強くなり、iOS・Android の画面の違いも契約に入ってしまう。読み直しの往復は 1 回増えるが、利用者は 1 人で、読み取りは 1 回の `batch()` で済む（ADR 0004「操作と読み取りの処理」）。
- どの操作の後にどの読み取りを読み直すか（Query のキーと無効化の方針）は #272 で決める。

### 消した記録を戻す操作の照合

消した割り込みを戻す `restoreInterrupt` は、ID を残す。クライアントは、消す前の読み取りで得た note（ID・時刻・本文・分）をそのまま送り（ID は `PUT /sprints/{sprintId}/interrupts/{interruptNoteId}` の path に、ほかは本文に）、domain の `restoreInterrupt` が「同じ ID の note がない（利用者のほかの Sprint の note も含めて）」「今より後に記録されたものでない」「Sprint の期間の日に記録されたものである（利用者のタイムゾーンの日付で）」「本文が空でない」を確かめて、時刻の順の位置に戻す（F38）。ほかの Sprint の note の ID と時間帯は、domain の入力として `packages/application` が記録から渡す（#269）。

- 内容で照合する案（サーバーが消した note を覚えておき、本文と時刻で探す）は採らない。サーバーは Activity を判定に読み返さず（ADR 0004「記録のテーブル」）、消した note を別に保つ場所が要るため。ID は TypeID で、接頭辞と書式を契約で確かめる。
- 同じ考えで、`undoAdoption` の `previous`（採用する前の Estimate）も、クライアントが採用の前の読み取りで持っていた値を送る。Task は今の Estimate だけを持つため（packages/domain）。
- 利用者は自分の記録しか送れないので、作り話の note を戻されても困るのは本人だけ。

### エラー

形は 1 つ：`{ code, message }`。`code` は変わらない識別子で、クライアントはこれで振る舞いを決める。`message` は開発者向けで、画面に出さない（画面の文言は `docs/design/content.md` に従ってクライアントが作る）。

| HTTP | `code` | いつ |
| --- | --- | --- |
| 400 | `validationFailed` | 要求が契約と合わない（形・書式・必須） |
| 401 | `unauthenticated` | 有効なセッションがない |
| 403 | `forbiddenOrigin` | 書き込みの Origin が違う（ADR 0004「書き込みの API の CSRF への備え」） |
| 404 | `notFound` | 要求が指す記録が利用者の記録にない（domain の `notFound`） |
| 409 | `revisionConflict` | ほかの書き込みが先に入り、この書き込みはしていない（ADR 0004「同時の書き込み」）。保存は確定したのに DB の応答が失われたときもこれになる（ADR 0004 の既知の限界）。どちらも読み直せば保存された記録が分かる |
| 413 | `payloadTooLarge` | 操作の本文が上限（64 KiB）を超える（#266） |
| 422 | `invalidInput`・`invalidTransition`・`recurringTaskCannotComplete` | domain が操作を受け付けない（値の規則、状態の遷移、繰り返しの Task の完了） |
| 422 | `userNotSetUp` | 利用者の設定（タイムゾーン・週の始まり）がまだなく、「今日」が決まらない。`getMe` のほかの操作と読み取りはすべてこれで断る（#266） |
| 500 | `internalError` | 予期しない失敗 |

- 各 operation の応答に書く：操作は 400（path の値・query・本文のどれもない操作を除く）・401・403・404・409・413・422・500。読み取りは 400（パラメータのある読み取り）・401・409・422・500。`getMe` は 401・409・500（設定があれば追いつきを走らせるので 409 がありうる。#295 R1）。読み取りの 409 は、読み取りの前の追いつき（#271）の書き込みが、ほかの書き込みとぶつかったとき。操作の 422 は domain の 3 つの code と `userNotSetUp` のどれか、読み取りの 422 は `userNotSetUp` だけ。
- `userNotSetUp` は domain の規則ではなく、記録を読み込んだときに設定の行がないことで決まる。判定はサーバーの流れの 1 か所（`services/api/src/handlers/flow.ts`）に置く。設定を作る `PUT /api/me/settings`（#279）は、記録を読む前に分かれるので、この code で断らない（`flow.setUp`）。
- 本文の大きさの上限は 64 KiB（書き込みのすべての面に Hono の `bodyLimit`。#295 までは `/api/operations/*`）。いちばん大きい本文は Task の説明を含む `saveTask` で、文章を書く欄として十分に大きく、D1 の文字列・行の上限（2 MB）より小さい。`Content-Length` があれば本文を読まずに 413 を返す（ない要求は上限まで読んでから 413）。上限は `info.version` を変えずに広げてよい（狭めるのは壊す変更）。
- `requireAuth` の 401 の本文も、この形（`unauthenticated`）にした（#266）。
- 422 にしたのは、要求の形は正しく、記録の今の状態や値の規則で受け付けられないことを、形の誤り（400）と分けるため。409 は版の衝突だけに使い、クライアントは 409 なら読み直す（ADR 0004）。
- **断られた操作の後も、クライアントは読み直す**（2026-10-03 司令塔の判断、#295）。400・403・404・413・422 で断られた操作は何も保存していないが、送った値が古かったことがある：日付が変わった後の古い「今日」（W3 の 422）、週が終わって Review に入った後の古い実行中の Sprint（422 `invalidTransition`）など。読み直せば、クライアントは今の記録（`/me` の時計と今の Sprint）に戻る。Web は `apps/web/src/api/query-client.ts` で、操作が断られたら読み直してから失敗を返す。iOS・Android も同じ規則に従う。画面の文言は、断られたことを伝えるもの（記録は変わっていない）のまま。
  - W3 のための専用の code（`dayChanged` など）は今は足さない。原因を文言で伝えたくなったら後から足せる（開いた列挙なので壊さない変更）。

### 生成物

- `pnpm contract:generate` が、Redocly で `openapi/` を 1 ファイルにまとめ（一時ディレクトリ）、Hey API で `packages/api-contract/src/generated/` に生成する。生成物はコミットする。分けたファイルのまま Hey API に渡すと、別ファイルの path と応答の参照から中身のない型（`CreateArea = unknown` など）が出るため、まとめてから渡す。
- `pnpm contract:check`（`pnpm check` の中）は、仕様を lint し、一時ディレクトリに生成し直して、コミットした生成物とファイルの一覧と中身が同じかを確かめる。違えば失敗する（CI でも同じ）。
- 出力：`@hey-api/typescript`（型）、`valibot`（定義・要求・応答のスキーマ）、`@hey-api/client-fetch` と `@hey-api/sdk`（fetch のクライアント）、`@tanstack/react-query`（Query と Mutation の options）。生成の入口ファイルは作らず、次の 3 つの入口で出し分ける。
  - `@itera/api-contract`：型と Valibot のスキーマだけ。`services/api` はこれだけを使う。
  - `@itera/api-contract/client`：fetch のクライアント（Web）。関数は契約の operation と読み取りだけにする（一覧のテストが、関数の export を operation として数える）。
  - `@itera/api-contract/create-client`：別のクライアントを作る `createClient`・`createConfig`。Web はデータの出どころ（API、ブラウザ内モック）ごとにクライアントを作る（#272、ADR 0005「Web のクライアントとブラウザ内モック」）。
  - `@itera/api-contract/react-query`：TanStack Query の options（Web）。React に依存する。
  - `@itera/api-contract/requests`：操作と面の振り分け（上の「経路の形」、#295）と `queryInput`。生成物ではなく手で書く。サーバー・ブラウザ内モック・Web が使う。
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
- 型：各操作の入力と要求は `requests.ts` の中で生成した型に対して型検査する。出力と応答（1 つの操作だけの面は同じ型、いくつかの操作の面は各出力が応答に合い、合わせて応答の項目になる）、各読み取りの結果と応答の `view`（`undefined` は `null`）と `clock` が、型として同じ（片方への代入ができるだけでなく、余分な・欠けたキーもない）。比べる前に、両方から brand（ID・日付）と `readonly` を外す。`pnpm typecheck` で確かめる。このテストは、今は application の結果から DTO への写像が恒等であることを確かめるもので、application の形が契約の正本であることを示すものではない（契約の正本は `openapi/`）。内部の変更で型が合わなくなったら、意図した契約の変更でない限り、契約は直さずに `services/api` に写像を置く（ADR 0007「アプリケーション層の読み取りと API の DTO」）。
- fixture：PRD §12 の 12 状態で、すべての読み取り（Backlog の絞り込みごと、すべての Sprint の番号と次の週、昨日と明日）の結果を JSON にして `{ clock, view }` で包み、生成した応答のスキーマで検証する。
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
- `PUT`・`DELETE` の 2 回目を、domain が `invalidTransition`（422）で断る操作がある（含めた回をもう一度含める `PUT …/included-occurrences/{occurrenceId}` など）。記録は変わらないので状態としては冪等だが、応答は 1 回目と同じにならない。直すなら domain の変更。
- 応答のスキーマは未知のキーを許すので、Valibot の検証だけでは余分なキーを見つけられない。型のテストで止めている。
- `restoreInterrupt` と `undoAdoption` は、クライアントが前の読み取りの値を送る。版はサーバーが読み込んだ時点のものなので、クライアントの読み取りが古いことは 409 では分からない。`undoAdoption` は domain の確かめ（提案の状態）で守られるが、`restoreInterrupt` は古い note でも受け付ける。
- `restoreInterrupt` が確かめる ID の重複は、利用者自身の Sprint の中だけ（#269）。`interrupt_note.id` は全体の主キーなので、ほかの利用者の note の ID を送ると保存の `batch()` が失敗して 500 になる（上書きはされない）。TypeID を知る必要があり、利用者が 1 人の間は起きない。
- 文字列・配列の長さに、契約では上限を置いていない。本文の大きさは 64 KiB で止める（上の「エラー」、#266）ので、1 つの値が D1 の上限を超えることはない。

## 互換の規則

契約を変えても、すでに動いているクライアントが壊れないようにする（ADR 0007）。

- 版のずれは、どのクライアントにもある。iOS・Android には古い版が長く残る。Web は API と同じ Worker で配信するので一緒に入れ替わるが、デプロイの前に開いたタブは、古いコードのまま新しい API を呼ぶ。この規則は Web にも当てはめる。
- 契約が変わるのは、`openapi/` を直したときだけにする。application と domain の内部の変更で、通信の形を変えない（ADR 0007「アプリケーション層の読み取りと API の DTO」）。

### 列挙

列挙は 2 種類に分け、どちらなのかを仕様の `description` に書く。

- **開いた列挙**：値が増えることを前提にする列挙。エラーの `code` と、操作の可否（ADR 0007「操作の可否」）。値を足すのは壊さない変更。
  - 受け取る側（すべてのクライアントと、そこで使う生成した型と検証）は、知らない値を受理しなければならない。知らない値で、読み込み（decode）も応答の検証も失敗させない。知らない `code` は一般の失敗として扱い、知らない操作は出さない。知らない HTTP のステータス（#266 で足した 413 のように、後から足すもの）も、一般の失敗として扱う。
  - iOS・Android の生成した型がこれを満たすこと（知らない値を表す場合を持つか、文字列として受ける）を、生成の道具を選ぶ条件にする。満たさない道具は使わない。
  - 今の仕様は、`code` をエラーごとに `const` で書いている（domain の 3 つの code の `RuleViolationError` だけ `enum`）。操作の 422 は `RuleViolationError` と `UserNotSetUpError` の `oneOf`（#266）。エラーの本文の `oneOf` のように、枝が `code` の値だけで分かれ、形がどれも `{ code, message }` のものは、開いた列挙として扱う。枝を足すのは `code` の値を足すのと同じで、壊さない変更。開いた列挙の仕様での書き方（拡張の印、`anyOf` で文字列を足すなど）は、iOS に着手する前に生成の道具と一緒に決め、そのとき `code` も書き直す。Web が応答を実行時に検証するようにするなら、それより前に決める。
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
- ただし最初の本番の公開（統合ブランチを main に入れて CD でデプロイするとき）までは、SemVer（§4）の major 0（初期の開発中）として扱い、壊す変更で minor を上げる。最初の本番の公開で 1.0.0 にし、その後は major を上げる（2026-10-03 司令塔の判断、#295）。#295 の経路の変更で 0.2.0 にした。
- 版の上げ方（経路、ヘッダー、受け付ける最低の版）と、古いクライアントの扱いは、iOS に着手するまでに決める。それまでは Web だけなので、壊す変更を入れた直後は、開いたままのタブの要求が失敗しうる（400 など）。利用者が 1 人の間は、読み直しで足りる。

### 決めていないこと（iOS に着手する前に決める）

- 時間（h）の数の表し方（今は JSON の数。分の整数にするかなど）と丸め。後から変えると壊す変更になる。
- 版の上げ方と、古いクライアントの扱い。
- iOS・Android の生成の道具。開いた列挙の知らない値と応答の知らないキーで読み込みを失敗させないこと、省略と空を分けられること、型の混ざった `oneOf`（例：`SprintAreaLabel.color` の数と `none`）を扱えること、判別子のない `oneOf` の要求の本文（どの項目があるかで枝が決まる。`updateSubtask`・`updateGoal`・`addToSprint`・`chooseForDay`・`adoptEstimateSuggestion`・`updateRetro`、#295）と、path の値の `oneOf`（印の `{pin}`：ID の種類の union と `available-hours`）を扱えることを条件にして選ぶ。開いた列挙の仕様での書き方も、このとき決める。

## 影響

- `services/api`（#266）は、`@itera/api-contract` のスキーマで入力を検証し、この ADR の割り当てでエラーを返す。書き込みは `@itera/api-contract/requests` の面をすべて登録し（#295）、読み取りは `reads.ts` の登録表に足す。契約のすべての面と読み取り（`getMe` のほか）が登録されていることはテストで確かめる（#270 で全部の領域がそろい、未実装の一覧はなくなった）。
- `apps/web`（#272）は、`@itera/api-contract/client` と `/react-query` を使い、`@tanstack/react-query` 5.104.1 を入れる。操作は `useOperation('<名前>')` で、`@itera/api-contract/requests` を通して送る（#295）。
- iOS・Android は、`openapi/` を 1 ファイルにまとめたもの（`redocly bundle`）から生成できる。セッションの Cookie と書き込みの Origin の検査（ADR 0004）は、Origin を送らないネイティブのクライアントでは 403 になるので、ネイティブの認証の方式は iOS に着手するときに決める。
- 契約を変えるときは、`openapi/` を直し、`pnpm contract:generate` を実行して、生成物と一緒にコミットする。
