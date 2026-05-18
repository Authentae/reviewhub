import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { setToken } from '../lib/auth';
import PasswordStrength from '../components/PasswordStrength';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import AuthSideArt from '../components/AuthSideArt';
import Logo from '../components/Logo';
import HoneypotField from '../components/HoneypotField';

export default function Register() {
  const { t } = useI18n();
  usePageTitle(t('page.createAccount'));
  const navigate = useNavigate();
  // Audit-flow attribution. When a prospect lands here from clicking
  // the CTA on /audit-preview/<token>, the URL carries:
  //   ?from=audit&business=<their business name>&token=<share token>
  // We stash these in sessionStorage on mount so:
  //   1. The dashboard's onboarding-checklist can pre-fill the new
  //      business name (one less step for them to fill in).
  //   2. We can attribute the signup to a specific outbound audit
  //      (which one converted) without leaking the data into the URL
  //      that gets logged in analytics tools.
  const [searchParams] = useSearchParams();
  // Post-Stripe-payment landing detection. The Stripe Payment Links
  // we use for paid tiers redirect to:
  //   /register?from=stripe&plan=<starter|pro|business>&checkout_success=1
  // The customer has ALREADY paid by the time they hit this page — we
  // need to (a) acknowledge their subscription is active so they don't
  // think they need to pay again, (b) walk them through creating their
  // ReviewHub account so we can match their Stripe email to a DB user
  // and grant access. Provisioning is still manual (Stripe webhook not
  // wired for the new ReviewHub account); Earth gets a Stripe email,
  // looks up the user by email, runs a 1-line SQL to mark them paid.
  const fromStripe = searchParams.get('from') === 'stripe'
    && searchParams.get('checkout_success') === '1';
  const fromAudit = searchParams.get('from') === 'audit';
  const stripePlan = fromStripe ? (searchParams.get('plan') || 'starter') : null;
  useEffect(() => {
    const from = searchParams.get('from');
    if (from === 'audit') {
      const business = searchParams.get('business') || '';
      const token = searchParams.get('token') || '';
      try {
        sessionStorage.setItem('rh_signup_attribution', JSON.stringify({
          from: 'audit',
          business,
          token,
          at: Date.now(),
        }));
      } catch { /* sessionStorage disabled in private mode — non-fatal */ }
    } else if (from === 'stripe') {
      // Record Stripe attribution too — useful for funnel analysis
      // ("how many Stripe-redirected customers completed signup?")
      // and as a hint to the dashboard onboarding to skip the
      // "start your trial" upsell since they already paid.
      try {
        sessionStorage.setItem('rh_signup_attribution', JSON.stringify({
          from: 'stripe',
          plan: searchParams.get('plan') || '',
          at: Date.now(),
        }));
      } catch { /* non-fatal */ }
    }
    // Run once on mount; we don't want to re-stash if the user edits the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Honeypot — see HoneypotField.jsx + server/middleware/honeypot.js. Real
  // users never touch this; bots that fill all fields trigger a fake-200.
  const [honeypot, setHoneypot] = useState('');
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
        // Honeypot field — sent verbatim. Real users always send '';
        // bots that fill all inputs send a value, and the server's
        // honeypot middleware fake-200s without creating a row.
        website: honeypot,
        // Server records these verbatim into the audit trail. The `true`
        // booleans are more than UI state — they're the contractual assent.
        acceptedTerms: true,
        ageConfirmed: true,
        // Signup attribution — tells server whether to send the regular
        // free-tier welcome path or the paid-checkout acknowledgement
        // email path (which sets a different expectation: "we got your
        // payment, you'll be fully activated within 24h" vs "you're in,
        // start using the free tier"). The audit-page funnel adds
        // 'audit' so we can split signup-from-cold-outreach from
        // organic signup in retention cohort analysis later.
        signupSource: fromStripe ? 'stripe' : (fromAudit ? 'audit' : 'organic'),
        signupPlan: fromStripe ? stripePlan : null,
      });
      setToken(data.token);
      // replace: true so clicking back doesn't return to /register
      // (PublicOnlyRoute would bounce them anyway, but adding the flag
      // matches Login's pattern and avoids the redirect flash).
      navigate('/dashboard', { replace: true });
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {fromStripe
                ? t('auth.createAccountAfterPay', 'One last step: create your account')
                : t('auth.createAccount')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
              {fromStripe
                ? t('auth.createAccountAfterPaySub', "Use the same email you paid with so we can match your subscription to your account.")
                : t('auth.trialNote')}
            </p>
          </div>

          {/* Post-Stripe-payment confirmation. Customer arrives here
              immediately after Stripe charges their card. The banner is
              the FIRST thing they should see — without it, they hit a
              generic signup form and reasonably wonder whether they
              just got double-charged or scammed. Provisioning is manual
              until we wire a Stripe webhook for this account, so the
              copy is honest about the small handoff window: Earth
              matches the email to the account and grants access. */}
          {fromStripe && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-xl mb-5 p-4"
              style={{
                background: 'rgba(107,142,122,0.10)',
                border: '1px solid rgba(107,142,122,0.30)',
                color: 'var(--rh-ink, #1d242c)',
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--rh-sage, #6b8e7a)' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div className="flex-1 text-sm leading-relaxed">
                <p className="font-semibold mb-1">
                  {t('auth.stripePaidTitle', 'Payment received — welcome to ReviewHub')} {stripePlan ? `· ${stripePlan.charAt(0).toUpperCase() + stripePlan.slice(1)}` : ''}
                </p>
                <p className="text-[13px]" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                  {t(
                    'auth.stripePaidBody',
                    'Your subscription is active. Create your account below using the email you used at checkout. Account access is granted within a few minutes (manual review while we finish onboarding our payment processor).'
                  )}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div id="reg-error" role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl mb-5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <HoneypotField value={honeypot} onChange={setHoneypot} />
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('auth.emailAddress')}</label>
              <input
                id="reg-email"
                ref={emailRef}
                name="email"
                type="email" required className="input" autoComplete="email" inputMode="email" autoFocus
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
                  type={showPassword ? 'text' : 'password'} required className="input pr-20" minLength={8} maxLength={128} autoComplete="new-password"
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

            {/* Healthcare/regulated-industries gate. We are NOT HIPAA-
                compliant and don't offer a BAA. Healthcare buyers who sign
                up not knowing this end up demanding refunds and bad-mouthing
                us. Surfacing the limitation BEFORE the signup form
                completes is honest + protects everyone. Direct buyers in
                non-regulated industries breeze past it. */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
              <strong className="font-semibold">{t('auth.regulatedIndustryTitle', 'Healthcare, legal, or financial advisory?')}</strong>{' '}
              {t('auth.regulatedIndustryBody', "We're not HIPAA-compliant and don't offer a BAA today. If you handle patient/client privileged data, ")}
              <Link to="/support?type=account" className="underline font-medium">
                {t('auth.regulatedIndustryCta', 'contact us first')}
              </Link>
              {t('auth.regulatedIndustryAfter', ' before signing up.')}
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
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.termsTitle')}</Link>
                  {', '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.privacyTitle')}</Link>
                  {', '}
                  <Link to="/acceptable-use" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.aupTitle')}</Link>
                  {', '}{t('auth.acceptTermsAnd')}{' '}
                  <Link to="/refund-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('legal.refundTitle')}</Link>.
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
