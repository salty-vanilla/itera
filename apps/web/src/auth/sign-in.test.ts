import { describe, expect, it } from 'vitest';
import { returnPath, signInHref } from './sign-in';

describe('returnPath', () => {
  it('keeps a path of the app, with its search and hash', () => {
    expect(returnPath('/today?date=2026-10-01')).toBe('/today?date=2026-10-01');
    expect(returnPath('/sprint?sprint=3#plan')).toBe('/sprint?sprint=3#plan');
  });

  it('opens Today without a screen to come back to', () => {
    expect(returnPath(undefined)).toBe('/today');
    expect(returnPath('')).toBe('/today');
    expect(returnPath(42)).toBe('/today');
  });

  it('never leaves the app', () => {
    for (const redirect of [
      'https://example.com/today',
      '//example.com/today',
      '/\\example.com/today',
      'javascript:alert(1)',
      'today',
      // The parser drops `.` and `..`, leaving `//evil.com`.
      '/.//evil.com',
      '/a/..//evil.com',
      '/%2e//evil.com',
      '/%2F%2Fevil.com',
      '/%5Cevil.com',
    ])
      expect(returnPath(redirect)).toBe('/today');
  });

  it('does not come back to the sign-in screen or go to the API', () => {
    expect(returnPath(signInHref('/today'))).toBe('/today');
    expect(returnPath('/api/auth/sign-out')).toBe('/today');
    expect(returnPath('/SIGN-IN/')).toBe('/today');
    expect(returnPath('/api')).toBe('/today');
  });
});
