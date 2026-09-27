import { Field as FieldPrimitive } from '@base-ui/react/field';
import { type ComponentProps, useState } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › Textarea: several lines (editing a Goal, the Retro
// reflection). At least 88px, resizable vertically only, and with a limit the
// character count sits at the bottom right. While typing the text stays in
// `body` / `body-l`; the larger `goal` / `reflection` sizes are for the
// confirmed text only. Use it inside Field.

type TextareaProps = Omit<ComponentProps<'textarea'>, 'className'> & {
  /**
   * `body-l` for thinking spaces such as the Retro reflection. Compact
   * widths always use 16px text so that iOS does not zoom.
   */
  text?: 'body' | 'body-l' | undefined;
  className?: string | undefined;
};

function Textarea({
  text = 'body',
  className,
  maxLength,
  value,
  defaultValue,
  ...props
}: TextareaProps) {
  // Counts the uncontrolled value too, so the count works either way.
  const [uncontrolledLength, setUncontrolledLength] = useState(
    () => String(defaultValue ?? '').length,
  );
  const length =
    value === undefined ? uncontrolledLength : String(value).length;

  return (
    <div data-slot="textarea-wrapper" className="flex flex-col gap-1">
      <FieldPrimitive.Control
        value={value as string | undefined}
        defaultValue={defaultValue as string | undefined}
        onValueChange={(next) => setUncontrolledLength(next.length)}
        render={
          <textarea
            data-slot="textarea"
            maxLength={maxLength}
            className={cn(
              // 88px: DESIGN.md Textarea minimum, about three lines of body.
              'block min-h-[88px] w-full resize-y rounded-sm border border-border-strong bg-surface px-3 py-2 text-ink',
              'text-body-l',
              text === 'body' && 'medium:text-body',
              'transition-colors duration-(--duration-fast) ease-standard',
              'placeholder:text-ink-subtle',
              'not-disabled:not-aria-invalid:hover:border-ink-muted',
              'focus-visible:focus-ring focus-visible:outline-offset-1',
              'aria-invalid:border-danger aria-invalid:inset-ring aria-invalid:inset-ring-danger',
              'read-only:border-border read-only:bg-canvas-subtle',
              'disabled:cursor-not-allowed disabled:border-border disabled:bg-canvas-subtle disabled:text-ink-disabled disabled:placeholder:text-ink-disabled',
              className,
            )}
            {...props}
          />
        }
      />
      {maxLength !== undefined && (
        // Part of the field's description, so it is read with the field.
        <FieldPrimitive.Description
          data-slot="textarea-count"
          className="self-end text-meta text-ink-muted"
        >
          <span aria-hidden>
            {length} / {maxLength}
          </span>
          <span className="sr-only">
            {length}文字（上限 {maxLength}文字）
          </span>
        </FieldPrimitive.Description>
      )}
    </div>
  );
}

export { Textarea };
export type { TextareaProps };
