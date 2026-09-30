import { Check } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { rowKeyHandlers, type RowKeys } from '@/lib/row-keys';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Task Row. One Task, the same structure in Backlog,
// Sprint and Today: a control (○ complete / □ choose / none), the title
// (`task`, two lines under 768px and one from it), Task Metadata, the Estimate at the right end and the
// row's `…` actions. Rows are separated by `border-soft`, with no gap, no
// corners and no Card.
//
// The title is a button that opens the Task; it stretches over the row so
// that the whole row opens it, while the control and the actions sit above
// it. The actions show on hover and focus, and always under 768px (no
// hover there).
//
// The row takes the list keys of docs/design/accessibility.md while the
// focus is in it (`@/lib/row-keys`): Space presses the control, Enter opens
// the Task, and E / Delete as the screen gives them.

type TaskRowProps = {
  title: string;
  /** ○, □ or nothing. */
  control?: ReactNode;
  metadata?: ReactNode;
  estimate?: ReactNode;
  /** The `…` Menu or other row actions. */
  actions?: ReactNode;
  /**
   * Keeps the width of the `…` when there are no `actions`, so that the
   * Estimate ends where it does in the rows of the same list that have them
   * (Today: 今日やる and 今週の残り share one column of values). From 768px
   * only: under it the `…` is 44px, and the title needs the room more.
   */
  reserveActions?: boolean;
  /**
   * Shows the `actions` at every width, not only on hover and focus: for
   * a way back (「取り消す」) that must not be hidden behind the pointer.
   */
  actionsVisible?: boolean;
  /** Opens the Task (its detail). Without it the title is plain text. */
  onOpen?: (() => void) | undefined;
  /** Read out with the title, e.g. that the detail is open. */
  current?: boolean | undefined;
  done?: boolean | undefined;
  /** E and Delete on the row; Space and Enter need nothing. */
  keys?: RowKeys | undefined;
  className?: string | undefined;
};

function TaskRow({
  title,
  control,
  metadata,
  estimate,
  actions,
  reserveActions = false,
  actionsVisible = false,
  onOpen,
  current = false,
  done = false,
  keys,
  className,
}: TaskRowProps) {
  const titleClass = cn(
    'min-w-0 text-left text-task',
    // Up to two lines under 768px, where the control and the values take
    // the room of a long title; one line from 768px (DESIGN.md Task Row).
    'line-clamp-2 medium:block medium:truncate',
    done ? 'text-ink-subtle line-through' : 'text-ink',
  );
  return (
    <div
      data-slot="task-row"
      data-current={current || undefined}
      {...rowKeyHandlers(keys)}
      className={cn(
        'group/row relative flex min-h-row-touch items-center gap-2 border-b border-border-soft px-2 py-2 medium:min-h-row-task medium:px-3',
        'transition-colors duration-(--duration-fast) ease-standard',
        onOpen && 'hover:bg-surface-hover',
        current && 'bg-here-subtle hover:bg-here-subtle',
        className,
      )}
    >
      {control !== undefined && (
        <div data-row-control className="relative z-1 flex">
          {control}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            data-row-focus
            aria-current={current || undefined}
            className={cn(
              titleClass,
              // The whole row opens the Task; the ring goes round the row.
              'after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:focus-ring-inset',
            )}
          >
            {title}
          </button>
        ) : (
          <span className={titleClass}>{title}</span>
        )}
        {metadata}
      </div>
      {estimate !== undefined && (
        <div className="flex shrink-0">{estimate}</div>
      )}
      {actions !== undefined && (
        <div
          className={cn(
            'relative z-1 flex shrink-0',
            !actionsVisible && [
              'medium:opacity-0 medium:group-hover/row:opacity-100 medium:group-focus-within/row:opacity-100',
              'medium:has-[[aria-expanded=true]]:opacity-100',
            ],
          )}
        >
          {actions}
        </div>
      )}
      {actions === undefined && reserveActions && (
        // The size of the `…` (IconButton sm).
        <div
          aria-hidden
          className="hidden size-control-sm shrink-0 medium:block"
        />
      )}
    </div>
  );
}

/**
 * ○ 完了: a 16px circle in a 24px target (44px under 768px). Done fills it
 * with `primary` and a check. Never a Checkbox (□ means choosing).
 */
function CompletionCircle({
  title,
  done = false,
  onToggle,
  disabled = false,
  ref,
}: {
  title: string;
  done?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement> | undefined;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={`${done ? '完了を取り消す' : '完了にする'}: ${title}`}
      data-slot="completion-circle"
      className={cn(
        'group/circle grid size-target-touch shrink-0 place-items-center rounded-full medium:size-target-min',
        'focus-visible:outline-none disabled:cursor-not-allowed',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-icon-s place-items-center rounded-full border border-border-strong',
          'transition-colors duration-(--duration-fast) ease-standard',
          'group-hover/circle:border-ink-muted group-focus-visible/circle:focus-ring',
          done && 'border-primary bg-primary text-on-primary',
          'group-disabled/circle:border-border group-disabled/circle:bg-canvas-subtle',
        )}
      >
        {done && (
          <Check className="size-3 [stroke-width:var(--icon-stroke-s)]" />
        )}
      </span>
    </button>
  );
}

export { CompletionCircle, TaskRow };
export type { TaskRowProps };
