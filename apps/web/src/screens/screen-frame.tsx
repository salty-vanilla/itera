import type { ReactNode } from 'react';

// The frame every screen shares until its Issue builds it (#39–#42): the
// one heading of what the screen decides (docs/design/patterns.md 共通) and
// a line of context. The screens replace their content, not this rule.
function ScreenFrame({
  heading,
  meta,
  children,
}: {
  heading: string;
  meta?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-measure-read flex-col gap-2 px-4 py-10 medium:px-6">
      <h1 className="text-display-m text-ink">{heading}</h1>
      {meta !== undefined && <p className="text-body text-ink-muted">{meta}</p>}
      {children}
    </div>
  );
}

export { ScreenFrame };
