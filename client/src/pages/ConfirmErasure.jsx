import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import { useI18n } from '../context/I18nContext';

// Landing page for the GDPR Article 17 erasure-confirmation link sent by
// email. The query string carries (userId, token); we POST them to
// /api/gdpr/confirm-erasure and surface the result.
//
// Public route — the request is authenticated by the signed token, not
// by session. We don't gate this on isLoggedIn() because deletion may
// be requested from a session that's since timed out, and the user
// shouldn't have to sign back in just to confirm deletion.
//
// StrictMode mounts effects twice in dev — a ref prevents the
// double-submit which would otherwise burn the token on the first call
// and 400 on the second.
export default function ConfirmErasure() {
  const { t } = useI18n();
  usePageTitle(t('confirmErasure.title', 'Confirm account deletion'));
  useNoIndex();

  const [params] = useSearchParams();
  const userId = params.get('userId') || '';
  const token = params.get('token') || '';

  // Validate BOTH params before treating the page as "ready to confirm".
  // userId must be a positive integer (matches the server gate at
  // gdpr.js:198) — accepting any truthy string previously meant "abc"
  // got past the client check, then Number('abc') = NaN, then the
  // server rejected with a confusing "Invalid user id" after the
  // user already saw the in-progress spinner.
  const valid = /^[1-9]\d{0,9}$/.test(userId) && /^[a-f0-9]{64}$/.test(token);
  const [status, setStatus] = useState(valid ? 'idle' : 'missing');
  const [error, setError] = useState('');
  const submitted = useRef(false);

  function confirmDelete() {
    if (submitted.current) return;
    submitted.current = true;
    setStatus('pending');
    api.post('/gdpr/confirm-erasure', { userId: Number(userId), token })
      .then(() => setStatus('success'))
      .catch((err) => {
        const msg = err?.response?.data?.error || 'Failed to confirm deletion. The link may have expired.';
        setError(msg);
        setStatus('error');
        // Allow retry on transient failures.
        submitted.current = false;
      });
  }

  // Note: no auto-submit. This is destructive and irreversible — explicit
  // click required. The email already explains the consequences; arriving
  // here is intent, but a user might reach this page from a forwarded
  // email by accident, so the final button-click stays.

  return (
    <div className="rh-design rh-app min-h-screen flex items-center justify-center px-4">
      <main id="main-content" className="card p-8 max-w-md w-full text-center">
        <p className="text-5xl mb-4" aria-hidden="true">⚠️</p>

        {status === 'missing' && (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t('confirmErasure.invalidTitle', 'Invalid confirmation link')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('confirmErasure.invalidBody', 'This link is missing or malformed. Request a new deletion email from Settings → Privacy.')}
            </p>
            <Link to="/" className="btn-secondary">{t('notFound.goHome', 'Home')}</Link>
          </>
        )}

        {status === 'idle' && (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t('confirmErasure.title', 'Confirm account deletion')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {t('confirmErasure.warn', 'You are about to permanently delete your ReviewHub account and all associated data — reviews, settings, audit trail, and platform connections.')}
            </p>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">
              {t('confirmErasure.irreversible', 'This action is irreversible.')}
            </p>
            <button
              type="button"
              onClick={confirmDelete}
              className="btn-primary"
              style={{ background: 'var(--rh-rose)', borderColor: 'var(--rh-rose)' }}
            >
              {t('confirmErasure.cta', 'Yes, delete my account')}
            </button>
            <div className="mt-3">
              <Link to="/" className="text-sm text-gray-500 hover:underline">
                {t('common.cancel', 'Cancel')}
              </Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('confirmErasure.pending', 'Deleting your account…')}
          </p>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t('confirmErasure.successTitle', 'Account deleted')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('confirmErasure.successBody', 'Your ReviewHub account and data have been permanently removed in compliance with GDPR Article 17.')}
            </p>
            <Link to="/" className="btn-secondary">{t('notFound.goHome', 'Home')}</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-xl font-bold mb-2">
              {t('confirmErasure.errorTitle', 'Couldn\'t complete deletion')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4" role="alert">
              {error}
            </p>
            <Link to="/" className="btn-secondary">{t('notFound.goHome', 'Home')}</Link>
          </>
        )}
      </main>
    </div>
  );
}
