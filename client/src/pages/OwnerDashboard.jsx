import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { makeT } from '../utils/tFallback';

// OwnerDashboard
// ----------------------------------------------------------------------------
// Lists every business the current user has successfully claimed (status =
// approved). Each row links to the business detail page where the user can
// post / edit / delete owner responses.
//
// Plan gate: the *response* feature is reserved for $14+ tiers (starter, pro,
// business). Free users see an inline upsell that links to /pricing instead
// of the management list. Backend still enforces this independently.
//
// Backend (best-effort — falls back gracefully if endpoints aren't all wired
// at the moment of first ship):
//   GET /api/owner/businesses → { businesses: [{ id, name, claim_status,
//                                  pending_response_count, total_reviews }] }
//
// We treat any non-2xx as "no claimed businesses yet" so the UI stays useful
// while the back-end is being wired.

const PAID_PLANS = new Set(['starter', 'pro', 'business']);

export default function OwnerDashboard() {
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  const { subscription, loading: userLoading } = useUser();
  const toast = useToast();
  usePageTitle(t('owner.pageTitle', 'Owner dashboard'));

  const [businesses, setBusinesses] = useState(null); // null = loading
  const [error, setError] = useState(null);

  const plan = subscription?.plan || 'free';
  const isPaid = PAID_PLANS.has(plan);

  useEffect(() => {
    if (userLoading) return;
    if (!isPaid) { setBusinesses([]); return; } // skip the fetch when gated
    let cancelled = false;
    api.get('/owner/businesses')
      .then(({ data }) => {
        if (cancelled) return;
        setBusinesses(Array.isArray(data?.businesses) ? data.businesses : []);
      })
      .catch((err) => {
        if (cancelled) return;
        // 404/501 = endpoint not wired yet → treat as empty list, don't toast
        const code = err?.response?.status;
        if (code === 404 || code === 501) {
          setBusinesses([]);
        } else {
          setError(t('owner.loadFailed', 'Could not load your claimed businesses'));
          setBusinesses([]);
          toast(t('owner.loadFailed', 'Could not load your claimed businesses'), 'error');
        }
      });
    return () => { cancelled = true; };
  }, [userLoading, isPaid, t, toast]);

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t('owner.eyebrow', 'Owner replies')}
            </p>
            <h1>{t('owner.heading', 'Your claimed businesses')}</h1>
            <p className="rh-page-sub">
              {t('owner.subheading', 'Respond to customer reviews on the businesses you’ve verified ownership of. Replies appear publicly under each review with an “Owner response” badge.')}
            </p>
          </div>
        </div>

        {!isPaid ? (
          <UpsellCard plan={plan} />
        ) : businesses === null ? (
          <LoadingSkeleton />
        ) : businesses.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {businesses.map((biz) => (
              <li key={biz.id}>
                <BusinessRow biz={biz} />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </main>
    </div>
  );
}

function UpsellCard({ plan }) {
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  return (
    <div
      className="card p-6 sm:p-8 relative overflow-hidden"
      role="region"
      aria-labelledby="owner-upsell-title"
    >
      {/* Brand gradient flourish — same vocabulary as Pricing/Landing */}
      <div
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <p className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 mb-3">
        {t('owner.upsellBadge', 'Starter plan or higher')}
      </p>
      <h2 id="owner-upsell-title" className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {t('owner.upsellTitle', 'Respond to reviews as the verified owner')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 max-w-prose">
        {(t('owner.upsellBody', 'Owner responses appear publicly under every review with a verified badge — a proven way to recover unhappy customers and signal trust to new ones. You’re currently on the {plan} plan; upgrade to Starter ($14/mo) or higher to unlock owner responses on all the businesses you’ve claimed.')).replace('{plan}', plan)}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/pricing" className="btn-primary text-sm">
          {t('owner.upsellCta', 'See plans')}
        </Link>
        <Link to="/dashboard" className="btn-secondary text-sm">
          {t('owner.backToDashboard', 'Back to dashboard')}
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label={t('common.loading', 'Loading…')}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4">
          <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  return (
    <div className="card p-8 text-center">
      <p className="text-4xl mb-3" aria-hidden="true">🏪</p>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {t('owner.emptyTitle', 'No claimed businesses yet')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
        {t('owner.emptyBody', 'Find a business in our directory and click "Claim this business" to start responding to reviews as the verified owner.')}
      </p>
    </div>
  );
}

function BusinessRow({ biz }) {
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  const pending = Number(biz.pending_response_count || 0);
  return (
    <Link
      to={`/businesses/${biz.id}`}
      className="card p-4 block hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {biz.name || biz.business_name || `Business #${biz.id}`}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {(t('owner.row.totalReviews', '{n} reviews')).replace('{n}', String(biz.total_reviews ?? 0))}
          </p>
        </div>
        {pending > 0 && (
          <span
            className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            aria-label={(t('owner.row.pendingAria', '{n} reviews awaiting your response')).replace('{n}', String(pending))}
          >
            {pending}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
        {t('owner.row.manage', 'Manage responses →')}
      </p>
    </Link>
  );
}
