import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { setToken } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import AuthSideArt from '../components/AuthSideArt';
import Logo from '../components/Logo';

export default function Login() {
  const { t } = useI18n();
  usePageTitle(t('page.signIn'));
  const navigate = useNavigate();
  const location = useLocation();
  // If PrivateRoute redirected us here, it stashed the intended destination.
  // Only accept same-origin paths (open-redirect defence) — anything starting
  // with "/" and not "//" is a safe path. Two sources, in priority order:
  //   1. location.state.from — set by PrivateRoute on a React Router redirect
  //      (initial visit to a protected page while logged out).
  //   2. ?next= URL param — set by api.js when a 401 mid-session does a
  //      hard window.location.href to /login (state can't survive that).
  // Either way, validate the path is local before honoring it.
  function safePath(p) {
    return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : null;
  }
  const fromState = safePath(location.state?.from);
  const fromQuery = safePath(new URLSearchParams(location.search).get('next'));
  const intended = fromState || fromQuery || '/dashboard';
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  // Surface "MFA session expired" when the user landed back on /login from
  // /login/mfa (refresh / browser back). Pre-populating the error keeps
  // them oriented instead of silently dropping them on a blank form.
  const [error, setError] = useState(
    location.state?.mfaExpired
      ? 'Your two-factor session expired — please sign in again.'
      : ''
  );
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const errorRef = useRef(null);

  // Move focus to the error banner itself (not the email field) so keyboard
  // and screen-reader users hear the message before re-typing. Focusing the
  // input was jarring — the error appeared above but focus jumped past it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(e, overrideCreds) {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    const creds = overrideCreds || form;
    try {
      const { data } = await api.post('/auth/login', creds);
      if (data.mfaRequired) {
        // Two-factor path: route to the challenge page, pass the pending
        // token in location state so the URL doesn't contain it (the token
        // is short-lived but logs/referers still shouldn't see it).
        navigate('/login/mfa', { state: { pendingToken: data.mfaPendingToken, from: intended } });
        return;
      }
      setToken(data.token);
      navigate(intended, { replace: true });
    } catch (err) {
      // If the auth limiter blocked us, show how long to wait — the
      // server echoes that via RateLimit-Reset headers and api.js surfaces
      // it as err.retryAfterSeconds.
      if (err.isRateLimited && err.retryAfterSeconds) {
        setError(t('common.rateLimitedWait', { seconds: err.retryAfterSeconds }));
      } else {
        setError(err.response?.data?.error || t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  // Demo-account button: fill the form AND immediately submit. The previous
  // behaviour just populated the inputs and left the user staring at a
  // pre-filled form wondering what to do next — clicking "Use demo account"
  // is itself the intent to sign in, so we shouldn't make them click "Sign
  // in" a second time. Pass creds explicitly because setForm is async and
  // handleSubmit would otherwise read the stale state on the same tick.
  async function fillDemo() {
    const demoCreds = { email: 'demo@reviewhub.review', password: 'demo123' };
    setForm(demoCreds);
    await handleSubmit(null, demoCreds);
  }

  return (
    <main id="main-content" className="rh-design rh-auth-form-pane min-h-screen lg:grid lg:grid-cols-2">
      {/* ── Left: marketing panel (desktop only) ───────────────────── */}
      <AuthSideArt
        eyebrow={t('auth.welcomeBack')}
        title={t('auth.signInSubtitle')}
      />

      {/* ── Right: the actual form ─────────────────────────────────── */}
      <div className="flex flex-col justify-center py-12 px-4 sm:px-8 lg:px-12">
        <div className="max-w-md w-full mx-auto">
          {/* Brand bar — only shown on mobile where AuthSideArt is hidden */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <Logo size={36} />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">ReviewHub</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('auth.welcomeBack')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t('auth.signInSubtitle')}</p>
          </div>

          {error && (
            <div id="login-error" role="alert" tabIndex={-1} ref={errorRef} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl mb-5 focus:outline-none focus:ring-2 focus:ring-red-400">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('auth.emailAddress')}</label>
              <input
                id="login-email"
                ref={emailRef}
                name="email"
                type="email" required className="input" autoComplete="email" inputMode="email" autoFocus
                aria-describedby={error ? 'login-error' : undefined}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('auth.password')}</label>
                <Link to="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{t('auth.forgotPassword')}</Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'} required className="input pr-20" autoComplete="current-password"
                  maxLength={128}
                  aria-describedby={error ? 'login-error' : undefined}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-medium">
                  {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading} aria-busy={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 rounded-xl shadow-sm shadow-blue-600/20 transition-colors disabled:opacity-60"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          {/* Demo CTA — shown ONLY in dev builds or when the operator
              explicitly opted in at build time via VITE_SHOW_DEMO=1 for a
              public demo deployment. In a real prod launch the demo user
              itself isn't seeded (see server/src/db/seed.js), so the
              button would point at a non-existent account. */}
          {(import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === '1') && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-gray-900 px-3 text-xs uppercase tracking-widest text-gray-400 font-semibold">{t('auth.orDemo')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={fillDemo}
                className="w-full text-sm text-blue-600 dark:text-blue-400 font-medium py-2.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
              >
                {t('auth.demoAccount')} (demo@reviewhub.review)
              </button>
            </>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">{t('auth.signUp')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
