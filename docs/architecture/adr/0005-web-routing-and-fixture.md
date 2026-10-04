# ADR 0005: Web のルーティングと fixture の置き場所

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #38、後続 Issue #39〜#42
- 改訂：2026-09-27（API への移行と状態の置き場所を追記）、2026-09-28（クライアントとデータの方式を追記）、2026-09-30（Sprint を番号で、日を日付で開く検索パラメータ、Issue #90）、2026-10-03（アプリケーション層、プレビューの例外、#45 の分け方、システムの記録、時計、本番ビルドの fixture。Issue #262）、2026-10-03（プレビューの共通のテストケースを仕様ケースと生成ケースに分ける。読み取りの結果と DTO の関係。ADR 0007）、2026-10-03（Web のクライアントとブラウザ内モック。Issue #272）、2026-10-03（何日も開かなかったときのシステムの記録。Issue #271）、2026-10-03（Backlog・Task の詳細・領域を契約に移す。Issue #273）、2026-10-03（サインインと設定。Issue #278）、2026-10-04（最初の設定と空の状態。Issue #279）、2026-10-04（`RecordStore` と `Change` の片づけ、import の境界の最終の形。Issue #277）、2026-10-04（失敗を Problem Details の `type` で分ける。Issue #319）、2026-10-04（書き込みを冪等キーで送り直し、409 を「保存できませんでした」に、保存できたか分からない失敗の Toast に「もう一度保存」。Issue #320）、2026-10-04（値を置き換える書き込みに記録の版を付け、412 を「ほかの端末で変わっていました」で知らせる。編集できる欄が版を覚える。Issue #321）、2026-10-04（操作の可否を読み取りの `capabilities` から出す。プレビューの例外のモジュールから `presentedSuggestion` を外す。Issue #322・#323）、2026-10-04（繰り返しの編集が規則の版を送る。Issue #330）、2026-10-04（編集できる欄が保存の終わりを記録の版で判断する。Issue #343）

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

- 状態は PRD §12 の 12 個：選ぶ / 整える / 確かめる、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence。このほかに、使い始めたばかりの人の 2 つ（`empty`：記録なし、`before-settings`：記録なしで設定の前。Issue #279。下の「最初の設定と空の状態」）。
- 状態はルートの検索パラメータ `fixture` で選ぶ（例：`/today?fixture=today-morning`）。`retainSearchParams` で、画面を移っても保つ。ないときは「日中」（`today-daytime`）。`sprint` と `date` は `retainSearchParams` に入れない。ナビから開けば今の Sprint と今日に戻り、画面を移っても前に選んだ Sprint と日を持ち越さない（Issue #90）。
- 開発用メニューは画面の右下に出し、状態を選ぶとその状態の画面を開く。開発用メニューと URL での切り替えは、ブラウザ内モックを使う開発のときだけ動く。本番ビルドと API を使う開発（`--mode api`）には fixture がなく、`fixture` の検索パラメータは捨てる（#272。下の「Web のクライアントとブラウザ内モック」）。
- fixture は、`packages/domain` のコマンドを 1 本の時系列（9/13〜10/5）で実行して作り、途中の記録をスナップショットとして取る（`packages/application/src/fixtures/timeline.ts`。#264 で `apps/web` から移した）。記録を手で書かないので、どの状態もドメインが作りうる記録だけになり、不変条件はコマンドが守る。ドメインモデルの Scenario A〜C を 1 人の利用者の 1 本の時系列に並べ直している。
- 状態ごとに時計（「今日」の LocalDate と現在時刻の Instant）を持つ。画面とコマンドはこの時計を使い、ブラウザの時計を読まない。

### 記録のストア

fixture の段階（#38〜#42）では、画面が `RecordStore` と `Change` でメモリ上の記録を直接変えた。画面を契約に移した（#273〜#276）あと、`apps/web` にストアはない（#277）。残っているのは次のとおり。

- 記録と派生値は API（OpenAPI の契約）から得る。クライアントでの取得結果のキャッシュは TanStack Query が持つ。
- `RecordStore`（`getSnapshot`・`subscribe`・`run`）と `createMemoryStore` は `packages/application` にあり、使うのはブラウザ内モック（`apps/web/src/mock/`）と各パッケージのテストだけ。モックは fixture の状態をメモリ上のストアに開き、リロードすると fixture に戻る。永続化しない。画面と画面のフックは `RecordStore`・`Change`・`Records` を参照しない。
- 変更は `packages/application` の `operations`（利用者の 1 操作を domain のコマンドの組み合わせで行う関数）として、API のハンドラーとモックが実行する。成功したら記録を差し替えて Activity を追記し、失敗したら何も変えずに domain のエラーを返す。ID はストアが作って文脈で渡す（domain は ID を作らない）。
- 契約の読み取りを画面の形にするフック、画面の操作のフック（`useOperation` から作る）、画面が使う値の変換は `apps/web/src/screen-data/` にある。置き場所の規則は「RecordStore と Change の片づけ」の節。
- クライアントの UI 状態を持つストア（Zustand など）は置かない。状態の置き場所は後の「状態の置き場所」のとおり。

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
- システムの記録（actor = システム。終了日を過ぎた Sprint を Review にする、その日の始まり）は、利用者の操作ではない。fixture の段階ではアプリの外枠の `useSystemDay` が実行した（#54）。API への移行後は、クライアントの operation にせず、サーバー側（読み取りの前や日次の処理）で行う。ブラウザ内モックは、読み取りと操作の前に同じ処理（`catchUp`）を行う。

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
  - ブラウザ内モック（#272）の追いつきも同じ `catchUp` を使う。fixture の状態の時計は動かないので、前に追いついた日は渡さず、その日だけを進める。画面の外枠の `useSystemDay` は #277 で消した。
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
  - 操作の Promise が解決するときには、画面の部品も新しい答えを受け取っている（#341）。TanStack Query は答えをキャッシュに入れた後で部品に知らせる（`notifyManager`。既定では `setTimeout` の次のタスク）ので、`readAgain` が答えを見た時点で解決すると、部品が前の答えのまま操作の続き（`useDraftField` の `hold` の終わりなど）が動く。続けて選んだ繰り返しの曜日の欄が、前の保存の読み取りを最後の保存のものと取り違えて選んだ曜日を外し、その間に次の曜日を選ぶと外れた曜日が保存されなかった。`readAgain` は最後の答えを見たら、部品への知らせの後ろに解決を並べる（`notifyManager.schedule`）。部品への知らせは `queueMicrotask` にする（`notifyManager.setScheduler`。`query-client.ts` のモジュールで 1 度。ページのすべての `QueryClient` に効く。TanStack Query v5 の文書が挙げる設定の 1 つ）：既定（`setTimeout`）のままだと、すべての操作の結果（Toast・焦点）が知らせのためにタスク 1 つ遅れる。利用者には分からない差。画面のテストはこれに頼らない：#401 で、操作の直後に画面を確かめていたテストを、確かめるものが出るまで待つ形に直し、既定の知らせ方でも通ることを確かめた（下の「操作の後の焦点と、画面のテストの待ち方」）。`reads.test.ts` が、既定の知らせ方でも `readAgain` が知らせの後に解決することを確かめる。ただし、読み取りの最初の 1 回が失敗したとき（再試行の待ちの間に次の操作が来て取り直しが取り消されたときを含む）は、上のとおり待たずに解決するので、部品は前の答えのままのことがある。このときも、編集できる欄は保存の終わりを記録の版で判断するので、前の保存の読み取りを最後の保存のものと取り違えない（#343。「編集できる欄の状態」）。
  - 代わりに払うもの：操作のたびに表示中の読み取りを 1 回ずつ取り直す。表示中の読み取りは 1 画面で 1〜3 個で、利用者は 1 人。
  - 見直す条件：取り直しが遅いと分かったとき（読み取りの時間は ADR 0004 の Workers Logs で見る）。
- 楽観的更新はしない（PRD §14）。

#### エラーと送信中

- 失敗は応答の Problem Details（RFC 9457。ADR 0006「エラー」）の `type` だけで分ける（`apps/web/src/api/failure.ts`）：`/problems/unauthenticated`（401）、`/problems/revision-conflict`（409）、受け付けられない（400・403・404・413・422。利用者の設定がまだない `/problems/user-not-set-up` もここ。設定を作る画面は「最初の設定」。#279。冪等キーを別の要求に使った `/problems/idempotency-key-reused` もここ。#320）、それ以外（500、通信の失敗、知らない `type`。ADR 0006「互換の規則」）。`title`・`detail`・`errors` は画面に出さない。書き込みの失敗は、生成したクライアントの誤りと HTTP のステータス（応答がなければなし）を `WriteFailed` に包んで投げる（送り直すかの判断にステータスが要るため。#320）。
  - エラーの `type` は開いた列挙（ADR 0006「列挙」）。生成した型は `type` をエラーごとの閉じた値で書いているが、Web は応答を実行時に検証しない（生成した SDK に応答の検証はない）。`failureOf` は失敗を `unknown` として受け、`type` を文字列として読むので、知らない `type`・知らない HTTP のステータス・JSON でない本文（契約 0.2 までの `{ code, message }` も）でも読み込みは失敗せず、一般の失敗になる（`failure.test.ts`）。Web が応答を実行時に検証するようにするなら、その前に開いた列挙の仕様での書き方を決める（ADR 0006）。
  - ブラウザ内モックのエラーも同じ形（`application/problem+json`）で、本文は API と同じ `@itera/api-contract/problems` で作る（#319）。
- 書き込みは冪等キーで送り直す（Issue #320。ADR 0006「冪等キー」）。`useSend`（`useOperation` と最初の設定の `useSetSettings`）は、`run` のたびに `crypto.randomUUID()` で新しいキーを作り、その `run` の送り直しでは同じキーを使う。通信の失敗（応答がない）と 5xx は、同じキーで自動で 2 回まで送り直す（間隔は 500ms・1000ms。`SEND_AGAIN_DELAYS`。TanStack Query の mutation の `retry`。2026-10-04 司令塔の判断で、オーナーの確認を待つ）。4xx と 409 は送り直さない（API が答えたので同じ答えになるか、読み直した記録では操作の意味が変わっていることがある。ADR 0004「同時の書き込み」）。知らない `type` の 4xx も送り直さない。#272 の「操作は自動で送り直さない」を、この範囲で改めた（RFC 9110 §9.2.2 は、冪等だと知る手段があれば冪等でないメソッドの送り直しを妨げない）。送り直しの間も送信中のまま（`pending`）で、読み直しは最後の試みの後に 1 回だけ。書き込みの mutation は `networkMode: 'always'` にする：TanStack Query の既定（`online`）では、ブラウザがオフラインと言う間やタブが表示されていない間に送り直しが止まり、`run` も、同じ scope の後ろの操作も、戻るまで待ち続ける。`always` なら、送り直しは決まった回数で終わり、Toast の「もう一度保存」で利用者が送り直せる（#320）。
- 操作が失敗したら、失敗が記録について言えることで danger の Toast を分ける（2026-10-03 オーナー決定、Issue #272。文言は `src/api/save-failed.ts` の 1 か所にまとめる）。
  - 保存していない（受け付けられない：400・403・404・413・422、ほかの書き込みが先に入った：409）：「保存できませんでした」「記録は変わっていません。内容を確かめてもう一度試してください。」。読み直してから出す（2026-10-03 司令塔の判断、#295。送った日付や実行中の Sprint が古かったときに、画面を今の記録に戻すため。ADR 0006「エラー」。それまでは読み直さなかった）。409 は #320 で、「この書き込みはしていない」だけになったので、ここに移した（2026-10-04 司令塔の判断で、オーナーの確認を待つ。それまでは、応答が失われただけで保存は済んでいることがあったので、下の「保存できたか分からない」に入れていた）。「もう一度保存」は付けない：同じ要求は同じ理由で断られ、409 は読み直した記録で操作の意味が変わりうるため。
  - 保存できたか分からない（同じキーでの送り直しを使い切った 500・通信の失敗、送り直さない知らない `type`・ステータス・JSON でない本文）：サーバーが書いた後に失敗したかもしれないので、「記録は変わっていません」とは言わない。すべての読み取りを読み直してから（成功のときと同じく最初の答えまで）、「保存できたかわかりませんでした」「記録が変わったかもしれません。最新の記録を見てください。」を出す（#313）。Toast には Quiet の「もう一度保存」を付け、押すと同じキーで同じ書き込みをもう一度送る（同じ自動の送り直しを含む。保存済みなら API は保存した応答を返すので、2 回効かない）。押すと Toast は閉じ、また失敗すれば同じ分け方で Toast を出す。通ったときは読み直すだけで、Toast は出さない（`run` はすでに `{ ok: false }` を返しているので、画面の焦点は動かさず、元に戻すなどの成功の Toast も出さない）。DESIGN.md の Toast の danger と Task Row の Error、content.md の「保存の失敗」と同じ規則（2026-10-04 司令塔の判断、#320。語は「再試行」でなく「もう一度保存」）。
    - その後にどれかの書き込みが通ったら、「もう一度保存」の付いた Toast を閉じる（`useCloseStaleToast`。2026-10-04 司令塔の判断、#320）。記録は読み直してあり、古い要求を送り直すと意味が変わりうる（1 回目が保存されていなければ、後に保存した新しい値を古い値で上書きする。409 を送り直さないのと同じ理由）。「保存できませんでした」（操作なし）は残す。
    - 保存の失敗の Toast は同じ種類（`save-failed`）なので、DESIGN.md の Toast のとおり最新の 1 つに置き換わる。次の書き込みも失敗すれば、前の書き込みの「もう一度保存」は消える。前の書き込みは、読み直した記録で確かめる（書き込みごとに Toast を分けると、失敗が続いたときに Toast が積み重なるため）。
    - 押すまでの時間に上限はない。キーの期限（24 時間）を過ぎてから押すと、新しい書き込みとして実行される（1 回目が保存されていれば 2 回効く）。Toast は画面を移っても残るが、24 時間開いたままにすることは稀なので、今は外さない。
  - ほかの端末で変わっていた（412 `/problems/precondition-failed`。`failureOf` の `stale`、#321）：保存していない。読み直してから、理由を見出しで言う Toast（content.md「保存の失敗」）「ほかの端末で変わっていました」を出す（danger）。打った値を欄に残す操作（`useOperation` の `typed`：Task の題名・説明・期限・見積もり、目標の文、振り返りの 2 つの文、割り込みの編集、領域の名前）は「書いた内容は、まだ保存していません。保存すると、ほかの端末の変更を上書きします。」、ほかは「保存していません。最新の記録を見て、もう一度試してください。」。打った値は部品の state にしかなく、画面を移ると消えるので、「残っています」とは言わない（#321 の visual と copy のレビュー）。Task の詳細の選択（領域・優先度・計画の時間）は、同じ `saveTask` でも `typed` にしない別の `useOperation`（`chooseForTask`）で送る。繰り返しの選択（頻度・曜日・日。#330）も `typed` にしない。「もう一度保存」は付けない（同じ要求は同じ版で断られる）。サブタスクの見積もりと使える時間の欄は、失敗で読み取りの値に戻る（#324 からの振る舞い）ので、`typed` にしない。428 は Web の誤り（版を付け忘れた）なので「保存できませんでした」。
  - 打った値を欄に残す操作（`typed`）の失敗は、欄でも示す（#332）。`useDraftField` の `saveFailed` は、最後の保存が失敗して打った値を返し、読み直した記録がその値でない間 true になり、Field・DurationField の `saveFailed` で、欄を Error（`aria-invalid` と「まだ保存していません」）にする。また打つ・保存し直す・`drop` で消える。欄が失敗を示し続けるので、その失敗の Toast（理由を言う）は、同じ `useOperation` の後の書き込みが通ったら閉じる（Toast に `closedBySaveOf` として `useSend` の ID を持たせ、`useCloseStaleToast` が閉じる）。ほかの操作の書き込みでは閉じない（その欄はまだ保存していない）。Task の詳細のように 1 つの操作が複数の欄を保存するときは、どの欄の保存し直しでも閉じる（残る欄は Error のまま）。保存に失敗した欄は、Toast に隠れないよう最小限スクロールする（`scrollClearOfToasts`。欄が出たときと、Toast が出たとき）。
    - 保存に失敗した内容は部品の state にしかなく、画面を移ると消える。そこで、保存に失敗してから記録に入るまで（また打っている間・保存し直している間も）の欄を `useDraftField` の `unsaved` とし、アプリの数（`lib/unsaved-typing.tsx`。`SignedIn` が持つ）に入れる。最後の保存が通れば、読み取りが変わらなくても（ほかの端末と同じ文を保存した）数から外す。数があるうちは、TanStack Router の `useBlocker`（`app/leave-guard.tsx` の `takesAway`）が、欄の消える移動を止めて AlertDialog「保存せずに移りますか？」「キャンセル」「保存せずに移る」を出し、タブを閉じる・再読み込みはブラウザの確認（`beforeunload`）を出す。欄の消える移動は、経路が変わる、または search のキーが変わる移動。ただし、画面の上に重ねて開く層のキー（Task の詳細の `task`。`UnsavedTypingLayer` の中の欄は数に層のキーを添える）は、その層の中に数えた欄があるときだけ数える（画面の目標の欄が保存できないまま Task の詳細を開く・閉じるのは止めない）。サインインへの移動は止めない（セッションがなく保存できない）。確かめている間に保存し直しが通って数がなくなれば、そのまま移る。Task の詳細は、閉じる・別の行を開く前に Drawer の Notice で同じことを聞き（DESIGN.md の Drawer。繰り返しの選択は「繰り返しの変更がまだ保存されていません」）、「保存せずに閉じる」で欄の内容と繰り返しの選択を捨ててから移るので、二重には聞かない（`drop` はすぐに数から外す）。2026-10-04 司令塔の判断（オーナーの返事がない間の既定。端末に下書きとして残す案、上部の文を出し分ける案と比べた。Issue #332 のコメント）。
  - 未認証（401）は Toast を出さず、下のサインインの入口へ送る。
  - 分け方は `use-operation.test.tsx` の「a failed operation」が、`type`・ステータスごとに Toast と読み直しの有無で確かめる。
- 未認証（401）は、読み取りでも操作でも、サインインの画面へ送る（`apps/web/src/auth/sign-in.ts`。`/sign-in?redirect=<元の画面>`、履歴は置き換える）。Toast は出さない。画面と戻り先の扱いは下の「サインインと設定」（#278）。
- 読み取りは、サーバーと通信の失敗（500 など）と版の衝突のときだけ 1 回まで取り直す。受け付けられない要求と未認証は取り直さない。操作は、上の冪等キーでの送り直しだけをする。
- 値を置き換える操作（契約の PATCH と規則の PUT。`@itera/api-contract/requests` の `ConditionalName`）は、`run(<入力>, <読んだ記録>)` と、記録をどの版から変えるか（`MadeFrom`：読み取りの `etag`、まだない目標と規則のない Task は `{ none: true }`）を渡さないと型の検査で失敗する（ADR 0006「記録ごとの版」、#321）。`useOperation` が `If-Match`（`If-None-Match: *`）を付ける。通ったら応答の `ETag` を、その資源（経路）の「自分の書き込みで進んだ版」として覚え（`ownVersions`。クライアントごと）、同じ版から作った次の書き込みは進んだ版で送る。`ETag` のない成功は記録を消した書き込み（目標を空にした）で、その後は「記録なし」（`If-None-Match: *`）から作る（目標を作って消してまた作るとき、自分の書き込みで 412 にならないように）。規則は外す書き込みが同じ経路の DELETE（`endRecurrence`。条件を送らない）なので、DELETE が通ったらその資源の覚えた版をすべて捨て、次の「記録なし」からの書き込みは `If-None-Match: *` で送る（規則を作ってやめてまた作るとき、#330。資源の鍵をメソッドを含まない経路にしたのは、PUT と DELETE が同じ資源の版を分けるため）。同じ形の 2 つの欄を続けて保存するとき、1 つ目の保存の読み直しを待たずに 2 つ目を送るので、そうしないと 2 つ目が自分の書き込みで 412 になる。ほかの端末の変更では進めない（それを 412 で知るため）。送り直し（冪等キー）は同じ版で送る。
- 操作は `useOperation('<操作の名前>')` と `run(<入力>)`（`apps/web/src/api/use-operation.ts`）で呼ぶ。名前と入力は `packages/application` の操作のもので、HTTP のメソッドと経路への載せ方は `@itera/api-contract/requests` が決める（ADR 0006「経路の形」、#295。2026-10-03 改訂。それまでは生成した mutation の options を渡していた）。送信中は同じ操作を重ねて送らない（押し直しは送らずに失敗として返す。自動の送り直しの間も送信中）。`pending`（送信中。操作を受け付けない）と `loading`（送信中が 300ms 続いた。DESIGN.md の Spinner のとおり、Button・IconButton の `loading` でスピナーと文言を出す）を返す。送信中の見た目は DESIGN.md Components › Button・IconButton と docs/design/foundations.md の Loading に従い、各画面の Issue で付ける。

#### ブラウザ内モック

- `apps/web/src/mock/`：`createMock(store)` が、契約の要求（`Request`）を受けて `packages/application` の読み取りと操作を `RecordStore` の上で実行し、API と同じ形の応答（読み取りは `{ clock, view }`、操作は値か 204、エラーは ADR 0006 の status と Problem Details）を返す。クライアントの `fetch` として渡す（Service Worker は使わない）。
- 記録の版（#321）：ストア（`createMemoryStore`）が変更のたびに自分の版を上げ、値の変わった記録の版をその値にする（`packages/application` の `nextVersions`。位置だけの変化では上げない。API の行の版と同じ規則）。読み取りは `tagRecords` で etag を付け、値を置き換える書き込みは API と同じく `checkCondition` で 412・428 にし、`ETag` を返す。fixture の記録は版 0。
- `getMe`（利用者と設定）は、API と同じく追いつきなしで、fixture の利用者の設定を返す。ほかの読み取りと操作の処理の順は API と同じ（ADR 0004「操作と読み取りの処理」）：入力を契約の Valibot のスキーマで確かめる（query の数と真偽は型に変えてから）→ システムの記録をその時点まで進める（終了日を過ぎた Sprint を Review にし、その日を始める。#271 と同じ処理）→ 読み取りか操作。利用者は設定のある者として扱い、サインインはモックの認証に従う（サインアウトした後はすべての要求に 401。下の「サインインと設定」）。Origin・版の衝突・本文の大きさの上限・冪等キー（#320）は確かめない。日付が暦の上で実在するかは、`getDay` のパスだけで確かめる（画面は実在しない日付を送らない）。
- ID は `packages/application` の `createIdSource`（TypeID）で作る。時計は fixture の状態ごとの時計（上の「時計」）。
- 移行の途中の一致（#277 で終わり）：モックと、まだ移していない画面が同じ `RecordStore` を使い、画面の変更でモックの読み取りを無効にしていた（`createMock` の `subscribeToScreens`）。全画面を契約に移したので、`subscribeToScreens` を消した。
- `packages/application` の `beginDay` は、その日がもう始まっていれば何も書かない（変更も Activity もない）ように改めた。前は実行中の Sprint を毎回書き直しており、要求のたびにシステムの記録を進めるモックでは、記録の差し替えと読み直しが止まらなかった。API（#271）でも書く行がなくなる。

#### 本番ビルド

- モックは `import.meta.env.DEV` が真で `--mode api` でないときだけ `import()` する（`apps/web/src/app/data-source.ts`。条件はここに 1 つだけ書き、ルーターなどはその結果を使う）。本番ビルドではこの分岐が消え、モックと fixture のチャンクが出力に入らない。条件をほかのモジュールの定数にして参照すると、Vite（Rolldown）は分岐を消さずチャンクが残る（2026-10-03 に確かめた。下の検査が捕まえる）ので、条件は `import()` の隣に直接書く。
- `pnpm build`（`apps/web` の `vite build && node scripts/check-build.mjs`）が、出力にモックの応答のヘッダー名と fixture の状態の ID がないことを確かめる。あれば失敗する（CI と CD も同じコマンド）。
- 移行の途中、まだ移していない画面は、本番ビルドと `--mode api` では開発者向けの短い表示（`NotOnContract`）を出した（2026-10-03 オーナー決定、Issue #272 のコメント）。#277 で、`NotOnContract` と `NotOnContractError` を消した。

#### import の境界

- `eslint.config.js`：`apps/web` のうち `packages/domain` を import してよいのは `src/lib/domain-functions.ts`（上の「プレビューの例外」の関数をまとめたモジュール）とモックだけ、`packages/application` はモックだけ。型だけの import も同じ。2 つを別の規則（`no-restricted-imports` と `@typescript-eslint/no-restricted-imports`）にして、片方の設定がもう片方を上書きしないようにしている。
- テスト（`*.test.*`、`src/test/`）は対象外：fixture の記録を開き、記録の ID で画面を指すため。
- 移行の途中は、まだ移していないファイルを例外の一覧（`MIGRATING`）にファイル名で並べた。#277 で一覧を空にして仕組みごと消した。例外はテストとモックと `domain-functions.ts` だけで（Better Auth のモジュールも両パッケージは import できない）、ここに挙げたもの以外が `@itera/domain` または `@itera/application` を import すると ESLint が失敗する。

### Backlog・Task の詳細・領域を契約に移す（2026-10-03、Issue #273）

最初に移した画面。ほかの画面（#274〜#276）は、ここで決めた形で移す。

- **読み取りのフック**：`useBacklog`・`useAreas` は、生成した options（`getBacklogOptions`・`listAreasOptions`）を `useQuery` で読み、`Read<T>`（`apps/web/src/api/read-state.ts`）を返す。`status` が `pending`（まだ答えがない）、`failed`（読めなかった。`retry` を持つ）、`ready`（画面のデータを持つ）のどれかで、画面は `ready` でない間、記録の場所を空白にせず `ReadStatus`（`components/read-status.tsx`）を出す。`ready` になったデータは、読み直しが失敗しても残る（最後に読めたものを見せる）。絞り込みを変えたときは、新しい答えが来るまで前の答えを残す（`placeholderData: keepPreviousData`。TanStack Query v5 の文書で確かめた）。
  - `ReadStatus` は、`pending` が 300ms 続いたら線（不透明度だけが動く Progress）と「読み込み中…」を出し、それより早く終われば何も出さない（DESIGN.md の Loading）。`failed` は danger の Notice「読み込めませんでした」と「もう一度読み込む」。
  - 別の画面が `useBacklog` の答え（Task の詳細を開くための `item` など）を使うときは、`status === 'ready'` を確かめてから使う。
  - 今日・計画・実行中の Sprint の Task の詳細は、`TaskDetailDrawer`（`screens/backlog/task-detail-drawer.tsx`）で開く。`?task=` があれば、Backlog が `ready` でない間も Drawer を開き、中に `ReadStatus`（`failed` は「もう一度読み込む」で Backlog の読み取りだけを読み直す）を出す。読み上げ名は、Task が来るまで「タスクの詳細」、来てからは Task の題名（TaskDetail の見出し）。待っていた間の焦点は、来たときに詳細の見出しへ移す。`ready` で Task が Backlog にない（完了・アーカイブ済み）ときは Drawer を開かない（Issue #355）。
- **操作のフック**：`useTaskActions`・`useSubtaskActions`・`useRecurrenceActions`・`useAreaActions` は、操作ごとに `useOperation` を呼び、操作ごとの名前つき関数を返す（1 つのフックが全部の操作の購読を作らないよう、使う部品ごとに分けた）。関数は非同期で、成功したかを `boolean` で（作ったものの ID は `string | undefined`、`setRecurrence` と `endRecurrence` は `{ ok, … }` で）返す。成功したときは、表示中の読み取りが戻ってから解決する。送信中に同じ操作を重ねて送らない。ただし、欄を離れたときや選んだときに保存する操作（Task の各欄の保存、サブタスクのチェックと見積もり、繰り返しの設定）は、重ねて送った分を捨てずに、前の分が終わってから順に送る（`useOperation` の `whileSending: 'wait'`）。捨てると、続けて変えた 2 つ目が黙って保存されない。`loading`（操作ごとの、300ms 続いた送信中）は、その操作のボタンの `loading` と `loadingLabel`（「追加中…」）に渡す。今回は追加（Quick Add、サブタスク、領域）のボタンに付けた。ほかの操作は、結果が Toast か行の変化で見えるので、送信中の見た目を付けない。
- **操作は重ならない**：`useOperation` の操作は、どのフックから送っても同じ mutation の scope（`operations`）に入り、1 つずつ送られる（TanStack Query v5 の `scope`。文書で確かめた）。API は版を確かめて書くので（ADR 0004 同時の書き込み）、重なると片方が版の衝突になる。
- **操作が終わっても、画面はまだ新しい記録を描いていないことがある**（#341 まで）：キャッシュは更新済みでも、購読者への通知は次のタスクで届いた。#341 から、操作は部品への知らせの後に解決する（上の「操作が成功したら、すべての読み取りを無効にする」）。操作の結果に合わせて表示や焦点を動かす処理は、操作の前に頼みを置いておくか、記録が変わるのを待つ。Task の詳細の「今日と今週」は、押したときの選択肢の並びを覚えておき、並びが変わったときに焦点を動かす。
- **Task の詳細が使う選択の操作**（開始・今日は中断する・今日は見送る・今日の回をスキップする・今週の残りに戻す）は、契約の operation を `screens/backlog/use-selection-actions.ts` から呼ぶ。Today の操作の一覧（`use-today.ts`）は #275 で移した（次の節）。
- **型**：Backlog の画面と部品は契約の型（`@itera/api-contract`）を使い、`packages/domain` を import しない。ID・`LocalDate`・`Instant` は契約では素の文字列で、domain のブランド付きの型を受ける部品も、契約の型を受けるように替えた（ブランド付きの値は文字列として渡せるので、まだ移していない画面はそのまま渡せる）。配列は読み取り専用にして受ける部品だけ、受け方を広げる。
- **プレビューの例外のモジュール**：`lib/domain-functions.ts` の日付の関数（`addDays`・`dayOfWeek`・`toLocalDate`）は、契約の型を受けて、domain の関数に渡す。ブランドの付け替え（`as`）はここだけで、日付と時刻の形は契約のスキーマが確かめる。`presentedSuggestion` は #323 で外した。Task の詳細が出す提案は、読み取りの `suggestionCapabilities` が使えると言うもの（ADR 0007「操作の可否」）。
- **import の境界**：`MIGRATING` から #273 のファイルと、契約の型だけになった共有のファイル（`components/task/`・`lib/` の一部）を消した。
- **画面の文言**：読み込めなかったときの「読み込めませんでした」と「もう一度読み込む」、読み込み中の「読み込み中…」、追加を送っている間の「追加中…」。content.md には載っていない語で、Notice・Progress・Button の部品の文書が例に挙げている。語として決めるかはオーナーの確認を待つ（Issue #312 で content.md の型「読み込み中」「読み込みの失敗」「送信中のボタン」に載せた）。

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
  - 送信中の語：追加（Quick Add）は「追加中…」、確定の Dialog のボタンは「確定中…」（DESIGN.md Components › Button の Loading）、「Sprint N の計画を始める」は「始めています…」（ボタンと同じ動詞。「開始」は今日の画面でタスクに取りかかる操作の語）。Issue #312 で「開始中…」に変えた（送信中のボタンは「〜中…」の 1 形にし、「〜しています…」をやめた。タスクの「開始」と同じ語だが、送信中の一瞬だけ「〜を始める」のボタンの上に出るので取り違えない、と判断した。content.md の型「送信中のボタン」と用語の「開始 / 完了」）。ほかの操作は、結果が Toast か行の変化で見えるので付けない。細い Backlog の欄（整える・確かめる、208px）の Quick Add には付けない（幅を保つ Button が広がり、領域の選択が「領域なし」を入れる幅を割る）。
- **部品は結果を待つ**：`GoalBlock` の `onSave` と `AvailableHoursField` の `onChange` は `boolean | Promise<boolean>` を受ける。目標の文は、保存が通ってから形を閉じる。使える時間は、通らなかったとき入力した文字を前の値に戻す。
- **描き直しを待ってから焦点を動かす**：目標を保存して形を閉じるとき、キャッシュは更新済みでも画面はまだ新しい目標を描いていない（上の #273「操作が終わっても…」）。「編集」へ戻す焦点は、形を閉じた直後ではなく、目標の文が変わるまで待つ（`GoalBlock`）。今と同じ文は保存せずに閉じる（変わらないので、待つ要求が残らない）。
- **見出しの焦点**：Sprint は一覧と計画の 2 段で読むので、読み込み中の見出しが読み終えた画面の見出しに替わるまでに 2 回作り直される。`useScreenFocus`（#275 で、見出しが作り直される画面に対応した）が、焦点がページに落ちているあいだ、今ある見出しへ何度でも移す。ほかへ移した焦点は取らない。
- **共有のもの**：`BeginPlanning` は `getMe` と `beginPlanning` に移した。Retro の画面も使うので（#276 がその画面を移す）、枠（`AppShell`）が `getMe` を先に読み、「Sprint N の計画を始める」が現れる時点で答えがあるようにした。Retro が開く Sprint は、Retro の画面を移すまで store から求める（`use-retro-choice.ts`。#276 で消す）。`useSprintSteps` は番号だけを持つ参照を受ける。
- **型**：計画と確定済みの Sprint の画面と部品は契約の型を使う。領域なしのまとまりの語は `screen-data/screen-area.ts`（Retro の `views.ts` のものは domain の型なので別）。
- **import の境界**：`MIGRATING` から #274 のファイルと、契約の型だけになった共有のファイル（`capacity-indicator.tsx`・`criterion-text.ts`・`selection-words.ts`・`week-text.ts`）を消した。`use-retro-choice.ts` を #276 の一覧に足した。
- **画面の文言**：送信中の「確定中…」「始めています…」と、記録を読む間の見出し「Sprint」・ラベル「計画」。ほかの語は変えていない（「始めています…」は Issue #312 で「開始中…」に変えた）。

### 今日を契約に移す（2026-10-03、Issue #275）

Backlog（#273）の形で `/today`（今日、過去と先の日）を移した。

- **今日の日付と日の読み取り**：今日の日付はサーバーが利用者のタイムゾーンで決める（「時計」）。画面は `getMe` の `clock.today` と `sprints`（`useNow`、`apps/web/src/api/use-me.ts`）を読み、その日付で `getDay`（`useDay`、`screen-data/use-today.ts`）を読む。URL に `?date=` がなければ今日の日付、あれば `?date=` の日付を渡す。答えの `kind` が、今日（`today`。実行中の Sprint がなければ `today` は空）か、ほかの日（`past`・`future`）かを決める。画面は日付の比較で今日かどうかを決めず、答えに従う。`useToday` は作らず、`useDay` が今日も含む（今日かどうかは画面ではなく答えの `kind` が決めるので、日付ごとに別のフックを呼び分ける必要がない）。
  - 代わりに払うもの：最初の表示は `getMe` → `getDay` の 2 つの読み取りが順に要る（契約に「今日」を指す経路がないため）。`getMe` は操作の対象の Sprint を決めるために操作のたびにも使うので、同じキャッシュを読む。
- **日を替えるとき**：`getDay` は日ごとに読み、前の日を残さない（`placeholderData` を使わない）。見出しの日付と中身の日付が食い違う間を作らないため。新しい日が読めるまでは、その日付の見出し・矢印・日付の入力と `ReadStatus`（`aria-busy`。テストはこれで読み終わりを待つ。`src/test/day-read.ts`）を出す。ほかの日の画面（`OtherDay`）と読み込み中は同じ枠（`DayFrame`）なので、読み終わっても見出しは作り直されない。今日の画面（`TodayView`）に替わるときだけ作り直され、見出しの矢印・日付の入力に置いていた焦点は `DayFocusScope` が戻す（`peek`。日が読めたら `clear` する。#90）。最初の `getMe` が読めるまでは日付が分からないので、見出しを出さない（読み込めなかったときだけ「今日」）。
  - 見出しに焦点を移す仕組み（`useScreenFocus`、#154）は、見出しがまだない画面・読み込みのあとで見出しが作り直される画面に対応する：焦点が見出しに置かれたあとで見出しが消え、焦点がページに落ちているときだけ、今ある見出しに移す。ほかへ移した焦点は取らない。Backlog（#273）も同じ形で、最初の読み込みのたびに見出しの焦点が外れていた。
- **操作のフック**：`useTodayActions` は、操作ごとに `useOperation` を呼ぶ。実行中の Sprint と今日の日付は `useRunningDay`（`getMe`）から取り、`useOnRunningDay` が、実行中の Sprint がないときに保存できなかった Toast を出して、操作の結果（`Outcome`）をそのまま返す（Backlog の今日へ・今週へ・詳細の選択の操作も同じ）。操作が作ったものの ID（今日へで入れた選択の `selectionId`、割り込みの `interruptNoteId`）は戻り値で返し、焦点と「見る」の行き先に使う（記録の並びの差分や DOM の並びから拾わない）。「かかった時間を記録」は、画面が持っている選択の記録（`row.selection`）から、`sprintTaskId`・`date`・`occurrenceId` を渡す（記録の並びから引かない）。
- **行を動かす操作と焦点**：操作は送り終わるまで画面に反映されないことがある（上の「操作が終わっても…」）。行が動く操作（完了・取り消し・見送り・今週の残りに戻すなど）は、焦点を移す先を押したときに決め、通ったら頼みを置き、通らなかったら前の頼みを残す（`follow`）。送ったあとにしか行が分からない今日へは、返った `selectionId` を移す先にする（`followTo`）。頼みは、押した行の操作がすべて送り終わってから、その行が描かれるのを待って移す。先に送った分の記録が描かれた時点では動かさない（続けて押した別の行が、まだ送られていないため）。送る順は押した順なので、最後に通った操作の行き先に移る。見送り・今週の残りに戻すの Toast と、割り込みの記録・消す Toast は、送り終わってから出す。
- **行の操作の送信中**（2026-10-04、Issue #354）：行の操作（今日へ、開始、完了、今日は見送る、今週の残りに戻す、今日の回をスキップする、今日は中断する、それぞれの取り消し。Backlog で完了した行の取り消し（F29 の `undoCompleteTask`）も `useTodayActions` から送る）は、計画の行（#274）と同じく `whileSending: 'wait'` で送り、同じ対象の重ねた押下だけを `useOncePerTarget` で捨てる。対象は操作と選択の ID（今日へは SprintTask と回の ID、Backlog で完了した行の取り消しは Task の ID）で決める。`drop` のままだと、行 A の送信中に押した行 B の操作が、Toast も出ずに捨てられていた（記録と画面は食い違わないが、押したことが無視されたと本人に分からない）。Backlog の行と Task の詳細の「今日へ」「今週へ」と「今週へ」の「元に戻す」（Task の ID で決める）、実行中の Sprint の行の「取り消す」も同じ形にした。割り込みの記録・編集、Quick Add、かかった時間の記録、Task の詳細の選択の操作（`use-selection-actions.ts`）は 1 つの対象への操作なので変えていない。`useOncePerTarget` は画面の形を知らないので `api/use-once-per-target.ts` に置く（下の「置き場所の規則」）。
- **送信中**：追加（今日やるタスク）は Backlog と同じ「追加中…」。割り込みの記録・編集と、かかった時間の記録・「今日は中断する」は、送信が 300ms 続いたら保存する Button を「保存中…」にする（foundations.md の Loading の語）。Sheet は送り終わるまで閉じず、通らなかったら入力を残して開いたままにする。
- **型と共通の部品**：Today の部品は契約の型（`TodayData`・`TodayRow`・`TodayItem`・`DayData`・`InterruptNote`・`LocalDate`）を使い、`packages/domain` を import しない。日付の関数は `lib/domain-functions.ts`（`addDays`・`parseLocalDate`）。`lib/selection-words.ts` は契約の `DailyResolution` にした。`useRead` は、答えに画面で使えるものがないとき（利用者の設定がまだなく、時計がない）`view` が `undefined` を返し、`failed` になる。
- **import の境界**：`MIGRATING` から #275 のファイルと `lib/selection-words.ts` を消した。`NotOnContract` の一覧から `/today` を消した。

### 振り返りを契約に移す（2026-10-04、Issue #276）

Backlog（#273）・今日（#275）の形で `/retro` を移した。

- **開く Sprint**：`useRetroChoice`（`screen-data/use-retro-choice.ts`）が `listSprints` を 1 本読み、URL の `?sprint=` の番号の Sprint、なければ Review の Sprint、実行中の Sprint（最終日に Retro を始める。F21）、最後に closed になった Sprint の順に選ぶ。前後の Sprint（見出しの ‹ ›）は一覧の隣。サーバーが各 Sprint の `week` を返すので、画面は選ぶだけで名前を付けない。Retro を開ける Sprint だけが対象なので、`/me` の `next`（まだ計画が始まっていない来週）は要らない。Sprint が 1 つもなければ、選んだ結果は空（`current` なし）で、画面は「振り返る Sprint はありません」を出す。
- **Retro の読み取り**：`useRetro(sprintId)` は `getSprintRetro` を Sprint の ID で読み、`Read<RetroData>` を返す。Sprint ごとに別の読み取りで、前の Sprint の答えを残さない（見出しの Sprint と中身の Sprint が食い違う間を作らない）。`retroScreenData`（`screen-data/retro-view.ts`）が、契約の `RetroData` から画面が使う ID 引き（`areaOf`・`titleOf`・`taskTitleOf`）を作る。Retro が始まっていない（`view` が `null`）Sprint は Review か closed なら起きないので、`failed` とする。
- **読み込み中**：Sprint の見出し（番号・期間・状態・‹ ›）は選んだ Sprint から作れるので、Retro を読んでいる間も出し続ける。‹ › で Sprint を替えたときに焦点が外れず、読めたあとに見出しが作り直されない。本体の場所は「振り返り」の見出しと `ReadStatus`。外側に `aria-busy`（テストはこれで読み終わりを待つ）。段階の表示は、記録から決まる段階（URL に段階がないとき）を読むまで出さない。
- **操作のフック**：`useRetroActions({ sprintId, draftId })` は、画面に出している Sprint の ID を操作に渡す（暗黙の「Review の Sprint」を使わない）。計画のルールの下書きの ID は読み取りの `draft.criterion.id`。`useBeginRetro(sprintId)` は実行中の Sprint の Retro を始める。次の計画（`useNextPlanning`・`useBeginPlanning`）は `screen-data/use-begin-planning.ts`（#274 と同じファイル）で、`getMe` の `sprints` から読み、始めたら作った Sprint の ID を返す。
  - 同時の扱い：印・自己判定・文章・決定は、選んだ値や書いた言葉をそのまま送るので、重ねて送った分を捨てず順に送る（`whileSending: 'wait'`）。計画のルールの下書きを作る・替える・消す操作は、画面に出ている方針から全体を作って送るので、画面が前の結果を描くまで次を送らない（捨てる）。
  - 完了の確認の Dialog は、送り終わるまで開いたままで、送信が 300ms 続いたらボタンを「完了中…」にする（Issue #312 で「保存中…」に変えた）。通らなかったときは Dialog を閉じ、焦点は「振り返りを完了」のボタンに戻る。通ったときは、完了のボタンがなくなった場所の「Sprint N の計画を始める」へ焦点を移す。画面が新しい記録を描くのは操作の Promise が解決したあとなので、焦点は ref に頼みを置き、ボタンが描かれてから移す（「操作が終わっても…」）。かかった時間の記録（Sheet / Popover）の後も同じで、行のボタンがなくなってから行の「振り返りに使う」へ戻す。
  - 「次に試すこと」は、欄を離れたときと「次に試すことを確定」が続けて起きても同じ言葉を 2 回送らない（送っている間は同じ結果を待つ）。
- **型**：Retro の部品は契約の型（`RetroData`・`RetroCriterion`・`TaskFact`・`RetroPin` など）を使い、`packages/domain` を import しない。`lib/criterion-text.ts` と `lib/week-text.ts` も契約の型にした。
- **画面の文言**：読み込めなかったときの文言は #273 と同じ。読み込み中の見出しは「振り返り」（ナビの語）、`ReadStatus` のラベルは、Sprint の一覧を読む間が「Sprint の一覧」、Retro を読む間が「この Sprint の記録」（見出しと同じ語を続けない。今日の「この日の記録」と同じ型）。送信中の「完了中…」（完了の確認のボタン）と「始めています…」（振り返りを始める。Sprint N の計画を始めるのボタンと同じ語）を足した。これらは content.md には載っていない語（語として決めるかはオーナーの確認を待つ。Issue #312 で型に載せ、「完了中…」は「保存中…」に、「始めています…」は「開始中…」に変えた）。
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

- モックの認証はサインイン済みで始まり、パスキーを 1 つ持つ。サインアウトすると、モックの API はすべての要求に 401（`/problems/unauthenticated`）を返す。パスキーでのサインインはすぐに通る。Google は戻り先をそのまま開く。再読み込みで最初に戻る（記録と同じく保存しない）。
- 401 でサインインの画面へ送られ、サインインの後に元の画面に戻ることを、このモックで確かめる（`sign-in-flow.test.tsx`）。モックにない結果（サインインが古い、失敗）は、偽の `Auth` で画面を描いて確かめる（`src/test/render-with-auth.tsx`）。API の側の流れ（セッションの延長、Google の開始と失敗の戻り）は、`fetch` を差し替えて確かめる（`server-data.test.tsx`）。

### 最初の設定と空の状態（2026-10-04、Issue #279）

記録が 1 つもない状態から使い始める。利用者の設定（タイムゾーン・週の始まり）がなければ「今日」が決まらず、どの読み取りも 422 `/problems/user-not-set-up` になる（ADR 0006「エラー」）ので、最初に設定を作る。

- **入口**：枠の画面（`SignedIn`、`root-layout.tsx`）が `getMe` の `settings` を見て、`null` なら枠の代わりに「最初の設定」（`screens/first-settings/`）を出す。ルートは足さない。開いていた画面（`/backlog` など）の URL のまま、設定を作ると読み取りがやり直されて、その画面が開く。サインインの画面と同じく枠（ナビ）の外。`getMe` が答える前は、これまでどおり枠と各画面の読み込み中を出す（新しい利用者が一瞬、枠を見ることがある）。
- **聞く項目**（2026-10-03 司令塔の判断、オーナーへ要確認として Issue #279 に記録）：週の始まりだけ（月曜・日曜。月曜が初めの選び）。タイムゾーンはブラウザ（`Intl.DateTimeFormat().resolvedOptions().timeZone`）から取り、画面に見出し「タイムゾーン」と値（「Asia/Tokyo」）で出す。表示名は Google の名前（`getSession` の `user.name`。空ならメールアドレスの `@` の前）。週の始まりとタイムゾーンは作った後に変えられない（ADR 0006「利用者」）ので、押す前にそう書く。タイムゾーンを誤って取ると直せない（設定を後から変える画面の Issue が決めるまで、オーナーが記録を直すしかない）。
- **書き込み**：`PUT /api/me/settings`（`useSetSettings`。`useOperation` と同じ `useSend` で送るので、送信中の重ね押し、失敗の Toast、成功後の読み直しは操作と同じ）。成功すると `getMe` が設定を返し、画面が開く。
- **サインアウト**：設定の前でも押せる（別の Google アカウントで入ったときの行き止まりを作らない）。`useSignOut` に設定の画面から切り出した。
- **ブラウザ内モック**：`PUT /me/settings` は API と同じ規則（`settingsChange`）で答える。`before-settings` の状態は、`getMe` が `settings: null` を返し、ほかの読み取りと操作を 422 にする（設定を作るまで）。記録はどちらも空で、時計は月曜の 9:00（`2026-09-14`）。時計は進まないので、モックでは空から「今日に選ぶ・完了」までを通せるが、Sprint の終わり（振り返り）には届かない。1 週を最後まで通す確認は、時計が進む API のテスト（`services/api/src/handlers/empty-start.test.ts`）と、振り返りの状態（`retro-start` など）で行う。
- **空の画面**：今日（「進行中の Sprint はありません」）、Sprint（「Sprint 1 の計画を始める」）、振り返り（「振り返る Sprint はありません」）、Backlog、領域のダイアログは、記録がなくてもこの形のままで通る。

### 操作の後の焦点と、画面のテストの待ち方（2026-10-05、Issue #401）

- 操作の答えの後に焦点や URL を動かす処理は、画面を書き換えるのと同じコミットの中で行う。描画に合わせて焦点を移す effect は `useLayoutEffect` にする（押したボタンが消える・結果が出る描画で移す）。今ある要素へ移すときと URL を変えるときは、ハンドラーの中で行う。`useEffect` はコミットの 1 タスク後に走るので、その間、焦点はページ（`body`）に落ちる（#396）。
  - 例外：Base UI の popup が焦点を返す・取るのを待つときは、`requestAnimationFrame` で待つ（今日の行の焦点、領域の Dialog の `afterFocusSettles`）。そのときも、移す先がまだ描かれていなければ描かれるのを待つ。領域の Dialog は、頼みを state に置き、行が描かれた後の effect で待ち始める。今日の行は、待った後で移す先を探し、なければ記録が変わった次の描画で頼み直す。
- 画面のテストは、操作の後の焦点・URL・status・表示を、結果の表示を待ってから（`findBy…` / `waitFor`）確かめる。焦点は表示と同じコミットで移るので、表示を待てば焦点の確認は決まる。待ち時間の上限を延ばして通さない。
  - 理由：React は、テストの `act` の外の更新（操作の答えの後の更新）を scheduler で描き、Node では `setImmediate` を待つ。負荷でこれが user-event の最後の `setTimeout(0)` より後になると、操作の直後に確かめるテストが、描かれる前の画面を見てまれに落ちる（#396）。
  - 確かめ方：`ITERA_LATE_RENDER=30 pnpm --filter @itera/web exec vitest run`。`apps/web/src/test/late-render.ts` が `setImmediate` を指定のミリ秒だけ遅らせ、待たないテストを毎回落とす。常の実行（`pnpm test`、CI）には入れない：apps/web のテストをもう 1 回すべて回すことになり、確かめたいのは、操作の後を確かめるテストを足し・直したときだけなので。そのときに実行する。
  - 代わりに払うもの：待たないテストが新しく入っても、常の実行では気づかず、まれに落ちるまで残ることがある。
  - 見直す条件：常の実行で同じ種類の揺れがまた起きたとき、CI に入れることを検討する。

### 状態の置き場所

グローバルな UI 状態のストアは入れない。

- 記録：API の読み取りの結果を TanStack Query がキャッシュする（ブラウザ内モックの `RecordStore` は画面から見えない。#277）。
- 画面の状態（fixture の状態、絞り込み、開いている詳細、開いている Sprint など）：ルートの検索パラメータ。選んでいる Sprint と日も Zustand などのアプリ全体のストアに持たない。再読み込み・ブラウザの戻る・新しいタブ・共有で同じ画面を開けるようにするため（Issue #90 のオーナー決定）。
- 部品の中だけの状態（開閉、入力途中の値）：React の state。

どれにも当てはまらない状態が出てきたら、そのとき改めて決める。


### RecordStore と Change の片づけ（2026-10-04、Issue #277）

画面をすべて契約に移した（#273〜#276）ので、移行の途中の仕組みを消し、import の境界を最終の形にした。

- 消したもの：`apps/web/src/store/` の `record-store.ts`・`store-provider.tsx`・`use-run.ts`・`use-system-day.ts`・`use-app-overview.ts`、`app/not-on-contract.tsx`（`NotOnContractError` を含む）、`createMock` の `subscribeToScreens`、`eslint.config.js` の `MIGRATING`。
- モックのストアの生成は `apps/web/src/mock/memory-store.ts` に置く（乱数だけを渡す薄い関数）。開発用メニューは、モックのストアの時計と利用者のタイムゾーンを自分で読む。
- システムの記録：モックは、読み取りと操作の前に `catchUp` を実行する（サーバーと同じ順序）。fixture の時計を進めた状態でも、終了日を過ぎた Sprint は読み取りの前に Review になる（`mock-api.test.ts`）。`packages/application` の `system-day.test.ts` も `catchUp` で確かめる。
- `packages/application`：使われなくなった画面ごとの読み取り（`appOverview`・`sprintChoice`・`planningData`・`nextPlanningOf`）と、それらだけが使う型・補助関数（`AppOverview`・`SprintSummary`・`SprintChoice`・`NextPlanning`・`PlanningData`・`planningSprint`・`reviewSprintOf`）を消した。`overview-view.ts` は `areaList` だけになったので `area-view.ts` に改めた。これらのテストが確かめていた振る舞いは、今使われている関数に移した：計画値・適用の切り替え・確定を待つ理由・追加できる領域・領域名の反映は `sprintPlanOf` のテスト、候補の印は `planningCandidatesOf` のテスト、どの Sprint を開くかの規則はクライアントの `use-sprint-choice.test.ts` と `use-retro-choice.test.ts`、契約の読み取り（`sprintList`・`currentSprints`・`sprintView`・`sprintCandidates`・`sprintRetro`・`dayView`）が JSON を通しても同じになることは `views.test.ts`。画面ごとの読み取りの `runningData`・`retroData`・`dayData`・`todayData` は index から外し、`resource-views` が部品として使う。`reviewEnded`・`beginDay` も index から外した（外から使うのは `catchUp` だけ）。
- import の境界の最終の形：`packages/domain` を import してよいのは `src/lib/domain-functions.ts` とモックとテスト、`packages/application` はモックとテスト。違反は ESLint が失敗する。例外の一覧はない。
- **置き場所の規則（`apps/web/src/`）**：`store/` を `screen-data/` に改めた（ストアではなくなったため）。依存の向きは `screens/` → `screen-data/` → `api/` → `@itera/api-contract`。
  - `api/`：契約への通信の層。クライアントとキャッシュ（`create-api`・`api-provider`・`query-client`）、読み取りの状態（`Read`・`useRead`）、操作（`useOperation`、同じ対象の重ねた押下を捨てる `useOncePerTarget`。#354）、失敗の扱い（`failure`・`save-failed`）、人と設定の読み取り（`useMe`・`useSettings`）。画面の語と形を知らない。
  - `screen-data/`：画面ごと・資源ごとのフック。契約の答えを画面の形にする読み取り（`use-backlog`・`use-today`・`use-planning`・`use-retro`・`use-running-sprint`・`use-areas`・`use-sprint-choice`・`use-retro-choice`）、画面が名前で呼ぶ操作の関数（`use-task-actions`・`use-begin-planning` と各 `use-*` の `*Actions`）、それらが使う値の変換（`retro-view.ts`・`screen-area.ts`）。`api/` を使い、画面から使われる。
  - 契約の読み取りを画面の形にするフックと、操作ごとの名前つき関数は、1 つの画面だけが使うものも `screen-data/` に置く（契約の形を知る場所を 1 か所にするため）。焦点・選択・Toast など画面の振る舞いのためのフックは、その画面のフォルダに置く（`screens/backlog/use-add-to-today.ts` など。必要なら `screen-data/` のフックを呼ぶ）。
  - `api/`・`components/`・`lib/`・`auth/`・`foundations/` は、`lib/domain-functions.ts` と `auth/better-auth.ts` も含めて `screen-data/` を import しない。ESLint の `no-restricted-imports` で検査する（違反を足して失敗を確かめた）。逆向き（`screen-data/` から `screens/`）は検査していない。いま import はない。
- 設定の画面のパスキーの一覧は、他の画面と同じ `useRead` と `ReadStatus` で読み込み中と失敗を表す（失敗の見出しは「読み込めませんでした」）。

### 編集できる欄の状態（2026-10-04、Issue #324）

欄の値を読み取りの値で 1 度だけ `useState` に作り、離れたときに読み取りの値と比べて保存する書き方には、ほかの端末が保存した値を、開いたときの古い値で上書きする不具合があった（読み直しても欄は古いまま、何も書かずに離れても `古い値 !== 読み取りの値` で保存される）。利用者の記録を失わないため、この書き方をやめる。

- `apps/web/src/lib/use-draft-field.ts` の `useDraftField(read)` を、読み取りの値を編集する欄の状態の置き場所にする。打った値と読み取りの値を分けて持ち、打っていない間は読み取りの値を欄に出す（ほかの端末の変更が見える）。打っている間は読み直しで欄を書き換えない。
- 保存するかどうかは、欄に入って打ち始めたときに欄が出していた値（`base`）と比べて決める。読み直した後の値とは比べない。`edited` が偽なら保存しない。保存に出した値は、読み取りが別の値に変わるまで欄に出し続ける（`hold`）。保存が失敗したら打った値を返す。同じと見なす値（前後の空白、時間の分）は `equal` で渡し、打ち戻しは編集にしない。操作が入れる値（見積もりの提案を使った後など）は `put`。
- 対象は、`apps/web` の編集できる欄のうち、読み取りの値から作る欄：振り返りの「気づいたこと」と「次に試すこと」、Task の題名・説明・期限・見積もり、サブタスクの見積もり、目標の文、使える時間、割り込みの編集、領域の名前、繰り返しの選択（頻度・曜日・日。1 つ選ぶとパターン全体を保存するので、読み取りの値から作らないと、触っていない部分を古い値で保存する）。新しい欄を足すときも同じ形にする。
- 保存できたか分からない失敗で打った値を返した後、読み取りがその値になったら（1 回目が実は保存されていた、または「もう一度保存」が通った）、欄はまた読み取りの値を追う（`given`。#320）。そうしないと、保存済みの値が「打った値」のまま残り、ほかの端末の変更が見えず、離れたときに同じ値をまた保存する。
- 同じ欄を 2 つの端末が同時に書き換えたときは、後に保存した方が残る（記録ごとの版で 412 にするのは #321）。この方針はそれを置き換えない。
- 記録ごとの版（#321、2026-10-04）：`useDraftField(read, equal, { etag })` は、欄の記録の版も持ち、保存の `madeFrom` を返す。打ち始めたときに読んでいた版（Issue の「欄に入ったとき」。打つ前にほかの端末が変えたら、欄はその値を出しているので、打ち始めたときの版の方が利用者の見た値に合う）。打っていない間と、失敗した保存が打った値を返した後（`given`）は、今の読み取りの版（Toast が理由を伝えたので、次の保存は今の記録の上での利用者の判断。2026-10-04 司令塔の推奨。オーナーの確認を待つ）。保存に出した値の上で打ち直したときも今の読み取りの版で、1 回目の保存で進んだ分は `ownVersions` が送るときに足す。版のない記録（まだない目標）は `{ none: true }`。2 つの欄を 1 つの保存で送る割り込みの編集は、どちらかに最初に打ったときの版で送る（`interrupt-sheet.tsx`）。選ぶ操作（目標に入れる、自分の評価、計画のルールの扱い、下書きのルール、サブタスクの完了、Task の詳細の選択）は、押したときの読み取りの版で送る。
- 保存の終わりを記録の版で判断する（#343、2026-10-04）：版を持つ欄（`useDraftField(read, equal, { etag })`）は、保存に出した値を、読み取りが「最後の保存を反映している」まで出し続ける。読み取りの値が保存したときから変わったかでは判断しない。読み直しの最初の 1 回が失敗したとき（`readAgain` は待たずに解決する）、前の保存の読み取りが再試行で後から届くと、値で判断する欄はそれを最後の保存のものと取り違えて選んだ値を外し、その間に選んだ次の値と一緒に外れた値を失っていた。値を置き換える書き込み（`ConditionalName`）の `run` は、通ったら記録の版の移り（`Written`：作った版から `ownVersions` で進めた版までの `over`、応答の `ETag` の `now`。記録を消した書き込みは「記録なし」）を返し、欄の保存はそれを `Saved`（`{ ok, written }`）として `hold` に渡す。欄は、読み取りの記録の版が `now` か、`over` にない版（その後にこの端末かほかの端末が変えた）なら、保存を反映していると見なす。`over` の版の読み取りは保存の前に作られたものなので、欄は保存に出した値を出し続ける。版は中身を読まずにまるごと比べる（ADR 0006 記録ごとの版）。判断に使うのは最後に通った保存の版だけ。読み取りは、同じ記録を出す別の読み取りのキャッシュ（Backlog の別の絞り込み、計画のルールで計画するかどうか）に切り替わると、取り直す間は前の版に戻ることがあるので、欄が保存を送る前に出した版も `over` と同じく保存の前のものと見なす（送る前に出した版は保存を含まない）。前の保存の版は、最後の保存の `over` か、欄が送る前に出した版のどちらかに入る。版を持つ欄の `hold` の型は `Saved` だけを受け、欄ごとに版を渡し忘れると型の検査で失敗する。保存の答えが版を返すので、欄ごとに版を書かない。対象は版を持つすべての欄（Task の題名・説明・期限・見積もり、サブタスクの見積もり、目標の文、使える時間、振り返りの 2 つの文、領域の名前、繰り返しの選択）。繰り返しの選択は、規則の版（Task の規則がなければ「記録なし」）を欄に渡す。保存は従来どおり押したときの読み取りの版で作る。
- 版を持たない欄（#343）：割り込みのシートの 2 つの欄（追加と編集）。追加は記録がまだなく、どちらも保存が通るとシートを閉じて打った値を捨てるので、保存の後に読み取りを待つ間がない。読み取りの値の変化で判断する従来の形のままにする。操作が入れる値（`put`。見積もりの提案を使った後、繰り返しをやめた後）も保存ではないので、読み取りの値が変わるまで出す。版を持たない欄で保存の後に読み取りを待つものを足すときは、版を持たせる。
- 対象にしなかった欄：読み取りの値から作らない欄（Task の追加、実績・中断の時間、新しい割り込み、新しい領域の名前、最初の設定）、日付を選ぶ欄（記録ではなく表示する日）、見積もりの提案の「編集して使う」（提案の値から始まる操作の入力で、利用者が見た値を「使う」で明示して送る）。

## 影響

- `pnpm --filter @itera/web dev` で 4 つの画面の入口が開く。画面の中身は #39〜#42 で作る。
- 時間の書式（DESIGN.md 原則 4）は `apps/web/src/lib/time-format.ts`、日付の書式（docs/design/content.md）は `date-format.ts` にある。
- 本番ビルドの JS が 500 kB（gzip 前）を超え、Vite が警告を出す。分割はコード量が画面の Issue で増えてから決める。
