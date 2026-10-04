import type { MadeFrom } from '@itera/api-contract/requests';
import type { AreaId, SprintItem } from '@itera/api-contract';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { Pin, Rewind, Route } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NotReady, Read } from '@/api/read-state';
import { ReadStatus } from '@/components/read-status';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { useToast } from '@/components/ui/toast';
import {
  SprintHeader,
  type SprintHeaderProps,
} from '@/components/sprint/sprint-header';
import { formatDate, formatDateRange } from '@/lib/date-format';
import { cn } from '@/lib/utils';
import { weekCall, weekText, weekLabel } from '@/lib/week-text';
import type { ActualTarget, RetroData } from '@/screen-data/retro-view';
import {
  useRetroChoice,
  type RetroChoice,
} from '@/screen-data/use-retro-choice';
import {
  useBeginRetro,
  useRetro,
  useRetroActions,
} from '@/screen-data/use-retro';
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
  const choice = useRetroChoice(search.sprint);
  if (choice.status !== 'ready') return <Reading read={choice} />;
  if (choice.current === undefined) {
    return (
      <ScreenFrame heading="振り返り" meta="振り返る Sprint はありません" />
    );
  }
  return <RetroOf current={choice.current} choice={choice} />;
}

/**
 * What the screen shows in place of the Retro while the Sprints, or a
 * Sprint's Retro, are being read: the heading and the read's status
 * (ReadStatus). `aria-busy` until the read has answered.
 */
function Reading({ read }: { read: NotReady }) {
  return (
    <div
      aria-busy={read.status === 'pending' || undefined}
      className="flex w-full max-w-measure-read flex-col gap-2 px-4 py-10 medium:px-6"
    >
      <h1 className="text-display-m text-ink">振り返り</h1>
      <ReadStatus label="Sprint の一覧" read={read} />
    </div>
  );
}

function RetroOf({
  current,
  choice,
}: {
  current: SprintItem;
  choice: RetroChoice;
}) {
  const steps = useSprintSteps('/retro', choice);
  if (current.state === 'review' || current.state === 'closed') {
    // The last closed Retro leads on to the next Planning (#42); an older
    // one, with a Sprint confirmed after it, does not.
    const leadsOn =
      choice.next === undefined || choice.next.state === 'planning';
    return <RetroFor sprint={current} steps={steps} leadsOn={leadsOn} />;
  }
  return <NotStarted sprint={current} steps={steps} />;
}

function RetroFor({
  sprint,
  steps,
  leadsOn,
}: {
  sprint: SprintItem;
  steps: Steps;
  leadsOn: boolean;
}) {
  const data = useRetro(sprint.id);
  return (
    <RetroView sprint={sprint} data={data} steps={steps} leadsOn={leadsOn} />
  );
}

type Editing = {
  target: ActualTarget;
  title: string;
  anchor: HTMLElement;
  /** The row's 振り返りに使う, beside the button, for the focus (#241). */
  returnFocus: HTMLElement | null;
};

/**
 * A Sprint's Retro. The Sprint Header comes from the Sprint (its number,
 * period and state), so it stays while the Retro is being read: moving
 * from one Sprint to another with its arrows keeps the focus on them.
 */
function RetroView({
  sprint,
  data,
  steps,
  leadsOn,
}: {
  sprint: SprintItem;
  data: Read<RetroData>;
  steps: Steps;
  /** Closed: whether 「Sprint N の計画を始める」 follows (#42). */
  leadsOn: boolean;
}) {
  const search = useSearch({ from: '/retro' });
  const navigate = useNavigate({ from: '/retro' });
  const router = useRouter();
  const toast = useToast();
  const ready = data.status === 'ready';
  const actions = useRetroActions({
    sprintId: sprint.id,
    draftId: ready ? data.draft?.criterion.id : undefined,
  });
  // No stage in the URL (opened from the navigation): where the records
  // say the writing has got to. The URL then names it, so that it stays put
  // while the records change under it. Not known until they are read.
  const fromRecords = ready ? retroStageOf(data) : undefined;
  const stage = search.stage ?? fromRecords ?? 'facts';
  useEffect(() => {
    if (search.stage !== undefined || fromRecords === undefined) return;
    void navigate({
      search: (prev) => ({ ...prev, stage: fromRecords }),
      replace: true,
    });
  }, [search.stage, fromRecords, navigate]);
  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  // The surface leaves with `editing`, before it can hand the focus back.
  // Back to its button, or, when the button left with the time entered (it
  // shows only on rows without time, #241), to the row's 振り返りに使う. The
  // time is drawn after the operation has resolved, so the button is still
  // there when the surface closes: the focus waits for it to go.
  const closedEditing = useRef<(Editing & { recorded: boolean }) | undefined>(
    undefined,
  );
  const recorded = useRef(false);
  useLayoutEffect(() => {
    const closed = closedEditing.current;
    if (editing !== undefined || closed === undefined) return;
    if (closed.recorded && closed.anchor.isConnected) return;
    closedEditing.current = undefined;
    (closed.anchor.isConnected ? closed.anchor : closed.returnFocus)?.focus();
  }, [editing, data]);
  const readOnly = sprint.state === 'closed';
  const setStage = (next: RetroStage) =>
    void navigate({ search: (prev) => ({ ...prev, stage: next }) });

  // After 振り返りを完了, the focus goes to what takes the Complete button's
  // place. The records are drawn after the operation has resolved, so this
  // waits for the button to be there. It is brought to the middle: at the
  // foot, the Toast would cover it on a narrow screen (#168).
  const focusBegin = useRef(false);
  useLayoutEffect(() => {
    if (!focusBegin.current || !readOnly) return;
    const next = document.querySelector<HTMLElement>(
      'nav[aria-label="次の段階"] [data-slot="begin-planning"]',
    );
    if (next === null) return;
    focusBegin.current = false;
    next.focus({ preventScroll: true });
    next.scrollIntoView?.({ block: 'center' });
  }, [readOnly, leadsOn, stage]);
  const complete = async () => {
    focusBegin.current = true;
    if (!(await actions.completeRetro())) {
      focusBegin.current = false;
      return;
    }
    toast.show({
      kind: 'retro-completed',
      tone: 'done',
      title: `Sprint ${sprint.number} の振り返りを完了しました`,
    });
  };

  return (
    // Every screen starts at the same left edge, beside the navigation
    // (#112). From 1920px (bp-xl) every stage is also as wide as the
    // screen: 事実を見る fills it with its tables, the others keep their
    // 720px text and 336px materials; so the left edge stays where it is
    // when the stage changes (owner decision in #81).
    <div
      aria-busy={data.status === 'pending' || undefined}
      className="flex min-h-full w-full max-w-[calc(var(--spacing-pane-today)+var(--spacing-pane-side)+var(--spacing-12))] flex-col gap-8 px-4 pt-6 pb-16 medium:px-6 medium:pt-8 xl:max-w-none"
    >
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
        title={`Sprint ${sprint.number}`}
        week={weekLabel(sprint.week)}
        period={formatDateRange(sprint.start, sprint.end)}
        steps={steps}
        stages={RETRO_STAGES.map((s) => ({
          id: s.id,
          label: s.label,
          href: router.buildLocation({
            to: '/retro',
            search: (prev) => ({ ...prev, stage: s.id }),
          }).href,
        }))}
        // Where the writing has got to is known once the Retro is read: the
        // stages are there from the start, so that the heading under them
        // stays where it is, and none is marked until then.
        currentStage={ready || search.stage !== undefined ? stage : undefined}
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

      {data.status !== 'ready' ? (
        <div className="flex max-w-measure-read flex-col gap-2">
          <h1 className="text-display-m text-ink">振り返り</h1>
          <ReadStatus label="この Sprint の記録" read={data} />
        </div>
      ) : (
        <>
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
                  // copy-lint-ignore long-sentence -- 語は 40 字のまま。アイコンの要素を字数に数えている（Issue #241）
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
                  onPin={actions.setPinned}
                  onAssess={(areaId, assessment) =>
                    actions.assessGoal(
                      areaId as AreaId,
                      assessment,
                      madeFrom(
                        data.sprint.goals.find((g) => g.areaId === areaId),
                      ),
                    )
                  }
                  onAddActual={(target, title, anchor) =>
                    setEditing({
                      target,
                      title,
                      anchor,
                      returnFocus:
                        anchor.parentElement?.querySelector<HTMLElement>(
                          '[aria-pressed]',
                        ) ?? null,
                    })
                  }
                />
              )}
              {stage === 'reflect' && (
                <ReflectPane
                  data={data}
                  readOnly={readOnly}
                  onPin={actions.setPinned}
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
                  onDraftPolicy={(policy) =>
                    actions.setDraftPolicy(
                      policy,
                      madeFrom(data.draft?.criterion),
                    )
                  }
                  onDropDraft={actions.dropCriterionDraft}
                  onDecide={(decision) =>
                    actions.decideCriterion(
                      decision,
                      madeFrom(data.sprint.criterionUse),
                    )
                  }
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
                    <CompleteRetro
                      data={data}
                      onComplete={complete}
                      loading={actions.loading.completeRetro}
                    />
                  )}
                  {stage === 'handoff' && readOnly && leadsOn && (
                    <BeginPlanning />
                  )}
                </nav>
              </div>
            </div>
            {stage !== 'facts' && (
              <aside className="hidden wide:block">
                <div className="sticky top-8">
                  <Materials
                    data={data}
                    onPin={
                      data.capabilities.canUnpinFact
                        ? actions.setPinned
                        : undefined
                    }
                  />
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {editing !== undefined && (
        <ActualTime
          key={`${editing.target.sprintTaskId}-${editing.target.occurrenceId ?? ''}`}
          mode="add"
          taskTitle={editing.title}
          // The day it goes to, which is not always today in Retro (F22).
          description={`${formatDate(editing.target.date)} に記録します。`}
          open
          onOpenChange={(open) => {
            if (open) return;
            closedEditing.current = { ...editing, recorded: recorded.current };
            recorded.current = false;
            setEditing(undefined);
          }}
          anchor={editing.anchor}
          loading={actions.loading.recordActual}
          onSubmit={async (hours) => {
            if (hours === undefined) return false;
            const ok = await actions.recordActual(
              editing.target.sprintTaskId,
              hours,
              editing.target.date,
              editing.target.occurrenceId,
            );
            recorded.current = ok;
            return ok;
          }}
        />
      )}
    </div>
  );
}

/**
 * A Sprint whose Retro has not started: running (its Retro starts on its
 * last day, F21) or still being planned.
 */
function NotStarted({ sprint, steps }: { sprint: SprintItem; steps: Steps }) {
  const { beginRetro, loading } = useBeginRetro(sprint.id);
  const week = weekCall(sprint.week, sprint.number);
  // From its last day on (F21), as the read says (#323).
  const lastDay = sprint.capabilities.canBeginRetro;
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
        title={`Sprint ${sprint.number}`}
        week={weekLabel(sprint.week)}
        period={formatDateRange(sprint.start, sprint.end)}
        steps={steps}
        actions={
          lastDay ? (
            <Button
              variant="primary"
              loading={loading}
              loadingLabel="開始中…"
              onClick={() => void beginRetro()}
            >
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

/**
 * A choice is made from the record as it is read now (#321): its etag, or
 * none when it is not there (the operation then answers that).
 */
function madeFrom(record: { readonly etag: string } | undefined): MadeFrom {
  return record === undefined ? { none: true } : { etag: record.etag };
}
