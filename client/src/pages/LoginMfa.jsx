import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { setToken } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Second-factor challenge page. Reached via navigate('/login/mfa', {state:
// {pendingToken}}) from Login.jsx after a correct password against an
// MFA-enabled account. If the user lands here without state (direct URL or
// refresh), we send them back to /login — the pending token isn't in URL
// params on purpose.
//
// Two input modes: 6-digit emailed OTP (default), or a recovery code for
// users who've lost access to their email. Recovery is a one-click toggle,
// not hidden behind a tiny link — losing email access is exactly when users
// need the escape hatch most, and hiding it defeats the purpose.
export default function LoginMfa() {
  const { t } = useI18n();
  usePageTitle(t('page.loginMfa'));
  const navigate = useNavigate();
  const location = useLocation();
  const pendingToken = location.state?.pendingToken;
  // Intended post-auth destination — passed through from Login when the user
  // was bounced off a private route (e.g. /settings?unsub=digest). Validate
  // as a same-origin path to prevent open-redirect via state injection.
  const intended = typeof location.state?.from === 'string'
    && location.state.from.startsWith('/')
    && !location.state.from.startsWith('//')
    ? location.state.from
    : '/dashboard';

  const [mode, setMode] = useState('otp'); // 'otp' | 'recovery'
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const codeRef = useRef(null);

  // If someone reloads this page (state is lost on reload in react-router),
  // there's nothing to do — send them back to /login to re-authenticate.
  useEffect(() => {
    if (!pendingToken) {
      navigate('/login', { replace: true });
    }
  }, [pendingToken, navigate]);

  // Focus the code input whenever the mode changes (including on initial mount)
  useEffect(() => {
    codeRef.current?.focus();
  }, [mode]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pendingToken) return;
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'otp' ? '/auth/login/mfa' : '/auth/login/recovery';
      const body = mode === 'otp' ? { code } : { recovery_code: code };
      // This endpoint wants the pending token in the Authorization header —
      // a one-off pattern since the usual api interceptor pulls from localStorage.
      const { data } = await api.post(endpoint, body, {
        headers: { Authorization: `Bearer ${pendingToken}` },
      });
      setToken(data.token);
      // Let the user know when they used the last-but-one recovery code —
      // helps them remember to generate new ones.
      if (mode === 'recovery' && typeof data.recovery_codes_remaining === 'number' && data.recovery_codes_remaining <= 2) {
        sessionStorage.setItem('mfa_low_recovery_warn', String(data.recovery_codes_remaining));
      }
      navigate(intended, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('mfa.genericError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!pendingToken) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      await api.post('/auth/login/mfa/resend', null, {
        headers: { Authorization: `Bearer ${pendingToken}` },
      });
      setInfo(t('mfa.resent'));
    } catch (err) {
      setError(err.response?.data?.error || t('mfa.resendFailed'));
    } finally {
      setResending(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setCode('');
    setError('');
    setInfo('');
  }

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 px-4">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('mfa.challengeTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {mode === 'otp' ? t('mfa.challengeSubtitleOtp') : t('mfa.challengeSubtitleRecovery')}
          </p>
        </div>

        <div className="card p-6">
          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          {info && (
            <div role="status" className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm px-4 py-3 rounded-lg mb-4">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {mode === 'otp' ? t('mfa.codeLabel') : t('mfa.recoveryCodeLabel')}
              </label>
              <input
                id="mfa-code"
                ref={codeRef}
                type="text"
                // OTP: allow only digits, autocomplete one-time-code, mobile numeric keyboard
                inputMode={mode === 'otp' ? 'numeric' : 'text'}
                autoComplete={mode === 'otp' ? 'one-time-code' : 'off'}
                pattern={mode === 'otp' ? '[0-9]{6}' : undefined}
                maxLength={mode === 'otp' ? 6 : 20}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={mode === 'otp' ? '000000' : 'XXXX-XXXX'}
                className="input text-lg tracking-widest text-center font-mono"
                aria-describedby="mfa-hint"
              />
              <p id="mfa-hint" className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {mode === 'otp' ? t('mfa.codeHint') : t('mfa.recoveryCodeHint')}
              </p>
            </div>
            <button type="submit" disabled={loading} aria-busy={loading} className="btn-primary w-full py-2.5">
              {loading ? t('mfa.verifying') : t('mfa.verify')}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2 text-center text-sm">
            {mode === 'otp' ? (
              <>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-blue-600 hover:underline disabled:opacity-60"
                >
                  {resending ? t('mfa.resending') : t('mfa.resendCode')}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => switchMode('recovery')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    {t('mfa.useRecovery')}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('otp')}
                className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              >
                {t('mfa.backToOtp')}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          <Link to="/login" className="text-blue-600 hover:underline font-medium">{t('forgot.backToLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
