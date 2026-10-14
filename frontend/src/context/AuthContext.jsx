import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMe, login, logout } from '../api/auth.api.js';
import { setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

// status is one of:
//   'loading'        we haven't asked the server who this is yet
//   'authenticated'  user is set
//   'anonymous'      nobody is signed in
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  // On page load (including a browser refresh), ask the server who the
  // cookie belongs to. This is what keeps you signed in across refreshes.
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If any later request returns 401, drop back to signed-out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const signIn = useCallback(async (username, password) => {
    const me = await login(username, password); // throws ApiError on failure
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      // Even if the request failed, this browser should stop acting signed in.
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signOut }),
    [user, status, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
