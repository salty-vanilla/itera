import type { Subtask, Task } from '@itera/api-contract';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxControl } from '@/components/ui/checkbox';
import { DurationField } from '@/components/ui/duration-field';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import {
  DURATION_ERROR,
  EMPTY_DURATION,
  hoursText,
  readMinutes,
  sameDuration,
  type DurationText,
} from '@/lib/duration-text';
import { useDraftField } from '@/lib/use-draft-field';
import { useSubtaskActions } from '@/screen-data/use-task-actions';

// Subtasks (PRD §6): add, check off, and give each an Estimate. They take
// effect at once. A subtask without an Estimate is counted, not added, in
// the sum (F11), which the time basis choice shows.

function parseHours(text: DurationText): number | null | 'invalid' {
  const minutes = readMinutes(text);
  if (minutes === undefined) return null;
  return minutes === null || minutes === 0 ? 'invalid' : minutes / 60;
}

function SubtaskList({
  task,
  pendingRef,
}: {
  task: Task;
  /**
   * For the Task detail's close (Issue #95): the field holding a subtask
   * typed but not added, or null.
   */
  pendingRef?: Ref<() => HTMLElement | null> | undefined;
}) {
  const actions = useSubtaskActions();
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState(EMPTY_DURATION);
  const [error, setError] = useState<string>();
  const titleRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(pendingRef, () => () => {
    if (title.trim() !== '') return titleRef.current;
    if (readMinutes(hours) !== undefined) return hoursRef.current;
    return null;
  });

  return (
    <section aria-labelledby="subtasks-heading" className="flex flex-col gap-2">
      <h3 id="subtasks-heading" className="text-subheading text-ink">
        サブタスク
      </h3>
      {task.subtasks.length > 0 && (
        <ul className="flex flex-col">
          {task.subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} task={task} subtask={subtask} />
          ))}
        </ul>
      )}
      {/* The title on a line of its own, the time and 追加 under it, so
          the title is not cut short in the detail's width (#252). */}
      <form
        className="flex flex-col gap-2"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = parseHours(hours);
          if (title.trim() === '') return;
          if (parsed === 'invalid') {
            setError(DURATION_ERROR);
            // Focus goes to the field in error (accessibility.md).
            hoursRef.current?.focus();
            return;
          }
          setError(undefined);
          const added = title.trim();
          const sentHours = hours;
          const ok = await actions.addSubtask(
            task.id,
            added,
            parsed ?? undefined,
          );
          // What was typed while it was sent is the next subtask's.
          if (ok) {
            setTitle((typed) => (typed.trim() === added ? '' : typed));
            setHours((typed) => (typed === sentHours ? EMPTY_DURATION : typed));
          }
        }}
      >
        <Field label="サブタスクを追加" hideLabel className="min-w-0 flex-1">
          <TextInput
            ref={titleRef}
            value={title}
            placeholder="サブタスクのタイトル"
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
        </Field>
        <div className="flex items-start gap-2">
          <DurationField
            label="サブタスクの見積もり（任意）"
            hideLabel
            error={error}
            value={hours}
            onChange={setHours}
            hoursProps={{ ref: hoursRef }}
          />
          <Button
            type="submit"
            loading={actions.loading.addSubtask}
            loadingLabel="追加中…"
          >
            追加
          </Button>
        </div>
      </form>
    </section>
  );
}

function SubtaskRow({ task, subtask }: { task: Task; subtask: Subtask }) {
  const actions = useSubtaskActions();
  // Typed apart from the Subtask as read: left as it was, the field follows
  // another device's change and saves nothing (#324).
  const field = useDraftField(hoursText(subtask.estimate), sameDuration, {
    etag: subtask.etag,
  });
  const hours = field.value;
  const [error, setError] = useState<string>();

  function commit() {
    const parsed = parseHours(hours);
    if (parsed === 'invalid') {
      setError(DURATION_ERROR);
      return;
    }
    setError(undefined);
    // Compared with what the field showed when it was typed in, to the minute.
    if (!field.leave()) return;
    const saving = actions.setSubtaskEstimate(
      task.id,
      subtask.id,
      parsed,
      field.madeFrom,
    );
    field.hold(saving);
    // A save that fails goes back to the value as read.
    void saving.then((ok) => {
      if (!ok) field.drop();
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-2 border-b border-border-soft py-2">
      <span className="grid size-target-touch shrink-0 place-items-center medium:size-target-min">
        <CheckboxControl
          checked={subtask.done}
          aria-label={`完了：${subtask.title}`}
          onCheckedChange={(done) =>
            actions.setSubtaskDone(task.id, subtask.id, done, {
              etag: subtask.etag,
            })
          }
        />
      </span>
      <span
        className={
          subtask.done
            ? 'min-w-0 flex-1 self-center text-body text-ink-subtle line-through'
            : 'min-w-0 flex-1 self-center text-body text-ink'
        }
      >
        {subtask.title}
      </span>
      {/* Compact: under the title, from the checkbox's edge (#252). */}
      <DurationField
        label={`見積もり：${subtask.title}`}
        hideLabel
        size="sm"
        error={error}
        className="basis-full pl-[calc(var(--spacing-target-touch)+var(--spacing-2))] medium:basis-auto medium:pl-0"
        value={hours}
        onChange={field.set}
        // Saved on leaving it, like the Task detail's own fields: a value
        // left in error keeps the detail open (Issue #95). Empty says it
        // has none; the sum above counts it (#241).
        onCommit={commit}
        hoursProps={{ 'data-detail-field': true }}
        minutesProps={{ 'data-detail-field': true }}
      />
    </li>
  );
}

export { SubtaskList };
