import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { criterionName } from '@/lib/criterion-text';
import type { RetroBlocker, RetroData } from '@/store/retro-view';
import { carryOverWords, DECISION_WORDS } from './retro-words';

// 「振り返りを完了」 (docs/design/patterns.md Retro › 引き継ぐ, Issue #106).
// At the end of 引き継ぐ, where the other stages have their 次へ button, and
// not in the Sprint Header: it is the last thing to do after the inputs
// above it. Completing closes the Sprint and no actual time can be added
// after (F22), so it asks first, in a Dialog (md) that says what is handed
// on. The reason it waits is text under the button, which stays where it is
// whether or not it can be pressed.

/** Why 「振り返りを完了」 waits, and where to choose (docs/design/content.md). */
const BLOCKER_WORDS: Readonly<Record<RetroBlocker, ReactNode>> = {
  // The words the screen shows stay whole when the line breaks.
  decisionMissing: (
    <>
      上の「今回の計画のルール」で、
      <span className="whitespace-nowrap">
        続ける・終える・置き換えるのどれか
      </span>
      を選ぶと完了できます。
    </>
  ),
  continueWithDraft: (
    <>
      上の「今回の計画のルール」で
      <span className="whitespace-nowrap">「続ける」</span>
      を選んでいるときは、
      <span className="whitespace-nowrap">「計画のルールにもする」</span>
      をオフにするか、
      <span className="whitespace-nowrap">「置き換える」</span>
      を選ぶと完了できます。
    </>
  ),
};

type CompleteRetroProps = {
  data: RetroData;
  /** Completes the Retro. Called when the Dialog is confirmed. */
  onComplete: () => void;
};

function CompleteRetro({ data, onComplete }: CompleteRetroProps) {
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const blocked = data.blockers.length > 0;
  return (
    <div
      data-slot="complete-retro"
      className="flex flex-col items-end gap-2 text-right"
    >
      <Button
        variant="primary"
        disabled={blocked}
        focusableWhenDisabled
        aria-describedby={reasonId}
        onClick={() => setOpen(true)}
      >
        振り返りを完了
      </Button>
      <div
        id={reasonId}
        className="flex max-w-measure-read flex-col gap-1 text-help text-balance text-ink-muted"
      >
        {data.blockers.map((b) => (
          <p key={b}>{BLOCKER_WORDS[b]}</p>
        ))}
        {!blocked && data.improvement === undefined && (
          <p>次に試すことがないまま完了します。次の計画には何も出ません。</p>
        )}
      </div>
      <CompleteDialog
        data={data}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => {
          setOpen(false);
          onComplete();
        }}
      />
    </div>
  );
}

type CompleteDialogProps = CompleteRetroProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

// Focus starts on 「戻る」, the safest action.
function CompleteDialog({
  data,
  open,
  onOpenChange,
  onConfirm,
}: Omit<CompleteDialogProps, 'onComplete'>) {
  const { used, draft, improvement } = data;
  // Each line: what it is about, and the word that is the decision (kept
  // on one line).
  const criterionLines: { text: string; decision?: string }[] = [
    ...(used?.decision === undefined
      ? []
      : [
          {
            text: `今回の計画のルール「${criterionName(used.criterion.policy, used.areaName)}」を`,
            decision: `「${DECISION_WORDS[used.decision]}」`,
          },
        ]),
    ...(draft === undefined
      ? []
      : [
          {
            text: `新しい計画のルール「${criterionName(draft.criterion.policy, draft.areaName)}」を、次の計画から使えるようにする`,
          },
        ]),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            Sprint {data.number} の振り返りを完了しますか？
          </DialogTitle>
          <DialogDescription>
            完了すると、書いた内容は変えられず、この Sprint
            には実績を足せなくなります。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-body medium:grid-cols-[auto_1fr] medium:gap-y-2">
            <dt className="text-ink-muted">次に試すこと</dt>
            <dd className="mb-2 text-ink medium:mb-0">
              {improvement ?? 'なし'}
            </dd>
            <dt className="text-ink-muted">計画のルールの決定</dt>
            <dd className="mb-2 text-ink medium:mb-0">
              {criterionLines.length === 0 ? (
                'なし'
              ) : (
                <ul className="flex flex-col gap-1">
                  {criterionLines.map((line) => (
                    <li key={line.text}>
                      {line.text}
                      {line.decision !== undefined && (
                        <span className="whitespace-nowrap">
                          {line.decision}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
            <dt className="text-ink-muted">持ち越し</dt>
            <dd className="text-ink">
              {data.carryOver.total === 0
                ? 'なし'
                : carryOverWords(data.carryOver)}
            </dd>
          </dl>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button />}>戻る</DialogClose>
          <Button variant="primary" onClick={onConfirm}>
            振り返りを完了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CompleteRetro };
