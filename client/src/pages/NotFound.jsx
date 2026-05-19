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

  // Editorial 404 — replaces the generic "big gray 404" with a brand-aligned
  // layout (ochre eyebrow, Instrument Serif headline, brand sparkle accent,
  // teal accent rule). Compounds: every 404 visit from now on lands on a
  // page that visually belongs to ReviewHub, not a tailwind default screen.
  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)' }}>
      <Navbar />
      <main
        id="main-content"
        className="flex flex-col items-center justify-center py-24 px-4 text-center"
        style={{ minHeight: 'calc(100vh - 200px)' }}
      >
        {/* Brand sparkle — ties the 404 to the rest of the site so the
            visitor knows they're still inside ReviewHub, just on a missing
            page. Decorative, hidden from screen readers. */}
        <svg
          aria-hidden="true"
          width="56"
          height="56"
          viewBox="0 0 64 64"
          style={{ marginBottom: '20px' }}
        >
          <defs>
            <linearGradient id="rh-404-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1e4d5e" />
              <stop offset="1" stopColor="#2c7889" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#rh-404-grad)" />
          <path d="M32 10c1.5 10 4 12.5 14 14-10 1.5-12.5 4-14 14-1.5-10-4-12.5-14-14 10-1.5 12.5-4 14-14z" fill="#fbf8f1" />
          <path d="M48 40c.7 4 1.6 4.9 5.5 5.5-3.9.6-4.8 1.5-5.5 5.5-.6-4-1.5-4.9-5.5-5.5 4-.6 4.9-1.5 5.5-5.5z" fill="#fbf8f1" opacity="0.95" />
        </svg>

        <p
          className="mb-3"
          style={{
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: '11px',
            color: 'var(--rh-ochre-deep, #a07d20)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          404 · Page not found
        </p>

        <h1
          className="mb-3"
          style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontWeight: 400,
            fontSize: 'clamp(34px, 5vw, 46px)',
            lineHeight: 1.15,
            letterSpacing: '-0.015em',
            color: 'var(--rh-ink, #1d242c)',
            maxWidth: '36ch',
          }}
        >
          {t('notFound.title')}
        </h1>

        <p
          className="mb-8 max-w-sm"
          style={{
            color: 'var(--rh-ink-2, #4b5560)',
            fontSize: '16px',
            lineHeight: 1.55,
          }}
        >
          {t('notFound.desc')}
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            to="/"
            className="px-5 py-2.5 rounded-lg font-semibold text-sm"
            style={{
              background: 'var(--rh-teal-deep, #1e4d5e)',
              color: 'var(--rh-paper, #fbf8f1)',
              textDecoration: 'none',
            }}
          >
            {t('notFound.goHome')}
          </Link>
          {loggedIn && (
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-lg font-semibold text-sm"
              style={{
                background: 'transparent',
                color: 'var(--rh-teal-deep, #1e4d5e)',
                border: '1px solid var(--rh-teal-deep, #1e4d5e)',
                textDecoration: 'none',
              }}
            >
              {t('notFound.goDashboard')}
            </Link>
          )}
        </div>

        {/* Stale-link recovery: users following an old link from a docs
            page or a search-engine result need a way to report it without
            having to navigate to find /support. */}
        <p
          className="mt-10 text-sm"
          style={{ color: 'var(--rh-ink-3, #8b939c)' }}
        >
          {t('notFound.brokenLink', 'Followed a broken link? ')}
          <Link
            to="/support"
            style={{
              color: 'var(--rh-teal-deep, #1e4d5e)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            {t('notFound.brokenLinkCta', 'Let us know')}
          </Link>
        </p>
      </main>
    </div>
  );
}
