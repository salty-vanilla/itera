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
  type TaskAttributeUpdate,
  type TaskPriority,
  type TimeBasis,
} from '@itera/domain';
import { Link, useLocation } from '@tanstack/react-router';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
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
import { NEW_AREA } from '@/components/task/area-select';
import {
  ACTUAL_HOURS_ERROR,
  ACTUAL_HOURS_HINT,
  readActualHours,
} from '@/lib/actual-hours';
import { formatDate, formatTime } from '@/lib/date-format';
import { formatHours, formatRange } from '@/lib/time-format';
import { startedText } from '@/lib/today-words';
import type { BacklogData, BacklogItem } from '@/store/backlog-view';
import { useTaskActions } from '@/store/use-task-actions';
import { useTodayActions } from '@/store/use-today';
import { useNewAreaDialog } from './area-dialog';
import { CarryOverText, RecurrenceText, SprintText } from './backlog-row';
import { RecurrenceEditor } from './recurrence-editor';
import { SubtaskList } from './subtask-list';
import { useAddToToday } from './use-add-to-today';
import { useAddToWeek } from './use-add-to-week';

const priorities: readonly { value: TaskPriority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'normal', label: '通常' },
  { value: 'low', label: '低' },
];

/** The fields typed as text: kept as typed until the person leaves them. */
type Draft = {
  title: string;
  description: string;
  due: string;
  estimate: string;
};

type TextKey = keyof Draft;
type FieldKey = TextKey | 'areaId' | 'priority' | 'timeBasis';

/** The words of 「〜を保存しました」 for each field. */
const fieldNames: Record<FieldKey, string> = {
  title: 'タイトル',
  description: '説明',
  areaId: '領域',
  due: '期限',
  priority: '優先度',
  estimate: '見積もり',
  timeBasis: '計画に使う時間',
};

function draftOf(task: Task): Draft {
  return {
    title: task.title,
    description: task.description,
    due: task.due ?? '',
    estimate: task.estimate === undefined ? '' : String(task.estimate.hours),
  };
}

type Reading =
  | { kind: 'error'; message: string }
  | { kind: 'same' }
  | { kind: 'save'; update: TaskAttributeUpdate; estimate?: number | null };

const same: Reading = { kind: 'same' };

/** What leaving a text field records: nothing, a change, or why not. */
function readField(key: TextKey, draft: Draft, task: Task): Reading {
  switch (key) {
    case 'title': {
      const title = draft.title.trim();
      if (title === '') {
        return { kind: 'error', message: 'タイトルを入力してください' };
      }
      return title === task.title ? same : { kind: 'save', update: { title } };
    }
    case 'description':
      return draft.description === task.description
        ? same
        : { kind: 'save', update: { description: draft.description } };
    case 'due': {
      if (draft.due === '') {
        return task.due === undefined
          ? same
          : { kind: 'save', update: { due: null } };
      }
      const parsed = parseLocalDate(draft.due);
      if (!parsed.ok) {
        return {
          kind: 'error',
          message: '日付を入力してください（例：2026-10-05）',
        };
      }
      return parsed.value === task.due
        ? same
        : { kind: 'save', update: { due: parsed.value } };
    }
    case 'estimate': {
      const text = draft.estimate.trim();
      const hours = text === '' ? null : Number(text);
      if (hours !== null && !(Number.isFinite(hours) && hours > 0)) {
        return {
          kind: 'error',
          message: '0 より大きい数で入力してください（例：1.5）',
        };
      }
      return hours === (task.estimate?.hours ?? null)
        ? same
        : { kind: 'save', update: {}, estimate: hours };
    }
  }
}

/** The items folded under 詳しく, in their order (Issue #95). */
type MoreKey = 'description' | 'subtasks' | 'recurrence';

const moreNames: Record<MoreKey, string> = {
  description: '説明',
  subtasks: 'サブタスク',
  recurrence: '繰り返し',
};

function valuesOf(item: BacklogItem): Record<MoreKey, boolean> {
  return {
    description: item.task.description !== '',
    subtasks: item.task.subtasks.length > 0,
    recurrence: item.rule !== undefined,
  };
}

/**
 * 保存しました, beside the field's label: it takes no line of its own, so
 * nothing moves under the pointer when a field is saved on leaving it. The
 * detail announces the save once, in its status line.
 */
function Saved({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      {show && (
        <span
          aria-hidden
          data-slot="saved-note"
          className="absolute top-0 right-0 flex items-center gap-1 text-help text-ink-muted [&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]"
        >
          <Check />
          保存しました
        </span>
      )}
    </div>
  );
}

/** The line under 今日と今週 for a Task in today's 今日やる. */
function dayText(
  today: NonNullable<BacklogItem['today']>,
  timeZone: BacklogData['timeZone'],
): string {
  switch (today.resolution) {
    case 'started':
      return `「今日やる」に入っています（${startedText(today.startedAt, timeZone)}）`;
    case 'done':
      return '「今日やる」に入っています（完了）';
    case 'skipped':
      return '「今日やる」に入っています（この回はスキップ）';
    case 'selected':
      return '「今日やる」に入っています';
  }
}

/** The line under 今日と今週 after the Task was closed for the day. */
const closedText: Record<
  NonNullable<BacklogItem['closedToday']>,
  { result: string; rest?: string }
> = {
  paused: {
    result: '今日はここまでにしました。',
    rest: '明日から今週の残りに出ます。',
  },
  deferred: {
    result: '今日は見送りました。',
    rest: '明日から今週の残りに出ます。',
  },
  removed: { result: '今日の予定から外しました。' },
};

type Outcome =
  | {
      kind: 'adopted';
      suggestionId: EstimateSuggestionId;
      previous: EstimateRecord | null;
      text: string;
    }
  | { kind: 'rejected'; suggestionId: EstimateSuggestionId; text: string };

/**
 * The Task detail (PRD §5 A Organize). Every field is saved on its own when
 * the person leaves it (a choice, when it is made); a value that cannot be
 * saved stays in the field with its error. Subtasks, the suggestion, the
 * recurrence rule and the actions take effect at once, each through its
 * domain command. The footer only closes (Issue #95).
 */
function TaskDetail({
  item,
  areas,
  timeZone,
  onClose,
  onComplete,
  focusEstimate,
  leaveRef,
  footer,
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
   * there again (`useEstimateFocus`). Otherwise it opens on the heading.
   */
  focusEstimate?: number | undefined;
  /** From `useTaskDetailLeave`: the screen asks before it closes the detail. */
  leaveRef?: Ref<(then: () => void, opens: boolean) => void> | undefined;
  /**
   * Beside 閉じる, always in view: Planning shows what the plan comes to, so
   * that an Estimate typed here shows its effect before closing (#165).
   */
  footer?: ReactNode;
}) {
  const actions = useTaskActions();
  const newArea = useNewAreaDialog();
  const todayActions = useTodayActions();
  const addToToday = useAddToToday();
  const addToWeek = useAddToWeek();
  const { task } = item;
  const facts = item;
  const toast = useToast();
  // 今日と今週: Today is where 今日を開く leads, so it is not offered there.
  const onTodayScreen = useLocation({ select: (l) => l.pathname === '/today' });
  // 今週へ is for the Backlog and Today (#155). Planning chooses for its own
  // week with □, and the running Sprint lists only its own Tasks.
  const onSprintScreen = useLocation({
    select: (l) => l.pathname === '/sprint',
  });
  const offersWeek = facts.canAddToWeek && !onSprintScreen;
  // A recurring Task in the week is done per occurrence, in Today (#171).
  const opensOccurrences =
    facts.recurrence !== undefined &&
    facts.thisWeek?.confirmed === true &&
    facts.today === undefined &&
    !onTodayScreen;
  const nowRef = useRef<HTMLElement>(null);
  const openTodayRef = useRef<HTMLAnchorElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // 今日はここまで asks for the actual time in the section itself: a Drawer
  // is never opened inside a Drawer (DESIGN.md Drawer).
  const [pausing, setPausing] = useState(false);
  const [pauseText, setPauseText] = useState('');
  const [pauseError, setPauseError] = useState<string>();
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const pauseInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pausing) pauseInputRef.current?.focus();
  }, [pausing]);
  function closePause() {
    setPausing(false);
    setPauseText('');
    setPauseError(undefined);
    requestAnimationFrame(() => pauseButtonRef.current?.focus());
  }
  function submitPause(event: FormEvent) {
    event.preventDefault();
    if (facts.today === undefined) return;
    const hours = readActualHours(pauseText);
    if (hours === null) {
      setPauseError(ACTUAL_HOURS_ERROR);
      pauseInputRef.current?.focus();
      return;
    }
    if (todayActions.pause(facts.today.selectionId, hours)) {
      setPausing(false);
      setPauseText('');
      setPauseError(undefined);
      setOperations((n) => n + 1);
    }
  }
  // After an operation of the section the button pressed is gone: the
  // focus goes to 今日を開く, else to the first button left, else the title.
  const [operations, setOperations] = useState(0);
  useEffect(() => {
    if (operations === 0) return;
    (
      openTodayRef.current ??
      nowRef.current?.querySelector<HTMLElement>('button:not([disabled])') ??
      titleRef.current
    )?.focus();
  }, [operations]);
  function runNow(run: () => boolean) {
    if (run()) setOperations((n) => n + 1);
  }
  const [draft, setDraft] = useState(() => draftOf(task));
  const [errors, setErrors] = useState<Partial<Record<TextKey, string>>>({});
  // The field saved last, marked 保存しました until it is edited again.
  const [saved, setSaved] = useState<FieldKey>();
  const [outcome, setOutcome] = useState<Outcome>();
  // After 元に戻す the suggestion comes back and takes the focus.
  const [suggestionBack, setSuggestionBack] = useState(false);
  // 詳しく: the items with a value when the detail opened are out of the
  // fold. Nothing moves in or out while it is open, so an item keeps its
  // focus and its state when it gets a value.
  const [openedWith] = useState(() => valuesOf(item));
  const [more, setMore] = useState(false);
  const moreId = useId();
  // Which of the day's operations the section offers.
  const resolution = facts.today?.resolution;
  const offers = {
    start: resolution === 'selected',
    pause: resolution === 'started',
    defer: resolution === 'selected' || resolution === 'started',
    skip: resolution === 'selected' && facts.today?.recurring === true,
    remove: resolution === 'selected',
  };
  // What was typed in the subtask and recurrence forms but not added or
  // applied: closing asks first, with the operation it would carry out.
  const [held, setHeld] = useState<{
    then: () => void;
    /** `then` opens another Task: 破棄して開く rather than 破棄して閉じる. */
    opens: boolean;
    subtask: boolean;
    recurrence: boolean;
  }>();
  const noticeId = useId();
  const backRef = useRef<HTMLButtonElement>(null);
  const subtaskPending = useRef<() => HTMLElement | null>(null);
  const recurrencePending = useRef<() => HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const foldRef = useRef<HTMLDivElement>(null);
  const estimateRef = useRef<HTMLInputElement>(null);
  // Opening, the Drawer finds it by `data-autofocus`; already open, this.
  useEffect(() => {
    if (focusEstimate !== undefined) estimateRef.current?.focus();
  }, [focusEstimate]);
  const suggestion = presentedSuggestion(task);
  const set = (key: TextKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (saved === key) setSaved(undefined);
  };
  // The suggestion's operations put a saved value in the field: whatever
  // was wrong with the text before is gone with it.
  const replaceEstimate = (value: string) => {
    set('estimate', value);
    setErrors((e) => {
      const next = { ...e };
      delete next.estimate;
      return next;
    });
  };

  function record(
    key: FieldKey,
    update: TaskAttributeUpdate,
    estimate?: number | null,
  ): boolean {
    if (!actions.saveTask(task.id, update, estimate)) return false;
    setSaved(key);
    return true;
  }

  /** Leaving a text field: saves it when it changed and can be saved. */
  function commit(key: TextKey) {
    const reading = readField(key, draft, task);
    setErrors((e) => {
      const next = { ...e };
      if (reading.kind === 'error') next[key] = reading.message;
      else delete next[key];
      return next;
    });
    if (reading.kind === 'save') {
      record(key, reading.update, reading.estimate);
    }
  }

  // Closing or opening another Task leaves the field being edited first,
  // so it is saved or shows its error. One of this detail's fields left in
  // error keeps it open and takes the focus back. A subtask not added or a
  // recurrence change not applied holds it with a notice: 戻る, or
  // 破棄して閉じる (破棄して開く) carries out `then`.
  function leave(then: () => void, opens = false) {
    const body = bodyRef.current;
    if (body === null) return then();
    const active = document.activeElement;
    if (active instanceof HTMLElement && body.contains(active)) {
      flushSync(() => active.blur());
    }
    const invalid = body.querySelector<HTMLElement>(
      '[data-detail-field][aria-invalid="true"]',
    );
    if (invalid !== null) {
      // A subtask's Estimate may be in the fold: open it to show the error.
      flushSync(() => {
        setHeld(undefined);
        if (foldRef.current?.contains(invalid)) setMore(true);
      });
      invalid.focus();
      return;
    }
    const subtask = subtaskPending.current?.() ?? null;
    const recurrence = recurrencePending.current?.() ?? null;
    if (subtask === null && recurrence === null) return then();
    flushSync(() =>
      setHeld({
        then,
        opens,
        subtask: subtask !== null,
        recurrence: recurrence !== null,
      }),
    );
    backRef.current?.focus();
  }
  useImperativeHandle(leaveRef, () => leave);

  /** 戻る: back to what was typed, opening the fold if it is in there. */
  function holdBack() {
    const target = subtaskPending.current?.() ?? recurrencePending.current?.();
    flushSync(() => {
      setHeld(undefined);
      if (target && foldRef.current?.contains(target)) setMore(true);
    });
    target?.focus();
  }

  const leaveOnEnter = (key: TextKey) => (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(key);
    }
  };

  function onAdopt(bound: SuggestionBound) {
    if (suggestion === undefined) return;
    const previous = task.estimate ?? null;
    const hours = boundValue(suggestion, bound);
    if (!actions.adoptSuggestion(task.id, suggestion.id, bound)) return;
    replaceEstimate(String(hours));
    setOutcome({
      kind: 'adopted',
      suggestionId: suggestion.id,
      previous,
      text: `見積もり ${formatHours(hours)} を採用しました（提案 ${formatRange(suggestion.lo, suggestion.hi)}）`,
    });
  }

  function onAdoptEdited(hours: number): boolean {
    if (suggestion === undefined) return false;
    const previous = task.estimate ?? null;
    if (!actions.adoptEditedSuggestion(task.id, suggestion.id, hours)) {
      return false;
    }
    replaceEstimate(String(hours));
    setOutcome({
      kind: 'adopted',
      suggestionId: suggestion.id,
      previous,
      text: `見積もり ${formatHours(hours)} を採用しました（提案 ${formatRange(suggestion.lo, suggestion.hi)} を編集）`,
    });
    return true;
  }

  function onUndoAdopt() {
    if (outcome?.kind !== 'adopted') return;
    if (!actions.undoAdoption(task.id, outcome.suggestionId, outcome.previous))
      return;
    replaceEstimate(
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
      text: `見積もりの提案 ${formatRange(suggestion.lo, suggestion.hi)} を却下しました`,
    });
  }

  function onUndoReject() {
    if (outcome?.kind !== 'rejected') return;
    if (!actions.undoRejection(task.id, outcome.suggestionId)) return;
    setOutcome(undefined);
    setSuggestionBack(true);
  }

  const folded = (Object.keys(moreNames) as MoreKey[]).filter(
    (key) => !openedWith[key],
  );
  // The items with a value come first; the fold opens under its button.
  // Folded items stay mounted, hidden, so what is typed there is kept.
  const moreItems = (inFold: boolean) =>
    (Object.keys(moreNames) as MoreKey[])
      .filter((key) => folded.includes(key) === inFold)
      .map((key) => <Fragment key={key}>{moreItem(key)}</Fragment>);

  function moreItem(key: MoreKey) {
    switch (key) {
      case 'description':
        return (
          <Saved show={saved === 'description'}>
            <Field label="説明" necessity="optional">
              <Textarea
                value={draft.description}
                onChange={(e) => set('description', e.currentTarget.value)}
                onBlur={() => commit('description')}
              />
            </Field>
          </Saved>
        );
      case 'subtasks':
        return (
          <>
            <SubtaskList task={task} pendingRef={subtaskPending} />
            {task.subtasks.length > 0 && (
              <Saved show={saved === 'timeBasis'}>
                <RadioGroup<TimeBasis>
                  legend="計画に使う時間"
                  description="タスクの見積もりとサブタスクの合計は、どちらか一方を計画に使います。"
                  value={task.timeBasis}
                  onValueChange={(timeBasis) =>
                    record('timeBasis', { timeBasis })
                  }
                >
                  <Radio<TimeBasis>
                    value="task"
                    label={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        このタスクの見積もり
                        {facts.taskValue.base === 'none' ? (
                          // 「見積もり」が 2 回続かないように、ここだけ「なし」。
                          <span className="text-num-s text-ink-subtle">
                            なし
                          </span>
                        ) : (
                          <Estimate value={facts.taskValue} inline />
                        )}
                      </span>
                    }
                  />
                  <Radio<TimeBasis>
                    value="subtasks"
                    label={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        サブタスクの合計
                        <Estimate
                          value={facts.subtaskValue}
                          inline
                          subtasksNamed
                        />
                      </span>
                    }
                  />
                </RadioGroup>
              </Saved>
            )}
          </>
        );
      case 'recurrence':
        return <RecurrenceEditor item={item} pendingRef={recurrencePending} />;
    }
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle
          ref={titleRef}
          // Opening shows the Task first; typing starts only when the person
          // chooses a field, so a phone does not raise its keyboard (#95).
          tabIndex={-1}
          data-autofocus={focusEstimate === undefined || undefined}
          className="w-fit rounded-sm focus-visible:focus-ring"
        >
          {task.title}
        </DrawerTitle>
        {(facts.thisWeek ||
          facts.nextWeek ||
          facts.carry ||
          facts.recurrence) && (
          <DrawerDescription className="flex flex-wrap gap-x-3 text-meta">
            {(facts.thisWeek || facts.nextWeek) && (
              <SprintText
                thisWeek={facts.thisWeek}
                nextWeek={facts.nextWeek}
                today={facts.today !== undefined}
              />
            )}
            {facts.carry && <CarryOverText {...facts.carry} />}
            {facts.recurrence && (
              <RecurrenceText recurrence={facts.recurrence} />
            )}
          </DrawerDescription>
        )}
      </DrawerHeader>
      <DrawerBody ref={bodyRef} className="flex flex-col gap-6">
        {(facts.canAddToToday ||
          facts.todayOpensOn !== undefined ||
          offersWeek ||
          facts.today !== undefined ||
          facts.closedToday !== undefined ||
          facts.canComplete ||
          opensOccurrences) && (
          <section
            ref={nowRef}
            aria-labelledby="task-detail-now"
            className="flex flex-col gap-2"
          >
            <h3 id="task-detail-now" className="text-subheading text-ink">
              今日と今週
            </h3>
            {(facts.today !== undefined || facts.closedToday !== undefined) && (
              <p
                role="status"
                className="text-body text-ink [text-wrap:pretty] [word-break:auto-phrase]"
              >
                {facts.today !== undefined ? (
                  dayText(facts.today, timeZone)
                ) : (
                  <>
                    {closedText[facts.closedToday!].result}
                    {closedText[facts.closedToday!].rest !== undefined && (
                      // The consequence on its own line, so that no line ends
                      // with a word's last letters.
                      <span className="block text-help text-ink-muted">
                        {closedText[facts.closedToday!].rest}
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {facts.canAddToToday && (
                <Button
                  onClick={() => runNow(() => addToToday(task.id, task.title))}
                >
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
              {offersWeek && (
                <Button
                  onClick={() => runNow(() => addToWeek(task.id, task.title))}
                >
                  今週へ
                </Button>
              )}
              {offers.start && (
                <Button
                  onClick={() =>
                    runNow(() => todayActions.start(facts.today!.selectionId))
                  }
                >
                  開始
                </Button>
              )}
              {/* While the field is open, its own 今日はここまで records: this one
                  stays where it is, disabled, so that the buttons after it do
                  not move under a second press. */}
              {offers.pause && (
                <Button
                  ref={pauseButtonRef}
                  disabled={pausing}
                  focusableWhenDisabled
                  onClick={() => setPausing(true)}
                >
                  今日はここまで
                </Button>
              )}
              {offers.defer && (
                <Button
                  onClick={() =>
                    runNow(() => todayActions.defer(facts.today!.selectionId))
                  }
                >
                  今日は見送る
                </Button>
              )}
              {offers.skip && (
                <Button
                  onClick={() =>
                    runNow(() => todayActions.skip(facts.today!.selectionId))
                  }
                >
                  今日はスキップ
                </Button>
              )}
              {offers.remove && (
                <Button
                  onClick={() =>
                    runNow(() =>
                      todayActions.removeFromToday(facts.today!.selectionId),
                    )
                  }
                >
                  今日の予定から外す
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
              {facts.today !== undefined && !onTodayScreen && (
                <Link
                  ref={openTodayRef}
                  to="/today"
                  className="inline-flex min-h-target-touch items-center rounded-sm pe-2 text-link underline focus-visible:focus-ring medium:min-h-target-min"
                >
                  今日を開く
                </Link>
              )}
              {opensOccurrences && (
                <Link
                  ref={openTodayRef}
                  to="/today"
                  className="inline-flex min-h-target-touch items-center rounded-sm pe-2 text-link underline focus-visible:focus-ring medium:min-h-target-min"
                >
                  今週の回を開く
                </Link>
              )}
            </div>
            {pausing && facts.today?.resolution === 'started' && (
              <form
                noValidate
                onSubmit={submitPause}
                onKeyDown={(event) => {
                  // Esc leaves the form, not the whole detail.
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closePause();
                  }
                }}
                className="flex flex-col gap-2"
              >
                <Field
                  label="実績時間"
                  necessity="optional"
                  description={ACTUAL_HOURS_HINT}
                  error={pauseError}
                >
                  <TextInput
                    ref={pauseInputRef}
                    inputMode="decimal"
                    suffix="h"
                    value={pauseText}
                    onChange={(e) => setPauseText(e.currentTarget.value)}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">今日はここまで</Button>
                  <Button variant="quiet" onClick={closePause}>
                    キャンセル
                  </Button>
                </div>
              </form>
            )}
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

        <div className="flex flex-col gap-4">
          <Saved show={saved === 'title'}>
            <Field label="タイトル" necessity="required" error={errors.title}>
              <TextInput
                value={draft.title}
                onChange={(e) => set('title', e.currentTarget.value)}
                data-detail-field
                onBlur={() => commit('title')}
                onKeyDown={leaveOnEnter('title')}
              />
            </Field>
          </Saved>
          <Saved show={saved === 'areaId'}>
            <Field label="領域" necessity="optional">
              <Select
                value={task.areaId ?? ''}
                onChange={(e) => {
                  const areaId = e.currentTarget.value;
                  if (areaId === NEW_AREA) {
                    newArea.open((created) =>
                      record('areaId', { areaId: created }),
                    );
                    return;
                  }
                  record('areaId', {
                    areaId: areaId === '' ? null : id<'Area'>(areaId),
                  });
                }}
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
                <option value={NEW_AREA}>新しい領域…</option>
              </Select>
            </Field>
          </Saved>
          {newArea.dialog}
          <Saved show={saved === 'due'}>
            <Field label="期限" necessity="optional" error={errors.due}>
              <TextInput
                type="date"
                value={draft.due}
                onChange={(e) => set('due', e.currentTarget.value)}
                data-detail-field
                onBlur={() => commit('due')}
                onKeyDown={leaveOnEnter('due')}
              />
            </Field>
          </Saved>
          <Saved show={saved === 'priority'}>
            <Field label="優先度">
              <Select
                value={task.priority}
                onChange={(e) =>
                  record('priority', {
                    priority: e.currentTarget.value as TaskPriority,
                  })
                }
              >
                {priorities.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Saved>
          <Saved show={saved === 'estimate'}>
            <Field
              label="見積もり（時間）"
              necessity="optional"
              description="本人の見積もり。0.25時間単位など（例：1.5）"
              error={errors.estimate}
            >
              <TextInput
                ref={estimateRef}
                data-autofocus={focusEstimate !== undefined || undefined}
                inputMode="decimal"
                suffix="h"
                value={draft.estimate}
                onChange={(e) => set('estimate', e.currentTarget.value)}
                data-detail-field
                onBlur={() => commit('estimate')}
                onKeyDown={leaveOnEnter('estimate')}
              />
            </Field>
          </Saved>
        </div>

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

        <div className="flex flex-col gap-4">
          {moreItems(false)}
          {folded.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-2">
                <Button
                  variant="quiet"
                  // The chevron lines up with the fields' left edge.
                  className="-ms-3"
                  aria-expanded={more}
                  aria-controls={moreId}
                  onClick={() => setMore((m) => !m)}
                >
                  {more ? (
                    <ChevronDown aria-hidden />
                  ) : (
                    <ChevronRight aria-hidden />
                  )}
                  詳しく
                </Button>
                {!more && (
                  <span className="text-meta text-ink-muted">
                    {folded.map((key) => moreNames[key]).join('・')}
                  </span>
                )}
              </div>
              <div
                ref={foldRef}
                id={moreId}
                hidden={!more}
                className="flex flex-col gap-4"
              >
                {moreItems(true)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border-soft pt-4">
          <Button
            onClick={() => {
              if (!actions.archiveTask(task.id)) return;
              onClose();
              toast.show({
                kind: 'task-archived',
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
        <p role="status" className="sr-only">
          {saved === undefined ? '' : `${fieldNames[saved]}を保存しました`}
        </p>
      </DrawerBody>
      {held !== undefined && (
        <div className="shrink-0 border-t border-border-soft px-4 py-3">
          <Notice
            live
            title={
              <span id={noticeId} className="flex flex-col">
                {held.subtask && (
                  <span>追加していないサブタスクがあります</span>
                )}
                {held.recurrence && (
                  <span>反映していない繰り返しの変更があります</span>
                )}
              </span>
            }
            action={
              <>
                <Button
                  ref={backRef}
                  size="sm"
                  aria-describedby={noticeId}
                  onClick={holdBack}
                >
                  戻る
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const { then } = held;
                    setHeld(undefined);
                    then();
                  }}
                >
                  {held.opens ? '破棄して開く' : '破棄して閉じる'}
                </Button>
              </>
            }
          />
        </div>
      )}
      <DrawerFooter>
        {footer}
        <Button onClick={() => leave(onClose)}>閉じる</Button>
      </DrawerFooter>
    </>
  );
}

export { TaskDetail };
