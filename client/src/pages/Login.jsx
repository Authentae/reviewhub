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

          {/* Magic-link sign-in — passwordless alternative for users
              who don't want to remember another password. Sends a
              click-once link to the email they typed above. */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={async () => {
                if (!form.email || !form.email.includes('@')) {
                  setError(t('auth.magicLinkNeedEmail', 'Type your email above first.'));
                  return;
                }
                try {
                  setLoading(true);
                  await api.post('/auth/magic-link/request', { email: form.email });
                  setError(null);
                  // eslint-disable-next-line no-alert
                  alert(t('auth.magicLinkSent', { email: form.email, defaultValue: `If an account exists for ${form.email}, a sign-in link is on its way. Check your inbox.` }));
                } catch {
                  // Endpoint always 200s for no-enumeration, so this
                  // catch is for network errors only.
                  setError(t('auth.magicLinkFailed', 'Could not send link. Try again.'));
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('auth.magicLinkPrompt', 'Or email me a sign-in link instead →')}
            </button>
          </div>

          {/* Sign in with Google — server-side OAuth flow. The /api
              endpoint redirects to Google, who redirects back; the
              session cookie + JWT are set by the time the user lands
              on /dashboard. No client-side OAuth lib needed. */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-gray-900 px-2 text-gray-400">{t('auth.orDivider', 'or')}</span>
            </div>
          </div>
          <a
            href="/api/auth/google/login"
            className="w-full inline-flex items-center justify-center gap-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t('auth.signInWithGoogle', 'Sign in with Google')}
          </a>

          {/* Surface Google OAuth errors from the URL — the callback
              redirects to /login?google_error=… on failure (CSRF,
              exchange failure, etc.) so the user gets feedback instead
              of a blank screen. */}
          {(() => {
            const sp = new URLSearchParams(window.location.search);
            const ge = sp.get('google_error');
            if (!ge) return null;
            const messages = {
              csrf: t('auth.googleErrorCsrf', 'Sign-in expired. Please try again.'),
              exchange_failed: t('auth.googleErrorExchange', 'Google sign-in failed. Try again.'),
              not_configured: t('auth.googleErrorNotConfigured', 'Google sign-in is not enabled.'),
              server_error: t('auth.googleErrorServer', 'Server error during sign-in. Try again.'),
              unknown: t('auth.googleErrorUnknown', 'Sign-in failed. Try again.'),
            };
            return (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400 text-center">
                {messages[ge] || messages.unknown}
              </p>
            );
          })()}

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
