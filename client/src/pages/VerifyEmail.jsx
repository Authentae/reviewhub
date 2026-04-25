import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Handles the landing of email verification links (CLIENT_URL/verify-email?token=...).
// Automatically submits the token on mount and shows the result.
// Under React.StrictMode the mount effect fires twice in dev; a ref prevents
// the double-submit that would otherwise cause the second call to fail with
// "Invalid or expired" after the first one consumed the token.
export default function VerifyEmail() {
  const { t } = useI18n();
  usePageTitle(t('page.verifyEmail'));
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  // 'pending' | 'success' | 'error' | 'missing'
  const [status, setStatus] = useState(() => (token ? 'pending' : 'missing'));
  const [error, setError] = useState('');
  const submitted = useRef(false);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || t('verify.genericError'));
      });
  }, [token, t]);

  return (
    <main id="main-content" className="rh-design min-h-screen grid place-items-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-8 text-center rh-sans">
          {status === 'pending' && (
            <>
              <div className="w-10 h-10 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <p className="text-gray-600 dark:text-gray-300">{t('verify.verifying')}</p>
            </>
          )}
          {status === 'success' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">✅</p>
              <h1 className="rh-serif text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">{t('verify.successTitle')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('verify.successDesc')}</p>
              <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm shadow-blue-600/20 transition-colors">{t('verify.goDashboard')}</Link>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">⚠️</p>
              <h1 className="rh-serif text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">{t('verify.errorTitle')}</h1>
              <p className="text-sm text-red-600 dark:text-red-400 mb-6" role="alert">{error}</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link to="/login" className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">{t('verify.backToLogin')}</Link>
                <Link to="/dashboard" className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm shadow-blue-600/20 transition-colors">{t('verify.goDashboard')}</Link>
              </div>
            </>
          )}
          {status === 'missing' && (
            <>
              <p className="text-5xl mb-3" aria-hidden="true">📧</p>
              <h1 className="rh-serif text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">{t('verify.missingTitle')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('verify.missingDesc')}</p>
              <Link to="/login" className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">{t('verify.backToLogin')}</Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
