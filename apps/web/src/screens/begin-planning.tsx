import { Link, useNavigate } from '@tanstack/react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { useBeginPlanning, useNextPlanning } from '@/store/use-begin-planning';

/**
 * 「Sprint N の計画を始める」 (owner decision in #42): starts the next
 * week's Planning — allowed even while the previous Retro is open, as only
 * confirming waits for it (invariant 12) — and opens that Sprint on the
 * Sprint screen (#90). With a Planning already started, it links there
 * instead, drawn as the same button so that it stays as easy to find (#168).
 */
function BeginPlanning({
  variant = 'primary',
}: {
  /** Secondary where the screen has its own Primary. */
  variant?: 'primary' | 'secondary';
}) {
  const next = useNextPlanning();
  const { beginPlanning, loading } = useBeginPlanning();
  const navigate = useNavigate();
  // Nothing to start from until the person's Sprints are read.
  if (next === undefined) return null;
  if (next.planning !== undefined) {
    return (
      <Link
        to="/sprint"
        search={{ sprint: next.number }}
        data-slot="begin-planning"
        className={buttonVariants({ variant })}
      >
        Sprint {next.number} の計画を開く
      </Link>
    );
  }
  return (
    <Button
      data-slot="begin-planning"
      variant={variant}
      loading={loading}
      loadingLabel="始めています…"
      onClick={async () => {
        if ((await beginPlanning()) !== undefined) {
          void navigate({ to: '/sprint', search: { sprint: next.number } });
        }
      }}
    >
      Sprint {next.number} の計画を始める
    </Button>
  );
}

export { BeginPlanning };
