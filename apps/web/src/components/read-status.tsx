import type { NotReady } from '@/api/read-state';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Progress } from '@/components/ui/progress';
import { useDelayed } from '@/lib/use-delayed';

/**
 * What a screen shows in place of its records while the read of the
 * contract has not answered, or could not be read (DESIGN.md Progress
 * indeterminate, Notice danger). The words wait `LOADING_DELAY`: a read that
 * ends sooner shows none (DESIGN.md Loading). `label` names what is being
 * read, as a noun.
 */
function ReadStatus({ label, read }: { label: string; read: NotReady }) {
  const late = useDelayed(read.status === 'pending');
  if (read.status === 'failed') {
    return (
      <Notice
        tone="danger"
        title="読み込めませんでした"
        action={
          <Button size="sm" onClick={read.retry}>
            もう一度読み込む
          </Button>
        }
      />
    );
  }
  return late ? <Progress label={label} value={null} max={1} /> : null;
}

export { ReadStatus };
