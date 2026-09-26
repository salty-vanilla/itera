/** Value of a CSS custom property on <html>, which carries data-theme. */
export function cssVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
