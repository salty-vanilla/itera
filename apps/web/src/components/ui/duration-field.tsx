import {
  useId,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import {
  FieldErrorContent,
  NecessityWord,
  fieldDescriptionStyles,
  fieldError,
  fieldErrorStyles,
  useClearOfToasts,
  type Necessity,
} from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import {
  durationText,
  readMinutes,
  type DurationText,
} from '@/lib/duration-text';
import { cn } from '@/lib/utils';

// A time typed as the screen writes it, in two fields: 時間 and 分 (#252,
// owner decision on 2026-10-03). Every time field uses it: 見積もり,
// かかった時間, 使える時間, the subtasks' Estimates and 割り込み.
//
// - One group, named by the visible label; each field is named 「時間」 or
//   「分」, and the units after them are not read out (TextInput's suffix).
// - The fields bring up the number keyboard. Focus never moves on its own
//   (hours may take two digits); Enter in 時間 goes to 分, the next key on
//   a phone keyboard (`enterkeyhint="next"`).
// - Leaving both fields writes the time back as the screen writes it, so 90
//   in 分 becomes 1 and 30 (`durationText`). A field saved on leaving it
//   saves then, not on going from 時間 to 分 (`onCommit`); in a form, the
//   button reads the fields.
// - One error line under both fields; both are marked invalid, and the
//   first one, 時間, takes the focus.

/** Attributes a screen gives a field: its ref, focus on opening, marks. */
type ControlProps = {
  ref?: Ref<HTMLInputElement> | undefined;
  autoFocus?: boolean | undefined;
  'data-autofocus'?: boolean | undefined;
  'data-detail-field'?: boolean | undefined;
};

type DurationFieldProps = {
  /** The visible label, the group's name (「見積もり」). */
  label: ReactNode;
  necessity?: Necessity | undefined;
  /** Support text above the fields; not the unit, which the fields show. */
  description?: ReactNode | undefined;
  /** Error line under both fields. Set it on leaving or submitting. */
  error?: ReactNode | undefined;
  /** The last save failed and the fields keep what was typed (Field `saveFailed`). */
  saveFailed?: boolean | undefined;
  errorClassName?: string | undefined;
  /** For a group named by its row (a subtask's Estimate). */
  hideLabel?: boolean | undefined;
  value: DurationText;
  onChange: (value: DurationText) => void;
  /**
   * For a time saved on leaving it: called on leaving both fields and on
   * Enter in 分, with the time as written back.
   */
  onCommit?: ((value: DurationText) => void) | undefined;
  size?: 'sm' | 'md' | undefined;
  hoursProps?: ControlProps | undefined;
  minutesProps?: ControlProps | undefined;
  className?: string | undefined;
};

function DurationField({
  label,
  necessity,
  description,
  error,
  saveFailed,
  errorClassName,
  hideLabel = false,
  value,
  onChange,
  onCommit,
  size,
  hoursProps,
  minutesProps,
  className,
}: DurationFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const minutesRef = useRef<HTMLInputElement>(null);
  const { message, failed } = fieldError(error, saveFailed);
  const invalid = message !== undefined;
  const groupRef = useRef<HTMLDivElement>(null);
  useClearOfToasts(groupRef, failed);
  const describedBy =
    [
      description !== undefined ? descriptionId : undefined,
      invalid ? errorId : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(' ') || undefined;

  /** Writes a time read back as the screen writes it; returns it. */
  const tidy = (): DurationText => {
    const minutes = readMinutes(value);
    if (minutes === undefined || minutes === null) return value;
    const next = durationText(minutes);
    if (next.hours !== value.hours || next.minutes !== value.minutes) {
      onChange(next);
    }
    return next;
  };
  const leave = (event: FocusEvent<HTMLDivElement>) => {
    // Going from one field to the other is not leaving the time.
    if (event.currentTarget.contains(event.relatedTarget as Node | null))
      return;
    const next = tidy();
    onCommit?.(next);
  };
  const enter =
    (part: 'hours' | 'minutes') => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      if (part === 'hours') {
        event.preventDefault();
        minutesRef.current?.focus();
        return;
      }
      if (onCommit === undefined) return; // The form's button.
      event.preventDefault();
      onCommit(tidy());
    };
  const control = {
    size,
    inputMode: 'numeric',
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  } as const;

  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby={labelId}
      data-slot="duration-field"
      data-save-failed={failed || undefined}
      className={cn('flex flex-col gap-1', className)}
      onBlur={leave}
    >
      <span
        id={labelId}
        data-slot="field-label"
        className={cn('self-start text-label text-ink', hideLabel && 'sr-only')}
      >
        {label}
        <NecessityWord necessity={necessity} />
      </span>
      {description !== undefined && (
        <p id={descriptionId} className={fieldDescriptionStyles}>
          {description}
        </p>
      )}
      <div className="flex items-center gap-2 enlarged:flex-wrap">
        <TextInput
          {...control}
          {...hoursProps}
          aria-label="時間"
          enterKeyHint="next"
          suffix="時間"
          columns={3}
          className="shrink-0"
          value={value.hours}
          onChange={(e) => onChange({ ...value, hours: e.currentTarget.value })}
          onKeyDown={enter('hours')}
        />
        <TextInput
          {...control}
          {...minutesProps}
          ref={minutesRef}
          aria-label="分"
          suffix="分"
          columns={2}
          className="shrink-0"
          value={value.minutes}
          onChange={(e) =>
            onChange({ ...value, minutes: e.currentTarget.value })
          }
          onKeyDown={enter('minutes')}
        />
      </div>
      {invalid && (
        <p
          id={errorId}
          data-slot="field-error"
          className={cn(fieldErrorStyles, errorClassName)}
        >
          <FieldErrorContent>{message}</FieldErrorContent>
        </p>
      )}
    </div>
  );
}

export { DurationField };
export type { DurationFieldProps };
