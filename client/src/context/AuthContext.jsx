import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { getToken, setToken, setUnauthorizedHandler } from '../api/client';
import { me } from '../api/auth';
import { AuthContext } from './useAuth';

const ANON = { status: 'anon', user: null, guest: null };

const fromIdentity = (identity) => ({
  status: identity.kind,
  user: identity.user || null,
  guest: identity.guest || null,
});

/**
 * Who is signed in. status: 'loading' | 'anon' | 'user' | 'guest' | 'error'.
 * 'error' means the server could not be reached while checking a saved token.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => (getToken() ? { ...ANON, status: 'loading' } : ANON));

  const logout = useCallback(() => {
    setToken(null);
    setState(ANON);
  }, []);

  // Asks the server who the saved token belongs to; `isCurrent` drops stale replies.
  const loadIdentity = useCallback((isCurrent = () => true) => {
    me()
      .then((identity) => {
        if (isCurrent()) setState(fromIdentity(identity));
      })
      .catch((err) => {
        // Also catches a malformed reply, so the session check can never hang.
        if (!isCurrent()) return;
        if (err.code === 'AUTH_REQUIRED') logout();
        else setState({ ...ANON, status: 'error' });
      });
  }, [logout]);

  const refresh = useCallback(() => {
    if (!getToken()) {
      setState(ANON);
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    loadIdentity();
  }, [loadIdentity]);

  /** Takes a signup, login or guest response: { token, user } or { token, guest }. */
  const login = useCallback((session) => {
    setToken(session.token);
    setState(session.guest
      ? { status: 'guest', user: null, guest: session.guest }
      : { status: 'user', user: session.user, guest: null });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return undefined;
    let active = true;
    loadIdentity(() => active);
    return () => {
      active = false;
    };
  }, [logout, loadIdentity]);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };
