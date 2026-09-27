import { Field as FieldPrimitive } from '@base-ui/react/field';
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// DESIGN.md Components › 入力 and docs/design/accessibility.md › フォーム.
// A field is built in the order label → support text → control → error. The
// support text and the error are tied to the control with aria-describedby,
// and an error also sets aria-invalid. Show an error when the person leaves
// the field or submits, never while typing, and keep what they entered.

type Necessity = 'required' | 'optional';

// 「必須」「任意」 are words, not colors or asterisks. Itera has many optional
// fields, so mark whichever of the two is the exception on the form.
function NecessityWord({ necessity }: { necessity?: Necessity | undefined }) {
  if (necessity === undefined) return null;
  return (
    <span className="ml-2 text-help text-ink-muted">
      {necessity === 'required' ? '必須' : '任意'}
    </span>
  );
}

// Icon and words: an error is never shown by color alone. The message says
// what is wrong and how to fix it, e.g. 「数値で入力してください（例: 1.5）」.
function FieldError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      // Always rendered while there is a message; the message itself decides.
      match
      className={cn(
        'flex items-start gap-1 text-help text-danger',
        '[&_svg]:size-icon-s [&_svg]:[stroke-width:var(--icon-stroke-s)]',
        className,
      )}
    >
      {/* One text line high, so the icon sits on the first line. */}
      <span className="flex h-5 shrink-0 items-center">
        <CircleAlert aria-hidden />
      </span>
      <span>{children}</span>
    </FieldPrimitive.Error>
  );
}

function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn('text-help text-ink-muted', className)}
      {...props}
    />
  );
}

type FieldProps = {
  /** Visible label. Also the accessible name of the control. */
  label: ReactNode;
  /** Adds 「必須」 or 「任意」 after the label. */
  necessity?: Necessity | undefined;
  /** Support text above the control: units or an example (「0.5時間単位」). */
  description?: ReactNode | undefined;
  /**
   * Error message below the control. Setting it marks the field invalid
   * (aria-invalid). Set it on blur or submit, not while typing.
   */
  error?: ReactNode | undefined;
  /**
   * Hides the label visually but keeps it as the accessible name. Only for
   * the search field and Quick Add (docs/design/accessibility.md).
   */
  hideLabel?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Form field name; takes precedence over the control's own name. */
  name?: string | undefined;
  /** One TextInput, Textarea or Select. */
  children: ReactNode;
  className?: string | undefined;
};

/**
 * Wraps one TextInput, Textarea or Select with its label, support text and
 * error. Checkbox, RadioGroup and Switch carry their own labels.
 */
function Field({
  label,
  necessity,
  description,
  error,
  hideLabel = false,
  disabled,
  name,
  children,
  className,
}: FieldProps) {
  const invalid = error !== undefined && error !== null && error !== false;
  return (
    <FieldPrimitive.Root
      data-slot="field"
      name={name}
      disabled={disabled}
      invalid={invalid}
      className={cn('flex flex-col gap-1', className)}
    >
      <FieldPrimitive.Label
        data-slot="field-label"
        className={cn('self-start text-label text-ink', hideLabel && 'sr-only')}
      >
        {label}
        <NecessityWord necessity={necessity} />
      </FieldPrimitive.Label>
      {description !== undefined && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {children}
      {invalid && <FieldError>{error}</FieldError>}
    </FieldPrimitive.Root>
  );
}

export { Field, FieldDescription, FieldError, NecessityWord };
export type { FieldProps, Necessity };
