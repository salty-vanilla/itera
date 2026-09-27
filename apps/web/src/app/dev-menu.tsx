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
} from '@/fixtures/states';
import { formatDate, formatTime } from '@/lib/date-format';
import { useStoreSnapshot } from '@/store/store-provider';
import { screens } from './screens';

// Development only (root-layout.tsx keeps it out of production builds).
// Switches the fixture state (PRD §12) and opens its screen. The same state
// opens from the URL: `?fixture=<id>`.

function DevMenu({ current }: { current: FixtureStateId }) {
  const navigate = useNavigate();
  const { records, clock } = useStoreSnapshot();
  const state = fixtureStates.find((s) => s.id === current);
  const screenLabel = screens.find((s) => s.id === state?.screen)?.label;
  const clockText = `${formatDate(clock.today)} ${formatTime(clock.now, records.user.timeZone)}`;

  return (
    // Bottom right, above the compact tab bar (56px), out of the headings.
    <div className="fixed right-2 bottom-[calc(64px+env(safe-area-inset-bottom))] z-(--layer-sticky) medium:bottom-2">
      <Menu>
        <MenuTrigger
          render={
            <Button
              size="sm"
              aria-label={`fixture: ${screenLabel} ${state?.label} · ${clockText}`}
            />
          }
        >
          <FlaskConical aria-hidden />
          <span>
            {screenLabel} {state?.label}
          </span>
          <span className="text-ink-muted">{clockText}</span>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuRadioGroup
            value={current}
            onValueChange={(value: unknown) => {
              if (!isFixtureStateId(value)) return;
              const next = fixtureStates.find((s) => s.id === value);
              const path = screens.find((s) => s.id === next?.screen)?.path;
              void navigate({
                to: path ?? '/today',
                search: { fixture: value },
              });
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
