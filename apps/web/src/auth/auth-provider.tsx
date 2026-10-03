import { createContext, use, type ReactNode } from 'react';
import type { Auth } from './auth';

const AuthContext = createContext<Auth | null>(null);

/**
 * Signing in and the session for the screens below. The data source
 * decides what answers: Better Auth on the API, or the browser mock in
 * development (ADR 0005).
 */
function AuthProvider({ auth, children }: { auth: Auth; children: ReactNode }) {
  return <AuthContext value={auth}>{children}</AuthContext>;
}

function useAuth(): Auth {
  const auth = use(AuthContext);
  if (auth === null) throw new Error('useAuth needs an AuthProvider.');
  return auth;
}

export { AuthProvider, useAuth };
