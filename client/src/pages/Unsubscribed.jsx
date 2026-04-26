import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { isLoggedIn } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Landing page after one-click unsubscribe via the email footer link.
// The server's GET /api/auth/unsubscribe handler redirects here on success
// with `?list=<type>`. Mail-client one-click POSTs return JSON instead and
// never hit this page.
//
// Public — no auth required. Anyone holding the signed token reaches the
// server route; the redirect that lands here happens AFTER the unsub is
// already applied, so this page is purely a confirmation/UX surface.
const LIST_LABELS = {
  digest: 'weekly digest',
  new_review: 'new-review notifications',
  negative_alert: 'negative-review alerts',
};

export default function Unsubscribed() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const list = params.get('list') || '';
  const label = LIST_LABELS[list] || 'this email list';
  usePageTitle(t('unsub.title') || 'Unsubscribed');
  const loggedIn = isLoggedIn();

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <p className="text-5xl mb-4" aria-hidden="true">✉️</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('unsub.title') || 'You\'re unsubscribed'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2 max-w-md">
          {t('unsub.body', { list: label }) || `We won't send you ${label} anymore.`}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-8 max-w-md">
          {t('unsub.note') || 'You can re-subscribe anytime from Settings → Notifications.'}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link to="/" className="btn-secondary">{t('notFound.goHome') || 'Home'}</Link>
          {loggedIn && (
            <Link to="/settings" className="btn-primary">
              {t('unsub.openSettings') || 'Notification settings'}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
