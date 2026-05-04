import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { setToken } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';

// /magic-login?token=… — the destination of the magic-link email.
//
// Auto-consumes the token on mount: POSTs to /auth/magic-link/consume,
// receives a JWT, sets it, redirects to /dashboard. Or, if the user
// has MFA enabled, redirects to /login/mfa with the pending token.
//
// Failures (expired link, already-used) show a clear retry path:
// "request a new link" linking back to /login. Tokens are single-use
// so a refresh after success would 400 — we don't auto-retry.

export default function MagicLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  usePageTitle('Signing in · ReviewHub');
  useNoIndex();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('Missing token. Open the link from your email again.');
      return;
    }
    let cancelled = false;
    api.post('/auth/magic-link/consume', { token })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.mfa_required && data?.mfa_token) {
          // Stash the pending token the same way /login does and
          // bounce to /login/mfa for code entry.
          sessionStorage.setItem('rh_mfa_pending', data.mfa_token);
          navigate('/login/mfa', { replace: true });
          return;
        }
        if (data?.token) {
          setToken(data.token);
          navigate('/dashboard', { replace: true });
        } else {
          setError('Sign-in failed. Try requesting a new link.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || 'Link expired or already used. Request a new one.');
      });
    return () => { cancelled = true; };
  }, [params, navigate]);

  return (
    <main className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--rh-paper, #fbf8f1)' }}>
      <div className="max-w-md text-center">
        {!error ? (
          <>
            <div
              className="w-10 h-10 mx-auto mb-4 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#1e4d5e', borderTopColor: 'transparent' }}
              aria-hidden="true"
            />
            <p className="text-sm" style={{ color: '#4a525a' }}>Signing you in…</p>
          </>
        ) : (
          <>
            <p className="text-5xl mb-4" aria-hidden="true">🔗</p>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#1d242c' }}>Couldn't sign in</h1>
            <p className="text-sm mb-6" style={{ color: '#4a525a' }}>{error}</p>
            <Link
              to="/login"
              className="inline-block px-5 py-2 rounded-lg font-semibold"
              style={{ background: '#1e4d5e', color: '#fff', textDecoration: 'none' }}
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
