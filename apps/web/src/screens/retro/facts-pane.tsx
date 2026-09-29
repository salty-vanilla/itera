import type { AreaId, RetroPin, SelfAssessment, TaskFact } from '@itera/domain';
import { Info, Timer } from 'lucide-react';
import { Fragment, useId, type ReactNode } from 'react';
import { AreaIndicator } from '@/components/ui/area-indicator';
import { Button } from '@/components/ui/button';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { SprintSummary } from '@/components/sprint/sprint-summary';
import { criterionName } from '@/lib/criterion-text';
import { formatDate, formatTime } from '@/lib/date-format';
import {
  formatHours,
  formatPlanningTotal,
  formatPlanningValue,
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

// 事実を見る (patterns.md Retro): 「今週、何が起きたか」. Everything here is
// derived from the records by `retroFacts` and never edited (invariant 40);
// the person only marks facts (気になる), judges Goals and adds actual time
// (F22). No scores and no rates; facts are written neutrally.

type FactsPaneProps = {
  data: RetroData;
  onPin: (pin: RetroPin) => void;
  onAssess: (areaId: AreaId, assessment: SelfAssessment | null) => void;
  /** 実績を足す: opens the actual time surface by the pressed button. */
  /** 実績を足す: `title` names it on the surface. */
  onAddActual: (
    target: ActualTarget,
    title: string,
    anchor: HTMLElement,
  ) => void;
  className?: string | undefined;
};

function FactsPane({
  data,
  onPin,
  onAssess,
  onAddActual,
  className,
}: FactsPaneProps) {
  const { facts, used } = data;
  const pinned = (pin: RetroPin) => data.pins.some((p) => samePin(p, pin));
  const toggle = (pin: RetroPin, subject: string) => (
    <PinToggle
      pinned={pinned(pin)}
      subject={subject}
      onToggle={() => onPin(pin)}
    />
  );
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

  return (
    <div
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
              value: facts.carriedOver.length,
              unit: '件',
            },
            {
              label: 'スキップ',
              value: facts.occurrences.skipped.length,
              unit: '回',
              note: `繰り返しの回：完了 ${facts.occurrences.done.length} · 未処理 ${facts.occurrences.missed.length}`,
            },
            {
              label: 'Sprint 中の追加',
              value: facts.midSprint.length,
              unit: '件',
            },
            {
              label: '計画値の合計',
              value: formatRange(total.lo, total.hi, { total: true }),
              note: [
                total.unestimated + total.unestimatedSubtasks > 0 &&
                  `未見積 ${total.unestimated + total.unestimatedSubtasks}`,
                plannedHours === undefined
                  ? '可用時間は未入力'
                  : `可用時間 ${formatHours(plannedHours, { total: true })}`,
              ]
                .filter(Boolean)
                .join(' · '),
            },
          ]}
        />
        <p className="text-body text-ink">
          計画 {formatPlanningTotal(total)} → 実績{' '}
          {formatHours(facts.actualHours, { total: true })}
          <span className="text-ink-muted">
            （入力済み {entered}件。実績は入力したものだけを数えています）
          </span>
        </p>
      </section>

      {used !== undefined && (
        <section
          aria-labelledby="retro-criterion"
          className="flex flex-col gap-2 rounded-sm bg-canvas-subtle p-4"
        >
          <h2
            id="retro-criterion"
            className="flex items-center gap-2 text-subheading text-ink"
          >
            <Info
              aria-hidden
              className="size-icon-s shrink-0 [stroke-width:var(--icon-stroke-s)]"
            />
            今回の計画基準：
            {criterionName(used.criterion.policy, used.areaName)}
          </h2>
          <p className="text-body text-ink">
            {used.appliedAtConfirm
              ? '確定したときに、今回の計画値に使いました。'
              : '確定したときに、今回の計画値には使いませんでした。'}
          </p>
          {used.appliedAtConfirm && <CriterionOutcome data={data} />}
        </section>
      )}

      {(changedGoals.length > 0 || hoursChanged) && (
        <section aria-labelledby="retro-diff" className="flex flex-col gap-3">
          <h2 id="retro-diff" className="text-heading text-ink">
            計画時との差
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {changedGoals.map((a) => (
              <FactRow
                key={a.areaId ?? 'none'}
                action={toggle(
                  { kind: 'goal', id: a.areaId ?? '' },
                  `${a.name ?? ''}の Goal`,
                )}
              >
                <span className="text-ink-muted">{a.name} の Goal：</span>
                {a.goal?.plannedText === undefined
                  ? `計画時にはなかった → 「${a.goal?.text ?? ''}」`
                  : `「${a.goal.plannedText}」 → 「${a.goal.text}」`}
              </FactRow>
            ))}
            {hoursChanged && (
              <FactRow
                action={toggle({ kind: 'availableHours' }, '可用時間の変更')}
              >
                <span className="text-ink-muted">可用時間：</span>
                計画時{' '}
                {plannedHours === undefined
                  ? '未入力'
                  : formatHours(plannedHours, { total: true })}{' '}
                → 今{' '}
                {currentHours === undefined
                  ? '未入力'
                  : formatHours(currentHours, { total: true })}
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
          onAssess={onAssess}
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
            繰り返しの回
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
                        {toggle({ kind: 'occurrence', id: o.id }, subject)}
                        {/* Per occurrence (#56): the time goes to its day. */}
                        <AddActualButton
                          subject={subject}
                          onClick={(anchor) =>
                            onAddActual(
                              target,
                              `${title}（${formatDate(o.scheduledDate)} の回）`,
                              anchor,
                            )
                          }
                        />
                      </span>
                    }
                  >
                    <span className="text-ink-muted">
                      {formatDate(o.scheduledDate)}
                    </span>{' '}
                    {title} · {occurrenceWord(o.state)}
                    {actualHours > 0 && (
                      <span className="text-ink-muted">
                        {' '}
                        · 実績 {formatHours(actualHours)}
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
            Sprint 中の追加
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
            Today での見送り・今日はここまで
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {[
              ...facts.deferrals.map((s) => ({ s, word: '見送り' })),
              ...facts.pauses.map((s) => ({ s, word: '今日はここまで' })),
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
                <span className="text-ink-muted">
                  {formatTime(n.at, data.timeZone)}
                </span>{' '}
                {n.text}
                {n.minutes !== undefined && (
                  <span className="text-ink-muted">
                    {' '}
                    · {formatHours(n.minutes / 60)}
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

/** 「研究の推定 1 件のうち 1 件を持ち越し（計画値 5h・実績 4.5h）」. */
function CriterionOutcome({ data }: { data: RetroData }) {
  const used = data.used;
  if (used === undefined) return null;
  const { result } = used;
  const scope = used.areaName === undefined ? '' : `${used.areaName}の`;
  if (result.tasks.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        計画値を変えたタスクはありませんでした。
      </p>
    );
  }
  const parts = [
    result.done.length > 0 && `${result.done.length}件を完了`,
    result.carriedOver.length > 0 && `${result.carriedOver.length}件を持ち越し`,
  ].filter(Boolean);
  return (
    <p className="text-body text-ink">
      {scope}推定タスク {result.tasks.length}件のうち {parts.join('、')}
      （計画値 {formatPlanningTotal(result.planned)}・実績{' '}
      {result.actualHours > 0
        ? formatHours(result.actualHours, { total: true })
        : '未入力'}
      ）
    </p>
  );
}

type AreaFactsProps = {
  data: RetroData;
  area: RetroData['facts']['areas'][number];
  /** Under 768px: Tasks stacked rather than in a table. */
  compact: boolean;
  toggle: (pin: RetroPin, subject: string) => ReactNode;
  onAssess: FactsPaneProps['onAssess'];
  onAddActual: FactsPaneProps['onAddActual'];
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
          {/* The Goal's 「気になる」 sits at the right end, over the rows'
              ones (#73); the Goal text keeps to measure-read. The end
              padding matches the table cells'. */}
          <div className="flex flex-wrap items-start justify-between gap-2 medium:pe-2">
            <p className="max-w-measure-read text-goal text-ink">{goal.text}</p>
            {toggle({ kind: 'goal', id: areaId }, `${shown.name}の Goal`)}
          </div>
          <RadioGroup<SelfAssessment | null>
            legend="この Goal を自分でどう見ますか"
            description="システムは判定しません。選ばなくても次へ進めます。"
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
        </div>
      )}
      {area.linked.length > 0 && (
        <TaskFacts
          compact={compact}
          caption={goal === undefined ? 'タスク' : 'Goal に紐づくタスク'}
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
            goal === undefined ? 'タスク' : 'Goal に紐づかなかったタスク'
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
  onAddActual: FactsPaneProps['onAddActual'];
};

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
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[53rem] table-fixed border-collapse text-body">
        <colgroup>
          <col className="xl:w-[32%]" />
          <col className="w-[7rem] xl:w-[11%]" />
          <col className="w-[9rem] xl:w-[11%]" />
          <col className="w-[5rem] xl:w-[11%]" />
          <col className="w-[13rem] wide:w-[18rem] xl:w-[20%]" />
          <col className="w-[9rem] wide:w-[13rem] xl:w-[15%]" />
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
              Estimate
            </th>
            <th scope="col" className={cn(num, 'font-normal')}>
              計画値
            </th>
            <th scope="col" className={cn(num, 'font-normal')}>
              実績
            </th>
            <th
              scope="col"
              className={cn(cell, 'text-left font-normal xl:ps-8')}
            >
              結果
            </th>
            <th scope="col" className={cell}>
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.sprintTaskId}>
              <th scope="row" className={cn(cell, 'text-left font-normal')}>
                <span className="text-ink">{t.title}</span>
                {t.carryCount > 0 && (
                  <span className="block text-meta text-ink-muted">
                    前の Sprint から持ち越し（{t.carryCount}回）
                  </span>
                )}
              </th>
              <td className={num}>{estimateOf(t).text}</td>
              <td className={num}>
                {plannedText(t)}
                {planNotes(t).map((note) => (
                  <span key={note} className="block text-meta text-ink-muted">
                    {note}
                  </span>
                ))}
              </td>
              <td className={num}>
                {t.actualHours > 0 ? formatHours(t.actualHours) : '未入力'}
              </td>
              <td className={cn(cell, 'xl:ps-8')}>
                {/* Breaks only between its parts (「回：完了 2 · スキップ 1」). */}
                {resultText(t, data)
                  .split(' · ')
                  .map((part, i) => (
                    <Fragment key={part}>
                      {i > 0 && ' · '}
                      <span className="whitespace-nowrap">{part}</span>
                    </Fragment>
                  ))}
                <DaysNote fact={t} />
              </td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * compact: one Task per item, its values in words on wrapping lines
 * (「提案 3–5h · 計画 5h（基準） · 実績 4.5h」), then its outcome and days,
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
          const values = [
            // A suggestion and 未見積 say what they are; a number needs its name.
            estimate.kind === 'estimate'
              ? `Estimate ${estimate.text}`
              : estimate.text,
            `計画 ${plannedText(t)}${planNotes(t)
              .map((n) => `（${n}）`)
              .join('')}`,
            `実績 ${t.actualHours > 0 ? formatHours(t.actualHours) : '未入力'}`,
          ];
          const outcome = [resultText(t, data), daysText(t)].filter(
            (x) => x !== undefined,
          );
          return (
            <li
              key={t.sprintTaskId}
              className="flex flex-col gap-1 border-b border-border-soft py-3"
            >
              <p className="text-body text-ink">{t.title}</p>
              {t.carryCount > 0 && (
                <p className="text-meta text-ink-muted">
                  前の Sprint から持ち越し（{t.carryCount}回）
                </p>
              )}
              <p className="text-body text-ink">{values.join(' · ')}</p>
              <p className="text-meta text-ink-muted">{outcome.join(' · ')}</p>
              <div className="flex flex-wrap gap-2">
                <TaskActions
                  fact={t}
                  actualDate={data.actualDate}
                  toggle={toggle}
                  onAddActual={onAddActual}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** 気になる, and 実績を足す for a non-recurring Task (F22). */
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
  onAddActual: FactsPaneProps['onAddActual'];
}) {
  return (
    <>
      {toggle({ kind: 'sprintTask', id: fact.sprintTaskId }, fact.title)}
      {/* A recurring Task's time goes to one occurrence (繰り返しの回). */}
      {!fact.recurring && (
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
    </>
  );
}

/** 実績を足す, named with what it adds to. */
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
      onClick={(event) => onClick(event.currentTarget)}
    >
      <Timer aria-hidden />
      実績を足す
      <span className="sr-only">: {subject}</span>
    </Button>
  );
}

/** The planning value fixed in the plan. */
function plannedText(t: TaskFact): string {
  return t.plan === undefined ? '未見積' : formatPlanningValue(t.plan.value);
}

/** What the value came from: the criterion, and a recurring Task's count. */
function planNotes(t: TaskFact): string[] {
  return [
    ...(t.plan?.value.criterionApplied === true ? ['基準'] : []),
    ...(t.plan?.occurrenceCount === undefined
      ? []
      : [`${t.plan.occurrenceCount}回分`]),
  ];
}

/** 「見送り 2回 · 今日はここまで 1回」, or nothing. */
function daysText(t: TaskFact): string | undefined {
  const parts = [
    ...(t.deferredDates.length > 0
      ? [`見送り ${t.deferredDates.length}回`]
      : []),
    ...(t.pausedDates.length > 0
      ? [`今日はここまで ${t.pausedDates.length}回`]
      : []),
  ];
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** The Estimate in the plan: the person's, the suggestion shown, or none. */
function estimateOf(t: TaskFact): {
  kind: 'estimate' | 'suggestion' | 'none';
  text: string;
} {
  const plan = t.plan;
  if (plan?.estimateHours !== undefined) {
    return { kind: 'estimate', text: formatHours(plan.estimateHours) };
  }
  if (plan?.suggestion !== undefined) {
    return {
      kind: 'suggestion',
      text: `提案 ${formatRange(plan.suggestion.lo, plan.suggestion.hi)}`,
    };
  }
  return { kind: 'none', text: '未見積' };
}

/** 「見送り 2回 · 今日はここまで 1回」 under the outcome, if any. */
function DaysNote({ fact }: { fact: TaskFact }) {
  const text = daysText(fact);
  return text === undefined ? null : (
    <span className="block text-meta text-ink-muted">{text}</span>
  );
}

function resultText(t: TaskFact, data: RetroData): string {
  if (!t.recurring) return OUTCOME_WORDS[t.outcome];
  // A recurring Task is shown by its occurrences, not done / carried (F20).
  const { done, skipped, missed } = data.facts.occurrences;
  const count = (list: readonly { taskId: string }[]) =>
    list.filter((o) => o.taskId === t.taskId).length;
  return `回：完了 ${count(done)} · スキップ ${count(skipped)} · 未処理 ${count(missed)}`;
}

/** One fact in a list, with its 気になる at the right. */
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
      <span className="min-w-0 grow basis-[12rem]">{children}</span>
      <span className="ms-auto shrink-0">{action}</span>
    </li>
  );
}

export { FactsPane };
