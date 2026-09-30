import { Plus } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Field } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { TextInput } from '@/components/ui/text-input';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Quick Add. Adds a Task by its title without
// leaving the screen: a `plus` icon, no visible label (it has an accessible
// name), an optional Area Select (beside the field, or under it in a narrow
// pane) and a hint. Enter adds, Esc clears, and the
// focus stays in the field for the next one. Never a modal.

type TaskQuickAddProps = {
  /** Adds the Task. Return false to keep the text (the add failed). */
  onAdd: (title: string) => boolean;
  /** Accessible name of the field. */
  label?: string;
  /** An Area Select, placed after the field. */
  area?: ReactNode;
  /** Puts the Area Select under the field, for a narrow pane. */
  stackArea?: boolean;
  className?: string | undefined;
};

function TaskQuickAdd({
  onAdd,
  label = 'タスクを追加',
  area,
  stackArea = false,
  className,
}: TaskQuickAddProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  return (
    <form
      data-slot="task-quick-add"
      className={cn('flex flex-col gap-1', className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim() === '') return;
        if (onAdd(title.trim())) setTitle('');
        inputRef.current?.focus();
      }}
    >
      <div
        className={cn(
          'flex gap-2',
          stackArea ? 'flex-col items-stretch' : 'items-end',
        )}
      >
        <Field label={label} hideLabel className="min-w-0 flex-1">
          <TextInput
            ref={inputRef}
            prefix={<Plus />}
            value={title}
            placeholder="タイトルを入力"
            enterKeyHint="done"
            aria-describedby={hintId}
            onChange={(event) => setTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              // Esc while converting Japanese input only closes the IME.
              if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                setTitle('');
              }
            }}
          />
        </Field>
        {area}
      </div>
      <p id={hintId} className="hidden text-help text-ink-subtle medium:block">
        <Kbd>Enter</Kbd> で追加 / <Kbd>Esc</Kbd> で取り消し
      </p>
    </form>
  );
}

export { TaskQuickAdd };
export type { TaskQuickAddProps };
