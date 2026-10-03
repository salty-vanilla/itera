# ADR 0005: Web のルーティングと fixture の置き場所

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #38、後続 Issue #39〜#42
- 改訂：2026-09-27（API への移行と状態の置き場所を追記）、2026-09-28（クライアントとデータの方式を追記）、2026-09-30（Sprint を番号で、日を日付で開く検索パラメータ、Issue #90）、2026-10-03（アプリケーション層、プレビューの例外、#45 の分け方、システムの記録、時計、本番ビルドの fixture。Issue #262）、2026-10-03（プレビューの共通のテストケースを仕様ケースと生成ケースに分ける。読み取りの結果と DTO の関係。ADR 0007）、2026-10-03（Web のクライアントとブラウザ内モック。Issue #272）、2026-10-03（何日も開かなかったときのシステムの記録。Issue #271）

## 背景

AGENTS.md の手順 4（`apps/web`）では、fixture だけで Backlog・Planning・Today・Retro の操作感を確かめる（PRD §12）。4 つの画面を作る前に、画面の入口（ルーティング）、記録の置き場所、fixture の状態の切り替え方を決める。ルーターは AGENTS.md の技術スタックの候補になかったため、採用理由と版をここに記録する。

オーナーの決定（2026-09-27、Issue #38）：

- ルーターは TanStack Router。
- fixture の状態は開発用メニュー（本番ビルドには入れない）で切り替え、同じ状態を URL でも開けるようにする。

## 決定

### ルーター

| 対象 | 採用 | 版 | 理由 |
| --- | --- | --- | --- |
| ルーター | `@tanstack/react-router` | 1.170.39 | 検索パラメータを型つきで検証し、遷移のあいだ保てる（`validateSearch`・`retainSearchParams`）。fixture の状態と、後の画面の状態（絞り込み、開いている詳細）を URL に置ける。React 19 に対応している |

依存は ADR 0001 と同じく完全一致で固定する。

- ルートはコードで定義する（`apps/web/src/app/router.tsx`）。ファイルベースのルーティングは、Vite プラグインと生成ファイル（`routeTree.gen.ts`）が増えるわりに、画面が 4 つでは得るものがないので使わない。画面が増えて定義が読みにくくなったら改めて決める。
- 画面ごとに 1 つのパス：`/today`（今日）、`/sprint`（Sprint）、`/backlog`、`/retro`（振り返り）。`/` は `/today` に送る。ないパスは「ページが見つかりません」を出す。
- `/sprint` と `/retro` は、検索パラメータ `sprint` で Sprint を番号（ドメインモデル F25）で開く（例：`/sprint?sprint=3`、`/retro?sprint=2`。Issue #90）。番号にしたのは、利用者が画面で見る名前（「Sprint 3」）と同じで、まだ Sprint のない次の週（計画を始める前）も指せるため。F25 のとおり Sprint は消さず、番号は変わらない。
  - 指定がないとき（ナビから開いたとき）は今の Sprint を開く。`/sprint` は実行中の Sprint、なければ計画中、なければ振り返り中の Sprint、なければ次の週。`/retro` は振り返り中の Sprint、なければ実行中（最終日から始められる、F21）、なければ最後に完了した Sprint。
  - 画面の中身は Sprint の状態で決まる。`/sprint` は計画中なら Planning、実行中なら実行中の Sprint、振り返り中と完了は確定時の計画と結果（読み取り専用）、次の週は「Sprint N の計画を始める」。`/retro` は振り返り中なら Retro、完了なら読み取り専用の Retro、実行中と計画中は始められる日。
  - Sprint Header の前後の矢印で、過去・次の Sprint に移る。`/sprint` では最後の Sprint の次に次の週がある（計画中の Sprint があるときはない）。移るときは、その Sprint の段階・開いている詳細などの検索パラメータを持ち越さない。
  - 数でない値・1 未満・その番号の Sprint がないときは、今の Sprint を開く（例外にしない）。
- `/today` は、検索パラメータ `date` で日を開く（例：`/today?date=2026-10-01`。Issue #90）。指定がないとき（ナビから開いたとき）と、今日の日付のときは今日を開く。今日以外の日は読み取り専用で、過去の日はその日の記録、先の日はその日の繰り返しの回と期限のタスクを出す。日付の見出しの前後の矢印と日付の選択で移る。実在しない日付と形式の違う値は、今日を開く。
- 検索パラメータは、ルートの `validateSearch` で検証してから使う。不正な値は捨てて既定に戻す（例外にしない）。Valibot はまだ入れていないので、それまでは手書きの検証関数にする。画面の状態（絞り込み、開いている詳細など）は、各画面の Issue でその画面のルートに足す。
  - TanStack Router は、ルートの検索パラメータを URL の値の上に検証の結果を重ねて作る（`{ ...URL の値, ...検証の結果 }`）。検証で捨てる値は、キーを省かずに `undefined` を返して上書きする（省くと URL の不正な値が画面に届く）。Issue #90 で `sprint`・`date` をこの形にした。ほかの検索パラメータ（`stage`・`criterion`・`task`・`view`・`area`・`fixture`）は、まだキーを省いている（未対応）。
- ナビゲーションは `Navigation`（DESIGN.md Components › Navigation）を使い、項目の `href` はルーターの `buildLocation` で作る。修飾キーなしの左クリックだけをルーターの遷移にし、新しいタブで開く操作はブラウザに任せる。

### fixture の状態

- 状態は PRD §12 の 12 個：選ぶ / 整える / 確かめる、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence。
- 状態はルートの検索パラメータ `fixture` で選ぶ（例：`/today?fixture=today-morning`）。`retainSearchParams` で、画面を移っても保つ。ないときは「日中」（`today-daytime`）。`sprint` と `date` は `retainSearchParams` に入れない。ナビから開けば今の Sprint と今日に戻り、画面を移っても前に選んだ Sprint と日を持ち越さない（Issue #90）。
- 開発用メニューは画面の右下に出し、状態を選ぶとその状態の画面を開く。開発用メニューと URL での切り替えは、ブラウザ内モックを使う開発のときだけ動く。本番ビルドと API を使う開発（`--mode api`）には fixture がなく、`fixture` の検索パラメータは捨てる（#272。下の「Web のクライアントとブラウザ内モック」）。
- fixture は、`packages/domain` のコマンドを 1 本の時系列（9/13〜10/5）で実行して作り、途中の記録をスナップショットとして取る（`packages/application/src/fixtures/timeline.ts`。#264 で `apps/web` から移した）。記録を手で書かないので、どの状態もドメインが作りうる記録だけになり、不変条件はコマンドが守る。ドメインモデルの Scenario A〜C を 1 人の利用者の 1 本の時系列に並べ直している。
- 状態ごとに時計（「今日」の LocalDate と現在時刻の Instant）を持つ。画面とコマンドはこの時計を使い、ブラウザの時計を読まない。

### 記録のストア

- ストアは `packages/domain` の記録（User・Area・Task・RecurrenceRule・Occurrence・Sprint・PlanningCriterion・Activity）だけを持つ。SprintTask・DailySelection・Retro などは Sprint の集約の中にある（packages/domain README）。派生値は持たず、画面が domain の関数で計算する。
- 変更は `Change`（記録と文脈を受け取り、domain のコマンドを呼んで、書き換える記録と Activity を返す関数）として `run` に渡す。成功したら記録を差し替えて Activity を追記し、失敗したら何も変えずに domain のエラーを返す。ID はストアが作って文脈で渡す（domain は ID を作らない）。
- 画面が使うのは `RecordStore`（`getSnapshot`・`subscribe`・`run`）だけにする。fixture はメモリ上の実装（`createMemoryStore`）を使い、永続化しない（リロードすると fixture に戻る）。services/api とのつなぎ方は、次の「API への移行」に従う。
- `RecordStore` はサーバー状態（将来は D1 にある記録）の仮の置き場で、クライアントの UI 状態を持つストア（Zustand など）とは役割が違う。移行後は TanStack Query（取得結果のキャッシュ）と API に置き換わる。

### API への移行

オーナーの決定（2026-09-27）：fixture で 4 つの画面（#39〜#42）を今の `RecordStore` と `Change` のまま作りきり、そのあとで OpenAPI を契約にした API 呼び出しへ移行する。

- 理由：`Change` は関数なのでサーバーへ送れず、このままつなぐと判定がクライアントとサーバーに分かれる。操作を名前と入力で表す契約（OpenAPI）にすれば、判定はサーバーの `packages/domain` のコマンドだけになり、将来 Web 以外のクライアント（iOS など）もその契約からクライアントを生成できる。Hono RPC や tRPC は型が TypeScript の中に閉じるので採らない。先に画面を作りきるのは、PRD §12 の操作感の検証を先に済ませ、必要な操作を画面から洗い出してから契約を決めるため。
- 移行先の方向：OpenAPI の仕様を先に書き（spec-first）、そこからクライアントを生成して（Hey API の候補）TanStack Query で呼ぶ。fixture の段階の代わりに、ブラウザ内のモックが同じ operation を受けて `packages/domain` のコマンドを実行する。採用する依存・版・仕様ファイルの置き場所は #45 と ADR で決める（ADR 0006、#265）。
- クライアントとデータの方式（2026-09-28 オーナー決定、PRD §14）：規則の正本は `packages/domain` で、使うのはサーバーだけ。API のハンドラーは記録を D1 から読み、コマンドを呼び、`batch()` で書く（ADR 0004）。移行後の `apps/web` は契約（DTO）だけに依存し、`packages/domain` を import するのはブラウザ内モック（サーバーの代役。本番ビルドに入れない）だけにする。これを ESLint の `no-restricted-imports` で検査する。
- 記録と派生値（`backlogView`・`retroFacts`・連続見送り・昨日の続きなど）は API から得る。入力に合わせて即座に変わるプレビュー（計画値、合計と容量、計画基準を適用したときの見え方、繰り返しの要約と次の日付）は、通信せずに `apps/web` の中で計算する。iOS（Swift）と Android（Kotlin）も同じプレビューをそれぞれの言語で持つ。確定時に固定する値（planSnapshot）はサーバーが計算する。
- プレビューの抜け漏れとずれは、契約の隣に置くプレビューの一覧と共通のテストケースで防ぐ。各クライアントのテストは一覧の全 ID を回し、実装がなければ失敗にする。テストケースは 2 種類にする（2026-10-03 オーナー決定、ADR 0007「プレビュー」）。
  - 仕様ケース：ドメインモデルと ADR で決めた意味から、人が期待値を書く。月末・曜日・タイムゾーン・省略と空・丸め・並び順などの境界を対象にし、TypeScript を含むすべての実装が従う。`packages/domain` の実装は参照実装だが、その出力を仕様にはしない。
  - 生成ケース：`packages/domain` の関数を実行して作り、CI で作り直して差分がないことを確かめる。組み合わせの網羅と回帰の検出のため。出力は一覧の出力スキーマに従って正規化し、内部のオブジェクトをそのまま保存しない。
- 書き直すのは `apps/web/src/store/` の `Change`・`changes.ts`・`RecordStore` の実装、それを呼ぶフックの中身、画面が使う domain の型（DTO に替える）に限る。

移行の範囲をフックの中に閉じ込めるため、#39〜#42 では次を守る。

- 画面の部品から `store.run`・`Change`・`Records` を直接使わない。読み取りは画面ごとのフック（例：`useBacklog()`）、変更は操作ごとのフック（例：`useTaskActions().updateTask(id, input)`）を通す。
- 利用者の 1 操作を 1 つの名前つき関数にする（例：`updateTask`、`selectForToday`）。この一覧が、移行時の OpenAPI の operation の元になる。
- 表示の部品はデータと操作を props で受け取り、取得の方法を知らない。送信中と失敗を表せる形にしておく（fixture では同期なので送信中は起きない）。
- システムの記録（actor = システム。終了日を過ぎた Sprint を Review にする、その日の始まり）は、利用者の操作ではない。fixture ではアプリの外枠の `useSystemDay` が実行する（#54）。API への移行後は、クライアントの operation にせず、サーバー側（読み取りの前や日次の処理）で行う。

### API への移行の改訂（2026-10-03）

- **アプリケーション層**：`apps/web/src/store/` の Change（利用者の 1 操作を domain のコマンドの組み合わせで行う関数）と view（記録から派生値を作る関数）を、新しいパッケージ `packages/application` に移す。API のハンドラーとブラウザ内モックの両方がこれを使う。モックはサーバーと同じ関数を実行するので、振る舞いがずれない。上の「書き直すのは…に限る」は「移す」に改める。
  - 読み取りの結果は、そのまま API の応答（DTO）にできる形にする。関数を含めない。画面の語（「領域なし」「今週」など）を含めず、画面が語に替える値（`areaId` がない、週が前・今・次のどれか）で返す。ただし契約の正本は OpenAPI で、読み取りの結果が契約を決めるのではない。両者の形が離れたら `services/api` に写像を置く（ADR 0007「アプリケーション層の読み取りと API の DTO」）。
  - 操作は、作った記録の ID と操作の結果の値（`effectiveFrom`・`removed` など）を戻り値で返す。画面が記録の並びや Activity から拾わない。
  - Area の並び順と色のように操作が決める値は、クライアントではなく操作の中で決める。
  - 実装（#264）：利用者の操作は `packages/application` の `operations`（`operations.ts`）に、画面をまたいで重ならない名前と入力の型で並べる（例：計画中の `setPlanningGoal` と実行中の `setRunningGoal`、Backlog の `completeTask` と Today の `completeSelection`）。この一覧が契約（#265）の operation の元になる。システムの記録（`reviewEnded`・`beginDay`）は一覧に入れない。読み取りは `*-view.ts` の関数で、fixture の 12 状態のすべての読み取りが JSON にして戻しても同じになることをテストで確かめる。ID から引く関数（`item`・`areaOf` など）と「領域なし」「先週」「今週」「来週」の語は、`apps/web` のフック（`src/store/views.ts`、`src/lib/week-text.ts`）が作る。
  - fixture（時系列と 12 状態）は `@itera/application/fixtures` に置き、ブラウザ内モックとテストが使う。`services/api` の本番のコードからの import は ESLint で止める。`packages/application` は `packages/domain` と同じく現在時刻と乱数を引数で受け取り、React と `apps/web` に依存しない（ESLint で検査する）。
  - 画面のフックは、#273〜#276 で契約に移すまで、このパッケージを `RecordStore` 経由で使う（上の「`packages/application` を import してよいのはモックだけ」の検査は、画面を移し終えてから入れる）。
- **プレビューの例外（D2、2026-10-02 オーナー決定）**：プレビューは、当面 `apps/web` が `packages/domain` の関数をそのまま使って計算する。Web での実装し直しと、共通のテストケース（PRD §14、#45 の範囲 2）は、iOS に着手するときに行う。
  - 2026-10-03 の時点で画面が使う値の関数は、`boundValue`・`presentedSuggestion` と日付の関数（`parseLocalDate`・`toLocalDate`・`addDays`・`dayOfWeek`）だけ。
  - `apps/web` のうち `packages/domain` を import してよいのは、この例外をまとめた 1 つのモジュールとブラウザ内モックだけ。`packages/application` を import してよいのはモックだけ。型だけの import も同じ（画面は契約の型を使う）。ESLint の `no-restricted-imports` で検査する。
  - 戻す条件：iOS に着手するとき。
- **#45 の分け方**：#45 の範囲を、#264（アプリケーション層）、#265（契約）、#272・#273・#274・#275・#276・#277（画面を契約に移す）に分けた。範囲 2 のプレビューの一覧と共通のテストケースは、上の例外のとおり iOS に回す。
- **システムの記録**：`useSystemDay` の処理（終了日を過ぎた Sprint を Review にする、その日の始まり）は、サーバーが操作と読み取りの前に、その時点まで進める（ADR 0004「操作と読み取りの処理」、#271）。クライアントの operation にしない。
  - 何日も開かなかったとき（#271）：最後の日だけを進めるのではなく、前に追いついた日から今日まで、実行中の Sprint の期間の日を 1 日ずつ始め（`startDay`）、終了日を過ぎていれば最後に Review に入れる（`enterReview`）。`startDay` はその日の繰り返しの回だけを今日に入れ、前の日の回は入れないので、最後の日だけを進めると、開かなかった日の繰り返しの回に選択ができない。日ごとに進めれば、その日に開いた場合と同じく選択ができ、次の日に「未完了」になる。Review の時点では、どちらの場合も残りの回は Missed になる。終了日の翌日以降の日は進めない（Review が開いたままの選択を閉じる。F23）。
  - 前に追いついた日より前の日は進め直さない。その後の操作で過去の日の回が Pending に戻ったり（F19 のスキップの取り消し）、Sprint に戻ったり（F13）しても、過ぎた日の選択を後から作らない。前に追いついた日は保存のたびに API が記録する（ADR 0004「操作と読み取りの処理」）。その日はもう一度進めるが、その日のうちの次の読み取りでも同じことが起きるので、毎日開いた場合と変わらない。
  - 毎日開いた場合との違い：記録の中身（選択の日付・状態、回の状態、Sprint の状態、Activity の種類と順）は同じになる（API のテスト `system-day.test.ts` で 2 週間の場合を確かめる）。違うのは、システムが作った記録と Activity の日時（`selectedAt`・`resolvedAt`・回の状態の日時・Retro の開始・Activity の `at`）が、その日ではなく処理した時点になることと、新しい選択の ID。日時は「システムがいつ記録したか」なので、処理した時点を正とする（#271 の範囲 4）。
  - ブラウザ内モック（#272）の追いつきも同じ `catchUp` を使う。fixture の状態の時計は動かないので、前に追いついた日は渡さず、その日だけを進める。まだ移していない画面のための `useSystemDay` は、今までどおり今日だけを進める（#277 で片づける）。
- **時計**：本番の「今日」と現在時刻は、サーバーが利用者のタイムゾーンで決め、読み取りの結果で返す。ブラウザ内モックは、今までどおり fixture の状態ごとの時計を使う。
- **本番ビルドの fixture**：本番ビルドは API を使い、fixture とモックを含めない。「fixture の状態」の節の「URL での切り替えは本番ビルドでも使える」は、#272 で開発ビルドだけに改めた。

### Web のクライアントとブラウザ内モック（2026-10-03、Issue #272）

画面を契約（ADR 0006）につなぐ土台。各画面のフックの差し替えは #273〜#276、`RecordStore` の片づけは #277。

#### 依存と版

| 対象 | 採用 | 版 | 置き場所 |
| --- | --- | --- | --- |
| 取得結果のキャッシュ | `@tanstack/react-query` | 5.104.1 | `apps/web` の dependencies。ADR 0006 と同じ版 |
| 契約のクライアント | `@itera/api-contract`（`/client`・`/create-client`・`/react-query`） | workspace | `apps/web` の dependencies |
| モックの入力の検証 | `valibot` | 1.5.0 | `apps/web` の devDependencies（モックだけが使い、本番ビルドに入らない）。ADR 0006 と同じ版 |

使い方は 2026-10-03 に Context7 で TanStack Query v5（`QueryCache`・`MutationCache` の全体のコールバック、`invalidateQueries`）と Vite（`server.proxy`、`--mode`）の文書を確かめた。

#### データの出どころ

- `apps/web/src/app/data-source.ts` が、ブラウザ内モック（開発の既定。`pnpm --filter @itera/web dev`）か API（本番ビルドと `pnpm --filter @itera/web dev:api`）かを選ぶ。どちらも同じ `ApiProvider`（契約のクライアントと `QueryClient`）を画面に渡す。
- 契約のクライアントは、データの出どころごとに `createClient` で作る（`@itera/api-contract/create-client` の `createClient`・`createConfig`）。生成した関数と options には `{ client }` で渡す（`getOverviewOptions({ client })`）。モジュールの既定の `client` を書き換えない。fixture の状態を替えるたびに、記録・クライアント・キャッシュを新しくする。
- `--mode api` では、Vite の開発サーバーが `/api` を `wrangler dev`（既定 `http://localhost:8787`、`ITERA_API_ORIGIN` で変えられる）に中継する。Host と Origin は開発サーバーのままなので、`BETTER_AUTH_URL` は開発サーバーの origin にする（`services/api/README.md`）。

#### Query のキーと無効化

- キーは生成したもの（`getOverviewQueryKey` など。`[{ _id: <operationId>, baseUrl, path?, query? }]`）だけを使い、手で作らない。
- 操作が成功したら、すべての読み取りを無効にする（`apps/web/src/api/reads.ts`）。表示中のものはすぐ取り直し、ほかは次に表示するときに取る。操作の Promise は、表示中の読み取りの最初の答えが戻ってから解決する（`MutationCache` の `onSuccess` が `readAgain` を待つ）。待つのは最初の 1 回（戻った・1 回失敗した・通信を待っている）までで、読み取りの取り直しは待たない。取り直しまで待つと、通信が不安定なときに操作の結果と失敗の Toast が遅れ、オフラインになると送信中のまま止まるため（Issue #272 のレビュー）。
  - 理由：読み取りはすべて利用者の記録の全体から作る派生値で（ADR 0004「操作と読み取りの処理」）、1 つの操作が複数の画面の読み取りを変える（今日の完了は、今日・実行中の Sprint・Backlog・ナビの件数を変える）。操作ごとに読み直す読み取りの表を持つと、派生値のたどり漏れが古い表示として残り、失敗として見えない。
  - 代わりに払うもの：操作のたびに表示中の読み取りを 1 回ずつ取り直す。表示中の読み取りは 1 画面で 1〜3 個で、利用者は 1 人。
  - 見直す条件：取り直しが遅いと分かったとき（読み取りの時間は ADR 0004 の Workers Logs で見る）。
- 楽観的更新はしない（PRD §14）。

#### エラーと送信中

- 失敗は応答の `code` だけで分ける（`apps/web/src/api/failure.ts`）：`unauthenticated`（401）、`revisionConflict`（409）、受け付けられない（400・403・404・413・422。利用者の設定がまだない `userNotSetUp` もここ。設定を作る画面への入口は #279）、それ以外（500、通信の失敗、知らない `code`。ADR 0006「互換の規則」）。`message` は画面に出さない。
  - エラーの `code` は開いた列挙（ADR 0006「列挙」）。生成した型は `code` をエラーごとの閉じた値で書いているが、Web は応答を実行時に検証しない（生成した SDK に応答の検証はない）。`failureOf` は失敗を `unknown` として受け、`code` を文字列として読むので、知らない `code`・知らない HTTP のステータス・JSON でない本文でも読み込みは失敗せず、一般の失敗になる（`failure.test.ts`）。Web が応答を実行時に検証するようにするなら、その前に開いた列挙の仕様での書き方を決める（ADR 0006）。
- 操作が失敗したら、失敗が記録について言えることで danger の Toast を分ける（2026-10-03 オーナー決定、Issue #272。文言は `src/api/save-failed.ts` の 1 か所にまとめ、`use-run.ts` も使う）。操作は自動で送り直さない。
  - 保存の前に断った（受け付けられない：400・403・404・413・422）：「保存できませんでした」「記録は変わっていません。内容を確かめてもう一度試してください。」。読み直さない。
  - 保存できたか分からない（409 `revisionConflict`、500、通信の失敗、知らない `code`・ステータス・JSON でない本文）：409 は応答が失われただけで保存は済んでいることがあり（ADR 0006「エラー」）、ほかはサーバーが書いた後に失敗したかもしれないので、「記録は変わっていません」とは言わない。すべての読み取りを読み直してから（成功のときと同じく最初の答えまで）、「保存できたか確かめられませんでした」「最新の記録を確かめてください。」を出す。
  - 未認証（401）は Toast を出さず、下のサインインの入口へ送る。
  - 分け方は `use-operation.test.tsx` の「a failed operation」が、code・ステータスごとに Toast と読み直しの有無で確かめる。
- 未認証（401）は、読み取りでも操作でも、サインインの画面へ送る（`apps/web/src/app/sign-in.ts`。`/sign-in?redirect=<元の画面>`、履歴は置き換える）。Toast は出さない。画面とパス・戻り先の渡し方は #278 で作り、決め直してよい。
- 読み取りは、サーバーと通信の失敗（500 など）と版の衝突のときだけ 1 回まで取り直す。受け付けられない要求と未認証は取り直さない。操作は取り直さない。
- 操作は `useOperation('<操作の名前>')` と `run(<入力>)`（`apps/web/src/api/use-operation.ts`）で呼ぶ。名前と入力は `packages/application` の操作のもので、HTTP のメソッドと経路への載せ方は `@itera/api-contract/requests` が決める（ADR 0006「経路の形」、#295。2026-10-03 改訂。それまでは生成した mutation の options を渡していた）。送信中は同じ操作を重ねて送らない（押し直しは送らずに失敗として返す）。`pending`（送信中。操作を受け付けない）と `loading`（送信中が 300ms 続いた。DESIGN.md の Spinner のとおり、Button・IconButton の `loading` でスピナーと文言を出す）を返す。送信中の見た目は DESIGN.md Components › Button・IconButton と docs/design/foundations.md の Loading に従い、各画面の Issue で付ける。

#### ブラウザ内モック

- `apps/web/src/mock/`：`createMock(store)` が、契約の要求（`Request`）を受けて `packages/application` の読み取りと操作を `RecordStore` の上で実行し、API と同じ形の応答（読み取りは `{ clock, view }`、操作は値か 204、エラーは ADR 0006 の status と `code`）を返す。クライアントの `fetch` として渡す（Service Worker は使わない）。
- `getMe`（利用者と設定）は、API と同じく追いつきなしで、fixture の利用者の設定を返す。ほかの読み取りと操作の処理の順は API と同じ（ADR 0004「操作と読み取りの処理」）：入力を契約の Valibot のスキーマで確かめる（query の数と真偽は型に変えてから）→ システムの記録をその時点まで進める（終了日を過ぎた Sprint を Review にし、その日を始める。#271 と同じ処理）→ 読み取りか操作。利用者はサインイン済みで設定もある者として扱い（#278）、Origin・版の衝突・本文の大きさの上限は確かめない。日付が暦の上で実在するかは、`getDay` のパスだけで確かめる（画面は実在しない日付を送らない）。
- ID は `packages/application` の `createIdSource`（TypeID）で作る。時計は fixture の状態ごとの時計（上の「時計」）。
- 移行の途中の一致：モックと、まだ移していない画面は、同じ `RecordStore` を使う。画面が `RecordStore` で記録を変えたら、すべての読み取りを無効にする（`createMock` の `subscribeToScreens`）。モック自身の変更（要求への応答）では無効にしない（操作はクライアントが読み直し、読み取りはその応答がある）。
- `packages/application` の `beginDay` は、その日がもう始まっていれば何も書かない（変更も Activity もない）ように改めた。前は実行中の Sprint を毎回書き直しており、要求のたびにシステムの記録を進めるモックでは、記録の差し替えと読み直しが止まらなかった。API（#271）でも書く行がなくなる。
- まだ移していない画面のための `useSystemDay` は、モックを使うときだけ外枠で動かす（#277 で外す）。

#### 本番ビルド

- モックは `import.meta.env.DEV` が真で `--mode api` でないときだけ `import()` する（`apps/web/src/app/data-source.ts`。条件はここに 1 つだけ書き、ルーターなどはその結果を使う）。本番ビルドではこの分岐が消え、モックと fixture のチャンクが出力に入らない。条件をほかのモジュールの定数にして参照すると、Vite（Rolldown）は分岐を消さずチャンクが残る（2026-10-03 に確かめた。下の検査が捕まえる）ので、条件は `import()` の隣に直接書く。
- `pnpm build`（`apps/web` の `vite build && node scripts/check-build.mjs`）が、出力にモックの応答のヘッダー名と fixture の状態の ID がないことを確かめる。あれば失敗する（CI と CD も同じコマンド）。
- まだ移していない画面は、本番ビルドと `--mode api` では `RecordStore` がないので表示できない。その画面の代わりに、開発者向けの短い表示（英語。画面の文言ではない）で、どの Issue で移すかを出す（`NotOnContract`）。統合ブランチはデプロイしないので、この途中の状態を受け入れる（2026-10-03 オーナー決定、Issue #272 のコメント）。#277 で消す。

#### import の境界

- `eslint.config.js`：`apps/web` のうち `packages/domain` を import してよいのは `src/lib/domain-functions.ts`（上の「プレビューの例外」の関数をまとめたモジュール）とモックだけ、`packages/application` はモックだけ。型だけの import も同じ。2 つを別の規則（`no-restricted-imports` と `@typescript-eslint/no-restricted-imports`）にして、片方の設定がもう片方を上書きしないようにしている。
- テスト（`*.test.*`、`src/test/`）は対象外：fixture の記録を開き、記録の ID で画面を指すため。
- まだ移していないファイルは、移行の途中の例外として `MIGRATING` に、画面の Issue（#273〜#276）ごとと共有のものに分けて、ファイル名で並べる（パターンにしないので、新しいファイルは規則に従う）。各 Issue が自分のファイルを消し、#277 で一覧と仕組みを消す。

### 状態の置き場所

グローバルな UI 状態のストアは入れない。

- 記録：`RecordStore`（移行後は TanStack Query。#272 から、契約に移した読み取りは TanStack Query）。
- 画面の状態（fixture の状態、絞り込み、開いている詳細、開いている Sprint など）：ルートの検索パラメータ。選んでいる Sprint と日も Zustand などのアプリ全体のストアに持たない。再読み込み・ブラウザの戻る・新しいタブ・共有で同じ画面を開けるようにするため（Issue #90 のオーナー決定）。
- 部品の中だけの状態（開閉、入力途中の値）：React の state。

どれにも当てはまらない状態が出てきたら、そのとき改めて決める。

## 影響

- `pnpm --filter @itera/web dev` で 4 つの画面の入口が開く。画面の中身は #39〜#42 で作る。
- 時間の書式（DESIGN.md 原則 4）は `apps/web/src/lib/time-format.ts`、日付の書式（docs/design/content.md）は `date-format.ts` にある。
- 本番ビルドの JS が 500 kB（gzip 前）を超え、Vite が警告を出す。分割はコード量が画面の Issue で増えてから決める。
