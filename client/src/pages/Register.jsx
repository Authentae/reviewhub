import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { setToken } from '../lib/auth';
import PasswordStrength from '../components/PasswordStrength';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import AuthSideArt from '../components/AuthSideArt';
import Logo from '../components/Logo';

export default function Register() {
  const { t } = useI18n();
  usePageTitle(t('page.createAccount'));
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  // Unchecked by default — this is intentional. Legal formation of a
  // contract via click-wrap requires an affirmative act by the user, not
  // pre-checked assent. The audit trail for "did the user agree to these
  // Terms?" starts with this checkbox being literally clicked.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  // Independent reveal for the password and confirm fields. Sharing one
  // toggle defeated the point of having a confirm field — clicking
  // "Show" on the password also unmasked the confirm, so a user could
  // visually copy from one to the other instead of re-typing it.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);

  // Move focus to email field when an error occurs so keyboard users notice it
  useEffect(() => {
    if (error) emailRef.current?.focus();
  }, [error]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError(t('toast.pwMismatch'));
    if (!acceptedTerms) return setError(t('auth.mustAcceptTerms'));
    if (!ageConfirmed) return setError(t('auth.mustConfirmAge'));
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        // Server records these verbatim into the audit trail. The `true`
        // booleans are more than UI state — they're the contractual assent.
        acceptedTerms: true,
        ageConfirmed: true,
      });
      setToken(data.token);
      navigate('/dashboard');
    } catch (err) {
      if (err.isRateLimited && err.retryAfterSeconds) {
        setError(t('common.rateLimitedWait', { seconds: err.retryAfterSeconds }));
      } else {
        setError(err.response?.data?.error || t('auth.registerFailed'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="rh-design rh-auth-form-pane min-h-screen lg:grid lg:grid-cols-2">
      <AuthSideArt
        eyebrow={t('auth.createAccount')}
        title={t('auth.trialNote')}
      />

      <div className="flex flex-col justify-center py-12 px-4 sm:px-8 lg:px-12">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Logo size={36} />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">ReviewHub</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('auth.createAccount')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t('auth.trialNote')}</p>
          </div>

          {error && (
            <div id="reg-error" role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl mb-5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('auth.emailAddress')}</label>
              <input
                id="reg-email"
                ref={emailRef}
                name="email"
                type="email" required className="input" autoComplete="email" autoFocus
                aria-describedby={error ? 'reg-error' : undefined}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'} required className="input pr-20" minLength={6} maxLength={128} autoComplete="new-password"
                  aria-describedby={error ? 'reg-error' : undefined}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={t('auth.pwMinCharsHint')}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-medium">
                  {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>
            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'} required className="input pr-20" autoComplete="new-password"
                  aria-describedby={
                    error ? 'reg-error'
                      : (form.confirm && form.password !== form.confirm ? 'reg-confirm-mismatch' : undefined)
                  }
                  aria-invalid={!!(form.confirm && form.password !== form.confirm)}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-medium">
                  {showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                </button>
              </div>
              {/* Real-time mismatch hint — saves users from submitting the
                  form, getting an error toast, and going back to retype.
                  Only shown once they've started typing the confirm field. */}
              {form.confirm && form.password !== form.confirm && (
                <p id="reg-confirm-mismatch" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t('toast.pwMismatch')}
                </p>
              )}
              {form.confirm && form.password && form.password === form.confirm && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  ✓ {t('auth.passwordMatches', 'Passwords match')}
                </p>
              )}
            </div>

            {/* Required attestations. Order matters for accessibility — the
                checkboxes precede the submit button so screen readers encounter
                them first. */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer leading-relaxed">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0 rounded"
                  aria-describedby="reg-terms-desc"
                />
                <span id="reg-terms-desc">
                  {t('auth.acceptTermsPrefix')}{' '}
                  <Link to="/terms" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.termsTitle')}</Link>
                  {', '}
                  <Link to="/privacy" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.privacyTitle')}</Link>
                  {', '}
                  <Link to="/acceptable-use" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.aupTitle')}</Link>
                  {', '}{t('auth.acceptTermsAnd')}{' '}
                  <Link to="/refund-policy" target="_blank" rel="noopener" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.refundTitle')}</Link>.
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer leading-relaxed">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0 rounded"
                />
                <span>{t('auth.confirmAge')}</span>
              </label>
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
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">{t('auth.signInLink')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
