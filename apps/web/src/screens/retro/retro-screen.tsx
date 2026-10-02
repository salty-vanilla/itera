import type { Sprint, SprintId } from '@itera/domain';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { Pin, Rewind, Route } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { weekCall, weekText } from '@/lib/week-text';
import type { ActualTarget, RetroData } from '@/store/retro-view';
import { type SprintChoice, type SprintRef } from '@/store/sprint-choice';
import { useAppOverview } from '@/store/use-app-overview';
import { useRetro, useRetroActions } from '@/store/use-retro';
import { useSprintChoice } from '@/store/use-sprint-choice';
import { ActualTime } from '../today/actual-time';
import { BeginPlanning } from '../begin-planning';
import { ScreenFrame } from '../screen-frame';
import { sprintSearchOf, useSprintSteps } from '../sprint-steps';
import { CompleteRetro } from './complete-retro';
import { FactsPane } from './facts-pane';
import { HandoffPane } from './handoff-pane';
import { Materials } from './materials';
import { ReflectPane } from './reflect-pane';
import { retroStageOf } from './retro-stage';

// Retro (docs/design/patterns.md Retro, PRD §5 D). As important as
// Planning: not a report card, but where this week's facts become one
// change to try next Sprint. One workspace that changes from 事実を見る to
// 振り返る to 引き継ぐ; the stage is a search parameter (ADR 0005) and any
// stage can be opened at any time. Thinking space: the reading column is at
// most 720px, and from 1200px 振り返りの材料 sits at its right. 事実を見る
// has no materials beside it: its tables of Tasks take the whole width,
// while its text keeps to 720px (owner decision in #73).
// Any Sprint's Retro opens by its number in the URL (`?sprint=2`, #90):
// by default the one in Review, else the running one (its Retro starts on
// its last day, F21), else the last closed. A closed Sprint's Retro is read
// only: its facts, judgements and words stay as they were (F22,
// invariant 40).

export type RetroStage = 'facts' | 'reflect' | 'handoff';

export const RETRO_STAGES: readonly { id: RetroStage; label: string }[] = [
  { id: 'facts', label: '事実を見る' },
  { id: 'reflect', label: '振り返る' },
  { id: 'handoff', label: '引き継ぐ' },
];

/**
 * The stage's heading. 事実を見る names the Sprint: in Review or closed it
 * is never 「今週」, as the next one to start is (#90).
 */
function stageHeading(stage: RetroStage, number: number): string {
  switch (stage) {
    case 'facts':
      return `Sprint ${number} で何が起きたか`;
    case 'reflect':
      return '何に気づいたか';
    case 'handoff':
      return '次の Sprint に何を引き継ぐか';
  }
}

export interface RetroSearch {
  /** The Sprint to open, by number (#90). Absent: the current one. */
  readonly sprint?: number | undefined;
  readonly stage?: RetroStage;
}

export function validateRetroSearch(
  search: Record<string, unknown>,
): RetroSearch {
  const stage = RETRO_STAGES.find((s) => s.id === search.stage)?.id;
  return {
    ...sprintSearchOf(search),
    ...(stage === undefined ? {} : { stage }),
  };
}

type Steps = SprintHeaderProps['steps'];

function RetroScreen() {
  const search = useSearch({ from: '/retro' });
  const choice = useSprintChoice('retro', search.sprint);
  if (choice === undefined) {
    return (
      <ScreenFrame heading="振り返り" meta="振り返る Sprint はありません" />
    );
  }
  return <RetroOf choice={choice} />;
}

function RetroOf({ choice }: { choice: SprintChoice }) {
  const steps = useSprintSteps('/retro', choice);
  const { sprint } = choice.current;
  if (sprint === undefined) return null;
  if (sprint.state === 'review' || sprint.state === 'closed') {
    return <RetroFor sprintId={sprint.id} choice={choice} steps={steps} />;
  }
  return <NotStarted current={choice.current} sprint={sprint} steps={steps} />;
}

function RetroFor({
  sprintId,
  choice,
  steps,
}: {
  sprintId: SprintId;
  choice: SprintChoice;
  steps: Steps;
}) {
  const data = useRetro(sprintId);
  if (data === undefined) return null;
  // The last closed Retro leads on to the next Planning (#42); an older
  // one, with a Sprint confirmed after it, does not.
  const leadsOn =
    choice.next === undefined || choice.next.sprint?.state === 'planning';
  return <RetroView data={data} steps={steps} leadsOn={leadsOn} />;
}

type Editing = { target: ActualTarget; title: string; anchor: HTMLElement };

function RetroView({
  data,
  steps,
  leadsOn,
}: {
  data: RetroData;
  steps: Steps;
  /** Closed: whether 「Sprint N の計画を始める」 follows (#42). */
  leadsOn: boolean;
}) {
  const search = useSearch({ from: '/retro' });
  const navigate = useNavigate({ from: '/retro' });
  const router = useRouter();
  const toast = useToast();
  const actions = useRetroActions();
  // No stage in the URL (opened from the navigation): where the records
  // say the writing has got to. The URL then names it, so that it stays put
  // while the records change under it.
  const fromRecords = retroStageOf(data);
  const stage = search.stage ?? fromRecords;
  useEffect(() => {
    if (search.stage !== undefined) return;
    void navigate({
      search: (prev) => ({ ...prev, stage: fromRecords }),
      replace: true,
    });
  }, [search.stage, fromRecords, navigate]);
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const readOnly = data.sprint.state === 'closed';
  const setStage = (next: RetroStage) =>
    void navigate({ search: (prev) => ({ ...prev, stage: next }) });

  const complete = () => {
    if (!actions.completeRetro()) return;
    toast.show({
      kind: 'retro-completed',
      tone: 'done',
      title: `Sprint ${data.number} の振り返りを完了しました`,
    });
    // The Complete button goes; the focus moves to what takes its place. It
    // is brought to the middle: at the foot, the Toast would cover it on a
    // narrow screen (#168).
    requestAnimationFrame(() => {
      const next = document.querySelector<HTMLElement>(
        'nav[aria-label="次の段階"] [data-slot="begin-planning"]',
      );
      next?.focus({ preventScroll: true });
      next?.scrollIntoView?.({ block: 'center' });
    });
  };

  return (
    // Every screen starts at the same left edge, beside the navigation
    // (#112). From 1920px (bp-xl) every stage is also as wide as the
    // screen: 事実を見る fills it with its tables, the others keep their
    // 720px text and 336px materials; so the left edge stays where it is
    // when the stage changes (owner decision in #81).
    <div className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8 xl:max-w-none">
      <SprintHeader
        status={
          readOnly ? (
            <Tag tone="done">完了</Tag>
          ) : (
            <Tag tone="neutral" icon={Rewind}>
              振り返り中
            </Tag>
          )
        }
        title={`Sprint ${data.number}`}
        week={data.week}
        period={formatDateRange(data.sprint.start, data.sprint.end)}
        steps={steps}
        stages={RETRO_STAGES.map((s) => ({
          id: s.id,
          label: s.label,
          href: router.buildLocation({
            to: '/retro',
            search: (prev) => ({ ...prev, stage: s.id }),
          }).href,
        }))}
        currentStage={stage}
        stagesDone={readOnly}
        onStage={(stageId, event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setStage(stageId as RetroStage);
        }}
        actions={
          // The same button ends 引き継ぐ, where it takes the place of
          // 「振り返りを完了」: one Primary on the screen (#168).
          readOnly && leadsOn ? (
            <BeginPlanning
              variant={stage === 'handoff' ? 'secondary' : 'primary'}
            />
          ) : undefined
        }
      >
        <p className="text-help text-ink-muted">
          {readOnly
            ? '完了した後は、書いた内容を変えられません。'
            : '書いた内容は、途中で閉じても残ります。'}
        </p>
      </SprintHeader>

      <div
        className={cn(
          'grid grid-cols-1 gap-12',
          stage !== 'facts' &&
            'wide:grid-cols-[minmax(0,var(--spacing-pane-today))_var(--spacing-pane-side)]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-display-m text-ink">
              {stageHeading(stage, data.number)}
            </h1>
            {stage === 'facts' && !readOnly && (
              // Where the mark on a row leads, and its icon, said once: the
              // rows carry the icon alone (#241).
              <p className="text-help text-ink-muted [word-break:auto-phrase]">
                気になった記録に
                <Icon icon={Pin} className="mx-0.5 inline align-[-0.2em]" />
                「振り返りに使う」を付けると、「振り返る」で材料として並びます。
              </p>
            )}
          </div>
          {stage === 'facts' && (
            <FactsPane
              data={data}
              readOnly={readOnly}
              onPin={actions.togglePin}
              onAssess={actions.assessGoal}
              onAddActual={(target, title, anchor) =>
                setEditing({ target, title, anchor })
              }
            />
          )}
          {stage === 'reflect' && (
            <ReflectPane
              data={data}
              readOnly={readOnly}
              onPin={actions.togglePin}
              onReflect={actions.setReflection}
              onImprove={actions.setImprovement}
              showMaterials
            />
          )}
          {stage === 'handoff' && (
            <HandoffPane
              data={data}
              readOnly={readOnly}
              titleOf={data.taskTitleOf}
              onDraft={actions.draftCriterion}
              onDraftPolicy={actions.setDraftPolicy}
              onDropDraft={actions.dropCriterionDraft}
              onDecide={actions.decideCriterion}
              onWriteImprovement={() => setStage('reflect')}
            />
          )}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {stage === 'facts' && !readOnly && (
              // How many facts go on as materials (#167), beside the way to
              // where they gather.
              <p className="text-help text-ink-muted">
                振り返りに使う {data.pins.length}件
              </p>
            )}
            <nav aria-label="次の段階">
              {stage === 'facts' && (
                <Button onClick={() => setStage('reflect')}>
                  次へ：振り返る
                </Button>
              )}
              {stage === 'reflect' && (
                <Button onClick={() => setStage('handoff')}>
                  次へ：引き継ぐ
                </Button>
              )}
              {stage === 'handoff' && !readOnly && (
                <CompleteRetro data={data} onComplete={complete} />
              )}
              {stage === 'handoff' && readOnly && leadsOn && <BeginPlanning />}
            </nav>
          </div>
        </div>
        {stage !== 'facts' && (
          <aside className="hidden wide:block">
            <div className="sticky top-8">
              <Materials
                data={data}
                onPin={readOnly ? undefined : actions.togglePin}
              />
            </div>
          </aside>
        )}
      </div>

      {editing !== undefined && (
        <ActualTime
          key={`${editing.target.sprintTaskId}-${editing.target.occurrenceId ?? ''}`}
          mode="add"
          taskTitle={editing.title}
          // The day it goes to, which is not always today in Retro (F22).
          description={`${formatDate(editing.target.date)} に記録します。`}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          anchor={editing.anchor}
          onSubmit={(hours) =>
            hours !== undefined &&
            actions.recordActual(
              editing.target.sprintTaskId,
              hours,
              editing.target.date,
              editing.target.occurrenceId,
            )
          }
        />
      )}
    </div>
  );
}

/**
 * A Sprint whose Retro has not started: running (its Retro starts on its
 * last day, F21) or still being planned.
 */
function NotStarted({
  current,
  sprint,
  steps,
}: {
  current: SprintRef;
  sprint: Sprint;
  steps: Steps;
}) {
  const { today } = useAppOverview();
  const actions = useRetroActions();
  const week = weekCall(current.week, current.number);
  const lastDay = sprint.state === 'active' && today >= sprint.end;
  return (
    <div className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8">
      <SprintHeader
        status={
          sprint.state === 'active' ? (
            <Tag tone="neutral" icon={Route}>
              進行中
            </Tag>
          ) : (
            <Tag tone="draft">計画中 · 未確定</Tag>
          )
        }
        title={`Sprint ${current.number}`}
        week={current.week}
        period={formatDateRange(sprint.start, sprint.end)}
        steps={steps}
        actions={
          lastDay ? (
            <Button variant="primary" onClick={() => actions.beginRetro()}>
              振り返りを始める
            </Button>
          ) : undefined
        }
      />
      <div className="flex max-w-measure-read flex-col gap-3">
        <h1 className="text-display-m text-ink">
          {weekText(week, 'の振り返り')}
        </h1>
        <p className="text-body text-ink-muted">
          {sprint.state === 'planning'
            ? `この Sprint はまだ計画中です。振り返りは、確定した後、最終日の ${formatDate(sprint.end)} から始められます。`
            : lastDay
              ? '今日はこの Sprint の最終日です。振り返りを始められます。'
              : `この Sprint の振り返りは、最終日の ${formatDate(sprint.end)} から始められます。`}
        </p>
      </div>
    </div>
  );
}

export { RetroScreen };
