import { useState, type FormEvent } from 'react';
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
import { Field } from '@/components/ui/field';
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
import { TextInput } from '@/components/ui/text-input';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';

// 実績時間 (patterns.md Today): optional, added lightly after completing or
// with 今日はここまで; never a stopwatch. Owner decision in #41: a Bottom
// Sheet on compact, a Popover by the row's `…` from medium up.

export type ActualTimeMode =
  /** 今日はここまで, with the day's hours if given. */
  | 'pause'
  /** 実績を残す after completing or pausing: the hours are the point. */
  | 'record';

type ActualTimeProps = {
  mode: ActualTimeMode;
  taskTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The row's `…`: the Popover sits by it and focus returns to it. */
  anchor: HTMLElement | null;
  /** Returns whether it went through; the surface then closes. */
  onSubmit: (hours: number | undefined) => boolean;
};

const words: Record<
  ActualTimeMode,
  { title: string; description: string; submit: string }
> = {
  pause: {
    title: '今日はここまで',
    description:
      '作業したが終わっていない Task を、今週の残りに戻します。明日は「昨日の続き」に出ます。',
    submit: '今日はここまで',
  },
  record: {
    title: '実績を残す',
    description: '今日この Task にかけた時間を足します。',
    submit: '残す',
  },
};

function ActualTime({
  mode,
  taskTitle,
  open,
  onOpenChange,
  anchor,
  onSubmit,
}: ActualTimeProps) {
  const sheet = !useMediaQuery(MEDIUM_UP, true);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const { title, description, submit } = words[mode];
  const optional = mode === 'pause';

  const change = (next: boolean) => {
    if (!next) {
      setText('');
      setError(undefined);
    }
    onOpenChange(next);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === '' && optional) {
      if (onSubmit(undefined)) change(false);
      return;
    }
    const hours = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(hours) || hours <= 0) {
      setError('0 より大きい時間を数字で入れてください（例: 1.5）');
      return;
    }
    if (onSubmit(hours)) change(false);
  };

  const field = (
    <Field
      label="実績時間"
      necessity={optional ? 'optional' : 'required'}
      description="時間単位（例: 1.5）。記録は残り、あとから足せます"
      error={error}
    >
      <TextInput
        inputMode="decimal"
        suffix="h"
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
      />
    </Field>
  );
  const heading = `${title}: ${taskTitle}`;

  if (sheet) {
    return (
      <Drawer open={open} onOpenChange={change}>
        <DrawerContent finalFocus={() => anchor ?? true}>
          <form noValidate onSubmit={save} className="flex flex-col">
            <DrawerHeader>
              <DrawerTitle>{heading}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            <DrawerBody>{field}</DrawerBody>
            <DrawerFooter>
              <DrawerClose render={<Button variant="quiet" />}>
                キャンセル
              </DrawerClose>
              <Button type="submit">{submit}</Button>
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
        <form noValidate onSubmit={save} className="flex flex-col">
          <PopoverHeader>
            <PopoverTitle>{heading}</PopoverTitle>
            <PopoverDescription>{description}</PopoverDescription>
          </PopoverHeader>
          <PopoverBody>{field}</PopoverBody>
          <PopoverFooter>
            <PopoverClose render={<Button size="sm" variant="quiet" />}>
              キャンセル
            </PopoverClose>
            <Button size="sm" type="submit">
              {submit}
            </Button>
          </PopoverFooter>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export { ActualTime };
