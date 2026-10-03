import { Plus } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { TextInput } from '@/components/ui/text-input';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Quick Add. Adds a Task by its title without
// leaving the screen: a `plus` icon, no visible label (the accessible name
// and the placeholder both say where the Task goes), an optional Area Select
// (beside the field, or under it in a narrow pane), an 「追加」 button at every
// width and a hint. The button and Enter add, Esc clears, and the focus stays
// in the field for the next one. Never a modal.

type TaskQuickAddProps = {
  /**
   * Adds the Task. Return false to keep the text (the add failed). An add
   * that is sent returns when it is done; the text stays until then.
   */
  onAdd: (title: string) => boolean | Promise<boolean>;
  /** The add has been sent for a while (useOperation `loading`). */
  loading?: boolean;
  /** Accessible name and placeholder: where the Task goes (#98). */
  label: string;
  /** An Area Select, placed after the field. */
  area?: ReactNode;
  /** Puts the Area Select under the field, for a narrow pane. */
  stackArea?: boolean;
  className?: string | undefined;
};

function TaskQuickAdd({
  onAdd,
  loading,
  label,
  area,
  stackArea = false,
  className,
}: TaskQuickAddProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const field = (
    <Field
      label={label}
      hideLabel
      className={cn(
        'min-w-0 flex-1',
        area !== undefined && 'col-span-2',
        area !== undefined && !stackArea && 'medium:col-auto',
      )}
    >
      <TextInput
        ref={inputRef}
        prefix={<Plus />}
        value={title}
        placeholder={label}
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
  );
  // Pressing it with nothing typed adds nothing; the focus goes to the field.
  const button =
    loading === undefined ? (
      <Button type="submit">追加</Button>
    ) : (
      <Button type="submit" loading={loading} loadingLabel="追加中…">
        追加
      </Button>
    );
  return (
    <form
      data-slot="task-quick-add"
      className={cn('flex flex-col gap-1', className)}
      onSubmit={async (event) => {
        event.preventDefault();
        inputRef.current?.focus();
        const added = title.trim();
        if (added === '' || !(await onAdd(added))) return;
        // Typing went on while it was sent: that text is the next Task's.
        setTitle((typed) => (typed.trim() === added ? '' : typed));
      }}
    >
      {/* Under 768px, and in a narrow pane, the field has the whole first
          row (its placeholder says where the Task goes) and the Area Select
          and the button share the second. From 768px it is one row. The
          order in the page is the same at every width. */}
      <div
        className={cn(
          'grid grid-cols-[1fr_auto] items-end gap-2',
          !stackArea && 'medium:flex',
        )}
      >
        {field}
        {area}
        {button}
      </div>
      <p id={hintId} className="hidden text-help text-ink-subtle medium:block">
        <Kbd>Enter</Kbd> で追加 / <Kbd>Esc</Kbd> で取り消し
      </p>
    </form>
  );
}

export { TaskQuickAdd };
export type { TaskQuickAddProps };
