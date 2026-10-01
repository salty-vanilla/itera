import { useRef, useState, type FormEvent } from 'react';
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
import { TextInput } from '@/components/ui/text-input';
import { MEDIUM_UP, useMediaQuery } from '@/lib/use-media-query';

// 割り込みを記録 (patterns.md Today): a short note and optional minutes,
// from its own entry, not a Task row. A Bottom Sheet on compact, the right
// Drawer from medium up. Recording it rearranges nothing (invariant 29).
// 編集 uses the same surface, filled with the note (F38).
// Modal at every width: a short form with nothing to use behind it, so Tab
// stays inside, the scrim shows and closing returns focus to what opened it
// (#153). From medium up a click on the scrim does not close it, as before it
// was modal, so that it does not throw away what is typed.

type InterruptSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns whether it went through; the sheet then closes. */
  onSubmit: (text: string, minutes: number | undefined) => boolean;
  /** 編集: the note as recorded, and the time it was noted (「10:00」). */
  editing?: { text: string; minutes?: number; time: string };
};

function InterruptSheet({
  open,
  onOpenChange,
  onSubmit,
  editing,
}: InterruptSheetProps) {
  const [text, setText] = useState(editing?.text ?? '');
  const [minutes, setMinutes] = useState(
    editing?.minutes === undefined ? '' : String(editing.minutes),
  );
  const [errors, setErrors] = useState<{ text?: string; minutes?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);
  const medium = useMediaQuery(MEDIUM_UP, true);
  const change = (next: boolean) => {
    if (!next) {
      setText('');
      setMinutes('');
      setErrors({});
    }
    onOpenChange(next);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const note = text.trim();
    const m = minutes.trim() === '' ? undefined : Number(minutes.trim());
    const next = {
      ...(note === '' ? { text: '何があったかを短く書いてください' } : {}),
      ...(m !== undefined && (!Number.isFinite(m) || m <= 0)
        ? { minutes: '0 より大きい分数を数字で入れてください（例：30）' }
        : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Focus goes to the first field in error (accessibility.md).
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    if (onSubmit(note, m)) change(false);
  };
  return (
    <Drawer
      modal
      disablePointerDismissal={medium}
      open={open}
      onOpenChange={change}
    >
      <DrawerContent>
        <form
          ref={formRef}
          noValidate
          onSubmit={save}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DrawerHeader>
            <DrawerTitle>
              {editing === undefined ? '割り込みを記録' : '割り込みを編集'}
            </DrawerTitle>
            <DrawerDescription>
              {editing === undefined
                ? '予定外の出来事をメモします。'
                : `${editing.time} の記録`}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Field label="メモ" necessity="required" error={errors.text}>
              <TextInput
                value={text}
                placeholder="例：障害対応、急な来客"
                onChange={(e) => setText(e.currentTarget.value)}
              />
            </Field>
            <Field
              label="かかった時間（分）"
              necessity="optional"
              error={errors.minutes}
            >
              <TextInput
                inputMode="decimal"
                suffix="分"
                value={minutes}
                onChange={(e) => setMinutes(e.currentTarget.value)}
              />
            </Field>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="quiet" />}>
              キャンセル
            </DrawerClose>
            <Button type="submit">
              {editing === undefined ? '記録する' : '保存'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

export { InterruptSheet };
