import { Plus } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Field } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { TextInput } from '@/components/ui/text-input';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Quick Add. Adds a Task by its title without
// leaving the screen: a `plus` icon, no visible label (it has an accessible
// name), an optional Area Select and a hint. Enter adds, Esc clears, and the
// focus stays in the field for the next one. Never a modal.

type TaskQuickAddProps = {
  /** Adds the Task. Return false to keep the text (the add failed). */
  onAdd: (title: string) => boolean;
  /** Accessible name of the field. */
  label?: string;
  /** An Area Select, placed after the field. */
  area?: ReactNode;
  className?: string | undefined;
};

function TaskQuickAdd({
  onAdd,
  label = 'タスクを追加',
  area,
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
      <div className="flex items-end gap-2">
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
              if (event.key === 'Escape') setTitle('');
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
