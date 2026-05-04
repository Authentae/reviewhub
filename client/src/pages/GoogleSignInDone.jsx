import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';

// /auth/google/done#token=… — handoff route for the server-side Google
// OAuth callback. The server sets the httpOnly session cookie AND
// passes the JWT via URL fragment so we can set the localStorage marker
// (rh_logged_in) PrivateRoute reads synchronously. Fragment (not query)
// keeps the token out of server logs and Referer headers.
export default function GoogleSignInDone() {
  const navigate = useNavigate();
  usePageTitle('Signing in · ReviewHub');
  useNoIndex();

  useEffect(() => {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const token = params.get('token');
    if (token) {
      setToken(token);
      // Strip the fragment so a back-button or refresh doesn't replay it.
      window.history.replaceState(null, '', '/dashboard');
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login?google_error=missing_token', { replace: true });
    }
  }, [navigate]);

  return (
    <main className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--rh-paper, #fbf8f1)' }}>
      <div className="max-w-md text-center">
        <div
          className="w-10 h-10 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#1e4d5e', borderTopColor: 'transparent' }}
          aria-hidden="true"
        />
        <p className="text-sm" style={{ color: '#4a525a' }}>Signing you in…</p>
      </div>
    </main>
  );
}
