# ADR 0006: API の契約（OpenAPI）

- 状態：採用
- 日付：2026-10-03
- 関連：Issue #265、#45（範囲の分け方は #262）、先行 #264、後続 #266・#272

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
- 記録の DTO は domain の型と同じ形にする。省略できる属性はキーを省き、`null` にしない（domain の `exactOptionalPropertyTypes`）。`null` を値として使うのは、domain がそう決めている入力（`TaskAttributeUpdate` の `areaId`・`due`、時間の消去など）と、`AreaTotal` などの `areaId: null`（領域なし）だけ。
- ID は TypeID（ADR 0004「ID の形式」）。種類ごとに schema（`TaskId` など）を置き、接頭辞と、UUIDv7 の version（11 文字目が e か f）と variant（14 文字目が 89abrstv のどれか）までを正規表現で決める。`parseId` が受け付けるものと同じであることをテストで確かめる。
- `LocalDate` は `format: date`、`Instant` は `format: date-time` に domain と同じ正規表現（UTC・ミリ秒つき）を足す。日付が実在するか（2 月 30 日など）は、サーバーが domain の `parseLocalDate` で確かめる。
- 契約が検証するのは形と書式（型、必須、ID と日付の書式、列挙）だけにする。値の規則（正の時間、空でない題名、状態の遷移）は domain の規則で、422 で返す。規則を契約と domain に二重に持たないため。
- 要求の本文の最上位は `additionalProperties: false`（Valibot の `strictObject`）。応答は未知のキーを許す（クライアントが後から足した項目で壊れないように）。応答の余分な・欠けたキーは、下の型のテストで止める。
- 一覧（`BacklogData.items` など、ID をキーにする表）は `additionalProperties` で書き、`propertyNames` は使わない（Hey API 0.99.0 は `propertyNames` があると Valibot で値を検証しない `v.object({})` を出すため）。

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
  - 応答は `{ clock, view }`。`clock` は、サーバーがその応答のために決めた「今日」と現在時刻（ADR 0005「時計」）。`view` は application の関数の結果そのもので、結果がない（`undefined`）ときは `null`（TanStack Query は `undefined` をデータにできない）。
  - query の数と真偽（`sprint`・`applyCriterion`）は、通信の上では文字列。サーバーは宣言した型に変えてから、生成したスキーマで検証する。
- `/api/health`・`/api/me`・`/api/auth/*` は今はこの契約の外にある。利用者の設定（`/api/me`）を契約の形にするのは #266。

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
| 409 | `revisionConflict` | ほかの書き込みが先に入った（ADR 0004「同時の書き込み」）。何も書いていない |
| 422 | `invalidInput`・`invalidTransition`・`recurringTaskCannotComplete` | domain が操作を受け付けない（値の規則、状態の遷移、繰り返しの Task の完了） |
| 500 | `internalError` | 予期しない失敗 |

- 各 operation の応答に書く：操作は 400（本文のない操作を除く）・401・403・404・409・422・500。読み取りは 400（パラメータのある読み取り）・401・409・500。読み取りの 409 は、読み取りの前の追いつき（#271）の書き込みが、ほかの書き込みとぶつかったとき。
- 今の `requireAuth` の 401 の本文（`{ error: 'unauthorized' }`）は、#266 でこの形にそろえる。
- 422 にしたのは、要求の形は正しく、記録の今の状態や値の規則で受け付けられないことを、形の誤り（400）と分けるため。409 は版の衝突だけに使い、クライアントは 409 なら読み直す（ADR 0004）。

### 生成物

- `pnpm contract:generate` が、Redocly で `openapi/` を 1 ファイルにまとめ（一時ディレクトリ）、Hey API で `packages/api-contract/src/generated/` に生成する。生成物はコミットする。分けたファイルのまま Hey API に渡すと、別ファイルの path と応答の参照から中身のない型（`CreateArea = unknown` など）が出るため、まとめてから渡す。
- `pnpm contract:check`（`pnpm check` の中）は、仕様を lint し、一時ディレクトリに生成し直して、コミットした生成物とファイルの一覧と中身が同じかを確かめる。違えば失敗する（CI でも同じ）。
- 出力：`@hey-api/typescript`（型）、`valibot`（定義・要求・応答のスキーマ）、`@hey-api/client-fetch` と `@hey-api/sdk`（fetch のクライアント）、`@tanstack/react-query`（Query と Mutation の options）。生成の入口ファイルは作らず、次の 3 つの入口で出し分ける。
  - `@itera/api-contract`：型と Valibot のスキーマだけ。`services/api` はこれだけを使う。
  - `@itera/api-contract/client`：fetch のクライアント（Web）。
  - `@itera/api-contract/react-query`：TanStack Query の options（Web）。React に依存する。
  - `services/api` から `client`・`react-query` の import を ESLint の `no-restricted-imports` で止める。API が React に依存しない。
- Hey API がそのまま写す fetch の実行時のコード（`src/generated/client/`・`core/`）は `exactOptionalPropertyTypes` を前提に書かれておらず、`apps/web` はこの .ts を自分の設定で型検査する。そこで生成の後処理で、この 2 つのディレクトリのファイルにだけ `// @ts-nocheck` を付ける。契約から生成したコード（型・スキーマ・SDK・Query の options）は型検査の対象のまま。Hey API がこの設定に対応したら外す。
- 生成物は Prettier と ESLint の対象外（`.prettierignore`、`eslint.config.js` の ignores）。正しさは `contract:check` と下のテストで確かめる。

### 契約と実装の一致

`packages/api-contract` のテストで確かめる。

- 一覧：生成したクライアントの operation が、`operations` のすべての名前と読み取りの 10 個に一致する。`@itera/application` の関数の export のうち、読み取りでも操作の道具でもないものがあれば失敗する（読み取りを足したら契約にも足す）。
- 型：各操作の入力と本文、出力と応答、各読み取りの結果と応答の `view`（`undefined` は `null`）と `clock` が、型として同じ（片方への代入ができるだけでなく、余分な・欠けたキーもない）。比べる前に、両方から brand（ID・日付）と `readonly` を外す。`pnpm typecheck` で確かめる。
- fixture：PRD §12 の 12 状態で、すべての読み取り（Backlog の絞り込みごと、すべての Sprint の番号と次の週、昨日と明日）の結果を JSON にして `{ clock, view }` で包み、生成した応答のスキーマで検証する。
- ID：各種類の ID のスキーマが、`parseId` と同じものを受け付ける。

## 検討した代替案

- **TS の型から仕様を出力する**（Hono のルート定義、型からの JSON Schema 生成）：#45 のオーナーの決定（仕様が正本）のとおり採らない。iOS・Android が使う契約が TypeScript の実装に従うことになる。
- **操作を 1 つの経路にまとめる**（`POST /api/operations` に `{ name, input }`）：operation ごとの型・スキーマ・クライアントの関数が生成できず、OpenAPI で契約にする意味が薄れる。
- **REST の資源の形にする**（`PATCH /api/tasks/{id}` など）：操作の多くは複数の記録を変え（例：今日へ＝SprintTask と DailySelection）、資源の形にすると判定がクライアントに寄る。ADR 0005 のとおり、操作は名前と入力で表す。
- **読み取りの応答をそのまま結果にする**（包まない）：結果がないとき（`undefined`）を 404 にすると、空の状態がエラーとして扱われる。今日と現在時刻を応答に含める必要もある（ADR 0005「時計」）。
- **生成物をコミットせず、CI とインストールのたびに生成する**：`pnpm install` の後に生成の手順が増え、差分のレビューで契約の変化が見えない。

## 既知の制約

- query の数と真偽は文字列で届くので、サーバーで変換が要る（#266）。
- 応答のスキーマは未知のキーを許すので、Valibot の検証だけでは余分なキーを見つけられない。型のテストで止めている。
- `restoreInterrupt` と `undoAdoption` は、クライアントが前の読み取りの値を送る。読み取りが古いと、戻す値も古い（409 の扱いは ADR 0004 のとおり）。

## 影響

- `services/api`（#266）は、`@itera/api-contract` のスキーマで入力を検証し、この ADR の割り当てでエラーを返す。
- `apps/web`（#272）は、`@itera/api-contract/client` と `/react-query` を使い、`@tanstack/react-query` 5.104.1 を入れる。
- iOS・Android は、`openapi/` を 1 ファイルにまとめたもの（`redocly bundle`）から生成できる。
- 契約を変えるときは、`openapi/` を直し、`pnpm contract:generate` を実行して、生成物と一緒にコミットする。
