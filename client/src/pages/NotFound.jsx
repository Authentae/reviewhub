import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { isLoggedIn } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

export default function NotFound() {
  const { t } = useI18n();
  usePageTitle(t('page.notFound'));
  const loggedIn = isLoggedIn();

  // Tell search-engine crawlers not to index this URL. Without this, Google
  // sees the SPA fallback returning HTTP 200 for any path under our domain
  // and would happily index thousands of bogus URLs ("/random-typo",
  // "/old-blog-post-that-never-existed", etc.) — diluting our real
  // page-rank signals. Setting `noindex, nofollow` on each render fixes the
  // perception without needing server-side route detection.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <p className="text-7xl font-extrabold text-gray-200 dark:text-gray-700 mb-4" aria-hidden="true">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('notFound.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">{t('notFound.desc')}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link to="/" className="btn-secondary">{t('notFound.goHome')}</Link>
          {loggedIn && <Link to="/dashboard" className="btn-primary">{t('notFound.goDashboard')}</Link>}
        </div>
        {/* Stale-link recovery: users following an old link from a docs
            page or a search-engine result need a way to report it without
            having to navigate to find /support. */}
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">
          {t('notFound.brokenLink', 'Followed a broken link? ')}
          <Link to="/support" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            {t('notFound.brokenLinkCta', 'Let us know')}
          </Link>
        </p>
      </main>
    </div>
  );
}
