import type { DailySelection, LocalDate } from '@itera/domain';
import { Link } from '@tanstack/react-router';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { semanticIcons } from '@/components/ui/icon';
import { Deadline } from '@/components/task/deadline';
import { MetaItem, TaskMetadata } from '@/components/task/task-metadata';
import { formatDate, formatTime } from '@/lib/date-format';
import { formatHours } from '@/lib/time-format';
import type { DayData } from '@/store/day-view';
import { useDay } from '@/store/use-today';
import { DayHeader } from './day-header';

// A day other than today on the Today screen (#90), read only.
// - Past: what was chosen that day and how each ended, and the interrupts.
//   Undoing a completion or a skip stays on the running Sprint's 「日ごとの
//   記録」 (#53).
// - Future: the occurrences due that day and the Tasks whose deadline it
//   is. Choosing a day to do a Task on is #91.
// - A day no Sprint has: the Sprint that has it, or the next to start.

/** How a choice ended, as Today and Retro say it. */
const ENDED: Readonly<Record<DailySelection['resolution'], string>> = {
  selected: '未処理',
  started: '未処理',
  unresolved: '未処理',
  done: '完了',
  skipped: 'スキップ',
  paused: '今日はここまで',
  deferred: '見送り',
  removed: '今日から外した',
};

const link = 'text-link underline focus-visible:focus-ring';
const Repeat = semanticIcons.recurrence;

function OtherDay({ date }: { date: LocalDate }) {
  const data = useDay(date);
  if (data === undefined) return null;
  const { within } = data;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-pane-today flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <DayHeader
        date={date}
        meta={
          within === undefined
            ? undefined
            : `Sprint ${within.number} · ${within.day.index}日目 / ${within.day.count}日`
        }
      />
      <Where data={data} />
      {data.when === 'past' ? <Past data={data} /> : <Future data={data} />}
    </div>
  );
}

/** Which Sprint the day belongs to, and the way to it. */
function Where({ data }: { data: DayData }) {
  const { within, next } = data;
  const readOnly =
    data.when === 'past'
      ? '過ぎた日の記録です。ここでは変えられません。'
      : '先の日です。ここでは読むだけです。';
  if (within === undefined) {
    return (
      <p className="text-body text-ink-muted">
        この日を含む Sprint はありません。
        {next !== undefined && (
          <Link
            to="/sprint"
            search={{ sprint: next.number }}
            className={`ms-1 ${link}`}
          >
            Sprint {next.number}（{formatDate(next.start)} から）を開く
          </Link>
        )}
      </p>
    );
  }
  return (
    <p className="text-body text-ink-muted">
      {within.sprint === undefined
        ? `Sprint ${within.number} の計画はまだありません。`
        : readOnly}
      <Link
        to="/sprint"
        search={{ sprint: within.number }}
        className={`ms-1 ${link}`}
      >
        Sprint {within.number} を開く
      </Link>
    </p>
  );
}

function Past({ data }: { data: DayData }) {
  const running = data.within?.sprint?.state === 'active';
  return (
    <>
      <section aria-labelledby="day-records" className="flex flex-col gap-2">
        <h2 id="day-records" className="text-heading text-ink">
          この日の記録
        </h2>
        {data.records.length === 0 ? (
          <p className="text-body text-ink-muted">
            この日に選んだタスクはありません。
          </p>
        ) : (
          <ul className="flex flex-col border-t border-border-soft">
            {data.records.map((r) => (
              <li
                key={r.selection.id}
                className="flex min-h-row-touch flex-col justify-center gap-1 border-b border-border-soft py-2 medium:min-h-row-task"
              >
                <span className="text-task text-ink">{r.title}</span>
                <TaskMetadata>
                  {r.area !== undefined && (
                    <AreaIndicator name={r.area.name} color={r.area.color} />
                  )}
                  {r.occurrence !== undefined && (
                    <MetaItem icon={<Repeat aria-hidden />}>繰り返し</MetaItem>
                  )}
                  <MetaItem className="text-ink">
                    {ENDED[r.selection.resolution]}
                  </MetaItem>
                  {r.actualHours > 0 && (
                    <MetaItem>実績 {formatHours(r.actualHours)}</MetaItem>
                  )}
                </TaskMetadata>
              </li>
            ))}
          </ul>
        )}
        {running && data.records.length > 0 && (
          <p className="text-help text-ink-muted">
            完了とスキップの取り消しは、Sprint
            の画面の「日ごとの記録」でできます。
          </p>
        )}
      </section>
      {data.interrupts.length > 0 && (
        <section
          aria-labelledby="day-interrupts"
          className="flex flex-col gap-2"
        >
          <h2 id="day-interrupts" className="text-subheading text-ink">
            割り込み
          </h2>
          <ul className="flex flex-col gap-1 text-body text-ink">
            {data.interrupts.map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className="shrink-0 text-meta leading-(--text-body--line-height) text-ink-muted">
                  {formatTime(n.at, data.timeZone)}
                </span>
                <span>
                  {n.text}
                  {n.minutes !== undefined && (
                    <span className="text-ink-muted">
                      {' '}
                      · {formatHours(n.minutes / 60)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Future({ data }: { data: DayData }) {
  const nothing = data.occurrences.length === 0 && data.due.length === 0;
  return (
    <>
      {nothing && (
        <p className="text-body text-ink-muted">
          この日に決まっている繰り返しと期限はありません。
        </p>
      )}
      {data.occurrences.length > 0 && (
        <section
          aria-labelledby="day-occurrences"
          className="flex flex-col gap-2"
        >
          <h2 id="day-occurrences" className="text-heading text-ink">
            この日の繰り返し
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {data.occurrences.map(({ occurrence, title, area }) => (
              <li
                key={occurrence.id}
                className="flex min-h-row-touch flex-col justify-center gap-1 border-b border-border-soft py-2 medium:min-h-row-task"
              >
                <span className="text-task text-ink">{title}</span>
                <TaskMetadata>
                  {area !== undefined && (
                    <AreaIndicator name={area.name} color={area.color} />
                  )}
                  <MetaItem icon={<Repeat aria-hidden />}>
                    {occurrence.state === 'done'
                      ? '繰り返し · 完了'
                      : occurrence.state === 'skipped'
                        ? '繰り返し · スキップ'
                        : '繰り返し'}
                  </MetaItem>
                </TaskMetadata>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.due.length > 0 && (
        <section aria-labelledby="day-due" className="flex flex-col gap-2">
          <h2 id="day-due" className="text-heading text-ink">
            この日が期限のタスク
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {data.due.map(({ task, area }) => (
              <li
                key={task.id}
                className="flex min-h-row-touch flex-col justify-center gap-1 border-b border-border-soft py-2 medium:min-h-row-task"
              >
                <span className="text-task text-ink">{task.title}</span>
                <TaskMetadata>
                  {area !== undefined && (
                    <AreaIndicator name={area.name} color={area.color} />
                  )}
                  {task.due !== undefined && (
                    <Deadline due={task.due} today={data.today} />
                  )}
                </TaskMetadata>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export { OtherDay };
