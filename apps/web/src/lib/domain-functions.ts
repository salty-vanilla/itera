// The only module of the screens that imports packages/domain (ADR 0005 プ
// レビューの例外, D2): the previews computed without a request, and the
// date functions. The screens take everything else from the contract.
// Until iOS starts, the web app runs the domain's own functions rather than
// its own copy of them (PRD §14). ESLint keeps every other screen file off
// packages/domain (eslint.config.js).
export {
  addDays,
  boundValue,
  dayOfWeek,
  parseLocalDate,
  presentedSuggestion,
  toLocalDate,
} from '@itera/domain';
