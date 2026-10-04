import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Field as FieldPrimitive } from '@base-ui/react/field';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FieldDescription, FieldError } from './field';

// DESIGN.md Components › Checkbox (□ = choose): pick Backlog tasks for this
// week, pick diff rows to apply, turn on an option in a form that is saved
// with a button. Never use it to complete a task; that is the completion
// circle (○), and the two meanings are never swapped. A setting that applies
// at once is a Switch.

type CheckboxControlProps = Omit<
  CheckboxPrimitive.Root.Props,
  'className' | 'render' | 'children'
> & { className?: string };

/**
 * The target around a 16px mark (Checkbox, Radio): an ::after area that
 * reaches 24px, or 44px on compact widths. The mark keeps its 16px layout box,
 * so it lines up with the left edge of labels and fields; the larger target
 * may overlap the label next to it, which toggles the control too.
 */
const choiceTargetStyles = [
  'relative',
  'after:absolute after:-inset-[calc((var(--spacing-target-touch)-var(--spacing-icon-s))/2)]',
  'medium:after:-inset-[calc((var(--spacing-target-min)-var(--spacing-icon-s))/2)]',
];

/**
 * The bare box. Give it a name: wrap it in `Checkbox` with a label, or pass
 * aria-label (「今週に入れる: タスク名」 in a Backlog row).
 */
function CheckboxControl({ className, ...props }: CheckboxControlProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        choiceTargetStyles,
        'flex size-icon-s shrink-0 cursor-pointer items-center justify-center rounded-xs border border-border-strong bg-surface text-on-primary',
        'transition-colors duration-(--duration-fast) ease-standard',
        '[&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]',
        'focus-visible:focus-ring',
        // Each state is an exclusive condition, so the order of the classes
        // does not matter.
        'not-data-disabled:not-data-invalid:not-data-checked:not-data-indeterminate:hover:border-ink-muted',
        'not-data-disabled:not-data-checked:not-data-indeterminate:hover:bg-surface-hover',
        // Checked and indeterminate: the primary fill with a check or a bar.
        'not-data-disabled:not-data-invalid:data-checked:border-primary not-data-disabled:not-data-invalid:data-indeterminate:border-primary',
        'not-data-disabled:data-checked:bg-primary not-data-disabled:data-indeterminate:bg-primary',
        'not-data-disabled:not-data-invalid:data-checked:hover:border-primary-hover not-data-disabled:not-data-invalid:data-indeterminate:hover:border-primary-hover',
        'not-data-disabled:data-checked:hover:bg-primary-hover not-data-disabled:data-indeterminate:hover:bg-primary-hover',
        'not-data-disabled:data-invalid:border-danger not-data-disabled:data-invalid:inset-ring not-data-disabled:data-invalid:inset-ring-danger',
        'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle data-disabled:text-ink-disabled',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        render={(indicatorProps, state) => (
          <span {...indicatorProps} className="flex">
            {state.indeterminate ? (
              <Minus aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

/**
 * Holds a 16px mark in the first row of a choice, as tall as the label's
 * first row, so the mark is centered on a one-line label.
 */
function ChoiceMarkCell({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-target-touch items-center medium:h-target-min">
      {children}
    </span>
  );
}

type CheckboxProps = CheckboxControlProps & {
  /** Label next to the box; clicking it toggles the box. */
  label: ReactNode;
  /** Support text under the label. */
  description?: ReactNode | undefined;
  /** Error under the label. Setting it marks the checkbox invalid. */
  error?: ReactNode | undefined;
  /**
   * Marks the checkbox invalid without a message of its own, for a group of
   * checkboxes whose one error sits under the group (the weekdays of a
   * recurrence). Tie the group's error to each with `aria-describedby`.
   */
  invalid?: boolean | undefined;
};

/** A checkbox with its label, and optionally support text and an error. */
function Checkbox({
  label,
  description,
  error,
  invalid: invalidGroup = false,
  disabled,
  name,
  ...props
}: CheckboxProps) {
  const hasError = error !== undefined && error !== null && error !== false;
  const invalid = hasError || invalidGroup;
  return (
    <FieldPrimitive.Root
      data-slot="checkbox-field"
      name={name}
      disabled={disabled}
      invalid={invalid}
      className="grid grid-cols-[auto_1fr] gap-x-2"
    >
      <ChoiceMarkCell>
        <CheckboxControl {...props} />
      </ChoiceMarkCell>
      <ChoiceLabel>{label}</ChoiceLabel>
      {description !== undefined && (
        <FieldDescription className="col-start-2">
          {description}
        </FieldDescription>
      )}
      {hasError && (
        <FieldError className="col-start-2 mt-1">{error}</FieldError>
      )}
    </FieldPrimitive.Root>
  );
}

/**
 * The label beside a checkbox, radio or switch. It is as tall as the target,
 * so a one-line label is centered on the control.
 */
function ChoiceLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="choice-label"
      className={cn(
        'flex min-h-target-touch cursor-pointer items-center text-body text-ink medium:min-h-target-min',
        'data-disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}

export {
  Checkbox,
  CheckboxControl,
  ChoiceLabel,
  ChoiceMarkCell,
  choiceTargetStyles,
};
export type { CheckboxControlProps, CheckboxProps };
