import { Field as FieldPrimitive } from '@base-ui/react/field';
import { Fieldset as FieldsetPrimitive } from '@base-ui/react/fieldset';
import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChoiceLabel, ChoiceMarkCell, choiceTargetStyles } from './checkbox';
import {
  FieldDescription,
  FieldError,
  type Necessity,
  NecessityWord,
} from './field';

// DESIGN.md Components › Radio / RadioGroup: 2–5 mutually exclusive choices
// that are all shown (the Goal self-assessment, the Sprint length). It is a
// fieldset (role="radiogroup") named by its legend. Arrow keys move the
// choice. A group may start with nothing chosen: the self-assessment has no
// default, and 「まだ」 is the absence of a value, not a choice.

type RadioGroupProps<Value> = Omit<
  RadioGroupPrimitive.Props<Value>,
  'className' | 'render' | 'children'
> & {
  /** The question the choices answer. Also the group's accessible name. */
  legend: ReactNode;
  necessity?: Necessity | undefined;
  /** Support text under the legend. */
  description?: ReactNode | undefined;
  /** Error under the choices. Setting it marks the group invalid. */
  error?: ReactNode | undefined;
  /** Radio items. */
  children: ReactNode;
  className?: string | undefined;
};

function RadioGroup<Value>({
  legend,
  necessity,
  description,
  error,
  disabled,
  name,
  children,
  className,
  ...props
}: RadioGroupProps<Value>) {
  const invalid = error !== undefined && error !== null && error !== false;
  return (
    <FieldPrimitive.Root
      data-slot="radio-group-field"
      name={name}
      disabled={disabled}
      invalid={invalid}
      className={className}
    >
      <FieldsetPrimitive.Root
        render={
          <RadioGroupPrimitive
            data-slot="radio-group"
            render={<fieldset />}
            className="m-0 min-w-0 border-0 p-0"
            {...props}
          />
        }
      >
        <FieldsetPrimitive.Legend
          data-slot="radio-group-legend"
          render={<legend />}
          className="mb-1 p-0 text-label text-ink"
        >
          {legend}
          <NecessityWord necessity={necessity} />
        </FieldsetPrimitive.Legend>
        {description !== undefined && (
          <FieldDescription className="mb-1">{description}</FieldDescription>
        )}
        <div className="flex flex-col">{children}</div>
        {invalid && <FieldError className="mt-1">{error}</FieldError>}
      </FieldsetPrimitive.Root>
    </FieldPrimitive.Root>
  );
}

type RadioProps<Value> = Omit<
  RadioPrimitive.Root.Props<Value>,
  'className' | 'render' | 'children'
> & {
  label: ReactNode;
  /** Support text under this choice's label. */
  description?: ReactNode | undefined;
  className?: string | undefined;
};

function Radio<Value>({
  label,
  description,
  className,
  ...props
}: RadioProps<Value>) {
  return (
    <FieldPrimitive.Item
      data-slot="radio-item"
      className={cn('grid grid-cols-[auto_1fr] gap-x-2', className)}
    >
      <ChoiceMarkCell>
        <RadioPrimitive.Root
          data-slot="radio"
          className={cn(
            choiceTargetStyles,
            // Checked is a 4px inner ring of primary, not a dot.
            'size-icon-s shrink-0 cursor-pointer rounded-full border border-border-strong bg-surface',
            'transition-colors duration-(--duration-fast) ease-standard',
            'focus-visible:focus-ring',
            // Each state is an exclusive condition; see CheckboxControl.
            'not-data-disabled:not-data-invalid:not-data-checked:hover:border-ink-muted',
            'not-data-disabled:not-data-checked:hover:bg-surface-hover',
            'data-checked:border-4',
            'not-data-disabled:not-data-invalid:data-checked:border-primary',
            'not-data-disabled:not-data-invalid:data-checked:hover:border-primary-hover',
            'not-data-disabled:data-invalid:border-danger not-data-disabled:not-data-checked:data-invalid:inset-ring not-data-disabled:not-data-checked:data-invalid:inset-ring-danger',
            'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle data-disabled:data-checked:border-ink-disabled',
          )}
          {...props}
        />
      </ChoiceMarkCell>
      <ChoiceLabel>{label}</ChoiceLabel>
      {description !== undefined && (
        <FieldDescription className="col-start-2">
          {description}
        </FieldDescription>
      )}
    </FieldPrimitive.Item>
  );
}

export { Radio, RadioGroup };
export type { RadioGroupProps, RadioProps };
