import { useId } from 'react';

const FIELD =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

// Chooses where focus lands when a Base UI popup opens. Spread `scopeProps`
// on the popup and pass `initialFocus` to it. Without a match, returning true
// keeps Base UI's default (the first tabbable element). An element marked
// `data-autofocus` inside comes first: the content asked for it (e.g. E on a
// row opens the Task at its Estimate).
function useInitialFocus(selector: string) {
  const scope = useId();
  return {
    scopeProps: { 'data-focus-scope': scope },
    initialFocus: () => {
      const popup = document.querySelector(`[data-focus-scope="${scope}"]`);
      return (
        popup?.querySelector<HTMLElement>('[data-autofocus]') ??
        popup?.querySelector<HTMLElement>(selector) ??
        true
      );
    },
  };
}

// docs/design/accessibility.md: a Drawer or Popover moves focus to its first
// input when it opens. The header's close button comes first in the DOM, so
// the default would land on it instead.
export function useFirstFieldFocus() {
  return useInitialFocus(FIELD);
}

// DESIGN.md Dialog: focus starts on the safest action, which is the first
// button of the footer (Secondary comes before Primary), even when the Dialog
// holds a checkbox or another input.
export function useFooterActionFocus(footerSlot: string) {
  return useInitialFocus(`[data-slot="${footerSlot}"] button`);
}
