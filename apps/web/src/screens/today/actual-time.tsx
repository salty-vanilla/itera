import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { DurationField } from '@/components/ui/duration-field';
import {
  Popover,
  PopoverBody,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverFooter,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  ACTUAL_HOURS_ERROR,
  ACTUAL_HOURS_HINT,
  readActualHours,
} from '@/lib/actual-hours';
import { EMPTY_DURATION } from '@/lib/duration-text';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';

// かかった時間 (実績時間, patterns.md Today): optional, added lightly after completing or
// with 今日は中断する; never a stopwatch. Owner decision in #41: a Bottom
// Sheet on compact, a Popover by the row's `…` from medium up.

export type ActualTimeMode =
  /** 今日は中断する, with the day's hours if given. */
  | 'pause'
  /** かかった時間を記録 after completing or pausing: the hours are the point. */
  | 'record'
  /** かかった時間を記録 from Retro, where the time goes to a day of the Sprint. */
  | 'add';

type ActualTimeProps = {
  mode: ActualTimeMode;
  taskTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The row's `…`: the Popover sits by it and focus returns to it. */
  anchor: HTMLElement | null;
  /**
   * Returns whether it went through; the surface then closes. One that is
   * sent returns when it is done.
   */
  onSubmit: (hours: number | undefined) => boolean | Promise<boolean>;
  /** The save has been sent for a while (useOperation `loading`). */
  loading?: boolean;
  /** Replaces the mode's description, e.g. which day it goes to in Retro. */
  description?: string | undefined;
};

const words: Record<
  ActualTimeMode,
  { title: string; description?: ReactNode; submit: string }
> = {
  pause: {
    title: '今日は中断する',
    // The screen's word stays whole when the line breaks.
    description: (
      <>
        途中のタスクは今週の残りに戻り、明日
        <span className="nowrap-phrase">「昨日の続き」</span>
        に出ます。
      </>
    ),
    submit: '今日は中断する',
  },
  record: {
    title: 'かかった時間を記録',
    submit: '記録する',
  },
  add: {
    title: 'かかった時間を記録',
    submit: '記録する',
  },
};

function ActualTime({
  mode,
  taskTitle,
  open,
  onOpenChange,
  anchor,
  onSubmit,
  loading = false,
  description: descriptionOverride,
}: ActualTimeProps) {
  const sheet = !useMediaQuery(MEDIUM_UP, true);
  const [text, setText] = useState(EMPTY_DURATION);
  const [error, setError] = useState<string | undefined>(undefined);
  const { title, submit } = words[mode];
  const description = descriptionOverride ?? words[mode].description;
  const optional = mode === 'pause';
  const formRef = useRef<HTMLFormElement>(null);
  // After a failed save, focus goes to the field in error (accessibility.md).
  const focusError = () =>
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    );

  const change = (next: boolean) => {
    if (!next) {
      setText(EMPTY_DURATION);
      setError(undefined);
    }
    onOpenChange(next);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const hours = readActualHours(text);
    if (hours === undefined && optional) {
      if (await onSubmit(undefined)) change(false);
      return;
    }
    if (hours === undefined || hours === null) {
      setError(ACTUAL_HOURS_ERROR);
      focusError();
      return;
    }
    if (await onSubmit(hours)) change(false);
  };

  const field = (
    <DurationField
      label="かかった時間"
      necessity={optional ? 'optional' : 'required'}
      description={ACTUAL_HOURS_HINT}
      error={error}
      value={text}
      onChange={setText}
    />
  );
  const heading = `${title}：${taskTitle}`;

  if (sheet) {
    return (
      <Drawer open={open} onOpenChange={change}>
        <DrawerContent finalFocus={() => anchor ?? true}>
          <form
            ref={formRef}
            noValidate
            onSubmit={save}
            className="flex flex-col"
          >
            <DrawerHeader>
              <DrawerTitle>{heading}</DrawerTitle>
              {description !== undefined && (
                <DrawerDescription className="[text-wrap:pretty] [word-break:auto-phrase]">
                  {description}
                </DrawerDescription>
              )}
            </DrawerHeader>
            <DrawerBody>{field}</DrawerBody>
            <DrawerFooter>
              <DrawerClose render={<Button variant="quiet" />}>
                キャンセル
              </DrawerClose>
              <Button type="submit" loading={loading} loadingLabel="保存中…">
                {submit}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverContent
        align="end"
        anchor={anchor}
        finalFocus={() => anchor ?? true}
      >
        <form
          ref={formRef}
          noValidate
          onSubmit={save}
          className="flex flex-col"
        >
          <PopoverHeader>
            <PopoverTitle>{heading}</PopoverTitle>
            {description !== undefined && (
              <PopoverDescription className="[text-wrap:pretty] [word-break:auto-phrase]">
                {description}
              </PopoverDescription>
            )}
          </PopoverHeader>
          <PopoverBody>{field}</PopoverBody>
          <PopoverFooter>
            <PopoverClose render={<Button size="sm" variant="quiet" />}>
              キャンセル
            </PopoverClose>
            <Button
              size="sm"
              type="submit"
              loading={loading}
              loadingLabel="保存中…"
            >
              {submit}
            </Button>
          </PopoverFooter>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export { ActualTime };
