/**
 * Every rule violation is returned, never thrown. Callers (UI, API) decide
 * how to show it; `code` is stable, `message` is for developers.
 */
export type DomainErrorCode =
  | 'invalidInput'
  | 'invalidTransition'
  | 'recurringTaskCannotComplete'
  | 'notFound';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(
  code: DomainErrorCode,
  message: string,
): Result<T> {
  return { ok: false, error: { code, message } };
}
