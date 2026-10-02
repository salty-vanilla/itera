import type { Subtask, Task } from '@itera/domain';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxControl } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import { useTaskActions } from '@/store/use-task-actions';

// Subtasks (PRD §6): add, check off, and give each an Estimate. They take
// effect at once. A subtask without an Estimate is counted, not added, in
// the sum (F11), which the time basis choice shows.

function parseHours(text: string): number | null | 'invalid' {
  if (text.trim() === '') return null;
  const hours = Number(text);
  return Number.isFinite(hours) && hours > 0 ? hours : 'invalid';
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
  const actions = useTaskActions();
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [error, setError] = useState<string>();
  const titleRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(pendingRef, () => () => {
    if (title.trim() !== '') return titleRef.current;
    if (hours.trim() !== '') return hoursRef.current;
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
      <form
        className="flex flex-wrap items-start gap-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseHours(hours);
          if (title.trim() === '') return;
          if (parsed === 'invalid') {
            setError('0 より大きい時間を数字で入れてください（例：0.5）');
            // Focus goes to the field in error (accessibility.md).
            hoursRef.current?.focus();
            return;
          }
          setError(undefined);
          const ok = actions.addSubtask(
            task.id,
            title.trim(),
            parsed ?? undefined,
          );
          if (ok) {
            setTitle('');
            setHours('');
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
        <Field
          label="サブタスクの見積もり（時間、任意）"
          hideLabel
          error={error}
          // The field's box stays one quarter wide; the error takes the whole
          // row, after the button, so it does not break inside a word (Issue #226).
          className="contents"
          errorClassName="order-last basis-full"
        >
          <TextInput
            className="w-1/4 min-w-[11rem] shrink-0 medium:min-w-16"
            inputMode="decimal"
            suffix="時間"
            ref={hoursRef}
            placeholder="任意"
            value={hours}
            onChange={(e) => setHours(e.currentTarget.value)}
          />
        </Field>
        <Button type="submit">追加</Button>
      </form>
    </section>
  );
}

function SubtaskRow({ task, subtask }: { task: Task; subtask: Subtask }) {
  const actions = useTaskActions();
  const saved = subtask.estimate === undefined ? '' : String(subtask.estimate);
  const [hours, setHours] = useState(saved);
  const [error, setError] = useState<string>();

  function commit() {
    const parsed = parseHours(hours);
    if (parsed === 'invalid') {
      setError('0 より大きい時間を数字で入れてください（例：0.5）');
      return;
    }
    setError(undefined);
    if ((parsed ?? undefined) === subtask.estimate) return;
    if (!actions.setSubtaskEstimate(task.id, subtask.id, parsed))
      setHours(saved);
  }

  return (
    <li className="flex flex-wrap items-start gap-2 border-b border-border-soft py-2">
      <span className="grid size-target-touch shrink-0 place-items-center medium:size-target-min">
        <CheckboxControl
          checked={subtask.done}
          aria-label={`完了：${subtask.title}`}
          onCheckedChange={(done) =>
            actions.setSubtaskDone(task.id, subtask.id, done)
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
      <Field
        label={`見積もり（時間）：${subtask.title}`}
        hideLabel
        error={error}
        className="contents"
        errorClassName="basis-full"
      >
        <TextInput
          className="w-1/4 min-w-[11rem] shrink-0 medium:min-w-16"
          size="sm"
          inputMode="decimal"
          suffix="時間"
          // Empty says it has none; the sum above counts it (#241). Without
          // the words, the field keeps its width at every size.
          // Saved on leaving it, like the Task detail's own fields: a value
          // left in error keeps the detail open (Issue #95).
          data-detail-field
          value={hours}
          onChange={(e) => setHours(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
      </Field>
    </li>
  );
}

export { SubtaskList };
