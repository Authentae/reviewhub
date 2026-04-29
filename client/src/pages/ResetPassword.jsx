import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import PasswordStrength from '../components/PasswordStrength';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import { useI18n } from '../context/I18nContext';
import AuthSideArt from '../components/AuthSideArt';
import Logo from '../components/Logo';

// Landing page for password-reset links. Requires ?token=<64-hex> in the URL.
// Presents a new-password form, submits token + password, then routes to login.
export default function ResetPassword() {
  const { t } = useI18n();
  usePageTitle(t('page.resetPassword'));
  useNoIndex();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const tokenValid = /^[a-f0-9]{64}$/.test(token);

  const [form, setForm] = useState({ password: '', confirm: '' });
  // Independent reveal toggles per field. Sharing one toggle let a user
  // see both passwords side-by-side and just visually copy — defeats
  // the point of a separate confirm field.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => { if (tokenValid) passwordRef.current?.focus(); }, [tokenValid]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError(t('toast.pwMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || t('reset.genericError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="rh-design rh-auth-form-pane min-h-screen lg:grid lg:grid-cols-2">
      <AuthSideArt eyebrow={t('reset.title')} title={t('reset.subtitle')} />

      <div className="flex flex-col justify-center py-12 px-4 sm:px-8 lg:px-12">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Logo size={36} />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">ReviewHub</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('reset.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t('reset.subtitle')}</p>
          </div>

          {!tokenValid ? (
            <div className="text-center py-4">
              <p className="text-5xl mb-4" aria-hidden="true">⚠️</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('reset.badLinkTitle')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('reset.badLinkDesc')}</p>
              <Link to="/forgot-password" className="btn-primary text-sm inline-block">{t('reset.requestNew')}</Link>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <p className="text-5xl mb-4" aria-hidden="true">✅</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('reset.successTitle')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('reset.successDesc')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('reset.newPassword')}</label>
                <div className="relative">
                  <input
                    id="reset-password"
                    ref={passwordRef}
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    className="input pr-20"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={t('auth.pwMinCharsHint')}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-medium">
                    {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">{t('reset.confirmPassword')}</label>
                <div className="relative">
                  <input
                    id="reset-confirm"
                    name="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    className="input pr-20"
                    value={form.confirm}
                    onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs font-medium">
                    {showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
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
                {loading ? t('reset.saving') : t('reset.submit')}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('forgot.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
