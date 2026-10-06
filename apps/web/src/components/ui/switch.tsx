import { Field as FieldPrimitive } from '@base-ui/react/field';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChoiceLabel } from './checkbox';
import { FieldDescription, FieldError } from './field';

// DESIGN.md Components › Switch: a setting that takes effect at once. In a
// form that is saved with a button, use a Checkbox instead. The track is
// 36×20px with a 4px radius (not a pill) and a 14px square thumb, and the
// words 「オン」「オフ」 say the state next to it, so it never depends on the
// fill alone. The description says what turning it on does.

type SwitchProps = Omit<
  SwitchPrimitive.Root.Props,
  'className' | 'render' | 'children'
> & {
  label: ReactNode;
  /** What happens when it is on, e.g. 「Retro の前日に通知します。」 */
  description?: ReactNode | undefined;
  /** Error under the description, e.g. when saving the setting failed. */
  error?: ReactNode | undefined;
  className?: string | undefined;
};

function Switch({
  label,
  description,
  error,
  disabled,
  name,
  className,
  ...props
}: SwitchProps) {
  const invalid = error !== undefined && error !== null && error !== false;
  return (
    <FieldPrimitive.Root
      data-slot="switch-field"
      name={name}
      disabled={disabled}
      invalid={invalid}
      className={cn(
        'grid max-w-measure-read grid-cols-[1fr_auto] gap-x-4',
        // With enlarged text the label would get 4 to 6 characters a line
        // beside the switch: it takes the full width, the switch goes under it
        // and the description under the switch (#425).
        'enlarged:grid-cols-1',
        className,
      )}
    >
      <ChoiceLabel>{label}</ChoiceLabel>
      <div className="flex items-center gap-2">
        <SwitchPrimitive.Root
          data-slot="switch"
          className={cn(
            // 36×20px: DESIGN.md Switch (control-md × icon-m). The track itself is the control.
            'peer/switch relative inline-flex h-icon-m w-control-md shrink-0 cursor-pointer items-center rounded-sm border border-border-strong bg-surface',
            'transition-colors duration-(--duration-fast) ease-standard',
            'focus-visible:focus-ring',
            // The target reaches 28px (44px on compact widths) beyond the track.
            'after:absolute after:-inset-x-1 after:-inset-y-3 medium:after:-inset-y-1',
            'not-data-disabled:not-data-checked:hover:bg-surface-hover',
            'not-data-disabled:not-data-checked:not-data-invalid:hover:border-ink-muted',
            'not-data-disabled:data-checked:bg-primary not-data-disabled:not-data-invalid:data-checked:border-primary',
            'not-data-disabled:data-checked:hover:bg-primary-hover not-data-disabled:not-data-invalid:data-checked:hover:border-primary-hover',
            'not-data-disabled:data-invalid:border-danger not-data-disabled:data-invalid:inset-ring not-data-disabled:data-invalid:inset-ring-danger',
            'data-disabled:cursor-not-allowed data-disabled:border-border data-disabled:bg-canvas-subtle',
          )}
          {...props}
        >
          <SwitchPrimitive.Thumb
            data-slot="switch-thumb"
            className={cn(
              // 14px: a square as high as the inside of the track (18px), less a
              // transparent 2px edge on each side. The background stops at the
              // padding box, and rounded-sm leaves the 2px of rounded.xs inside
              // it. It moves by icon-s, 16px, to the other end.
              'block aspect-square h-full shrink-0 rounded-sm border-2 border-transparent bg-border-strong bg-clip-padding',
              'transition-[translate,background-color] duration-(--duration-fast) ease-standard',
              'data-checked:translate-x-icon-s not-data-disabled:data-checked:bg-on-primary',
              'data-disabled:bg-ink-disabled',
              // Forced colors would paint the thumb as Canvas and hide it; keep it as
              // text color in both states.
              'forced-colors:bg-[CanvasText]! forced-colors:forced-color-adjust-none forced-colors:data-disabled:bg-[GrayText]!',
            )}
          />
        </SwitchPrimitive.Root>
        {/*
          The state in words, as siblings of the switch so that they follow
          its data-checked. role="switch" already announces the state. They
          stay readable (ink-muted) when disabled: the words are what tells
          on from off.
        */}
        <span
          aria-hidden
          className="hidden text-body text-ink peer-data-checked/switch:inline peer-data-disabled/switch:text-ink-muted"
        >
          オン
        </span>
        <span
          aria-hidden
          className="text-body text-ink-muted peer-data-checked/switch:hidden"
        >
          オフ
        </span>
      </div>
      {description !== undefined && (
        <FieldDescription className="col-start-1 enlarged:mt-1">
          {description}
        </FieldDescription>
      )}
      {invalid && <FieldError className="col-start-1 mt-1">{error}</FieldError>}
    </FieldPrimitive.Root>
  );
}

export { Switch };
export type { SwitchProps };
