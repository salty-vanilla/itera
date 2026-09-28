import type { AreaId, RetroPin, SelfAssessment, TaskFact } from '@itera/domain';
import { Info, Timer } from 'lucide-react';
import { useId, type ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
import type { RetroData } from '@/store/retro-view';
import {
  ASSESSMENTS,
  AssessmentTag,
  OUTCOME_WORDS,
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
  onAddActual: (fact: TaskFact, anchor: HTMLElement) => void;
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
  const entered = facts.tasks.filter((t) => t.actualHours > 0).length;
  const total = facts.plannedTotal.withAdditions;
  const { planned: plannedHours, current: currentHours } = facts.availableHours;
  const changedGoals = facts.areas.filter(
    (a) => a.goal !== undefined && a.goal.changedSinceConfirm,
  );
  const hoursChanged =
    plannedHours !== undefined && currentHours !== plannedHours;

  return (
    <div
      data-slot="facts-pane"
      className={cn('flex flex-col gap-12', className)}
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
              label: '繰り返しの回',
              value: facts.occurrences.done.length,
              unit: '回完了',
              note: `スキップ ${facts.occurrences.skipped.length} · 未処理 ${facts.occurrences.missed.length}`,
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
                計画時 {formatHours(plannedHours, { total: true })} → 今{' '}
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
          toggle={toggle}
          onAssess={onAssess}
          onAddActual={onAddActual}
        />
      ))}

      {facts.tasks.some((t) => t.recurring) && (
        <section
          aria-labelledby="retro-occurrences"
          className="flex flex-col gap-3"
        >
          <h2 id="retro-occurrences" className="text-heading text-ink">
            繰り返しの回
          </h2>
          <ul className="flex flex-col border-t border-border-soft">
            {[
              ...facts.occurrences.done.map((o) => ({ o, word: '完了' })),
              ...facts.occurrences.skipped.map((o) => ({
                o,
                word: 'スキップ',
              })),
              ...facts.occurrences.missed.map((o) => ({
                o,
                word: '未処理',
              })),
            ]
              .toSorted((a, b) =>
                a.o.scheduledDate < b.o.scheduledDate ? -1 : 1,
              )
              .map(({ o, word }) => {
                const title =
                  facts.tasks.find((t) => t.taskId === o.taskId)?.title ?? '';
                return (
                  <FactRow
                    key={o.id}
                    action={toggle(
                      { kind: 'occurrence', id: o.id },
                      `${formatDate(o.scheduledDate)} ${title}`,
                    )}
                  >
                    <span className="text-ink-muted">
                      {formatDate(o.scheduledDate)}
                    </span>{' '}
                    {title} · {word}
                  </FactRow>
                );
              })}
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
  toggle: (pin: RetroPin, subject: string) => ReactNode;
  onAssess: FactsPaneProps['onAssess'];
  onAddActual: FactsPaneProps['onAddActual'];
};

function AreaFacts({
  data,
  area,
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
          <div className="flex flex-wrap items-start justify-between gap-2">
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
        <TaskTable
          caption={goal === undefined ? 'タスク' : 'Goal に紐づくタスク'}
          tasks={area.linked}
          data={data}
          toggle={toggle}
          onAddActual={onAddActual}
        />
      )}
      {area.unlinked.length > 0 && (
        <TaskTable
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

/** Estimate / 計画値 / 実績 / 結果, numbers right-aligned (DESIGN.md Typography). */
function TaskTable({
  caption,
  tasks,
  data,
  toggle,
  onAddActual,
}: {
  caption: string;
  tasks: readonly TaskFact[];
  data: RetroData;
  toggle: AreaFactsProps['toggle'];
  onAddActual: FactsPaneProps['onAddActual'];
}) {
  const cell = 'border-b border-border-soft px-2 py-2 align-top';
  const num = cn(cell, 'text-right whitespace-nowrap');
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-body">
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
            <th scope="col" className={cn(cell, 'w-1/4 text-left font-normal')}>
              結果
            </th>
            <th scope="col" className={cn(cell, 'sticky right-0 bg-canvas')}>
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.sprintTaskId}>
              <th
                scope="row"
                className={cn(cell, 'min-w-[9rem] text-left font-normal')}
              >
                <span className="text-ink">{t.title}</span>
                {t.carryCount > 0 && (
                  <span className="block text-meta text-ink-muted">
                    前の Sprint から持ち越し（{t.carryCount}回）
                  </span>
                )}
              </th>
              <td className={num}>{estimateText(t)}</td>
              <td className={num}>
                {t.plan === undefined
                  ? '未見積'
                  : formatPlanningValue(t.plan.value)}
                {t.plan?.value.criterionApplied === true && (
                  <span className="block text-meta text-ink-muted">基準</span>
                )}
                {t.plan?.occurrenceCount !== undefined && (
                  <span className="block text-meta text-ink-muted">
                    {t.plan.occurrenceCount}回分
                  </span>
                )}
              </td>
              <td className={num}>
                {t.actualHours > 0 ? formatHours(t.actualHours) : '未入力'}
              </td>
              <td className={cell}>
                <span className={t.recurring ? undefined : 'whitespace-nowrap'}>
                  {resultText(t, data)}
                </span>
                {(t.deferredDates.length > 0 || t.pausedDates.length > 0) && (
                  <span className="block text-meta text-ink-muted">
                    {[
                      t.deferredDates.length > 0 &&
                        `見送り ${t.deferredDates.length}回`,
                      t.pausedDates.length > 0 &&
                        `今日はここまで ${t.pausedDates.length}回`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </td>
              {/* Stays at the right while a narrow screen scrolls the table. */}
              <td
                className={cn(
                  cell,
                  'sticky right-0 bg-canvas whitespace-nowrap',
                )}
              >
                <div className="flex flex-col items-end gap-1">
                  {toggle({ kind: 'sprintTask', id: t.sprintTaskId }, t.title)}
                  {!t.recurring && (
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={(event) => onAddActual(t, event.currentTarget)}
                    >
                      <Timer aria-hidden />
                      実績を足す
                      <span className="sr-only">: {t.title}</span>
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function estimateText(t: TaskFact): string {
  const plan = t.plan;
  if (plan?.estimateHours !== undefined) return formatHours(plan.estimateHours);
  if (plan?.suggestion !== undefined) {
    return `提案 ${formatRange(plan.suggestion.lo, plan.suggestion.hi)}`;
  }
  return '未見積';
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
    <li className="flex min-h-row-touch items-center justify-between gap-3 border-b border-border-soft py-1 text-body text-ink medium:min-h-row-task">
      <span className="min-w-0">{children}</span>
      <span className="shrink-0">{action}</span>
    </li>
  );
}

export { FactsPane };
