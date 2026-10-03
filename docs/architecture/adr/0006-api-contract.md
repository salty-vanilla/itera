# ADR 0006: API の契約（OpenAPI）

- 状態：採用
- 日付：2026-10-03
- 関連：Issue #265、#45（範囲の分け方は #262）、先行 #264、後続 #266・#272
- 改訂：2026-10-03（互換の規則を書き直す。型のテストが失敗したときの直し方。ADR 0007）
- 改訂：2026-10-03（利用者と設定の読み取り `getMe`、設定がないときのエラー、本文の大きさの上限。Issue #266）

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
  - `paths/`：読み取り（`reads.yaml`）と、画面の領域ごとの操作（`area`・`task`・`planning`・`today`・`running`・`retro`）。
  - `schemas/`：`common.yaml`（ID・日付・時計・エラー）、`records.yaml`（domain の記録）、`values.yaml`（domain の派生値）、`views.yaml`（application の読み取りの結果）。
  - `responses.yaml`：エラーの応答。
- 説明（summary・description）は英語で書く（生成したコードの JSDoc になり、コードのコメントと揃える）。画面の語は使わない。
- 記録の DTO は、今は domain の型と同じ形にする（写像は恒等。ADR 0007「アプリケーション層の読み取りと API の DTO」）。省略できる属性はキーを省き、`null` にしない（domain の `exactOptionalPropertyTypes`）。`null` を値として使うのは、domain がそう決めている入力（`TaskAttributeUpdate` の `areaId`・`due`、時間の消去など）と、`AreaTotal` などの `areaId: null`（領域なし）だけ。
- ID は TypeID（ADR 0004「ID の形式」）。種類ごとに schema（`TaskId` など）を置き、接頭辞と、UUIDv7 の version（11 文字目が e か f）と variant（14 文字目が 89abrstv のどれか）までを正規表現で決める。`parseId` が受け付けるものと同じであることをテストで確かめる。
- `LocalDate` は `format: date`、`Instant` は `format: date-time` に domain と同じ正規表現（UTC・ミリ秒つき）を足す。Valibot の書式の検査は暦の上で実在するか（2 月 30 日など）までは見ないので、サーバーは入力の検証の段階で、入力の日付と日時を domain の `parseLocalDate`・`parseInstant` でも確かめ、実在しなければ 400 `validationFailed` にする（形の誤りとして扱い、操作の入力でも読み取りのパラメータでも同じ）。
- 契約が検証するのは形と書式（型、必須、ID と日付の書式、列挙）だけにする。値の規則（正の時間、空でない題名、状態の遷移）は domain の規則で、422 で返す。規則を契約と domain に二重に持たないため。
- 要求の本文の最上位と、要求にしか使わない入れ子（`TaskAttributeUpdate`）は `additionalProperties: false`（Valibot の `strictObject`）。綴りの誤りなどの未知のキーは 400 になる。応答と共有する入れ子（`InterruptNote`・`RetroPin`・`Estimate`・`RecurrencePattern`・`CriterionPolicy`）は未知のキーを許し、Valibot の `object` が出力から落とす。サーバーは、要求の本文ではなく検証の出力だけを application に渡す。応答は未知のキーを許す（クライアントが後から足した項目で壊れないように）。応答の余分な・欠けたキーは、下の型のテストで止める。
- 一覧（`BacklogData.items`・`RetroData.sprintAreas` など、ID をキーにする表）は `additionalProperties` で書き、`propertyNames` は使わない（Hey API 0.99.0 は `propertyNames` があると値を検証しない `v.object({})` を出す）。値が `$ref` の表も、0.99.0 の Valibot の出力では同じく `v.object({})` になる（Valibot のプラグインが `$ref` の値を読まない）。これは下の「生成物」の patch で直す。

### 経路の形

- 経路はすべて `/api` の下（ADR 0004「API の経路」）。仕様の `servers` が `/api` で、生成したクライアントは同じ origin の `/api` を呼ぶ。
- **操作**：`POST /api/operations/{名前}`。名前と operationId は `packages/application` の `operations` のキーそのもの（例：`POST /api/operations/createArea`）。本文は入力のオブジェクト。入力のない操作（`beginRetro`・`dropCriterionDraft`・`completeRetro`・`beginPlanning`）は本文を持たない。
- **操作の応答**：値を返す操作（作った ID、`effectiveFrom`・`removed` など）は 200 でその値（`OperationOutput`）、返さない操作は 204。変わった後の読み取りは返さない（下の「操作の応答に読み取りを含めない」）。
- **読み取り**：`GET`。application の読み取りの関数ごとに 1 つ。

  | operationId | 経路 | application | 結果がないとき |
  | --- | --- | --- | --- |
  | `getOverview` | `/api/overview` | `appOverview` | — |
  | `listAreas` | `/api/areas` | `areaList` | — |
  | `getBacklog` | `/api/backlog?view=&area=` | `backlogData` | — |
  | `getSprintChoice` | `/api/sprint-choice?screen=sprint\|retro&sprint=N` | `sprintChoice` | 最初の Sprint の前の Retro |
  | `getPlanning` | `/api/planning?applyCriterion=` | `planningData` | 計画中の Sprint がない |
  | `getRunning` | `/api/running?sprint=N` | `runningData` | 実行中がない・番号の Sprint がない・計画中 |
  | `getToday` | `/api/today` | `todayData` | 実行中の Sprint がない |
  | `getDay` | `/api/days/{date}` | `dayData` | 今日（`getToday` で読む） |
  | `getRetro` | `/api/retro?sprint=N` | `retroData` | 振り返りがまだ始まっていない・番号の Sprint がない |
  | `getNextPlanning` | `/api/next-planning` | `nextPlanningOf` | — |

  - Sprint は番号（F25）で、日は日付で指定する（#90）。番号から Sprint を引くのはサーバー（#266〜#270）。
  - 応答は `{ clock, view }`。`clock` は、サーバーがその応答のために決めた「今日」と現在時刻（ADR 0005「時計」）。`view` は、今は application の関数の結果そのもので（写像は恒等。ADR 0007）、結果がない（`undefined`）ときは `null`（TanStack Query は `undefined` をデータにできない）。
  - query の数と真偽（`sprint`・`applyCriterion`）は、通信の上では文字列。サーバーは宣言した型に変えてから、生成したスキーマで検証する。
- **利用者**：`GET /api/me`（`getMe`）は、サインインしている利用者の ID と設定（表示名・タイムゾーン・週の始まり。domain の `User` から ID を除いたもの）を `{ userId, settings }` で返す。設定をまだ作っていなければ `settings` は `null`。application の読み取りではないので `{ clock, view }` で包まず、日付が変わったときの処理（#271）も走らせない。設定がない間もこの読み取りだけは答え、クライアントは設定を作る画面を出す（#279。2026-10-03 司令塔経由のオーナー方針、#266）。
- `/api/health`・`/api/auth/*` はこの契約の外にある。

### 操作の応答に読み取りを含めない

操作は、その操作の結果（作った ID、操作が決めた値）だけを返し、画面は TanStack Query の無効化で読み直す（Issue #265 の推奨どおり）。

- 理由：読み取りは 10 種類あり、1 つの操作が変える読み取りは画面によって違う。操作ごとにどの読み取りを返すかを契約に持たせると、操作と画面の結合が強くなり、iOS・Android の画面の違いも契約に入ってしまう。読み直しの往復は 1 回増えるが、利用者は 1 人で、読み取りは 1 回の `batch()` で済む（ADR 0004「操作と読み取りの処理」）。
- どの操作の後にどの読み取りを読み直すか（Query のキーと無効化の方針）は #272 で決める。

### 消した記録を戻す操作の照合

消した割り込みを戻す `restoreInterrupt` は、ID を残す。クライアントは、消す前の読み取りで得た note（ID・時刻・本文・分）をそのまま送り、domain の `restoreInterrupt` が「同じ ID の note がない」「今より後に記録されたものでない」「本文が空でない」を確かめて、時刻の順の位置に戻す（F38）。

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

- 各 operation の応答に書く：操作は 400（本文のない操作を除く）・401・403・404・409・413・422・500。読み取りは 400（パラメータのある読み取り）・401・409・422・500。`getMe` は 401・500。読み取りの 409 は、読み取りの前の追いつき（#271）の書き込みが、ほかの書き込みとぶつかったとき。操作の 422 は domain の 3 つの code と `userNotSetUp` のどれか、読み取りの 422 は `userNotSetUp` だけ。
- `userNotSetUp` は domain の規則ではなく、記録を読み込んだときに設定の行がないことで決まる。判定はサーバーの流れの 1 か所（`services/api/src/handlers/flow.ts`）に置く。設定を作る operation（#279）は、この code を断る対象から外す。
- 本文の大きさの上限は 64 KiB（`/api/operations/*` に Hono の `bodyLimit`）。いちばん大きい本文は Task の説明を含む `saveTask` で、文章を書く欄として十分に大きく、D1 の文字列・行の上限（2 MB）より小さい。`Content-Length` があれば本文を読まずに 413 を返す（ない要求は上限まで読んでから 413）。上限は `info.version` を変えずに広げてよい（狭めるのは壊す変更）。
- `requireAuth` の 401 の本文も、この形（`unauthenticated`）にした（#266）。
- 422 にしたのは、要求の形は正しく、記録の今の状態や値の規則で受け付けられないことを、形の誤り（400）と分けるため。409 は版の衝突だけに使い、クライアントは 409 なら読み直す（ADR 0004）。

### 生成物

- `pnpm contract:generate` が、Redocly で `openapi/` を 1 ファイルにまとめ（一時ディレクトリ）、Hey API で `packages/api-contract/src/generated/` に生成する。生成物はコミットする。分けたファイルのまま Hey API に渡すと、別ファイルの path と応答の参照から中身のない型（`CreateArea = unknown` など）が出るため、まとめてから渡す。
- `pnpm contract:check`（`pnpm check` の中）は、仕様を lint し、一時ディレクトリに生成し直して、コミットした生成物とファイルの一覧と中身が同じかを確かめる。違えば失敗する（CI でも同じ）。
- 出力：`@hey-api/typescript`（型）、`valibot`（定義・要求・応答のスキーマ）、`@hey-api/client-fetch` と `@hey-api/sdk`（fetch のクライアント）、`@tanstack/react-query`（Query と Mutation の options）。生成の入口ファイルは作らず、次の 3 つの入口で出し分ける。
  - `@itera/api-contract`：型と Valibot のスキーマだけ。`services/api` はこれだけを使う。
  - `@itera/api-contract/client`：fetch のクライアント（Web）。`createClient`・`createConfig` も出し、Web はデータの出どころ（API、ブラウザ内モック）ごとにクライアントを作る（#272、ADR 0005「Web のクライアントとブラウザ内モック」）。
  - `@itera/api-contract/react-query`：TanStack Query の options（Web）。React に依存する。
  - `services/api` から `client`・`react-query` の import を ESLint の `no-restricted-imports` で止める。API が React に依存しない。
- Hey API がそのまま写す fetch の実行時のコード（`src/generated/client/`・`core/`）は `exactOptionalPropertyTypes` を前提に書かれておらず、`apps/web` はこの .ts を自分の設定で型検査する。そこで生成の後処理で、この 2 つのディレクトリのファイルにだけ `// @ts-nocheck` を付ける。契約から生成したコード（型・スキーマ・SDK・Query の options）は型検査の対象のまま。Hey API がこの設定に対応したら外す。
- Hey API 0.99.0 の Valibot のプラグインは、`additionalProperties` の値が `$ref` だと値を読まず、`v.record` の代わりに何も検証しない `v.object({})` を出す（`BacklogData.items`、`RetroData.sprintAreas`）。仕様の書き方（`allOf`・`anyOf`・`type` を並べる）では避けられなかった。そこで `pnpm patch` で、その条件の 1 行（`$ref` の値も読む）だけを直す（`patches/@hey-api__openapi-ts@0.99.0.patch`、`pnpm-workspace.yaml` の `patchedDependencies`）。
  - 境界：Valibot のプラグインの `additionalProperties` の扱いの 1 行だけ。ほかの出力は変えない。
  - 検査：生成した Valibot に `v.object({})`・`v.unknown()` があればテストが失敗し、2 つの表が `v.record` で値を検証していることもテストで確かめる（`src/generated.test.ts`）。版を上げて patch が当たらなくなったときも、ここで止まる。
  - 戻す条件：Hey API が `$ref` の値の表に `v.record` を出すようになったら、版を上げて patch を消す。
- 生成物は Prettier と ESLint の対象外（`.prettierignore`、`eslint.config.js` の ignores）。正しさは `contract:check` と下のテストで確かめる。

### 契約と実装の一致

`packages/api-contract` のテストで確かめる。

- 一覧：生成したクライアントの operation が、`operations` のすべての名前と読み取りの 10 個と `getMe` に一致する。`@itera/application` の関数の export のうち、読み取りでも操作の道具でもないものがあれば失敗する（読み取りを足したら契約にも足す）。
- 型：各操作の入力と本文、出力と応答、各読み取りの結果と応答の `view`（`undefined` は `null`）と `clock` が、型として同じ（片方への代入ができるだけでなく、余分な・欠けたキーもない）。比べる前に、両方から brand（ID・日付）と `readonly` を外す。`pnpm typecheck` で確かめる。このテストは、今は application の結果から DTO への写像が恒等であることを確かめるもので、application の形が契約の正本であることを示すものではない（契約の正本は `openapi/`）。内部の変更で型が合わなくなったら、意図した契約の変更でない限り、契約は直さずに `services/api` に写像を置く（ADR 0007「アプリケーション層の読み取りと API の DTO」）。
- fixture：PRD §12 の 12 状態で、すべての読み取り（Backlog の絞り込みごと、すべての Sprint の番号と次の週、昨日と明日）の結果を JSON にして `{ clock, view }` で包み、生成した応答のスキーマで検証する。
- ID：各種類の ID のスキーマが、`parseId` と同じものを受け付ける。型のテストは ID を文字列として比べるので、各操作の本文のどの属性がどの種類の ID を取るかは別に確かめる：application の入力の型から求めた種類の表（`pnpm typecheck` で型と照合）と、生成した本文のスキーマが参照する ID のスキーマを照らす（`src/id-kinds.test.ts`）。

## 検討した代替案

- **TS の型から仕様を出力する**（Hono のルート定義、型からの JSON Schema 生成）：#45 のオーナーの決定（仕様が正本）のとおり採らない。iOS・Android が使う契約が TypeScript の実装に従うことになる。
- **操作を 1 つの経路にまとめる**（`POST /api/operations` に `{ name, input }`）：operation ごとの型・スキーマ・クライアントの関数が生成できず、OpenAPI で契約にする意味が薄れる。
- **REST の資源の形にする**（`PATCH /api/tasks/{id}` など）：操作の多くは複数の記録を変え（例：今日へ＝SprintTask と DailySelection）、資源の形にすると判定がクライアントに寄る。ADR 0005 のとおり、操作は名前と入力で表す。
- **読み取りの応答をそのまま結果にする**（包まない）：結果がないとき（`undefined`）を 404 にすると、空の状態がエラーとして扱われる。今日と現在時刻を応答に含める必要もある（ADR 0005「時計」）。
- **生成物をコミットせず、CI とインストールのたびに生成する**：`pnpm install` の後に生成の手順が増え、差分のレビューで契約の変化が見えない。

## 既知の制約

- query の数と真偽は文字列で届くので、サーバーで変換が要る（#266）。
- 応答のスキーマは未知のキーを許すので、Valibot の検証だけでは余分なキーを見つけられない。型のテストで止めている。
- `restoreInterrupt` と `undoAdoption` は、クライアントが前の読み取りの値を送る。版はサーバーが読み込んだ時点のものなので、クライアントの読み取りが古いことは 409 では分からない。`undoAdoption` は domain の確かめ（提案の状態）で守られるが、`restoreInterrupt` は古い note でも受け付ける。
- `restoreInterrupt` の ID の重複を domain が確かめるのは今の Sprint の中だけで、DB の `interrupt_note.id` は全体の主キー。ほかの Sprint にある ID を送ると保存の `batch()` が失敗する（上書きはされない）。偶然には起きないが 500 になるので、Today の操作をつなぐ Issue（#269）で、利用者のすべての割り込みと照合して 422 にする。`note.at` が Sprint の期間の外でも受け付ける点も同じ。
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
- 版の上げ方（経路、ヘッダー、受け付ける最低の版）と、古いクライアントの扱いは、iOS に着手するまでに決める。それまでは Web だけなので、壊す変更を入れた直後は、開いたままのタブの要求が失敗しうる（400 など）。利用者が 1 人の間は、読み直しで足りる。

### 決めていないこと（iOS に着手する前に決める）

- 時間（h）の数の表し方（今は JSON の数。分の整数にするかなど）と丸め。後から変えると壊す変更になる。
- 版の上げ方と、古いクライアントの扱い。
- iOS・Android の生成の道具。開いた列挙の知らない値と応答の知らないキーで読み込みを失敗させないこと、省略と空を分けられること、型の混ざった `oneOf`（例：`SprintAreaLabel.color` の数と `none`）を扱えることを条件にして選ぶ。開いた列挙の仕様での書き方も、このとき決める。

## 影響

- `services/api`（#266）は、`@itera/api-contract` のスキーマで入力を検証し、この ADR の割り当てでエラーを返す。operation と読み取りは `src/handlers/` の登録表（`operations.ts`・`reads.ts`）に足し、まだ答えないものは同じファイルの未実装の一覧に置く（契約のすべての operation がどちらかにあることをテストで確かめる）。
- `apps/web`（#272）は、`@itera/api-contract/client` と `/react-query` を使い、`@tanstack/react-query` 5.104.1 を入れる。
- iOS・Android は、`openapi/` を 1 ファイルにまとめたもの（`redocly bundle`）から生成できる。セッションの Cookie と書き込みの Origin の検査（ADR 0004）は、Origin を送らないネイティブのクライアントでは 403 になるので、ネイティブの認証の方式は iOS に着手するときに決める。
- 契約を変えるときは、`openapi/` を直し、`pnpm contract:generate` を実行して、生成物と一緒にコミットする。
