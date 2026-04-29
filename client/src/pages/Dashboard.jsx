import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReviewCard from '../components/ReviewCard';
import BulkActionBar from '../components/BulkActionBar';
import TagBadge from '../components/TagBadge';
import { useToast } from '../components/Toast';
import usePageTitle from '../hooks/usePageTitle';
import { getToken } from '../lib/auth';
import api from '../lib/api';
import ReviewTrend from '../components/ReviewTrend';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ValueReceipt from '../components/ValueReceipt';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';
import useSeedDemo from '../hooks/useSeedDemo';
import { platformsForLocale, platformLabel } from '../lib/platforms';

// Filter/sort options are translated inline via t() in the render

// Return YYYY-MM-DD for a date offset by `days` from today (negative = past)
function isoOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Module-level constants — defined once, never recreated on re-render
// Platform list is locale-aware at render time via platformsForLocale().
// This shorter list stays here only as a permissive validator for the URL
// query param — accept anything we know about, fall through to '' otherwise.
const ALL_KNOWN_PLATFORMS = [
  'google', 'yelp', 'facebook', 'tripadvisor', 'trustpilot',
  'wongnai', 'tabelog', 'retty', 'hotpepper', 'gurunavi',
  'naver', 'kakaomap', 'mangoplate',
  'dianping', 'meituan', 'xiaohongshu',
  'thefork', 'mercadolibre', 'pagesjaunes', 'avisverifies',
  'holidaycheck', 'ekomi', 'kununu', 'reclameaqui', 'paginegialle',
  'manual',
];
const VALID_SENTIMENTS_CLIENT = ['positive', 'negative', 'neutral'];
const VALID_SORT_CLIENT = ['newest', 'oldest', 'rating_asc', 'rating_desc', 'unresponded_first', 'pinned_first'];
const VALID_RESPONDED_CLIENT = ['yes', 'no'];
const VALID_RATINGS_CLIENT = ['1', '2', '3', '4', '5'];

export default function Dashboard() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user, refresh: refreshUser } = useUser();
  // Optimistic flag so the checklist hides instantly on dismiss — the server
  // round-trip + /me refresh takes ~200ms which would cause a flash otherwise.
  // Context's user.onboarding_dismissed is the authoritative cross-session signal.
  const [onboardingDismissedLocal, setOnboardingDismissedLocal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawPlatform = searchParams.get('platform') || '';
  const rawSentiment = searchParams.get('sentiment') || '';
  const rawResponded = searchParams.get('responded') || '';
  const rawSort = searchParams.get('sort') || 'newest';
  const rawRating = searchParams.get('rating') || '';

  const [platform, setPlatform] = useState(ALL_KNOWN_PLATFORMS.includes(rawPlatform) ? rawPlatform : '');
  const [sentiment, setSentiment] = useState(VALID_SENTIMENTS_CLIENT.includes(rawSentiment) ? rawSentiment : '');
  const [responded, setResponded] = useState(VALID_RESPONDED_CLIENT.includes(rawResponded) ? rawResponded : '');
  const [sort, setSort] = useState(VALID_SORT_CLIENT.includes(rawSort) ? rawSort : 'newest');
  const [rating, setRating] = useState(VALID_RATINGS_CLIENT.includes(rawRating) ? rawRating : '');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(Math.max(1, Math.min(10000, Number(searchParams.get('page')) || 1)));

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Tag filter state
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag_id') ? Number(searchParams.get('tag_id')) : null);
  const [userTags, setUserTags] = useState([]);
  // Pinned filter
  const [pinnedOnly, setPinnedOnly] = useState(searchParams.get('pinned') === 'true');
  // Flagged filter
  const [flaggedOnly, setFlaggedOnly] = useState(searchParams.get('flagged') === 'true');
  // Status filter
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  // Date range filter
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const [data, setData] = useState(null);
  // Show unresponded count in browser tab title so users know at a glance
  const unrespondedForTitle = data?.stats
    ? Math.max(0, (data.stats.total || 0) - (data.stats.responded || 0))
    : 0;
  usePageTitle(
    unrespondedForTitle > 0
      ? `(${unrespondedForTitle}) ${t('page.dashboard')}`
      : t('page.dashboard')
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { seed: seedDemo, seeding } = useSeedDemo();
  const [seedMsg, setSeedMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const searchTimeout = useRef(null);
  const searchInputRef = useRef(null);
  // Monotonic counter — each fetch increments it; stale responses can detect they're outdated
  const fetchIdRef = useRef(0);

  // Cleanup debounce timeout on unmount
  useEffect(() => () => { clearTimeout(searchTimeout.current); }, []);

  // Load user's tags once for the filter row
  useEffect(() => {
    api.get('/tags').then(({ data }) => setUserTags(data || [])).catch(() => {});
  }, []);

  // Press '/' to focus search (like GitHub, Linear, etc.)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Back-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const p = {};
    if (platform) p.platform = platform;
    if (sentiment) p.sentiment = sentiment;
    if (responded) p.responded = responded;
    if (rating) p.rating = rating;
    if (sort && sort !== 'newest') p.sort = sort;
    if (search) p.q = search;
    if (tagFilter) p.tag_id = tagFilter;
    if (pinnedOnly) p.pinned = 'true';
    if (flaggedOnly) p.flagged = 'true';
    if (statusFilter) p.status = statusFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo)   p.date_to = dateTo;
    if (page > 1) p.page = page;
    setSearchParams(p, { replace: true });
  }, [platform, sentiment, responded, rating, sort, search, tagFilter, pinnedOnly, flaggedOnly, statusFilter, dateFrom, dateTo, page]);

  const fetchReviews = useCallback(async (p = 1) => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (platform) params.set('platform', platform);
      if (sentiment) params.set('sentiment', sentiment);
      if (responded) params.set('responded', responded);
      if (rating) params.set('rating', rating);
      if (search) params.set('search', search);
      if (sort !== 'newest') params.set('sort', sort);
      if (tagFilter) params.set('tag_id', tagFilter);
      if (pinnedOnly) params.set('pinned', 'true');
      if (flaggedOnly) params.set('flagged', 'true');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to', dateTo);
      params.set('page', p);
      params.set('limit', 10);
      const { data: res } = await api.get(`/reviews?${params}`);
      // Ignore stale responses if a newer fetch has already started
      if (fetchId !== fetchIdRef.current) return null;
      setData(res);
      // Page-clamp guard: if a deep-link / stale URL puts the user on
      // page 5 but the filter only has 1 page of results, the response
      // comes back with reviews=[] and total>0 — user sees an empty
      // list and assumes "no matches" when really we just over-paged.
      // Snap back to page 1 and refetch. The bigger filter-change path
      // already calls setPage(1); this catches the "deep link with
      // out-of-range page" edge case and any race where filters and
      // page change in the wrong order.
      const pages = Math.max(1, Math.ceil((res.total || 0) / 10));
      if (p > pages && (res.total || 0) > 0) {
        setPage(1);
        // Pagination is updated manually elsewhere (filter changes call
        // fetchReviews(1) directly), so explicitly re-fetch with page=1
        // here too — otherwise the user sees the empty page-5 result.
        // Defer to next tick so React commits the setPage first.
        Promise.resolve().then(() => fetchReviews(1));
      }
      return res;
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return null;
      const msg = err.isNetworkError
        ? t('common.networkError')
        : err.isRateLimited
        ? (err.retryAfterSeconds
            ? t('common.rateLimitedWait', { seconds: err.retryAfterSeconds })
            : t('common.rateLimited'))
        : err.response?.data?.error || t('dashboard.reviewsFailed');
      setError(msg);
      toast(msg, 'error');
      return null;
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [platform, sentiment, responded, rating, search, sort, tagFilter, pinnedOnly, flaggedOnly, statusFilter, dateFrom, dateTo]); // page intentionally omitted — always passed explicitly

  useEffect(() => {
    let cancelled = false;
    async function init() {
      await fetchReviews(page);
      if (cancelled) return;
      // Historical note: this used to auto-seed demo data when the dashboard
      // was empty. Removed because for a real user, seeing "The Corner Bistro"
      // reviews on their dashboard is confusing — they signed up for THEIR
      // business, not ours. The "Load Test Data" button still exists for
      // anyone who explicitly wants to explore the UI with pre-made data.
    }
    init();
    return () => { cancelled = true; };
  }, [fetchReviews]); // fetchReviews changes when any filter changes

  async function handleSeed() {
    const added = await seedDemo();
    if (added > 0) {
      setPage(1);
      await fetchReviews(1);
    } else if (added === 0) {
      setSeedMsg(t('dashboard.seedAlreadyLoaded'));
      setTimeout(() => setSeedMsg(''), 3000);
    }
  }

  // Shared export: CSV (default, Excel-friendly) or JSON (machine-readable).
  // Server has a single filter-builder so the two formats always match.
  async function handleExport(format = 'csv') {
    setExporting(true);
    try {
      const token = getToken();
      // Pass current filters so the export matches what the user sees
      const params = new URLSearchParams();
      if (platform) params.set('platform', platform);
      if (sentiment) params.set('sentiment', sentiment);
      if (responded) params.set('responded', responded);
      if (rating) params.set('rating', rating);
      if (search) params.set('search', search);
      if (pinnedOnly) params.set('pinned', 'true');
      if (flaggedOnly) params.set('flagged', 'true');
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (tagFilter) params.set('tag', tagFilter);
      // `credentials: 'include'` so cookie-only clients (post-migration)
      // auth correctly. Bearer header is still sent for legacy localStorage
      // tokens. Sending both is fine — server prefers the cookie.
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/reviews/export/${format}?${params}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const text = await res.text();
      // CSV gets a UTF-8 BOM so Excel on Windows auto-detects encoding for
      // non-ASCII characters; JSON is fine without.
      const isJson = format === 'json';
      const parts = isJson ? [text] : ['\uFEFF', text];
      const mime = isJson ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';
      const blob = new Blob(parts, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviews-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke to give browser time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t('dashboard.exportDone', { n: data?.total ?? '' }), 'success');
    } catch {
      toast(t('dashboard.exportFailed'), 'error');
    } finally {
      setExporting(false);
    }
  }

  const handleFilterChange = useCallback((setter) => {
    return (e) => { setter(e.target.value); setPage(1); };
  }, []);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  }, []);

  const clearFilters = useCallback(() => {
    setPlatform('');
    setSentiment('');
    setResponded('');
    setRating('');
    setSort('newest');
    setSearch('');
    setSearchInput('');
    setTagFilter(null);
    setPinnedOnly(false);
    setFlaggedOnly(false);
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const hasFilters = platform || sentiment || responded || rating || search || tagFilter || pinnedOnly || flaggedOnly || statusFilter || dateFrom || dateTo;
  const stats = hasFilters ? (data?.filteredStats ?? data?.stats) : data?.stats;
  const totalPages = data ? Math.ceil(data.total / 10) : 0;

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />

      <main id="main-content" className={`rh-page ${selectMode && selectedIds.size > 0 ? 'pb-40' : ''}`}>
        {/* Editorial page head — eyebrow + serif title + mono subtitle, matches
            the Landing/Pricing voice so the app and marketing feel like one
            product. */}
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              № 01 · {t('dashboard.eyebrow', 'Inbox')}
            </p>
            <h1>
              {data?.business?.business_name || t('dashboard.title')}
            </h1>
            <p className="rh-page-sub">{t('dashboard.subtitle')}</p>
          </div>
          <div className="rh-page-actions">
            {seedMsg && <span className="text-sm text-amber-600 font-medium" aria-live="polite">{seedMsg}</span>}
            {/* Bulk-select toggle — only shown when there are reviews to act on */}
            {data?.total > 0 && (
              <button
                type="button"
                onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
                aria-pressed={selectMode}
                className={`btn-secondary text-sm flex items-center gap-1.5 ${selectMode ? 'ring-2 ring-blue-500' : ''}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {selectMode ? t('bulk.cancel') : t('bulk.select')}
              </button>
            )}
            {/* Split button: default action is CSV, dropdown adds JSON. */}
            <div className="inline-flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={exporting || loading || !data?.total}
                className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 text-sm font-semibold px-3 py-2 flex items-center gap-1.5 disabled:opacity-60"
              >
                {exporting ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                ) : <span aria-hidden="true">↓</span>}
                {exporting ? t('dashboard.exporting') : t('dashboard.exportCsv')}
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                disabled={exporting || loading || !data?.total}
                aria-label={t('dashboard.exportJsonAria')}
                title={t('dashboard.exportJson')}
                className="bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 text-[11px] font-mono px-2 py-2 border-l border-gray-300 dark:border-gray-600 disabled:opacity-60"
              >
                JSON
              </button>
            </div>
            {/* Load Test Data — shown ONLY in dev or with explicit opt-in
                via VITE_SHOW_DEMO=1. In prod this button pollutes the user's
                real dashboard with fake "Sarah M. / Corner Bistro" reviews
                that look legitimate; a real business would (reasonably)
                respond to fake reviews thinking they're real. Safer to hide. */}
            {(!data || data.stats?.total === 0) &&
              (import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === '1') && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <span aria-hidden="true">🧪</span>
                {seeding ? t('dashboard.loading') : t('dashboard.loadTestData')}
              </button>
            )}
          </div>
        </div>

        {/* Onboarding checklist — shown until user dismisses or all steps complete */}
        {(() => {
          if (!user || user.onboarding_dismissed || onboardingDismissedLocal) return null;
          const biz = data?.business;
          const hasRealBusiness = !!biz?.business_name && biz.business_name !== 'My Business';
          const hasReviews = (data?.total ?? 0) > 0;
          const hasResponded = (data?.stats?.responded ?? 0) > 0;
          const allDone = hasRealBusiness && hasReviews && hasResponded;
          if (allDone) return null;
          return (
            <OnboardingChecklist
              business={biz}
              hasReviews={hasReviews}
              hasResponded={hasResponded}
              onBusinessCreated={async () => { await Promise.all([fetchReviews(page), refreshUser()]); }}
              onSeedDemo={async () => { await handleSeed(); }}
              onDismiss={() => { setOnboardingDismissedLocal(true); refreshUser(); }}
            />
          );
        })()}

        {/* Negative review alert — shown when there are unresponded 1-2 star reviews */}
        {!loading && data?.stats?.unresponded_negative > 0 && !responded && !sentiment && (
          <div
            role="alert"
            className="rh-banner danger"
            style={{ marginBottom: 16, borderRadius: 12, border: '1px solid color-mix(in oklab, var(--rh-rose) 30%, var(--rh-rule))', justifyContent: 'space-between' }}
          >
            <span style={{ color: 'var(--rh-ink)' }}>
              <span aria-hidden="true">⚠️ </span>
              {t('dashboard.negativeAlert', { n: data.stats.unresponded_negative })}
            </span>
            <button
              type="button"
              onClick={() => { setSentiment('negative'); setResponded('no'); setPage(1); }}
              style={{
                flexShrink: 0,
                fontSize: 12, fontWeight: 600,
                color: 'var(--rh-rose)',
                border: '1px solid color-mix(in oklab, var(--rh-rose) 35%, var(--rh-rule))',
                padding: '4px 10px', borderRadius: 8,
                background: 'transparent', cursor: 'pointer',
              }}
            >
              {t('dashboard.negativeAlertAction')}
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && !loading && <ValueReceipt stats={stats} />}
        {stats && !loading && (
          <section aria-label={t('dashboard.statsSection')} className="mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label={t('dashboard.stats.total')} value={stats.total} />
              <StatCard label={t('dashboard.stats.avgRating')} value={stats.avg_rating ? `${stats.avg_rating} ★` : '—'} />
              <StatCard label={t('dashboard.stats.positive')} value={stats.positive} color="text-green-600 dark:text-green-400" />
              <StatCard
                label={t('dashboard.stats.responseRate')}
                value={stats.total > 0 && stats.responded != null ? `${Math.round((stats.responded / stats.total) * 100)}%` : '—'}
                color="text-blue-600 dark:text-blue-400"
              />
            </div>
            {/* Per-platform breakdown — always shows global counts for full context */}
            {data?.platformCounts && Object.keys(data.platformCounts).length > 0 && (
              <div className="flex gap-3 mt-3 flex-wrap">
                {/* Show every platform with reviews, sorted by count desc.
                    The previous hardcoded ['google','yelp','facebook'] list
                    silently hid distribution for SMBs whose reviews mostly
                    live on Trustpilot / Tabelog / Wongnai / etc. */}
                {Object.entries(data.platformCounts)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([p, count]) => {
                  const icons = { google: '🔵', yelp: '🔴', facebook: '🟣', tripadvisor: '🟢', trustpilot: '⭐', wongnai: '🟡', tabelog: '🟠', naver: '🟩', dianping: '🔶' };
                  const isActive = platform === p;
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => { setPlatform(isActive ? '' : p); setPage(1); }}
                      aria-pressed={isActive}
                      aria-label={`${platformLabel(p)}: ${count} reviews`}
                      className="rh-filter-chip"
                    >
                      <span aria-hidden="true">{icons[p] || '⚪'}</span>
                      <span>{platformLabel(p)}</span>
                      <span className="count">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {hasFilters && data?.stats && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {t('dashboard.statsNote', { total: data.stats.total, avg: data.stats.avg_rating ?? '—' })}
              </p>
            )}
          </section>
        )}

        {/* Skeleton stats */}
        {loading && !data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-7 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Rating distribution */}
        {!loading && (data?.filteredStats || data?.stats) && (
          <RatingDistribution
            stats={hasFilters ? (data.filteredStats ?? data.stats) : data.stats}
            activeRating={rating}
            onRatingClick={(r) => { setRating(prev => prev === String(r) ? '' : String(r)); setPage(1); }}
          />
        )}

        {/* Review trend — only show when no filters active to keep context clear */}
        {!hasFilters && !loading && data?.stats?.total > 0 && (
          <ReviewTrend />
        )}

        {/* Search + Filters — sticky on scroll. top-[60px] matches the
            .rh-app-nav .rh-bar height in dashboard-system.css; top-14 (56px)
            left a 4px gap that let the topmost review card peek through
            under the navbar before the filter bar caught it. */}
        <section aria-label={t('dashboard.filtersSection')} className="space-y-2 mb-4 sticky top-[60px] pt-2 pb-2 z-10 -mx-4 px-4" style={{ background: 'color-mix(in oklab, var(--rh-paper) 92%, transparent)', backdropFilter: 'blur(12px) saturate(160%)', WebkitBackdropFilter: 'blur(12px) saturate(160%)', borderBottom: '1px solid var(--rh-rule)' }}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              aria-label={t('dashboard.search.ariaLabel')}
              autoComplete="off"
              maxLength={200}
              className="input pl-9 text-sm w-full"
              placeholder={t('dashboard.search.placeholder')}
              title={t('dashboard.search.shortcutHint')}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                aria-label={t('dashboard.search.clearAriaLabel')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select aria-label={t('dashboard.filter.platformAriaLabel')} value={platform} onChange={handleFilterChange(setPlatform)} className="input w-auto text-sm">
              <option value="">{t('dashboard.filter.allPlatforms')}</option>
              {platformsForLocale(lang).map((p) => (
                <option key={p} value={p}>{platformLabel(p)}</option>
              ))}
            </select>
            <select aria-label={t('dashboard.filter.sentimentAriaLabel')} value={sentiment} onChange={handleFilterChange(setSentiment)} className="input w-auto text-sm">
              <option value="">{t('dashboard.filter.allSentiments')}</option>
              <option value="positive">{t('sentiment.positive')}</option>
              <option value="negative">{t('sentiment.negative')}</option>
              <option value="neutral">{t('sentiment.neutral')}</option>
            </select>
            <select aria-label={t('dashboard.filter.ratingAriaLabel')} value={rating} onChange={handleFilterChange(setRating)} className="input w-auto text-sm">
              <option value="">{t('dashboard.filter.allRatings')}</option>
              <option value="5">★★★★★</option>
              <option value="4">★★★★</option>
              <option value="3">★★★</option>
              <option value="2">★★</option>
              <option value="1">★</option>
            </select>
            <select aria-label={t('dashboard.filter.responseAriaLabel')} value={responded} onChange={handleFilterChange(setResponded)} className="input w-auto text-sm">
              <option value="">{t('dashboard.filter.allReviews')}</option>
              <option value="no">{t('dashboard.filter.needsResponse')}</option>
              <option value="yes">{t('dashboard.filter.responded')}</option>
            </select>
            <select aria-label={t('dashboard.filter.statusAriaLabel')} value={statusFilter} onChange={handleFilterChange(setStatusFilter)} className="input w-auto text-sm">
              <option value="">{t('dashboard.filter.allStatuses')}</option>
              <option value="follow_up">{t('review.status.follow_up')}</option>
              <option value="resolved">{t('review.status.resolved')}</option>
              <option value="escalated">{t('review.status.escalated')}</option>
            </select>
            <select aria-label={t('dashboard.filter.sortAriaLabel')} value={sort} onChange={handleFilterChange(setSort)} className="input w-auto text-sm">
              <option value="newest">{t('dashboard.filter.newest')}</option>
              <option value="oldest">{t('dashboard.filter.oldest')}</option>
              <option value="rating_desc">{t('dashboard.filter.ratingHigh')}</option>
              <option value="rating_asc">{t('dashboard.filter.ratingLow')}</option>
              <option value="unresponded_first">{t('dashboard.filter.unrespondedFirst')}</option>
              <option value="pinned_first">{t('dashboard.filter.pinnedFirst')}</option>
            </select>
            {/* Date range presets */}
            <div className="flex items-center gap-1" role="group" aria-label={t('dashboard.filter.datePresets')}>
              {[
                { label: t('dashboard.filter.preset7d'),  days: -7 },
                { label: t('dashboard.filter.preset30d'), days: -30 },
                { label: t('dashboard.filter.preset90d'), days: -90 },
              ].map(({ label, days }) => {
                const from = isoOffset(days);
                const active = dateFrom === from && dateTo === '';
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => { setDateFrom(from); setDateTo(''); setPage(1); }}
                    aria-pressed={active}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-medium' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="sr-only">{t('dashboard.filter.dateFrom')}</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                aria-label={t('dashboard.filter.dateFrom')}
                max={dateTo || undefined}
                className="input text-sm w-36"
              />
            </label>
            <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
            <label className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="sr-only">{t('dashboard.filter.dateTo')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                aria-label={t('dashboard.filter.dateTo')}
                min={dateFrom || undefined}
                className="input text-sm w-36"
              />
            </label>
            <button
              type="button"
              onClick={() => { setPinnedOnly(v => !v); setPage(1); }}
              aria-pressed={pinnedOnly}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors font-medium ${pinnedOnly ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
            >
              ★ {t('dashboard.filter.pinnedOnly')}
            </button>
            <button
              type="button"
              onClick={() => { setFlaggedOnly(v => !v); setPage(1); }}
              aria-pressed={flaggedOnly}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors font-medium ${flaggedOnly ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
            >
              🚩 {t('dashboard.filter.flaggedOnly')}
            </button>
            {(hasFilters || sort !== 'newest') && (
              <button type="button" onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-2">
                ✕ {t('dashboard.filter.clearAll')}
              </button>
            )}
          </div>
          {/* Tag filter row — only shown when user has tags */}
          {userTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1" role="group" aria-label={t('tags.filterBy') + ':'}>
              <span className="text-xs text-gray-500 dark:text-gray-300 mr-0.5">{t('tags.filterBy')}:</span>
              {userTags.map(tag => {
                const isActive = tagFilter === tag.id;
                return (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    small
                    selected={isActive}
                    onClick={() => { setTagFilter(prev => prev === tag.id ? null : tag.id); setPage(1); }}
                    ariaLabel={isActive
                      ? t('tags.removeFilterAria', `Remove filter: ${tag.name}`).replace('${tag.name}', tag.name)
                      : t('tags.applyFilterAria', `Filter by tag: ${tag.name}`).replace('${tag.name}', tag.name)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Error state */}
        {error && !loading && (
          <div className="card p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => fetchReviews(page)} className="text-red-600 dark:text-red-400 underline text-xs">{t('common.retry')}</button>
          </div>
        )}

        {/* Accessible live region to announce filter results to screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {!loading && data && (hasFilters
            ? t('dashboard.a11y.filteredCount', { n: data.total })
            : t('dashboard.a11y.totalCount', { n: data.total }))}
        </div>

        {/* Review feed */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex gap-2 mb-2">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-100 rounded w-16" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : seeding ? (
          <div className="card p-12 text-center">
            <div className="text-3xl mb-3 animate-spin inline-block" aria-hidden="true">⭐</div>
            <p className="font-semibold text-gray-700 dark:text-gray-300">{t('dashboard.loading')}</p>
          </div>
        ) : !data?.reviews?.length ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">{responded === 'no' ? '🎉' : '📭'}</p>
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {responded === 'no'
                ? t('dashboard.allCaughtUp')
                : hasFilters ? t('dashboard.noReviewsMatch') : t('dashboard.noReviewsYet')}
            </p>
            {responded === 'no'
              ? <button type="button" onClick={clearFilters} className="btn-secondary text-sm mt-3">{t('dashboard.viewAll')}</button>
              : hasFilters
              ? <button type="button" onClick={clearFilters} className="btn-secondary text-sm mt-3">{t('dashboard.clearFilters')}</button>
              : (
                // Fresh-account path — guide the user to connect their first
                // platform in Settings rather than push them to load fake data.
                // Test-data button stays in the header; this is the primary CTA.
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                    {t('dashboard.noReviewsOnboardHint')}
                  </p>
                  {/* SPA nav — a raw <a href> would full-page-reload */}
                  <Link
                    to="/settings"
                    className="btn-primary text-sm inline-block mt-1"
                  >
                    {t('dashboard.connectAPlatform')}
                  </Link>
                </div>
              )
            }
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {t('dashboard.reviewCount', { n: data.total })}
              {hasFilters ? ` ${t('dashboard.filtered')}` : ''}
            </p>
            <ul className="space-y-3 list-none" role="list" aria-label={t('dashboard.reviewsListAria')}>
              {data.reviews.map(review => (
                <li key={review.id} className={selectMode ? 'flex items-start gap-2' : undefined}>
                  {selectMode && (
                    <div className="pt-4 pl-1 flex-shrink-0">
                      <input
                        type="checkbox"
                        id={`select-${review.id}`}
                        checked={selectedIds.has(review.id)}
                        onChange={() => toggleSelect(review.id)}
                        aria-label={t('bulk.selectReviewAria', { name: review.reviewer_name })}
                        className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                      />
                    </div>
                  )}
                  <div className={`flex-1 min-w-0 ${selectMode && selectedIds.has(review.id) ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}>
                    <ReviewCard review={review} business={data.business} highlight={search} onResponseSaved={async () => {
                      const res = await fetchReviews(page);
                      // Refresh the navbar unresponded-count badge immediately
                      // (skip the 60s polling delay).
                      window.dispatchEvent(new CustomEvent('reviewhub:reviews-mutated'));
                      // If the current page is now empty but reviews remain elsewhere, go back a page
                      if (res && res.reviews?.length === 0 && res.total > 0 && page > 1) {
                        const prev = page - 1;
                        setPage(prev);
                        await fetchReviews(prev);
                      }
                    }} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {/* Disabled state: opacity-40 left buttons looking clickable.
                    Add cursor-not-allowed and explicit pointer-events so the
                    boundary is unambiguous. Also scroll the page-head back
                    into view on prev/next so users see fresh data from the
                    top instead of staying scrolled mid-list of the OLD page. */}
                <button
                  type="button"
                  onClick={() => {
                    setPage(p => p - 1);
                    fetchReviews(page - 1);
                    document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  disabled={page === 1}
                  aria-label={t('dashboard.prevPageAria')}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('dashboard.prevPage')}
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite" aria-atomic="true">
                  {t('dashboard.paginationInfo', {
                    from: (page - 1) * 10 + 1,
                    to: Math.min(page * 10, data.total),
                    total: data.total,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPage(p => p + 1);
                    fetchReviews(page + 1);
                    document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  disabled={page >= totalPages}
                  aria-label={t('dashboard.nextPageAria')}
                  className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('dashboard.nextPage')}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bulk respond action bar — appears when reviews are selected */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          onSent={async () => {
            exitSelectMode();
            await fetchReviews(page);
            // Tell the navbar's unresponded-count hook to refresh now
            // instead of waiting for its 60s poll. Without this, a user
            // who just bulk-replied to 5 reviews would see a stale "12"
            // badge for up to a minute.
            window.dispatchEvent(new CustomEvent('reviewhub:reviews-mutated'));
          }}
          onDeleted={async () => {
            exitSelectMode();
            await fetchReviews(page);
            window.dispatchEvent(new CustomEvent('reviewhub:reviews-mutated'));
          }}
          onDeselectAll={() => setSelectedIds(new Set())}
          onCancel={exitSelectMode}
        />
      )}

      {/* Back to top */}
      {showBackTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('common.backToTop')}
          className="btn-fab fixed bottom-6 right-6 w-10 h-10 z-40"
        >
          ↑
        </button>
      )}
    </div>
  );
}

const StatCard = React.memo(function StatCard({ label, value, color }) {
  // Editorial stat tile — matches the .rh-stat primitive in dashboard-system.css
  // (mono uppercase label + serif numeric value). The optional `color` prop maps
  // legacy Tailwind colour classes onto editorial accents so existing call sites
  // still tint the value.
  const valueClass = color ? color : '';
  return (
    <div className="rh-stat">
      <dl style={{ margin: 0 }}>
        <dt className="label">{label}</dt>
        <dd className={`value ${valueClass}`} style={{ margin: 0 }}>{value ?? '—'}</dd>
      </dl>
    </div>
  );
});

const RatingDistribution = React.memo(function RatingDistribution({ stats, activeRating, onRatingClick }) {
  const { t } = useI18n();
  if (!stats || !stats.total) return null;
  const total = stats.total || 1;
  const rows = [
    { stars: 5, count: stats.r5 || 0, color: 'bg-green-400', activeColor: 'bg-green-500' },
    { stars: 4, count: stats.r4 || 0, color: 'bg-lime-400', activeColor: 'bg-lime-500' },
    { stars: 3, count: stats.r3 || 0, color: 'bg-yellow-400', activeColor: 'bg-yellow-500' },
    { stars: 2, count: stats.r2 || 0, color: 'bg-orange-400', activeColor: 'bg-orange-500' },
    { stars: 1, count: stats.r1 || 0, color: 'bg-red-400', activeColor: 'bg-red-500' },
  ];
  const headingId = 'rating-dist-heading';
  return (
    <section aria-labelledby={headingId} className="card p-4 mb-6">
      <h2 id={headingId} className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
        {t('dashboard.ratingBreakdown')}
        {activeRating && <span className="ml-2 text-blue-500 normal-case font-normal">{t('dashboard.ratingOnly', { stars: activeRating })}</span>}
      </h2>
      <div className="space-y-1.5">
        {rows.map(({ stars, count, color, activeColor }) => {
          const isActive = activeRating === String(stars);
          const pct = Math.round((count / total) * 100);
          return (
            <button
              type="button"
              key={stars}
              onClick={() => onRatingClick?.(stars)}
              aria-pressed={isActive}
              aria-label={t('dashboard.ratingFilterAria', { stars, count })}
              className={`w-full flex items-center gap-3 rounded px-1 -mx-1 transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
            >
              <span className="text-xs text-gray-500 dark:text-gray-400 w-8 flex-shrink-0 text-right" aria-hidden="true">{stars} ★</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={total}>
                <div
                  className={`h-full rounded-full ${isActive ? activeColor : color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs w-6 text-right flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
