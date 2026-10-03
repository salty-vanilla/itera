# ADR 0005: Web のルーティングと fixture の置き場所

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #38、後続 Issue #39〜#42
- 改訂：2026-09-27（API への移行と状態の置き場所を追記）、2026-09-28（クライアントとデータの方式を追記）、2026-09-30（Sprint を番号で、日を日付で開く検索パラメータ、Issue #90）、2026-10-03（アプリケーション層、プレビューの例外、#45 の分け方、システムの記録、時計、本番ビルドの fixture。Issue #262）、2026-10-03（プレビューの共通のテストケースを仕様ケースと生成ケースに分ける。読み取りの結果と DTO の関係。ADR 0007）、2026-10-03（Web のクライアントとブラウザ内モック。Issue #272）、2026-10-03（何日も開かなかったときのシステムの記録。Issue #271）、2026-10-03（Backlog・Task の詳細・領域を契約に移す。Issue #273）、2026-10-03（サインインと設定。Issue #278）

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
  - 実装（#264）：利用者の操作は `packages/application` の `operations`（`operations.ts`）に、画面をまたいで重ならない名前と入力の型で並べる（例：Backlog の `completeTask` と Today の `completeSelection`。#295 で Sprint の中の操作は対象の Sprint の ID を入力に取るようにし、計画中と実行中で同じ意味の操作は `setGoal` などにまとめた）。この一覧が契約（#265）の operation の元になる。システムの記録（`reviewEnded`・`beginDay`）は一覧に入れない。読み取りは `*-view.ts` の関数で、fixture の 12 状態のすべての読み取りが JSON にして戻しても同じになることをテストで確かめる。ID から引く関数（`item`・`areaOf` など）と「領域なし」「先週」「今週」「来週」の語は、`apps/web` のフック（`src/store/views.ts`、`src/lib/week-text.ts`）が作る。
  - fixture（時系列と 12 状態）は `@itera/application/fixtures` に置き、ブラウザ内モックとテストが使う。`services/api` の本番のコードからの import は ESLint で止める。`packages/application` は `packages/domain` と同じく現在時刻と乱数を引数で受け取り、React と `apps/web` に依存しない（ESLint で検査する）。
  - 画面のフックは、#273〜#276 で契約に移すまで、このパッケージを `RecordStore` 経由で使う（上の「`packages/application` を import してよいのはモックだけ」の検査は、画面を移し終えてから入れる）。
- **プレビューの例外（D2、2026-10-02 オーナー決定）**：プレビューは、当面 `apps/web` が `packages/domain` の関数をそのまま使って計算する。Web での実装し直しと、共通のテストケース（PRD §14、#45 の範囲 2）は、iOS に着手するときに行う。
  - 2026-10-03 の時点で画面が使う値の関数は、`boundValue`・`presentedSuggestion` と日付の関数（`parseLocalDate`・`toLocalDate`・`addDays`・`dayOfWeek`）だけ。
  - `apps/web` のうち `packages/domain` を import してよいのは、この例外をまとめた 1 つのモジュールとブラウザ内モックだけ。`packages/application` を import してよいのはモックだけ。型だけの import も同じ（画面は契約の型を使う）。操作の名前と入力の型は `@itera/api-contract/requests` から取る（元は application の型。ADR 0007「依存の向き」の例外、#295）。ESLint の `no-restricted-imports` で検査する。
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
- 契約のクライアントは、データの出どころごとに `createClient` で作る（`@itera/api-contract/create-client` の `createClient`・`createConfig`）。生成した関数と options には `{ client }` で渡す（`getMeOptions({ client })`）。モジュールの既定の `client` を書き換えない。fixture の状態を替えるたびに、記録・クライアント・キャッシュを新しくする。
- `--mode api` では、Vite の開発サーバーが `/api` を `wrangler dev`（既定 `http://localhost:8787`、`ITERA_API_ORIGIN` で変えられる）に中継する。Host と Origin は開発サーバーのままなので、`BETTER_AUTH_URL` は開発サーバーの origin にする（`services/api/README.md`）。

#### Query のキーと無効化

- キーは生成したもの（`getMeQueryKey` など。`[{ _id: <operationId>, baseUrl, path?, query? }]`）だけを使い、手で作らない。
- 操作が成功したら、すべての読み取りを無効にする（`apps/web/src/api/reads.ts`）。表示中のものはすぐ取り直し、ほかは次に表示するときに取る。操作の Promise は、表示中の読み取りの最初の答えが戻ってから解決する（`MutationCache` の `onSuccess` が `readAgain` を待つ）。待つのは最初の 1 回（戻った・1 回失敗した・通信を待っている）までで、読み取りの取り直しは待たない。取り直しまで待つと、通信が不安定なときに操作の結果と失敗の Toast が遅れ、オフラインになると送信中のまま止まるため（Issue #272 のレビュー）。
  - 理由：読み取りはすべて利用者の記録の全体から作る派生値で（ADR 0004「操作と読み取りの処理」）、1 つの操作が複数の画面の読み取りを変える（今日の完了は、今日・実行中の Sprint・Backlog・ナビの件数を変える）。操作ごとに読み直す読み取りの表を持つと、派生値のたどり漏れが古い表示として残り、失敗として見えない。
  - 代わりに払うもの：操作のたびに表示中の読み取りを 1 回ずつ取り直す。表示中の読み取りは 1 画面で 1〜3 個で、利用者は 1 人。
  - 見直す条件：取り直しが遅いと分かったとき（読み取りの時間は ADR 0004 の Workers Logs で見る）。
- 楽観的更新はしない（PRD §14）。

#### エラーと送信中

- 失敗は応答の `code` だけで分ける（`apps/web/src/api/failure.ts`）：`unauthenticated`（401）、`revisionConflict`（409）、受け付けられない（400・403・404・413・422。利用者の設定がまだない `userNotSetUp` もここ。設定を作る画面への入口は #279）、それ以外（500、通信の失敗、知らない `code`。ADR 0006「互換の規則」）。`message` は画面に出さない。
  - エラーの `code` は開いた列挙（ADR 0006「列挙」）。生成した型は `code` をエラーごとの閉じた値で書いているが、Web は応答を実行時に検証しない（生成した SDK に応答の検証はない）。`failureOf` は失敗を `unknown` として受け、`code` を文字列として読むので、知らない `code`・知らない HTTP のステータス・JSON でない本文でも読み込みは失敗せず、一般の失敗になる（`failure.test.ts`）。Web が応答を実行時に検証するようにするなら、その前に開いた列挙の仕様での書き方を決める（ADR 0006）。
- 操作が失敗したら、失敗が記録について言えることで danger の Toast を分ける（2026-10-03 オーナー決定、Issue #272。文言は `src/api/save-failed.ts` の 1 か所にまとめ、`use-run.ts` も使う）。操作は自動で送り直さない。
  - 保存の前に断った（受け付けられない：400・403・404・413・422）：「保存できませんでした」「記録は変わっていません。内容を確かめてもう一度試してください。」。読み直してから出す（2026-10-03 司令塔の判断、#295。送った日付や実行中の Sprint が古かったときに、画面を今の記録に戻すため。ADR 0006「エラー」。それまでは読み直さなかった）。
  - 保存できたか分からない（409 `revisionConflict`、500、通信の失敗、知らない `code`・ステータス・JSON でない本文）：409 は応答が失われただけで保存は済んでいることがあり（ADR 0006「エラー」）、ほかはサーバーが書いた後に失敗したかもしれないので、「記録は変わっていません」とは言わない。すべての読み取りを読み直してから（成功のときと同じく最初の答えまで）、「保存できたか確かめられませんでした」「最新の記録を確かめてください。」を出す。
  - 未認証（401）は Toast を出さず、下のサインインの入口へ送る。
  - 分け方は `use-operation.test.tsx` の「a failed operation」が、code・ステータスごとに Toast と読み直しの有無で確かめる。
- 未認証（401）は、読み取りでも操作でも、サインインの画面へ送る（`apps/web/src/auth/sign-in.ts`。`/sign-in?redirect=<元の画面>`、履歴は置き換える）。Toast は出さない。画面と戻り先の扱いは下の「サインインと設定」（#278）。
- 読み取りは、サーバーと通信の失敗（500 など）と版の衝突のときだけ 1 回まで取り直す。受け付けられない要求と未認証は取り直さない。操作は取り直さない。
- 操作は `useOperation('<操作の名前>')` と `run(<入力>)`（`apps/web/src/api/use-operation.ts`）で呼ぶ。名前と入力は `packages/application` の操作のもので、HTTP のメソッドと経路への載せ方は `@itera/api-contract/requests` が決める（ADR 0006「経路の形」、#295。2026-10-03 改訂。それまでは生成した mutation の options を渡していた）。送信中は同じ操作を重ねて送らない（押し直しは送らずに失敗として返す）。`pending`（送信中。操作を受け付けない）と `loading`（送信中が 300ms 続いた。DESIGN.md の Spinner のとおり、Button・IconButton の `loading` でスピナーと文言を出す）を返す。送信中の見た目は DESIGN.md Components › Button・IconButton と docs/design/foundations.md の Loading に従い、各画面の Issue で付ける。

#### ブラウザ内モック

- `apps/web/src/mock/`：`createMock(store)` が、契約の要求（`Request`）を受けて `packages/application` の読み取りと操作を `RecordStore` の上で実行し、API と同じ形の応答（読み取りは `{ clock, view }`、操作は値か 204、エラーは ADR 0006 の status と `code`）を返す。クライアントの `fetch` として渡す（Service Worker は使わない）。
- `getMe`（利用者と設定）は、API と同じく追いつきなしで、fixture の利用者の設定を返す。ほかの読み取りと操作の処理の順は API と同じ（ADR 0004「操作と読み取りの処理」）：入力を契約の Valibot のスキーマで確かめる（query の数と真偽は型に変えてから）→ システムの記録をその時点まで進める（終了日を過ぎた Sprint を Review にし、その日を始める。#271 と同じ処理）→ 読み取りか操作。利用者は設定のある者として扱い、サインインはモックの認証に従う（サインアウトした後はすべての要求に 401。下の「サインインと設定」）。Origin・版の衝突・本文の大きさの上限は確かめない。日付が暦の上で実在するかは、`getDay` のパスだけで確かめる（画面は実在しない日付を送らない）。
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

### Backlog・Task の詳細・領域を契約に移す（2026-10-03、Issue #273）

最初に移した画面。ほかの画面（#274〜#276）は、ここで決めた形で移す。

- **読み取りのフック**：`useBacklog`・`useAreas` は、生成した options（`getBacklogOptions`・`listAreasOptions`）を `useQuery` で読み、`Read<T>`（`apps/web/src/api/read-state.ts`）を返す。`status` が `pending`（まだ答えがない）、`failed`（読めなかった。`retry` を持つ）、`ready`（画面のデータを持つ）のどれかで、画面は `ready` でない間、記録の場所を空白にせず `ReadStatus`（`components/read-status.tsx`）を出す。`ready` になったデータは、読み直しが失敗しても残る（最後に読めたものを見せる）。絞り込みを変えたときは、新しい答えが来るまで前の答えを残す（`placeholderData: keepPreviousData`。TanStack Query v5 の文書で確かめた）。
  - `ReadStatus` は、`pending` が 300ms 続いたら線（不透明度だけが動く Progress）と「読み込み中…」を出し、それより早く終われば何も出さない（DESIGN.md の Loading）。`failed` は danger の Notice「読み込めませんでした」と「もう一度読み込む」。
  - 別の画面が `useBacklog` の答え（Task の詳細を開くための `item` など）を使うときは、`status === 'ready'` を確かめてから使う。
- **操作のフック**：`useTaskActions`・`useSubtaskActions`・`useRecurrenceActions`・`useAreaActions` は、操作ごとに `useOperation` を呼び、操作ごとの名前つき関数を返す（1 つのフックが全部の操作の購読を作らないよう、使う部品ごとに分けた）。関数は非同期で、成功したかを `boolean` で（作ったものの ID は `string | undefined`、`setRecurrence` と `endRecurrence` は `{ ok, … }` で）返す。成功したときは、表示中の読み取りが戻ってから解決する。送信中に同じ操作を重ねて送らない。ただし、欄を離れたときや選んだときに保存する操作（Task の各欄の保存、サブタスクのチェックと見積もり、繰り返しの設定）は、重ねて送った分を捨てずに、前の分が終わってから順に送る（`useOperation` の `whileSending: 'wait'`）。捨てると、続けて変えた 2 つ目が黙って保存されない。`loading`（操作ごとの、300ms 続いた送信中）は、その操作のボタンの `loading` と `loadingLabel`（「追加中…」）に渡す。今回は追加（Quick Add、サブタスク、領域）のボタンに付けた。ほかの操作は、結果が Toast か行の変化で見えるので、送信中の見た目を付けない。
- **操作は重ならない**：`useOperation` の操作は、どのフックから送っても同じ mutation の scope（`operations`）に入り、1 つずつ送られる（TanStack Query v5 の `scope`。文書で確かめた）。API は版を確かめて書くので（ADR 0004 同時の書き込み）、重なると片方が版の衝突になる。
- **操作が終わっても、画面はまだ新しい記録を描いていないことがある**：キャッシュは更新済みでも、購読者への通知は次のタスクで届く。操作の結果に合わせて表示や焦点を動かす処理は、操作の前に頼みを置いておくか、記録が変わるのを待つ。Task の詳細の「今日と今週」は、押したときの選択肢の並びを覚えておき、並びが変わったときに焦点を動かす。
- **Task の詳細が使う選択の操作**（開始・今日は中断する・今日は見送る・今日の回をスキップする・今週の残りに戻す）は、契約の operation を `screens/backlog/use-selection-actions.ts` から呼ぶ。Today の操作の一覧（`use-today.ts`）は #275 で移した（次の節）。
- **型**：Backlog の画面と部品は契約の型（`@itera/api-contract`）を使い、`packages/domain` を import しない。ID・`LocalDate`・`Instant` は契約では素の文字列で、domain のブランド付きの型を受ける部品も、契約の型を受けるように替えた（ブランド付きの値は文字列として渡せるので、まだ移していない画面はそのまま渡せる）。配列は読み取り専用にして受ける部品だけ、受け方を広げる。
- **プレビューの例外のモジュール**：`lib/domain-functions.ts` の日付の関数（`addDays`・`dayOfWeek`・`toLocalDate`）は、契約の型を受けて、domain の関数に渡す。ブランドの付け替え（`as`）はここだけで、日付と時刻の形は契約のスキーマが確かめる。`presentedSuggestion` は、Task 全体でなく `suggestions` を持つものを受けるようにした（`packages/domain` の型の変更だけで、振る舞いは同じ）。
- **import の境界**：`MIGRATING` から #273 のファイルと、契約の型だけになった共有のファイル（`components/task/`・`lib/` の一部）を消した。
- **画面の文言**：読み込めなかったときの「読み込めませんでした」と「もう一度読み込む」、読み込み中の「読み込み中…」、追加を送っている間の「追加中…」。content.md には載っていない語で、Notice・Progress・Button の部品の文書が例に挙げている。語として決めるかはオーナーの確認を待つ。

### Sprint（計画・実行中）を契約に移す（2026-10-03、Issue #274）

`/sprint` の計画（選ぶ / 整える / 確かめる）、実行中、確定済みの読み取り専用、次の週を移した。形は上の #273 に従い、ここでは違うところだけを書く。

- **読み取りは 2 つを合わせる**：Sprint の画面は読み取りが 1 つにならない（ADR 0006「読み取り」の資源の分け方）。`Read<T>` は `useRead2`（`apps/web/src/api/read-state.ts`）で 2 つの結果を合わせ、両方が答えたときに `ready`、どちらかが失敗して見せるものがなければ `failed`（`retry` は失敗した方だけ読み直す）にする。
  - `useSprintChoice(asked)`：画面が開く Sprint とその前後。`getMe`（`sprints.next`）と `listSprints` から求める。`?sprint=` の番号があればそれ、なければ実行中 → 計画中 → Review 中 → 次の週。計画中の Sprint がないときだけ、`getMe` の次の週を最後に足す。選ぶだけで、週の名前と終了日は読み取りの値を使う（下）。
  - `usePlanning(sprintId, { applyCriterion })`：`getSprint`（`apply-criterion` は付けるときだけ `true`。外す選択でキーが変わるので、`keepPreviousData` で前の計画を残す）と `listSprintCandidates`。計画中でなくなった Sprint（確定した直後）の答えは `pending` として扱う。
  - `useRunningSprint(sprintId)`：`getSprint`。計画中の答えは `pending`。
  - 画面は `ready` でない間、`ReadStatus`（ラベルは「計画」）を出す。Sprint の一覧が読めるまでは見出し「Sprint」、開く Sprint が分かってからは、その Sprint の見出し（名前・週・期間・‹ ›）をそのまま出して計画だけを待つ（画面の見出しは読み上げ専用）。見出しが読み込みの前後で跳ばず、押した ‹ › も消えない。別の Sprint を開いたときに前の Sprint の記録を見せないよう、`Planning`・`Confirmed` は Sprint の ID を `key` にする。
- **契約の欠けを足した**：次の週（計画を始める前で、Sprint がまだない）を開くには、その週の名前（今週／来週）と終了日が要る。`getMe` の `sprints.next` は開始日と番号だけだったので、`end` と `week`（省略可）を足した（2026-10-03 司令塔の判断。週の規則をクライアントに二重に持たせない、ADR 0007）。`packages/application` の `currentSprints`、`views.yaml`、生成物、API とモックのテストを合わせた。ADR 0006 の `getMe` の項に書いてある。
- **操作のフック**：`usePickActions`（選ぶ：Task を入れる・外す、回を入れる・外す、新しい Task を足して入れる）、`usePlanActions`（整える・確かめる：行の操作、目標のリンク、目標の文）、`useAvailableHoursAction`、`useConfirmSprint`、`useRunningSprintActions`、`useBeginPlanning`。画面（`PlanningScreen`・`PlanPane`）が 1 つずつ呼び、部品へ props で渡す。行ごとにフックを呼ばない（購読が行の数だけ増える）。対象の Sprint の ID は、画面が読んだ Sprint から渡す（記録の並びから探さない）。
  - 操作が返す ID を使う：「元に戻す」は、入れたときに返った `sprintTaskIds` で外す。
  - 使える時間は欄を離れたときに保存するので、`whileSending: 'wait'`（#273 と同じ理由）。
  - 行を続けて選ぶ操作（Task の入れる・外す、回の入れる・外す、目標のリンク、目標の文）は、`wait` で送り、同じ対象の重ねた押下だけを捨てる（`useOncePerTarget`）。`drop` にすると、遅い API で別の行の選択が黙って捨てられる。`wait` だけだと、同じ行の二度押しが同じ変更を 2 回送って 2 回目が失敗する（Toast が出る）。対象は操作と ID で決める。
  - 送信中の語：追加（Quick Add）は「追加中…」、確定の Dialog のボタンは「確定中…」（DESIGN.md Components › Button の Loading）、「Sprint N の計画を始める」は「始めています…」（ボタンと同じ動詞。「開始」は今日の画面でタスクに取りかかる操作の語）。ほかの操作は、結果が Toast か行の変化で見えるので付けない。細い Backlog の欄（整える・確かめる、208px）の Quick Add には付けない（幅を保つ Button が広がり、領域の選択が「領域なし」を入れる幅を割る）。
- **部品は結果を待つ**：`GoalBlock` の `onSave` と `AvailableHoursField` の `onChange` は `boolean | Promise<boolean>` を受ける。目標の文は、保存が通ってから形を閉じる。使える時間は、通らなかったとき入力した文字を前の値に戻す。
- **描き直しを待ってから焦点を動かす**：目標を保存して形を閉じるとき、キャッシュは更新済みでも画面はまだ新しい目標を描いていない（上の #273「操作が終わっても…」）。「編集」へ戻す焦点は、形を閉じた直後ではなく、目標の文が変わるまで待つ（`GoalBlock`）。今と同じ文は保存せずに閉じる（変わらないので、待つ要求が残らない）。
- **見出しの焦点**：Sprint は一覧と計画の 2 段で読むので、読み込み中の見出しが読み終えた画面の見出しに替わるまでに 2 回作り直される。`useScreenFocus`（#275 で、見出しが作り直される画面に対応した）が、焦点がページに落ちているあいだ、今ある見出しへ何度でも移す。ほかへ移した焦点は取らない。
- **共有のもの**：`BeginPlanning` は `getMe` と `beginPlanning` に移した。Retro の画面も使うので（#276 がその画面を移す）、枠（`AppShell`）が `getMe` を先に読み、「Sprint N の計画を始める」が現れる時点で答えがあるようにした。Retro が開く Sprint は、Retro の画面を移すまで store から求める（`use-retro-choice.ts`。#276 で消す）。`useSprintSteps` は番号だけを持つ参照を受ける。
- **型**：計画と確定済みの Sprint の画面と部品は契約の型を使う。領域なしのまとまりの語は `store/screen-area.ts`（Retro の `views.ts` のものは domain の型なので別）。
- **import の境界**：`MIGRATING` から #274 のファイルと、契約の型だけになった共有のファイル（`capacity-indicator.tsx`・`criterion-text.ts`・`selection-words.ts`・`week-text.ts`）を消した。`use-retro-choice.ts` を #276 の一覧に足した。
- **画面の文言**：送信中の「確定中…」「始めています…」と、記録を読む間の見出し「Sprint」・ラベル「計画」。ほかの語は変えていない。

### 今日を契約に移す（2026-10-03、Issue #275）

Backlog（#273）の形で `/today`（今日、過去と先の日）を移した。

- **今日の日付と日の読み取り**：今日の日付はサーバーが利用者のタイムゾーンで決める（「時計」）。画面は `getMe` の `clock.today` と `sprints`（`useNow`、`apps/web/src/api/use-me.ts`）を読み、その日付で `getDay`（`useDay`、`store/use-today.ts`）を読む。URL に `?date=` がなければ今日の日付、あれば `?date=` の日付を渡す。答えの `kind` が、今日（`today`。実行中の Sprint がなければ `today` は空）か、ほかの日（`past`・`future`）かを決める。画面は日付の比較で今日かどうかを決めず、答えに従う。`useToday` は作らず、`useDay` が今日も含む（今日かどうかは画面ではなく答えの `kind` が決めるので、日付ごとに別のフックを呼び分ける必要がない）。
  - 代わりに払うもの：最初の表示は `getMe` → `getDay` の 2 つの読み取りが順に要る（契約に「今日」を指す経路がないため）。`getMe` は操作の対象の Sprint を決めるために操作のたびにも使うので、同じキャッシュを読む。
- **日を替えるとき**：`getDay` は日ごとに読み、前の日を残さない（`placeholderData` を使わない）。見出しの日付と中身の日付が食い違う間を作らないため。新しい日が読めるまでは、その日付の見出し・矢印・日付の入力と `ReadStatus`（`aria-busy`。テストはこれで読み終わりを待つ。`src/test/day-read.ts`）を出す。ほかの日の画面（`OtherDay`）と読み込み中は同じ枠（`DayFrame`）なので、読み終わっても見出しは作り直されない。今日の画面（`TodayView`）に替わるときだけ作り直され、見出しの矢印・日付の入力に置いていた焦点は `DayFocusScope` が戻す（`peek`。日が読めたら `clear` する。#90）。最初の `getMe` が読めるまでは日付が分からないので、見出しを出さない（読み込めなかったときだけ「今日」）。
  - 見出しに焦点を移す仕組み（`useScreenFocus`、#154）は、見出しがまだない画面・読み込みのあとで見出しが作り直される画面に対応する：焦点が見出しに置かれたあとで見出しが消え、焦点がページに落ちているときだけ、今ある見出しに移す。ほかへ移した焦点は取らない。Backlog（#273）も同じ形で、最初の読み込みのたびに見出しの焦点が外れていた。
- **操作のフック**：`useTodayActions` は、操作ごとに `useOperation` を呼ぶ。実行中の Sprint と今日の日付は `useRunningDay`（`getMe`）から取り、`useOnRunningDay` が、実行中の Sprint がないときに保存できなかった Toast を出して、操作の結果（`Outcome`）をそのまま返す（Backlog の今日へ・今週へ・詳細の選択の操作も同じ）。操作が作ったものの ID（今日へで入れた選択の `selectionId`、割り込みの `interruptNoteId`）は戻り値で返し、焦点と「見る」の行き先に使う（記録の並びの差分や DOM の並びから拾わない）。「かかった時間を記録」は、画面が持っている選択の記録（`row.selection`）から、`sprintTaskId`・`date`・`occurrenceId` を渡す（記録の並びから引かない）。
- **行を動かす操作と焦点**：操作は送り終わるまで画面に反映されないことがある（上の「操作が終わっても…」）。行が動く操作（完了・取り消し・見送り・今週の残りに戻すなど）は、焦点を移す先を送る前に決め、通らなかったら決める前の頼みに戻す（`follow`。送信中に押し直した分は先に返るので、先に送った分の頼みを消さない）。送ったあとにしか行が分からない今日へは、返った `selectionId` の行が描かれるまで待って移す。見送り・今週の残りに戻すの Toast と、割り込みの記録・消す Toast は、送り終わってから出す。
- **送信中**：追加（今日やるタスク）は Backlog と同じ「追加中…」。割り込みの記録・編集と、かかった時間の記録・「今日は中断する」は、送信が 300ms 続いたら保存する Button を「保存中…」にする（foundations.md の Loading の語）。Sheet は送り終わるまで閉じず、通らなかったら入力を残して開いたままにする。
- **型と共通の部品**：Today の部品は契約の型（`TodayData`・`TodayRow`・`TodayItem`・`DayData`・`InterruptNote`・`LocalDate`）を使い、`packages/domain` を import しない。日付の関数は `lib/domain-functions.ts`（`addDays`・`parseLocalDate`）。`lib/selection-words.ts` は契約の `DailyResolution` にした。`useRead` は、答えに画面で使えるものがないとき（利用者の設定がまだなく、時計がない）`view` が `undefined` を返し、`failed` になる。
- **import の境界**：`MIGRATING` から #275 のファイルと `lib/selection-words.ts` を消した。`NotOnContract` の一覧から `/today` を消した。

### 振り返りを契約に移す（2026-10-04、Issue #276）

Backlog（#273）・今日（#275）の形で `/retro` を移した。

- **開く Sprint**：`useRetroChoice`（`store/use-retro-choice.ts`）が `listSprints` を 1 本読み、URL の `?sprint=` の番号の Sprint、なければ Review の Sprint、実行中の Sprint（最終日に Retro を始める。F21）、最後に closed になった Sprint の順に選ぶ。前後の Sprint（見出しの ‹ ›）は一覧の隣。サーバーが各 Sprint の `week` を返すので、画面は選ぶだけで名前を付けない。Retro を開ける Sprint だけが対象なので、`/me` の `next`（まだ計画が始まっていない来週）は要らない。Sprint が 1 つもなければ、選んだ結果は空（`current` なし）で、画面は「振り返る Sprint はありません」を出す。
- **Retro の読み取り**：`useRetro(sprintId)` は `getSprintRetro` を Sprint の ID で読み、`Read<RetroData>` を返す。Sprint ごとに別の読み取りで、前の Sprint の答えを残さない（見出しの Sprint と中身の Sprint が食い違う間を作らない）。`retroScreenData`（`store/retro-view.ts`）が、契約の `RetroData` から画面が使う ID 引き（`areaOf`・`titleOf`・`taskTitleOf`）を作る。Retro が始まっていない（`view` が `null`）Sprint は Review か closed なら起きないので、`failed` とする。
- **読み込み中**：Sprint の見出し（番号・期間・状態・‹ ›）は選んだ Sprint から作れるので、Retro を読んでいる間も出し続ける。‹ › で Sprint を替えたときに焦点が外れず、読めたあとに見出しが作り直されない。本体の場所は「振り返り」の見出しと `ReadStatus`。外側に `aria-busy`（テストはこれで読み終わりを待つ）。段階の表示は、記録から決まる段階（URL に段階がないとき）を読むまで出さない。
- **操作のフック**：`useRetroActions({ sprintId, draftId })` は、画面に出している Sprint の ID を操作に渡す（暗黙の「Review の Sprint」を使わない）。計画のルールの下書きの ID は読み取りの `draft.criterion.id`。`useBeginRetro(sprintId)` は実行中の Sprint の Retro を始める。次の計画（`useNextPlanning`・`useBeginPlanning`）は `store/use-begin-planning.ts`（#274 と同じファイル）で、`getMe` の `sprints` から読み、始めたら作った Sprint の ID を返す。
  - 同時の扱い：印・自己判定・文章・決定は、選んだ値や書いた言葉をそのまま送るので、重ねて送った分を捨てず順に送る（`whileSending: 'wait'`）。計画のルールの下書きを作る・替える・消す操作は、画面に出ている方針から全体を作って送るので、画面が前の結果を描くまで次を送らない（捨てる）。
  - 完了の確認の Dialog は、送り終わるまで開いたままで、送信が 300ms 続いたらボタンを「完了中…」にする。通らなかったときは Dialog を閉じ、焦点は「振り返りを完了」のボタンに戻る。通ったときは、完了のボタンがなくなった場所の「Sprint N の計画を始める」へ焦点を移す。画面が新しい記録を描くのは操作の Promise が解決したあとなので、焦点は ref に頼みを置き、ボタンが描かれてから移す（「操作が終わっても…」）。かかった時間の記録（Sheet / Popover）の後も同じで、行のボタンがなくなってから行の「振り返りに使う」へ戻す。
  - 「次に試すこと」は、欄を離れたときと「次に試すことを確定」が続けて起きても同じ言葉を 2 回送らない（送っている間は同じ結果を待つ）。
- **型**：Retro の部品は契約の型（`RetroData`・`RetroCriterion`・`TaskFact`・`RetroPin` など）を使い、`packages/domain` を import しない。`lib/criterion-text.ts` と `lib/week-text.ts` も契約の型にした。
- **画面の文言**：読み込めなかったときの文言は #273 と同じ。読み込み中の見出しは「振り返り」（ナビの語）、`ReadStatus` のラベルは、Sprint の一覧を読む間が「Sprint の一覧」、Retro を読む間が「この Sprint の記録」（見出しと同じ語を続けない。今日の「この日の記録」と同じ型）。送信中の「完了中…」（完了の確認のボタン）と「始めています…」（振り返りを始める。Sprint N の計画を始めるのボタンと同じ語）を足した。これらは content.md には載っていない語（語として決めるかはオーナーの確認を待つ）。
- **import の境界**：`MIGRATING` から #276 のファイルを消し、使われなくなった `store/views.ts` を消した。#274 と #276 が入って、移していない画面はなくなった。`NotOnContract`（`MOVES` は空）は #277 で消す。`server-data.test.tsx` の検査は移していない画面に頼らない形に直した。
- **API での確認**：画面の送受信はブラウザ内モックの上で `retro-api.test.tsx` が確かめる。Retro の API（#270）は統合ブランチに入っているが、`wrangler dev` への接続での手操作の確認は、この Issue の実装では行っていない（司令塔が行う）。

### サインインと設定（2026-10-03、Issue #278）

Better Auth（ADR 0004「認証の構成」）の API を使う、Web のサインインの画面と設定の画面。パスキーの追加とサインアウトの置き場所は、2026-10-03 のオーナー決定（Issue #278 のコメント）で設定の画面（`/settings`）の「アカウント」の欄にした。初めは「アカウント」の画面（`/account`）としたが、rail の 55px の項目に「アカウント」（12px で約 59px）が収まらないため、同じ日のオーナー決定で「設定」に改めた。利用者の設定（週の始まりなど）も、あとでこの画面の欄として置ける。入口は DESIGN.md の Navigation「設定の入口」。

#### 依存と版

| 対象 | 採用 | 版 | 置き場所 |
| --- | --- | --- | --- |
| 認証のクライアント | `better-auth`（`better-auth/client`） | 1.7.6 | `apps/web` の dependencies。サーバーと同じ版（ADR 0004「導入した依存と版」） |
| パスキーのクライアント | `@better-auth/passkey`（`/client`） | 1.7.6 | `apps/web` の dependencies。サーバーと同じ版 |
| `better-call` の任意の peer | `zod` | 4.6.5 | `apps/web` の devDependencies。画面のコードは使わない |

- `zod` を足す理由：`better-auth` が使う `better-call` は `zod` を任意の peer に持つ。`apps/web` では shadcn（CLI）が持ち込む zod 3 がその peer に解決され、pnpm が `better-auth` の 1 つの実体を `services/api` と共有するため（`dedupePeerDependents`）、API の `better-auth` まで zod 3 の組み合わせに移った（2026-10-03 に lockfile で確かめた）。`apps/web` に zod 4.6.5 を置くと peer がそれに解決され、`services/api` の解決は変わらない。pnpm の `overrides` は peer の解決を変えなかった（範囲だけが変わり、警告が残る）。同じ lockfile の変更で、`eslint-plugin-react-hooks` の依存の zod も 3.25.76 から 4.6.5 に寄った（その範囲が両方を許すため）。`better-auth` を外すか、shadcn が zod 4 に移ったら、この devDependency を外せるか確かめる。
- 使い方は 2026-10-03 に Context7（Better Auth の client、passkey プラグイン、`sessionOptions`）と、固定した 1.7.6 のコード（`@better-auth/passkey/client` の `signIn.passkey`・`passkey.addPasskey` の戻り値、OAuth のコールバックが `errorCallbackURL` に `error` を足す処理）で確かめた。

#### 境界

- 画面は `apps/web/src/auth/auth.ts` の `Auth`（セッション、Google とパスキーでのサインイン、パスキーの一覧と追加、サインアウト）だけを使い、`useAuth()` で受け取る。データの出どころが実装を選ぶ：API では `src/auth/better-auth.ts`（Better Auth のクライアント。同じ origin の `/api/auth`）、開発のモックでは `src/mock/mock-auth.ts`。
- `better-auth`・`@better-auth/*` を import してよいのは `src/auth/better-auth.ts` だけ（ESLint の `no-restricted-imports`。`services/api` の `src/auth/better-auth.ts` と同じ形）。画面の domain と application の 2 つの規則に入れたので、両方の外にあるファイル（モック、テスト、両方を移行中のファイル）は検査されない。
- 戻り先とサインインの入口（`SIGN_IN_PATH`・`signInHref`・`returnPath`・`sendToSignIn`）は `src/auth/sign-in.ts` に置く（#272 では `src/app/sign-in.ts`）。依存の向きを app → screens → auth の一方にするため。
- Better Auth の React の hook（`useSession` など）と、クライアントのセッションの自動の取り直しは使わない。延長の呼び方を下の 1 か所で決め、テストで確かめるため。

#### 画面と経路

- `/sign-in`（`?redirect=<元の画面>`、Google が失敗して戻ったときは `&error=<code>`）。アプリの枠（ナビ）の外に出す。枠の中の画面は読み取りをするので、セッションのない画面に置くと 401 をくり返すため。経路は平らなまま（各画面の `getRouteApi('/today')` などの ID を変えない）、`root-layout.tsx` がパスで枠を付けるかを決める。
- 戻り先（`returnPath`）は、アプリの中のパス（`/` で始まり、別の origin にならず、サインインの画面と `/api` でない。比べるときは大文字小文字と末尾の `/` を無視する）だけを受け、ほかは今日を開く。URL から来る値なので、外のサイトへ送らない。URL の解析は `.` と `..` を消すので（`/.//host` が `//host` になる）、解析した後のパスも確かめ、`//` で始まる・`\` を含む・`%2F` か `%5C` を含むものは断る（Better Auth 1.7.6 の相対の `callbackURL` の検査と同じ条件）。
- Google：`signIn.social` に `callbackURL`（戻り先）と `errorCallbackURL`（`/sign-in?redirect=<戻り先>`）を渡す。失敗の文言は `error` の code だけで分ける（`access_denied`：取り消した。`SIGN_UP_NOT_ALLOWED`：許可の一覧にない。ほか：失敗）。`error_description` は使わない（ADR 0004）。
- パスキー：プロンプトを閉じた・時間切れ（`AUTH_CANCELLED`、`ERROR_CEREMONY_ABORTED`、`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`）は何も言わない。追加では、追加済み（`ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`）と、サインインが古い（`SESSION_NOT_FRESH`。Better Auth の fresh session は 1 日）を分け、後者はもう一度サインインする入口を出す。ほかは失敗。
- サインインした後とサインアウトした後は `QueryClient` を空にする。前の人の記録と、401 で失敗した取得を残さない。設定の画面の操作は `useMutation` にしない（`MutationCache` が成功のたびに契約の読み取りをすべて読み直し、サインアウトの直後に 401 で別の遷移が起きるため）。

#### セッションの延長

- セッションは 1 つのクエリ（`src/auth/session-query.ts`）として取る。延長はそのクエリを取り直し（`fetchQuery`）、設定の画面は同じクエリを読む。`/api/auth/get-session` を呼ぶ場所を 1 つにするため。
- `src/auth/session-refresh.ts`：枠の中の画面を開いたとき、画面が隠れてから 1 時間以上たって戻ってきたとき（`visibilitychange`）、表示している間は 1 時間ごとに `getSession`（`/api/auth/get-session`）を呼ぶ。ADR 0004 の延長は 1 日を過ぎたセッションで起きるので、1 時間おきなら開いている日には延びる。セッションがなければサインインの画面へ送る。サーバーや通信の失敗は捨て、次の呼び出しに任せる。

#### ブラウザ内モック

- モックの認証はサインイン済みで始まり、パスキーを 1 つ持つ。サインアウトすると、モックの API はすべての要求に 401（`unauthenticated`）を返す。パスキーでのサインインはすぐに通る。Google は戻り先をそのまま開く。再読み込みで最初に戻る（記録と同じく保存しない）。
- 401 でサインインの画面へ送られ、サインインの後に元の画面に戻ることを、このモックで確かめる（`sign-in-flow.test.tsx`）。モックにない結果（サインインが古い、失敗）は、偽の `Auth` で画面を描いて確かめる（`src/test/render-with-auth.tsx`）。API の側の流れ（セッションの延長、Google の開始と失敗の戻り）は、`fetch` を差し替えて確かめる（`server-data.test.tsx`）。

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
