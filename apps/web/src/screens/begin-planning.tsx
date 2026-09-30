import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useNextPlanning, useRetroActions } from '@/store/use-retro';

/**
 * 「Sprint N の計画を始める」 (owner decision in #42): starts the next
 * week's Planning — allowed even while the previous Retro is open, as only
 * confirming waits for it (invariant 12) — and opens that Sprint on the
 * Sprint screen (#90). With a Planning already started, it links there
 * instead.
 */
function BeginPlanning({
  variant = 'primary',
}: {
  /** Secondary where the screen has its own Primary. */
  variant?: 'primary' | 'secondary';
}) {
  const next = useNextPlanning();
  const actions = useRetroActions();
  const navigate = useNavigate();
  if (next.planning !== undefined) {
    return (
      <Link
        to="/sprint"
        search={{ sprint: next.number }}
        data-slot="begin-planning"
        className="text-link underline focus-visible:focus-ring"
      >
        Sprint {next.number} の計画を開く
      </Link>
    );
  }
  return (
    <Button
      data-slot="begin-planning"
      variant={variant}
      onClick={() => {
        if (actions.beginPlanning()) {
          void navigate({ to: '/sprint', search: { sprint: next.number } });
        }
      }}
    >
      Sprint {next.number} の計画を始める
    </Button>
  );
}

export { BeginPlanning };
