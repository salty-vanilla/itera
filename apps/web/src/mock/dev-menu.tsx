import { useNavigate } from '@tanstack/react-router';
import { FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import {
  fixtureStates,
  isFixtureStateId,
  type FixtureStateId,
} from './fixture-states';
import { formatDate, formatTime } from '@/lib/date-format';
import { useAppOverview } from '@/store/use-app-overview';
import { screens } from '@/app/screens';

// Development only, with the browser mock (mock-data.tsx).
// Switches the fixture state (PRD §12) and opens its screen. The same state
// opens from the URL: `?fixture=<id>`.

function DevMenu({ current }: { current: FixtureStateId }) {
  const navigate = useNavigate();
  const { today, now, timeZone } = useAppOverview();
  const state = fixtureStates.find((s) => s.id === current);
  const screenLabel = screens.find((s) => s.id === state?.screen)?.label;
  const clockText = `${formatDate(today)} ${formatTime(now, timeZone)}`;

  return (
    // Out of the headings and of the compact Quick Add: top right and
    // icon-only under 768px, bottom right with its words from 768px.
    <div className="fixed top-2 right-2 z-(--layer-sticky) medium:top-auto medium:bottom-2">
      <Menu>
        <MenuTrigger render={<Button size="sm" />}>
          <FlaskConical aria-hidden />
          <span className="sr-only medium:not-sr-only">
            {screenLabel} {state?.label}
          </span>
          <span className="sr-only text-ink-muted medium:not-sr-only">
            {clockText}
          </span>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuRadioGroup
            value={current}
            onValueChange={(value: unknown) => {
              if (!isFixtureStateId(value)) return;
              const next = fixtureStates.find((s) => s.id === value);
              const path = screens.find((s) => s.id === next?.screen)?.path;
              // The state's own screen parameters (an open Task, a 切り口).
              const query = new URLSearchParams({
                fixture: value,
                ...next?.search,
              });
              void navigate({ href: `${path ?? '/today'}?${query}` });
            }}
          >
            {screens.map((screen, index) => (
              <MenuGroup key={screen.id}>
                {index > 0 && <MenuSeparator />}
                <MenuGroupLabel>{screen.label}</MenuGroupLabel>
                {fixtureStates
                  .filter((s) => s.screen === screen.id)
                  .map((s) => (
                    <MenuRadioItem key={s.id} value={s.id}>
                      {s.label}
                    </MenuRadioItem>
                  ))}
              </MenuGroup>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
    </div>
  );
}

export { DevMenu };
