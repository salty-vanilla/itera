# @itera/domain

Itera のドメインロジック。`docs/domain/domain-model.md`（v0.2 Final、F1〜F9）を、UI・DB・HTTP から独立した純粋な TypeScript で表す。`apps/web` の fixture と、後の `services/api` はこのパッケージの型と関数を使う。

作業の前に `.claude/rules/domain.md` を読む。

## 表記の決定（Issue #20）

以後の Issue（#21〜#24）もこの決定に従う。変えるときは Issue で決め、この節を更新する。

### 状態名

状態はドメインモデルの「状態遷移」の表にある小文字の camelCase の文字列リテラルで書く。本文の見出しや図にある大文字始まり（`Planned`、`CarriedOver`）は同じ状態を指す。

| 観点 | フィールド | 値 |
| --- | --- | --- |
| Task のライフサイクル | `Task.lifecycle` | `active` / `completed` / `archived` |
| Sprint への参加 | `SprintTask.outcome` | `draft` / `planned` / `done` / `removed` / `carriedOver` |
| 今日の選択 | `DailySelection.resolution` | `selected` / `started` / `done` / `paused` / `deferred` / `removed` / `skipped` / `unresolved` |
| 繰り返しの回 | `Occurrence.state` | `pending` / `excluded` / `done` / `skipped` / `missed` |
| 計画基準 | `PlanningCriterion.state` | `draft` / `active` / `ended` / `replaced` |
| Sprint | `Sprint.state` | `planning` / `active` / `review` / `closed` |
| 提案 | `EstimateSuggestion.state` | `presented`（提示中）/ `adopted`（採用）/ `rejected`（却下）/ `replaced`（置換） |

- **DailySelection.resolution** は `selected` と `started` を含む 1 つのフィールドにする（状態表のとおり）。`startedAt` と `resolvedAt` は別に日時として持ち、開始したあとで見送った選択（`started` → `deferred`）でも開始の事実を残す。型と遷移は #23 で実装する。
- **Occurrence の Projected** は保存しないので `Occurrence.state` に入れない。次の回を返す計算関数の戻り値にする（#21）。

### 日付と日時

| 型 | 形 | 使う場所 |
| --- | --- | --- |
| `LocalDate` | `YYYY-MM-DD`（利用者のタイムゾーンでの暦日） | Sprint の日、Today、期限、回の予定日 |
| `Instant` | UTC の ISO 8601、ミリ秒つき（`2026-09-28T00:30:00.000Z`） | 作成・変更・完了などの日時、Activity の `at` |
| `TimeZone` | IANA 名（`Asia/Tokyo`） | `User.timeZone` |

- どちらも型を区別した文字列。文字列の比較がそのまま時間の前後になる。JSON にそのまま入り、fixture で読める。
- 外から来た値は `parseLocalDate` / `parseInstant` で検証する。テストと fixture のリテラルは `localDate()` / `instant()`（不正なら例外）。
- 日時から「どの日か」は `toLocalDate(instant, timeZone)` で求める（`Intl.DateTimeFormat` を使う）。日付の加算は `addDays`、曜日は `dayOfWeek`（0 = 日曜、`User.weekStartsOn` と同じ）。
- Temporal は使わない。TypeScript 6.0 の `lib: ES2023` に型がなく、対応ブラウザも揃っていないため。

### ID

- ID は型を区別した文字列（`TaskId`、`AreaId` など。`Id<'Task'>`）。
- ID はパッケージの外（UI・API・fixture）で作り、コマンドの入力で渡す。パッケージは乱数に依存しない。境界では `id()` で型をつける。

### コマンド

```ts
function command(record, input, ctx: CommandContext): CommandResult<T>;

interface CommandContext {
  now: Instant; // 現在日時。パッケージは時計を読まない
  actor: 'user' | 'agent' | 'system';
}

type CommandResult<T> =
  | { ok: true; value: { value: T; activities: readonly Activity[] } }
  | { ok: false; error: { code: DomainErrorCode; message: string } };
```

- ルール違反（不正な入力、状態図にない遷移、繰り返しの Task の完了など）は例外にせず、`ok: false` と安定した `code` で返す。`message` は開発者向けで、画面の文言には使わない。
- 成功したときは新しい記録と、追記する Activity を返す。何も変わらない操作は Activity を返さない。
- 渡された記録は書き換えない。新しいオブジェクトを返す。

### 記録と履歴

- 記録は `readonly` のプレーンなオブジェクト（class にしない）。そのまま JSON にでき、fixture に書ける。
- 省略できる属性は、ないときはキー自体を持たない（`exactOptionalPropertyTypes`）。更新の入力では `null` で消す。
- ドメインモデルが「履歴として残す」とし、専用の記録がないもの（Area 名の変更、Task の属性の変更、Estimate の変更）は Activity に残す。Activity は追記だけで、種類ごとに型のある union（`kind` で区別）。
- 派生値（Backlog、計画値の合計、後の Issue の連続見送りや Retro の事実など）は記録から計算する関数にし、保存しない。

## この段階で決めた細部

- **Backlog の既定の並び**は作成順（同時刻なら ID 順）。優先度は既定の並びにしない（不変条件 5）。
- **提示中の提案**は Task に 1 つまで。新しい提案を出すと、前の提案は `replaced` になる。
- **中央で採用**したときの Estimate は下限と上限の平均。
- **サブタスク合計**は見積りのあるサブタスクだけを足す。1 つもなければ未見積。完了したサブタスクも足す。Subtask の見積りは点の値なので、合計も点になり、計画基準は当たらない（不変条件 9 の「幅のあるサブタスク合計」は、今のモデルでは生じない）。
- **計画基準**はこのパッケージでは `CriterionPolicy`（対象と `rangePolicy`）として受け取る。状態遷移と CriterionUse は #22・#24。

## 対象外（この Issue）

PlanProposal（不変条件 41）は、外部 Agent を MVP に含めるかが PRD §14 で未決のため作らない。提案の中身を作る処理と、永続化も対象外。

## 構成

| ファイル | 内容 |
| --- | --- |
| `src/shared/` | ID、日付と日時、Result、コマンドの形、Activity |
| `src/user.ts`、`src/area.ts` | User、Area（改名・アーカイブ） |
| `src/task.ts` | Task、Subtask、ライフサイクル、属性の変更 |
| `src/estimate.ts` | Estimate、EstimateSuggestion（提示・採用・却下） |
| `src/planning-value.ts` | 計画値の計算と合計 |
| `src/backlog.ts` | Backlog のビュー |

テストは同じ場所の `*.test.ts`。不変条件のテストは名前に番号を入れる（`invariant 7: ...`）。
