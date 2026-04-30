import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import { useI18n } from '../context/I18nContext';

// Landing page for the email-change confirm link (CLIENT_URL/email-change?token=…).
// Mirrors VerifyEmail: auto-submits the token, shows the outcome. Under
// StrictMode the effect fires twice, so a ref prevents the double-submit
// that would otherwise burn the token on first call and fail on the second.
export default function EmailChange() {
  const { t } = useI18n();
  usePageTitle(t('page.emailChange'));
  useNoIndex();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  // Same client-side shape gate used on /verify-email and /confirm-erasure.
  // Server expects exactly 64 hex chars (auth.js:883). Without this, a
  // malformed link briefly flashes "Verifying…" before the server's
  // "Invalid token" rejection arrives — confusing UX.
  const tokenLooksValid = /^[a-f0-9]{64}$/.test(token);
  const [status, setStatus] = useState(() => (tokenLooksValid ? 'pending' : 'missing'));
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');
  const submitted = useRef(false);

  useEffect(() => {
    if (!tokenLooksValid || submitted.current) return;
    submitted.current = true;
    api.post('/auth/email/confirm', { token })
      .then(({ data }) => { setStatus('success'); setEmail(data.email || null); })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || t('emailChange.genericError'));
      });
  }, [token, t]);

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-md mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          {status === 'pending' && (
            <>
              <div className="w-10 h-10 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-gray-600 dark:text-gray-300">{t('emailChange.verifying')}</p>
            </>
          )}
          {status === 'success' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">✅</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('emailChange.successTitle')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('emailChange.successDesc')}</p>
              {email && <p className="text-sm font-mono text-gray-700 dark:text-gray-200 mb-6 break-all">{email}</p>}
              <Link to="/settings" className="btn-primary text-sm inline-block">{t('emailChange.goSettings')}</Link>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">⚠️</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('emailChange.errorTitle')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <Link to="/settings" className="btn-secondary text-sm inline-block">{t('emailChange.goSettings')}</Link>
            </>
          )}
          {status === 'missing' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">❓</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('emailChange.missingTitle')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('emailChange.missingDesc')}</p>
              <Link to="/settings" className="btn-secondary text-sm inline-block">{t('emailChange.goSettings')}</Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
