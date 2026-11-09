import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/** { status: 'loading'|'anon'|'user'|'guest'|'error', user, guest, login(session), logout(), refresh() } */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
