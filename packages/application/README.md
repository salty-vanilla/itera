# @itera/application

Itera のアプリケーション層（ADR 0005「API への移行の改訂（2026-10-03）」）。利用者の操作と、記録から作る派生値を持つ。規則の正本は `@itera/domain` で、このパッケージは記録を読み、domain のコマンドを呼び、書く記録と Activity を返す。`services/api` のハンドラーとブラウザ内モックが同じ関数を使う。

## 置いているもの

| ファイル | 内容 |
| --- | --- |
| `operations.ts` | 利用者の操作の一覧。名前は画面をまたいで重ならず、入力は 1 つのオブジェクト。契約（#265）の operation の元になる |
| `*-changes.ts` | 操作の中身（`Change`）。作った記録の ID と操作の結果の値を `value` で返す |
| `system-changes.ts`、`today-changes.ts` の `beginDay` | システムの記録（終了日を過ぎた Sprint の Review、その日の始まり）。利用者の操作の一覧には入れない |
| `*-view.ts`、`sprint-choice.ts`、`overview-view.ts` | 読み取り。結果はそのまま API の応答にできる形（関数・`Map`・`Set`・画面の語を含めない） |
| `record-store.ts`、`records.ts` | 記録の形、`Change` の型、メモリ上のストア（fixture とブラウザ内モック）。操作と読み取りが受け取る `Records` は Activity を含まない（追記するだけで読み返さない。ADR 0004）。メモリ上のストアは追記した Activity も持つ（`RecordsWithActivity`） |
| `ids.ts` | TypeID（ADR 0004「ID の形式」）を作る関数と、外から来た ID を確かめる関数 |
| `fixtures/` | fixture の時系列と PRD §12 の 12 状態。`@itera/application/fixtures` から使う。テストとブラウザ内モックのためのもので、本番のコードからは使わない |

## 約束

- `packages/domain` と同じく、現在時刻と乱数は引数で受け取る（`ChangeContext`、`createMemoryStore` の `random`）。React と `apps/web` に依存しない。ESLint で検査する。
- 派生値は保存せず、記録から計算する（`.claude/rules/domain.md`）。
- 読み取りの結果に、ID から引く関数や画面の語（「領域なし」「今週」など）を入れない。Area がないことは `area` を省いて、週は `previous`・`current`・`next` で表す。語と引く関数は画面の側で作る。
- 操作が決める値（Area の並び順と色など）は操作の中で決める。
