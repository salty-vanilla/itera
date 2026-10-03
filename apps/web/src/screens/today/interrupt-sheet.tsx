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
import { DurationField } from '@/components/ui/duration-field';
import { Field } from '@/components/ui/field';
import { TextInput } from '@/components/ui/text-input';
import {
  DURATION_ERROR,
  EMPTY_DURATION,
  durationText,
  readMinutes,
} from '@/lib/duration-text';
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
  /**
   * Returns whether it went through; the sheet then closes. One that is
   * sent returns when it is done.
   */
  onSubmit: (
    text: string,
    minutes: number | undefined,
  ) => boolean | Promise<boolean>;
  /** The save has been sent for a while (useOperation `loading`). */
  loading?: boolean;
  /** 編集: the note as recorded, and the time it was noted (「10:00」). */
  editing?: { text: string; minutes?: number; time: string };
};

function InterruptSheet({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  editing,
}: InterruptSheetProps) {
  const [text, setText] = useState(editing?.text ?? '');
  const [minutes, setMinutes] = useState(durationText(editing?.minutes));
  const [errors, setErrors] = useState<{ text?: string; minutes?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);
  const medium = useMediaQuery(MEDIUM_UP, true);
  const change = (next: boolean) => {
    if (!next) {
      setText('');
      setMinutes(EMPTY_DURATION);
      setErrors({});
    }
    onOpenChange(next);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const note = text.trim();
    const m = readMinutes(minutes);
    const next = {
      ...(note === '' ? { text: '何があったかを短く書いてください' } : {}),
      ...(m === null || m === 0 ? { minutes: DURATION_ERROR } : {}),
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
    if (await onSubmit(note, m ?? undefined)) change(false);
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
            <DurationField
              label="かかった時間"
              necessity="optional"
              error={errors.minutes}
              value={minutes}
              onChange={setMinutes}
            />
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="quiet" />}>
              キャンセル
            </DrawerClose>
            <Button type="submit" loading={loading} loadingLabel="保存中…">
              {editing === undefined ? '記録する' : '保存'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

export { InterruptSheet };
