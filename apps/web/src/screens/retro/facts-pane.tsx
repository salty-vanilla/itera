import type { AreaId, RetroPin, SelfAssessment, TaskFact } from '@itera/domain';
import { ChevronDown, ChevronRight, Info, Timer } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { semanticIcons } from '@/components/ui/icon';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { Button } from '@/components/ui/button';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import {
  capacityRelationSentences,
  Sentences,
} from '@/components/sprint/capacity-indicator';
import { SprintSummary } from '@/components/sprint/sprint-summary';
import { criterionQuotedName } from '@/lib/criterion-text';
import { formatDate, formatDateTime } from '@/lib/date-format';
import { SELECTION_WORDS } from '@/lib/selection-words';
import {
  formatHours,
  formatPlanningAside,
  formatPlanningSum,
  formatRange,
} from '@/lib/time-format';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import type { ActualTarget, RetroData } from '@/store/retro-view';
import {
  ASSESSMENTS,
  AssessmentTag,
  OUTCOME_WORDS,
  occurrenceWord,
  PinToggle,
  samePin,
} from './retro-words';
import { TaskResult } from './task-result';
import {
  actualLabel,
  daysText,
  differenceParts,
  differenceText,
  estimateOf,
  plannedCellText,
  plannedLabel,
  planNotes,
  unestimatedNote,
} from './task-values';

// 事実を見る (patterns.md Retro): 「今週、何が起きたか」. Everything here is
// derived from the records by `retroFacts` and never edited (invariant 40);
// the person only marks facts (振り返りに使う), judges Goals and adds actual time
// (F22). No scores and no rates; facts are written neutrally. Once the
// Sprint is closed, all of it is read only (#90): no 振り返りに使う, no judging
// and no actual time.

const CarryIcon = semanticIcons.carriedOver;

type AddActual = (
  target: ActualTarget,
  title: string,
  anchor: HTMLElement,
) => void;

type FactsPaneProps = {
  data: RetroData;
  /** A closed Retro (#90). */
  readOnly?: boolean | undefined;
  onPin: (pin: RetroPin) => void;
  onAssess: (areaId: AreaId, assessment: SelfAssessment | null) => void;
  /**
   * かかった時間を記録: opens the actual time surface by the pressed button;
   * `title` names it on the surface.
   */
  onAddActual: AddActual;
  className?: string | undefined;
};

function FactsPane({
  data,
  readOnly = false,
  onPin,
  onAssess,
  onAddActual: addActual,
  className,
}: FactsPaneProps) {
  const { facts, used } = data;
  const pinned = (pin: RetroPin) => data.pins.some((p) => samePin(p, pin));
  const toggle = (pin: RetroPin, subject: string) =>
    readOnly ? null : (
      <PinToggle
        pinned={pinned(pin)}
        subject={subject}
        onToggle={() => onPin(pin)}
      />
    );
  const onAddActual = readOnly ? undefined : addActual;
  // compact is not a smaller table: each Task is stacked (owner decision
  // in #57), so nothing needs scrolling sideways.
  const compact = !useMediaQuery(MEDIUM_UP, true);
  const entered = facts.tasks.filter((t) => t.actualHours > 0).length;
  const total = facts.plannedTotal.withAdditions;
  const { planned: plannedHours, current: currentHours } = facts.availableHours;
  const changedGoals = facts.areas.filter(
    (a) => a.goal !== undefined && a.goal.changedSinceConfirm,
  );
  // Also when the hours were first entered after confirming.
  const hoursChanged = currentHours !== plannedHours;
  const { minutes: interruptMinutes, withoutMinutes } = facts.interruptTime;
  // The band says the plan with the additions once (#253); the plan as
  // confirmed is said only when it is not that total. An addition removed
  // again changes neither.
  const { atConfirm } = facts.plannedTotal;
  const sameTotal =
    atConfirm.lo === total.lo &&
    atConfirm.hi === total.hi &&
    atConfirm.unestimated === total.unestimated &&
    atConfirm.unestimatedSubtasks === total.unestimatedSubtasks;
  const unestimatedAside = formatPlanningAside(total) !== undefined;
  const interruptNote = [
    withoutMinutes > 0 && `時間の記録なし ${withoutMinutes}件`,
    interruptMinutes > 0 && 'タスクの実績には含みません',
  ]
    .filter(Boolean)
    .join('。');

  // Under 詳しく (#241): the plan as confirmed against the hours entered
  // when planning (owner decision in #167), words only, no danger, as a
  // fact of the week, when the plan changed. Then the interrupts, which are
  // not actual time of a Task, so 実績 above leaves their minutes out (#167).
  const details = [
    ...(facts.capacity === undefined || sameTotal
      ? []
      : [
          <li key="atConfirm">
            <span className="text-ink-muted">
              確定したときの計画{' '}
              <span className="whitespace-nowrap">
                {formatPlanningSum(atConfirm)}：
              </span>
            </span>
            <Sentences
              items={capacityRelationSentences(facts.capacity.atConfirm)}
            />
          </li>,
        ]),
    ...(facts.interrupts.length > 0
      ? [
          <li key="interrupts">
            割り込み {facts.interrupts.length}件
            {interruptMinutes > 0 &&
              ` · 合計 ${formatHours(interruptMinutes / 60)}`}
            {interruptNote !== '' && (
              <span className="text-ink-muted">（{interruptNote}）</span>
            )}
          </li>,
        ]
      : []),
  ];
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 持ち越し N件 in the summary moves to the rows, one press at a time from
  // the first, and round again after the last.
  const paneRef = useRef<HTMLDivElement>(null);
  const nextCarried = useRef(0);
  const goToCarriedOver = () => {
    const rows =
      paneRef.current?.querySelectorAll<HTMLElement>('[data-carried-over]') ??
      [];
    const row = rows[nextCarried.current % rows.length];
    nextCarried.current = (nextCarried.current + 1) % Math.max(rows.length, 1);
    if (row === undefined) return;
    row.focus();
    row.scrollIntoView?.({ block: 'center' });
  };

  return (
    <div
      ref={paneRef}
      data-slot="facts-pane"
      // The tables of Tasks and occurrences take the whole width; the rest
      // is text and keeps to the reading column (owner decision in #73).
      className={cn(
        'flex flex-col gap-12 [&>*:not([data-wide])]:max-w-pane-today',
        className,
      )}
    >
      <section aria-label="Sprint の結果" className="flex flex-col gap-3">
        <SprintSummary
          items={[
            { label: '完了', value: facts.completed.length, unit: '件' },
            {
              label: '持ち越し',
              icon: <CarryIcon aria-hidden />,
              value: facts.carriedOver.length,
              unit: '件',
              // To the rows that carry the same icon; 0 is only text.
              ...(facts.carriedOver.length > 0 && {
                onSelect: goToCarriedOver,
                selectLabel: `持ち越し ${facts.carriedOver.length}件の行へ移る`,
              }),
            },
            {
              // All the Sprint's occurrences, split as the table's rows are
              // (#245): the skipped ones are said here once, not apart.
              label: '繰り返し',
              value: facts.occurrences.all.length,
              unit: '回',
              quiet: true,
              // Breaks only at 「 · 」.
              note: (
                <Sentences
                  items={[
                    `完了 ${facts.occurrences.done.length}`,
                    `スキップ ${facts.occurrences.skipped.length}`,
                    `未完了 ${facts.occurrences.missed.length}`,
                  ]}
                />
              ),
            },
            {
              label: '週の途中の追加',
              value: facts.midSprint.length,
              unit: '件',
              quiet: true,
            },
            {
              label: '計画',
              value: formatPlanningSum(total),
              lower: true,
              quiet: true,
              // Not when the value is the count itself (「見積もりなし 1件」).
              note: unestimatedAside
                ? `見積もりなし ${total.unestimated + total.unestimatedSubtasks}件`
                : undefined,
            },
            {
              // Only what is entered is summed, and the count says so (#241).
              label: '実績',
              value: formatHours(facts.actualHours),
              lower: true,
              quiet: true,
              note: `入力済み ${entered}件`,
            },
          ]}
        />
        <div className="flex flex-col gap-1 text-body text-ink">
          {/* Whether the plan above fits the hours entered when planning:
              out of 詳しく, the hours said here once (#253). */}
          <p>
            {facts.capacity === undefined ? (
              <span className="text-ink-muted">使える時間は未入力</span>
            ) : (
              <>
                <span className="whitespace-nowrap text-ink-muted">
                  使える時間{' '}
                  {formatHours(facts.capacity.withAdditions.availableHours)}：
                </span>
                <Sentences
                  items={capacityRelationSentences(
                    facts.capacity.withAdditions,
                  )}
                />
              </>
            )}
          </p>
          {details.length > 0 && (
            // The rest under 詳しく, closed at first (#241).
            <>
              <Button
                variant="quiet"
                className="-ms-3 self-start"
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                onClick={() => setDetailsOpen(!detailsOpen)}
              >
                {detailsOpen ? (
                  <ChevronDown aria-hidden />
                ) : (
                  <ChevronRight aria-hidden />
                )}
                {detailsOpen ? '折りたたむ' : '詳しく'}
              </Button>
              <ul
                id={detailsId}
                hidden={!detailsOpen}
                className="flex flex-col gap-1"
              >
                {details}
              </ul>
            </>
          )}
        </div>
      </section>

      {used !== undefined && (
        // Its result is in 引き継ぐ, right before it is decided on (#107).
        <p className="flex items-start gap-2 text-body text-ink">
          <Info
            aria-hidden
            className="mt-1 size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
          />
          <span>
            {`今回の計画のルール${criterionQuotedName(used.criterion.policy, used.areaName)}`}
            <span className="text-ink-muted">
              {readOnly
                ? '（結果と扱いは「引き継ぐ」にあります）'
                : '（扱いは「引き継ぐ」で決めます）'}
            </span>
          </span>
        </p>
      )}

      {(changedGoals.length > 0 || hoursChanged) && (
        <section aria-labelledby="retro-diff" className="flex flex-col gap-3">
          <h2 id="retro-diff" className="text-heading text-ink">
            確定したときとの差
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {changedGoals.map((a) => (
              <FactRow
                key={a.areaId ?? 'none'}
                action={toggle(
                  { kind: 'goal', id: a.areaId ?? '' },
                  `${a.name ?? ''}の目標`,
                )}
              >
                <span className="text-ink-muted">{a.name} の目標：</span>
                {a.goal?.plannedText === undefined
                  ? `確定したときにはなかった → 「${a.goal?.text ?? ''}」`
                  : `「${a.goal.plannedText}」 → 「${a.goal.text}」`}
              </FactRow>
            ))}
            {hoursChanged && (
              <FactRow
                action={toggle({ kind: 'availableHours' }, '使える時間の変更')}
              >
                <span className="text-ink-muted">使える時間：</span>
                確定したとき{' '}
                {plannedHours === undefined
                  ? '未入力'
                  : formatHours(plannedHours)}{' '}
                → 今{' '}
                {currentHours === undefined
                  ? '未入力'
                  : formatHours(currentHours)}
              </FactRow>
            )}
          </ul>
        </section>
      )}

      {facts.areas.map((area) => (
        <AreaFacts
          key={area.areaId ?? 'none'}
          data={data}
          area={area}
          compact={compact}
          toggle={toggle}
          onAssess={readOnly ? undefined : onAssess}
          onAddActual={onAddActual}
        />
      ))}

      {facts.tasks.some((t) => t.recurring) && (
        <section
          aria-labelledby="retro-occurrences"
          data-wide
          className="flex flex-col gap-3 xl:max-w-pane-rows"
        >
          <h2 id="retro-occurrences" className="text-heading text-ink">
            繰り返し
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {data.occurrences.map(
              ({ occurrence: o, title, actualHours, target }) => {
                const subject = `${formatDate(o.scheduledDate)} ${title}`;
                return (
                  <FactRow
                    key={o.id}
                    action={
                      <span className="flex flex-wrap justify-end gap-1">
                        {/* Per occurrence (#56): the time goes to its day.
                            Only where none is entered (#241), before the
                            pin, so that the pins keep one column. */}
                        {onAddActual !== undefined && actualHours === 0 && (
                          <AddActualButton
                            subject={subject}
                            onClick={(anchor) =>
                              onAddActual(
                                target,
                                `${title} · ${formatDate(o.scheduledDate)} の分`,
                                anchor,
                              )
                            }
                          />
                        )}
                        {toggle({ kind: 'occurrence', id: o.id }, subject)}
                      </span>
                    }
                  >
                    <span className="text-ink-muted">
                      {formatDate(o.scheduledDate)}
                    </span>{' '}
                    {title} · {occurrenceWord(o.state)}
                    {actualHours > 0 && (
                      // The separator stays at the end of the line and the
                      // value whole: never 「実績」 and 「30分」 apart (#241).
                      <span className="text-ink-muted">
                        {'\u00a0· '}
                        <span className="whitespace-nowrap">
                          実績 {formatHours(actualHours)}
                        </span>
                      </span>
                    )}
                  </FactRow>
                );
              },
            )}
          </ul>
        </section>
      )}

      {facts.midSprint.length > 0 && (
        <section aria-labelledby="retro-mid" className="flex flex-col gap-3">
          <h2 id="retro-mid" className="text-heading text-ink">
            週の途中の追加
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {facts.midSprint.map((t) => (
              <FactRow
                key={t.sprintTaskId}
                action={toggle(
                  { kind: 'sprintTask', id: t.sprintTaskId },
                  t.title,
                )}
              >
                {t.title} · {OUTCOME_WORDS[t.outcome]}
              </FactRow>
            ))}
          </ul>
        </section>
      )}

      {(facts.deferrals.length > 0 || facts.pauses.length > 0) && (
        <section aria-labelledby="retro-days" className="flex flex-col gap-3">
          <h2 id="retro-days" className="text-heading text-ink">
            見送り・中断
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {[
              ...facts.deferrals.map((s) => ({
                s,
                word: SELECTION_WORDS.deferred,
              })),
              ...facts.pauses.map((s) => ({
                s,
                word: SELECTION_WORDS.paused,
              })),
            ]
              .toSorted((a, b) => (a.s.date < b.s.date ? -1 : 1))
              .map(({ s, word }) => {
                const title = data.titleOf(s.sprintTaskId);
                return (
                  <FactRow
                    key={`${s.id}-${word}`}
                    action={toggle(
                      { kind: 'dailySelection', id: s.id },
                      `${formatDate(s.date)} ${word} ${title}`,
                    )}
                  >
                    <span className="text-ink-muted">{formatDate(s.date)}</span>{' '}
                    {word} · {title}
                    {s.resolution === 'done' && (
                      <span className="text-ink-muted">
                        （その日のうちに完了）
                      </span>
                    )}
                  </FactRow>
                );
              })}
          </ul>
        </section>
      )}

      {facts.interrupts.length > 0 && (
        <section
          aria-labelledby="retro-interrupts"
          className="flex flex-col gap-3"
        >
          <h2 id="retro-interrupts" className="text-heading text-ink">
            割り込み
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {facts.interrupts.map((n) => (
              <FactRow
                key={n.id}
                action={toggle({ kind: 'interrupt', id: n.id }, n.text)}
              >
                <span className="whitespace-nowrap text-ink-muted">
                  {formatDateTime(n.at, data.timeZone)}
                </span>{' '}
                {n.text}
                {n.minutes !== undefined && (
                  <span className="text-ink-muted">
                    {'\u00a0· '}
                    <span className="whitespace-nowrap">
                      {formatHours(n.minutes / 60)}
                    </span>
                  </span>
                )}
              </FactRow>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type AreaFactsProps = {
  data: RetroData;
  area: RetroData['facts']['areas'][number];
  /** Under 768px: Tasks stacked rather than in a table. */
  compact: boolean;
  toggle: (pin: RetroPin, subject: string) => ReactNode;
  /** Absent in a closed Retro: the judgement is read only. */
  onAssess: FactsPaneProps['onAssess'] | undefined;
  onAddActual: AddActual | undefined;
};

function AreaFacts({
  data,
  area,
  compact,
  toggle,
  onAssess,
  onAddActual,
}: AreaFactsProps) {
  const headingId = useId();
  const shown = data.areaOf(area.areaId);
  const { goal, areaId } = area;
  return (
    <section
      aria-labelledby={headingId}
      data-wide
      className="flex flex-col gap-4 border-t border-border pt-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId}>
          <AreaIndicator
            name={area.name ?? shown.name}
            color={shown.color}
            variant="heading"
          />
        </h2>
        {/* The judgement at a glance, by shape and word (owner decision). */}
        {goal?.selfAssessment !== undefined && (
          <AssessmentTag value={goal.selfAssessment} />
        )}
      </div>
      {goal !== undefined && areaId !== null && (
        <div className="flex flex-col gap-3">
          {/* The Goal's 「振り返りに使う」 sits at the right end, over the rows'
              ones (#73); the Goal text keeps to measure-read. The end
              padding matches the table cells'. */}
          <div className="flex flex-wrap items-start justify-between gap-2 medium:pe-2">
            <p className="max-w-measure-read text-goal text-ink">{goal.text}</p>
            {toggle({ kind: 'goal', id: areaId }, `${shown.name}の目標`)}
          </div>
          {onAssess === undefined ? (
            goal.selfAssessment === undefined && (
              <p className="text-meta text-ink-muted">自分の評価：まだ</p>
            )
          ) : (
            <RadioGroup<SelfAssessment | null>
              legend="この目標を自分でどう見ますか"
              value={goal.selfAssessment ?? null}
              onValueChange={(value) => onAssess(areaId, value)}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {ASSESSMENTS.map((a) => (
                  <Radio<SelfAssessment | null>
                    key={a.value}
                    value={a.value}
                    label={a.label}
                  />
                ))}
              </div>
            </RadioGroup>
          )}
        </div>
      )}
      {area.linked.length > 0 && (
        <TaskFacts
          compact={compact}
          caption={goal === undefined ? 'タスク' : '目標に入っているタスク'}
          tasks={area.linked}
          data={data}
          toggle={toggle}
          onAddActual={onAddActual}
        />
      )}
      {area.unlinked.length > 0 && (
        <TaskFacts
          compact={compact}
          caption={
            goal === undefined ? 'タスク' : '目標に入っていなかったタスク'
          }
          tasks={area.unlinked}
          data={data}
          toggle={toggle}
          onAddActual={onAddActual}
        />
      )}
    </section>
  );
}

type TaskFactsProps = {
  caption: string;
  tasks: readonly TaskFact[];
  data: RetroData;
  toggle: AreaFactsProps['toggle'];
  /** Absent in a closed Retro, which has no actions at all. */
  onAddActual: AddActual | undefined;
};

/**
 * A carried-over Task's title is where 持ち越し N件 in the summary moves to
 * (focus, so it is read out; the ring shows where it landed).
 */
const carriedAnchor = (t: TaskFact) =>
  t.outcome === 'carriedOver' ? { 'data-carried-over': '', tabIndex: -1 } : {};
const carriedFocus = 'focus:focus-ring-inset';

/** A group of Tasks: a table from 768px, stacked under it. */
function TaskFacts({
  compact,
  ...props
}: TaskFactsProps & { compact: boolean }) {
  return compact ? <TaskList {...props} /> : <TaskTable {...props} />;
}

/**
 * Estimate / 計画値 / 実績 / 結果, numbers right-aligned (DESIGN.md
 * Typography). Every table has the same columns, so they line up from one
 * Goal to the next (#73); the title takes what is left. From 1200px the
 * actions sit side by side. From 1920px (bp-xl) the columns share the whole
 * width in proportion (the three numbers equal), so the title does not take
 * all of it and the result stays clear of 実績 (#81).
 */
function TaskTable({
  caption,
  tasks,
  data,
  toggle,
  onAddActual,
}: TaskFactsProps) {
  const cell = 'border-b border-border-soft px-2 py-2 align-top';
  const num = cn(cell, 'text-right whitespace-nowrap');
  // A closed Retro has nothing to do on a row: no column for it.
  const actions = onAddActual !== undefined;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[55rem] table-fixed border-collapse text-body">
        <colgroup>
          <col className="xl:w-[32%]" />
          <col className="w-[7rem] xl:w-[11%]" />
          <col className="w-[9rem] xl:w-[11%]" />
          <col className="w-[7rem] wide:w-[10rem] xl:w-[11%]" />
          <col className="w-[13rem] wide:w-[18rem] xl:w-[20%]" />
          {actions && <col className="w-[9rem] wide:w-[13rem] xl:w-[15%]" />}
        </colgroup>
        <caption className="pb-2 text-left text-subheading text-ink">
          {caption}
        </caption>
        <thead>
          <tr className="text-meta text-ink-muted">
            <th scope="col" className={cn(cell, 'text-left font-normal')}>
              タスク
            </th>
            <th scope="col" className={cn(num, 'font-normal')}>
              見積もり
            </th>
            <th scope="col" className={cn(num, 'font-normal')}>
              計画
            </th>
            {/* The end padding keeps 実績 and its difference apart from
                the result's words, which start right after (#167). */}
            <th scope="col" className={cn(num, 'pe-4 font-normal')}>
              実績
            </th>
            <th
              scope="col"
              className={cn(cell, 'text-left font-normal xl:ps-8')}
            >
              結果
            </th>
            {actions && (
              <th scope="col" className={cell}>
                <span className="sr-only">操作</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.sprintTaskId}>
              <th
                scope="row"
                {...carriedAnchor(t)}
                className={cn(cell, 'text-left font-normal', carriedFocus)}
              >
                <span className="text-ink">{t.title}</span>
                {t.carryCount > 0 && (
                  <span className="block text-meta text-ink-muted">
                    前の Sprint から持ち越し（{t.carryCount}回）
                  </span>
                )}
              </th>
              <td className={num}>
                {/* A suggestion is its range alone: an Estimate is one
                    value, so a range in the column is a suggestion (#241). */}
                {t.plan?.estimateHours === undefined &&
                t.plan?.suggestion !== undefined ? (
                  <RangeCell
                    text={formatRange(
                      t.plan.suggestion.lo,
                      t.plan.suggestion.hi,
                    )}
                  />
                ) : (
                  estimateOf(t).text
                )}
              </td>
              <td className={num}>
                <RangeCell text={plannedCellText(t)} />
                {/* Notes break at a phrase within the column, not into 実績. */}
                {[...unestimatedNote(t), ...planNotes(t)].map((note) => (
                  <span
                    key={note}
                    className="block text-meta whitespace-normal text-ink-muted [word-break:auto-phrase]"
                  >
                    {note}
                  </span>
                ))}
              </td>
              <td className={cn(num, 'pe-4')}>
                {t.actualHours > 0 ? formatHours(t.actualHours) : '未入力'}
                {/* 確定したときとの差, under the value it is about (#167). */}
                <DifferenceNote fact={t} />
              </td>
              <td className={cn(cell, 'xl:ps-8')}>
                <TaskResult fact={t} data={data} />
                <DaysNote fact={t} />
              </td>
              {actions && (
                <td className={cn(cell, 'whitespace-nowrap')}>
                  <div className="flex flex-col items-end gap-1 wide:flex-row wide:justify-end">
                    <TaskActions
                      fact={t}
                      actualDate={data.actualDate}
                      toggle={toggle}
                      onAddActual={onAddActual}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A value in a narrow column of numbers: a range that does not fit breaks
 * after its 〜 only, onto a second right-aligned line (「1時間30分〜」
 * 「2時間30分」), never inside a time (#239, owner decision).
 */
function RangeCell({ text }: { text: string }) {
  const at = text.indexOf('〜');
  if (at === -1) return text;
  return (
    <span className="whitespace-normal">
      <span className="whitespace-nowrap">{text.slice(0, at + 1)}</span>
      <wbr />
      <span className="whitespace-nowrap">{text.slice(at + 1)}</span>
    </span>
  );
}
/**
 * compact: one Task per item, its values in words on wrapping lines
 * (「見積もりの提案 3〜5時間 · 計画 5時間（ルール） · 実績 4時間30分」), then its outcome and days,
 * then its actions in a row.
 */
function TaskList({
  caption,
  tasks,
  data,
  toggle,
  onAddActual,
}: TaskFactsProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-subheading text-ink">
        {caption}
      </h3>
      <ul className="flex flex-col border-t border-border-soft">
        {tasks.map((t) => {
          const estimate = estimateOf(t);
          const difference = differenceText(t);
          const values = [
            // A suggestion and 見積もりなし say what they are; a number needs
            // its name.
            estimate.kind === 'estimate'
              ? `見積もり ${estimate.text}`
              : estimate.text,
            plannedLabel(t),
            actualLabel(t),
            ...(difference === undefined ? [] : [difference]),
          ];
          const days = daysText(t);
          return (
            <li
              key={t.sprintTaskId}
              className="flex flex-col gap-1 border-b border-border-soft py-3"
            >
              <p
                {...carriedAnchor(t)}
                className={cn('text-body text-ink', carriedFocus)}
              >
                {t.title}
              </p>
              {t.carryCount > 0 && (
                <p className="text-meta text-ink-muted">
                  前の Sprint から持ち越し（{t.carryCount}回）
                </p>
              )}
              <p className="text-body text-ink">
                {/* Breaks only between the values, never inside one. */}
                <Sentences items={values} />
              </p>
              <p className="text-meta text-ink-muted">
                <TaskResult fact={t} data={data} iconSize="xs" />
                {days !== undefined && ` · ${days}`}
              </p>
              {onAddActual !== undefined && (
                // At the end, as in the lists of facts (#241).
                <div className="flex flex-wrap justify-end gap-2">
                  <TaskActions
                    fact={t}
                    actualDate={data.actualDate}
                    toggle={toggle}
                    onAddActual={onAddActual}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * 振り返りに使う, and かかった時間を記録 for a non-recurring Task without
 * actual time (F22, #241).
 */
function TaskActions({
  fact,
  actualDate,
  toggle,
  onAddActual,
}: {
  fact: TaskFact;
  /** The day a Task's actual time goes to (RetroData.actualDate). */
  actualDate: RetroData['actualDate'];
  toggle: AreaFactsProps['toggle'];
  onAddActual: AddActual;
}) {
  return (
    <>
      {/* A recurring Task's time goes to one occurrence (繰り返しの回). Only
          where none is entered: the row's exception (#241). */}
      {!fact.recurring && fact.actualHours === 0 && (
        <AddActualButton
          subject={fact.title}
          onClick={(anchor) =>
            onAddActual(
              { sprintTaskId: fact.sprintTaskId, date: actualDate },
              fact.title,
              anchor,
            )
          }
        />
      )}
      {/* Last, so that the pins keep one column (#241). */}
      {toggle({ kind: 'sprintTask', id: fact.sprintTaskId }, fact.title)}
    </>
  );
}

/** かかった時間を記録, named with what it adds to. */
function AddActualButton({
  subject,
  onClick,
}: {
  subject: string;
  onClick: (anchor: HTMLElement) => void;
}) {
  return (
    <Button
      size="sm"
      variant="quiet"
      aria-label={`かかった時間を記録：${subject}`}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <Timer aria-hidden />
      かかった時間を記録
    </Button>
  );
}

/**
 * 「計画より 30分少ない」 under the actual time, if any. Under 1200px the
 * column is narrow and it breaks after 「計画より」, so the table still fits
 * at 1000px; the difference itself is not broken (「30分 / 少ない」, #250).
 */
function DifferenceNote({ fact }: { fact: TaskFact }) {
  const parts = differenceParts(fact);
  if (parts === undefined) return null;
  return (
    <span className="block text-meta whitespace-normal text-ink-muted">
      {parts.against} <span className="whitespace-nowrap">{parts.amount}</span>
    </span>
  );
}

/** 「見送り 2回 · 中断 1回」 under the outcome, if any. */
function DaysNote({ fact }: { fact: TaskFact }) {
  const text = daysText(fact);
  return text === undefined ? null : (
    <span className="block text-meta text-ink-muted">{text}</span>
  );
}

/** One fact in a list, with its 振り返りに使う at the right (none when closed). */
function FactRow({
  children,
  action,
}: {
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    // The actions go under the words when both do not fit (a narrow screen
    // with two actions), rather than squeezing the words.
    <li className="flex min-h-row-touch flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-soft py-1 text-body text-ink medium:min-h-row-task">
      <span className="min-w-0 grow basis-[12rem] [word-break:auto-phrase]">
        {children}
      </span>
      <span className="ms-auto shrink-0">{action}</span>
    </li>
  );
}

export { FactsPane };
