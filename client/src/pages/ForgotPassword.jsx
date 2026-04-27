import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import { useI18n } from '../context/I18nContext';
import AuthSideArt from '../components/AuthSideArt';
import Logo from '../components/Logo';

// "Forgot password?" entry point. Collects an email, asks the server to send a
// reset link, then shows a generic confirmation message (same regardless of
// whether the address exists — server-side behaviour prevents enumeration).
export default function ForgotPassword() {
  const { t } = useI18n();
  usePageTitle(t('page.forgotPassword'));
  useNoIndex();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const emailRef = useRef(null);

  // Move focus to the field on mount so keyboard users can type immediately.
  useEffect(() => { if (!submitted) emailRef.current?.focus(); }, [submitted]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      if (err.isRateLimited && err.retryAfterSeconds) {
        setError(t('common.rateLimitedWait', { seconds: err.retryAfterSeconds }));
      } else {
        setError(err.response?.data?.error || t('forgot.genericError'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="rh-design rh-auth-form-pane min-h-screen lg:grid lg:grid-cols-2">
      <AuthSideArt eyebrow={t('forgot.title')} title={t('forgot.subtitle')} />

      <div className="flex flex-col justify-center py-12 px-4 sm:px-8 lg:px-12">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Logo size={36} />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">ReviewHub</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{t('forgot.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">{t('forgot.subtitle')}</p>
          </div>

          {submitted ? (
            <div className="text-center py-4">
              <p className="text-5xl mb-4" aria-hidden="true">📨</p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('forgot.sentTitle')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('forgot.sentDesc')}</p>
              <Link to="/login" className="btn-secondary text-sm inline-block">{t('forgot.backToLogin')}</Link>
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
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  {t('auth.emailAddress')}
                </label>
                <input
                  id="forgot-email"
                  ref={emailRef}
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
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
                {loading ? t('forgot.sending') : t('forgot.sendLink')}
              </button>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{t('forgot.backToLogin')}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
