import {
  boundValue,
  id,
  parseLocalDate,
  presentedSuggestion,
  toLocalDate,
  type Estimate as EstimateRecord,
  type EstimateSuggestionId,
  type SuggestionBound,
  type Task,
  type TaskPriority,
  type TimeBasis,
} from '@itera/domain';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { TextInput } from '@/components/ui/text-input';
import {
  EstimateSuggestion,
  SuggestionOutcome,
} from '@/components/task/estimate-suggestion';
import { Estimate } from '@/components/task/estimate';
import { formatDate, formatTime } from '@/lib/date-format';
import { formatHours, formatRange } from '@/lib/time-format';
import type { BacklogData, BacklogItem } from '@/store/backlog-view';
import { useTaskActions } from '@/store/use-task-actions';
import { CarryOverText, RecurrenceText, SprintText } from './backlog-row';
import { RecurrenceEditor } from './recurrence-editor';
import { SubtaskList } from './subtask-list';

const priorities: readonly { value: TaskPriority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '低' },
];

type Draft = {
  title: string;
  description: string;
  areaId: string;
  due: string;
  priority: TaskPriority;
  timeBasis: TimeBasis;
  estimate: string;
};

function draftOf(task: Task): Draft {
  return {
    title: task.title,
    description: task.description,
    areaId: task.areaId ?? '',
    due: task.due ?? '',
    priority: task.priority,
    timeBasis: task.timeBasis,
    estimate: task.estimate === undefined ? '' : String(task.estimate.hours),
  };
}

type Outcome =
  | {
      kind: 'adopted';
      suggestionId: EstimateSuggestionId;
      previous: EstimateRecord | null;
      text: string;
    }
  | { kind: 'rejected'; suggestionId: EstimateSuggestionId; text: string };

/**
 * The Task detail (PRD §5 A Organize): the attributes and the Estimate are a
 * form saved with 「保存」; subtasks, the suggestion, the recurrence rule and
 * the actions take effect at once, each through its domain command.
 */
function TaskDetail({
  item,
  areas,
  timeZone,
  onClose,
  onComplete,
  focusEstimate,
}: {
  item: BacklogItem;
  /** The Areas to choose from, in the person's order. */
  areas: BacklogData['areas'];
  timeZone: BacklogData['timeZone'];
  onClose: () => void;
  /** 完了にする: the screen closes the detail and leaves the undo line. */
  onComplete: () => void;
  /**
   * E on the row: the focus goes to the Estimate. A new value moves it
   * there again (`useEstimateFocus`).
   */
  focusEstimate?: number | undefined;
}) {
  const actions = useTaskActions();
  const { task } = item;
  const facts = item;
  const toast = useToast();
  const [draft, setDraft] = useState(() => draftOf(task));
  const [errors, setErrors] = useState<{
    title?: string;
    estimate?: string;
    due?: string;
  }>({});
  const [outcome, setOutcome] = useState<Outcome>();
  // After 元に戻す the suggestion comes back and takes the focus.
  const [suggestionBack, setSuggestionBack] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const estimateRef = useRef<HTMLInputElement>(null);
  // Opening, the Drawer finds it by `data-autofocus`; already open, this.
  useEffect(() => {
    if (focusEstimate !== undefined) estimateRef.current?.focus();
  }, [focusEstimate]);
  // After a failed save, focus goes to the first field in error.
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors]);
  const suggestion = presentedSuggestion(task);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function save() {
    const title = draft.title.trim();
    const hours = draft.estimate.trim() === '' ? null : Number(draft.estimate);
    const parsedDue = draft.due === '' ? undefined : parseLocalDate(draft.due);
    const due = parsedDue?.ok ? parsedDue.value : undefined;
    const next = {
      ...(title === '' ? { title: 'タイトルを入力してください' } : {}),
      ...(hours !== null && !(Number.isFinite(hours) && hours > 0)
        ? { estimate: '0 より大きい数で入力してください（例: 1.5）' }
        : {}),
      ...(parsedDue !== undefined && !parsedDue.ok
        ? { due: '日付を入力してください（例: 2026-10-05）' }
        : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const current = task.estimate?.hours ?? null;
    const ok = actions.saveTask(
      task.id,
      {
        title,
        description: draft.description,
        areaId: draft.areaId === '' ? null : id<'Area'>(draft.areaId),
        due: due === undefined ? null : due,
        priority: draft.priority,
        timeBasis: draft.timeBasis,
      },
      hours === current ? undefined : hours,
    );
    if (ok) onClose();
  }

  function onAdopt(bound: SuggestionBound) {
    if (suggestion === undefined) return;
    const previous = task.estimate ?? null;
    const hours = boundValue(suggestion, bound);
    if (!actions.adoptSuggestion(task.id, suggestion.id, bound)) return;
    set('estimate', String(hours));
    setOutcome({
      kind: 'adopted',
      suggestionId: suggestion.id,
      previous,
      text: `Estimate ${formatHours(hours)} を採用しました（Agent 提案 ${formatRange(suggestion.lo, suggestion.hi)}）`,
    });
  }

  function onAdoptEdited(hours: number): boolean {
    if (suggestion === undefined) return false;
    const previous = task.estimate ?? null;
    if (!actions.adoptEditedSuggestion(task.id, suggestion.id, hours)) {
      return false;
    }
    set('estimate', String(hours));
    setOutcome({
      kind: 'adopted',
      suggestionId: suggestion.id,
      previous,
      text: `Estimate ${formatHours(hours)} を採用しました（Agent 提案 ${formatRange(suggestion.lo, suggestion.hi)} を編集）`,
    });
    return true;
  }

  function onUndoAdopt() {
    if (outcome?.kind !== 'adopted') return;
    if (!actions.undoAdoption(task.id, outcome.suggestionId, outcome.previous))
      return;
    set(
      'estimate',
      outcome.previous === null ? '' : String(outcome.previous.hours),
    );
    setOutcome(undefined);
    setSuggestionBack(true);
  }

  function onReject() {
    if (suggestion === undefined) return;
    if (!actions.rejectSuggestion(task.id, suggestion.id)) return;
    setOutcome({
      kind: 'rejected',
      suggestionId: suggestion.id,
      text: `提案 ${formatRange(suggestion.lo, suggestion.hi)} を却下しました`,
    });
  }

  function onUndoReject() {
    if (outcome?.kind !== 'rejected') return;
    if (!actions.undoRejection(task.id, outcome.suggestionId)) return;
    setOutcome(undefined);
    setSuggestionBack(true);
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{task.title}</DrawerTitle>
        {(facts.thisWeek || facts.carry || facts.recurrence) && (
          <DrawerDescription className="flex flex-wrap gap-x-3 text-meta">
            {facts.thisWeek && <SprintText {...facts.thisWeek} />}
            {facts.carry && <CarryOverText {...facts.carry} />}
            {facts.recurrence && (
              <RecurrenceText recurrence={facts.recurrence} />
            )}
          </DrawerDescription>
        )}
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-6">
        <form
          id="task-detail-form"
          ref={formRef}
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Field label="タイトル" necessity="required" error={errors.title}>
            <TextInput
              value={draft.title}
              onChange={(e) => set('title', e.currentTarget.value)}
            />
          </Field>
          <Field label="説明" necessity="optional">
            <Textarea
              value={draft.description}
              onChange={(e) => set('description', e.currentTarget.value)}
            />
          </Field>
          <div className="grid gap-4 medium:grid-cols-2">
            <Field label="領域" necessity="optional">
              <Select
                value={draft.areaId}
                onChange={(e) => set('areaId', e.currentTarget.value)}
              >
                <option value="">領域なし</option>
                {/* An archived Area stays selectable while the Task is in it. */}
                {task.areaId !== undefined &&
                  facts.area !== undefined &&
                  !areas.some((a) => a.id === task.areaId) && (
                    <option value={task.areaId}>{facts.area.name}</option>
                  )}
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="期限" necessity="optional" error={errors.due}>
              <TextInput
                type="date"
                value={draft.due}
                onChange={(e) => set('due', e.currentTarget.value)}
              />
            </Field>
            <Field label="優先度">
              <Select
                value={draft.priority}
                onChange={(e) =>
                  set('priority', e.currentTarget.value as TaskPriority)
                }
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Estimate（時間）"
              necessity="optional"
              description="本人の見積もり。0.25時間単位など（例: 1.5）"
              error={errors.estimate}
            >
              <TextInput
                ref={estimateRef}
                data-autofocus={focusEstimate !== undefined || undefined}
                inputMode="decimal"
                suffix="h"
                value={draft.estimate}
                onChange={(e) => set('estimate', e.currentTarget.value)}
              />
            </Field>
          </div>
          {task.subtasks.length > 0 && (
            <RadioGroup<TimeBasis>
              legend="計画に使う時間"
              value={draft.timeBasis}
              onValueChange={(value) => set('timeBasis', value)}
            >
              <Radio<TimeBasis> value="task" label="この Task の Estimate" />
              <Radio<TimeBasis>
                value="subtasks"
                label={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    サブタスクの合計
                    <Estimate value={facts.subtaskValue} />
                  </span>
                }
              />
            </RadioGroup>
          )}
        </form>

        {suggestion !== undefined && (
          <EstimateSuggestion
            key={suggestion.id}
            suggestion={suggestion}
            autoFocus={suggestionBack}
            madeAt={`${formatDate(toLocalDate(suggestion.createdAt, timeZone))} ${formatTime(suggestion.createdAt, timeZone)}`}
            onAdopt={onAdopt}
            onAdoptEdited={onAdoptEdited}
            onReject={onReject}
          />
        )}
        {outcome !== undefined && (
          <SuggestionOutcome
            onUndo={outcome.kind === 'adopted' ? onUndoAdopt : onUndoReject}
          >
            {outcome.text}
          </SuggestionOutcome>
        )}

        <SubtaskList task={task} />
        <RecurrenceEditor item={item} />

        {(facts.canAddToToday ||
          facts.todayOpensOn !== undefined ||
          facts.canComplete) && (
          <section
            aria-labelledby="task-detail-now"
            className="flex flex-col gap-2"
          >
            <h3 id="task-detail-now" className="text-subheading text-ink">
              今日と今週
            </h3>
            <div className="flex flex-wrap gap-2">
              {facts.canAddToToday && (
                <Button onClick={() => actions.addToToday(task.id)}>
                  今日へ
                </Button>
              )}
              {facts.todayOpensOn !== undefined && (
                <Button
                  disabled
                  focusableWhenDisabled
                  aria-describedby="task-detail-today-opens"
                >
                  今日へ
                </Button>
              )}
              {facts.canComplete && (
                <Button
                  onClick={() => {
                    onComplete();
                  }}
                >
                  完了にする
                </Button>
              )}
            </div>
            {facts.todayOpensOn !== undefined && (
              <p
                id="task-detail-today-opens"
                className="text-help text-ink-muted"
              >
                Sprint {facts.todayOpensOn.number} が始まる{' '}
                {formatDate(facts.todayOpensOn.start)} から選べます。
              </p>
            )}
          </section>
        )}

        <div className="border-t border-border-soft pt-4">
          <Button
            variant="danger"
            onClick={() => {
              if (!actions.archiveTask(task.id)) return;
              onClose();
              toast.show({
                title: `「${task.title}」をアーカイブしました`,
                action: {
                  label: '元に戻す',
                  onClick: () => actions.restoreTask(task.id),
                },
              });
            }}
          >
            アーカイブ
          </Button>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="quiet" onClick={onClose}>
          キャンセル
        </Button>
        <Button variant="primary" type="submit" form="task-detail-form">
          保存
        </Button>
      </DrawerFooter>
    </>
  );
}

export { TaskDetail };
