# ADR 0005: Web のルーティングと fixture の置き場所

- 状態：採用
- 日付：2026-09-27
- 関連：Issue #38、後続 Issue #39〜#42
- 改訂：2026-09-27（API への移行と状態の置き場所を追記）

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
- 画面ごとに 1 つのパス：`/today`（今日）、`/sprint`（Sprint。Planning 中は Planning）、`/backlog`、`/retro`（振り返り）。`/` は `/today` に送る。ないパスは「ページが見つかりません」を出す。
- 検索パラメータは、ルートの `validateSearch` で検証してから使う。不正な値は捨てて既定に戻す（例外にしない）。Valibot はまだ入れていないので、それまでは手書きの検証関数にする。画面の状態（絞り込み、開いている詳細など）は、各画面の Issue でその画面のルートに足す。
- ナビゲーションは `Navigation`（DESIGN.md Components › Navigation）を使い、項目の `href` はルーターの `buildLocation` で作る。修飾キーなしの左クリックだけをルーターの遷移にし、新しいタブで開く操作はブラウザに任せる。

### fixture の状態

- 状態は PRD §12 の 12 個：選ぶ / 整える / 確かめる、Today の朝 / 日中 / 割り込み、Retro の開始 / 振り返り / 完了直前、Backlog の Capture / Detail / Recurrence。
- 状態はルートの検索パラメータ `fixture` で選ぶ（例：`/today?fixture=today-morning`）。`retainSearchParams` で、画面を移っても保つ。ないときは「日中」（`today-daytime`）。
- 開発用メニューは画面の右下に出し、状態を選ぶとその状態の画面を開く。`import.meta.env.DEV` のときだけ動的に読み込むので、本番ビルドには入らない。URL での切り替えは本番ビルドでも使える（services/api とつなぐまでは fixture がデータの唯一の出どころのため）。
- fixture は、`packages/domain` のコマンドを 1 本の時系列（9/13〜10/5）で実行して作り、途中の記録をスナップショットとして取る（`apps/web/src/fixtures/timeline.ts`）。記録を手で書かないので、どの状態もドメインが作りうる記録だけになり、不変条件はコマンドが守る。ドメインモデルの Scenario A〜C を 1 人の利用者の 1 本の時系列に並べ直している。
- 状態ごとに時計（「今日」の LocalDate と現在時刻の Instant）を持つ。画面とコマンドはこの時計を使い、ブラウザの時計を読まない。

### 記録のストア

- ストアは `packages/domain` の記録（User・Area・Task・RecurrenceRule・Occurrence・Sprint・PlanningCriterion・Activity）だけを持つ。SprintTask・DailySelection・Retro などは Sprint の集約の中にある（packages/domain README）。派生値は持たず、画面が domain の関数で計算する。
- 変更は `Change`（記録と文脈を受け取り、domain のコマンドを呼んで、書き換える記録と Activity を返す関数）として `run` に渡す。成功したら記録を差し替えて Activity を追記し、失敗したら何も変えずに domain のエラーを返す。ID はストアが作って文脈で渡す（domain は ID を作らない）。
- 画面が使うのは `RecordStore`（`getSnapshot`・`subscribe`・`run`）だけにする。fixture はメモリ上の実装（`createMemoryStore`）を使い、永続化しない（リロードすると fixture に戻る）。services/api とのつなぎ方は、次の「API への移行」に従う。
- `RecordStore` はサーバー状態（将来は D1 にある記録）の仮の置き場で、クライアントの UI 状態を持つストア（Zustand など）とは役割が違う。移行後は TanStack Query（取得結果のキャッシュ）と API に置き換わる。

### API への移行

オーナーの決定（2026-09-27）：fixture で 4 つの画面（#39〜#42）を今の `RecordStore` と `Change` のまま作りきり、そのあとで OpenAPI を契約にした API 呼び出しへ移行する。

- 理由：`Change` は関数なのでサーバーへ送れず、このままつなぐと判定がクライアントとサーバーに分かれる。操作を名前と入力で表す契約（OpenAPI）にすれば、判定はサーバーの `packages/domain` のコマンドだけになり、将来 Web 以外のクライアント（iOS など）もその契約からクライアントを生成できる。Hono RPC や tRPC は型が TypeScript の中に閉じるので採らない。先に画面を作りきるのは、PRD §12 の操作感の検証を先に済ませ、必要な操作を画面から洗い出してから契約を決めるため。
- 移行先の方向：OpenAPI の仕様からクライアントを生成し（Hey API の候補）、TanStack Query で呼ぶ。fixture の段階の代わりに、ブラウザ内のモックが同じ operation を受けて `packages/domain` のコマンドを実行する。採用する依存・版・仕様の書き方（Hono から出すか、仕様を先に書くか）・派生値を API で返すかは、移行の Issue と ADR で決める。
- `packages/domain` は移行後もそのまま使う。API のハンドラーは記録を D1 から読み、コマンドを呼び、`batch()` で書く（ADR 0004）。書き直すのは `apps/web/src/store/` の `Change`・`changes.ts`・`RecordStore` の実装と、それを呼ぶフックの中身に限る。

移行の範囲をフックの中に閉じ込めるため、#39〜#42 では次を守る。

- 画面の部品から `store.run`・`Change`・`Records` を直接使わない。読み取りは画面ごとのフック（例：`useBacklog()`）、変更は操作ごとのフック（例：`useTaskActions().updateTask(id, input)`）を通す。
- 利用者の 1 操作を 1 つの名前つき関数にする（例：`updateTask`、`selectForToday`）。この一覧が、移行時の OpenAPI の operation の元になる。
- 表示の部品はデータと操作を props で受け取り、取得の方法を知らない。送信中と失敗を表せる形にしておく（fixture では同期なので送信中は起きない）。
- システムの記録（actor = システム。終了日を過ぎた Sprint を Review にする、その日の始まり）は、利用者の操作ではない。fixture ではアプリの外枠の `useSystemDay` が実行する（#54）。API への移行後は、クライアントの operation にせず、サーバー側（読み取りの前や日次の処理）で行う。

### 状態の置き場所

グローバルな UI 状態のストアは入れない。

- 記録：`RecordStore`（移行後は TanStack Query）。
- 画面の状態（fixture の状態、絞り込み、開いている詳細など）：ルートの検索パラメータ。
- 部品の中だけの状態（開閉、入力途中の値）：React の state。

どれにも当てはまらない状態が出てきたら、そのとき改めて決める。

## 影響

- `pnpm --filter @itera/web dev` で 4 つの画面の入口が開く。画面の中身は #39〜#42 で作る。
- 時間の書式（DESIGN.md 原則 4）は `apps/web/src/lib/time-format.ts`、日付の書式（docs/design/content.md）は `date-format.ts` にある。
- 本番ビルドの JS が 500 kB（gzip 前）を超え、Vite が警告を出す。分割はコード量が画面の Issue で増えてから決める。
