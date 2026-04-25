import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { isLoggedIn } from '../lib/auth';

// Shared /me result — before this, Navbar + EmailVerifyBanner +
// SessionExpiryBanner + every Settings-like page each fetched /auth/me
// independently, so a single page load fired 3-4 identical requests.
//
// Contract:
//   user            — object returned by /auth/me's `user` field, or null
//   subscription    — /auth/me's `subscription` (with plan_meta hydrated)
//   notifications   — prefs object or null
//   sessionExpires  — ISO string or null
//   loading         — true until the first fetch resolves (either way)
//   refresh()       — force-refetch (call after a mutation that changes /me)
//
// The fetch is gated by isLoggedIn() so anonymous pages don't pay the cost.
// Failures silently leave the state null — individual components decide how
// to degrade (most show nothing; api.js already redirects on session 401).

const UserContext = createContext({
  user: null, subscription: null, notifications: null, sessionExpires: null,
  loading: false, refresh: () => {},
});

export function UserProvider({ children }) {
  const [state, setState] = useState({
    user: null, subscription: null, notifications: null, sessionExpires: null,
    loading: isLoggedIn(),
  });

  const fetchMe = useCallback(async () => {
    if (!isLoggedIn()) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setState({
        user: data.user || null,
        subscription: data.subscription || null,
        notifications: data.notifications || null,
        sessionExpires: data.session_expires_at || null,
        loading: false,
      });
    } catch {
      // Silent — api.js interceptor handles 401 globally.
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  // Re-fetch when the tab regains focus so cross-device changes propagate
  // within a session (e.g. upgraded on laptop, come back to phone).
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible' && isLoggedIn()) fetchMe();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchMe]);

  // Cross-tab sync. localStorage fires `storage` events in OTHER tabs only
  // (not the one that made the change), so when the user logs out in one
  // tab every other tab drops its cached user state and bounces to /login
  // on the next protected-route check.
  useEffect(() => {
    function onStorage(e) {
      // `rh_logged_in` flipped to null/absent → user just logged out here
      // or in another tab.
      if (e.key === 'rh_logged_in' && !e.newValue) {
        setState({
          user: null, subscription: null, notifications: null,
          sessionExpires: null, loading: false,
        });
      }
      // Explicit refresh event — any mutation from another tab that
      // affects /me (plan change, email change) sets this to force a
      // cross-tab refresh.
      if (e.key === 'rh_user_ctx_bump') {
        fetchMe();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchMe]);

  return (
    <UserContext.Provider value={{ ...state, refresh: fetchMe }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
