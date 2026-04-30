import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import useSeedDemo from '../hooks/useSeedDemo';
import EmptyState from '../components/EmptyState';

function formatWeekLabel(dateStr, locale) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

// ── Mini inline-SVG charts ──────────────────────────────────────────────────

function BarChart({ weeks, valueKey, color = '#3b82f6', label }) {
  const values = weeks.map(w => w[valueKey] ?? 0);
  const max = Math.max(...values, 1);
  const W = 600, H = 80, barW = Math.floor(W / weeks.length) - 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true" focusable="false">
      {weeks.map((w, i) => {
        const h = Math.max(2, Math.round((values[i] / max) * (H - 4)));
        const x = i * (W / weeks.length) + 1;
        return (
          <rect
            key={w.week}
            x={x} y={H - h} width={barW} height={h}
            fill={values[i] === 0 ? '#e5e7eb' : color}
            rx="2"
          >
            <title>{`${label}: ${values[i]}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// Stacked bar chart: each bar = positive (green) + neutral (gray) + negative (red)
function SentimentBarChart({ weeks }) {
  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const W = 600, H = 80;
  const gap = 2;
  const barW = Math.floor(W / weeks.length) - gap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true" focusable="false">
      {weeks.map((w, i) => {
        if (!w.count) return null;
        const totalH = Math.max(4, Math.round((w.count / maxCount) * (H - 4)));
        const posH = Math.round((w.positive / w.count) * totalH);
        const negH = Math.round((w.negative / w.count) * totalH);
        const neuH = totalH - posH - negH;
        const x = i * (W / weeks.length) + 1;
        let y = H - totalH;
        return (
          <g key={w.week}>
            <rect x={x} y={y} width={barW} height={posH} fill="#4ade80" rx="2">
              <title>{`Positive: ${w.positive}`}</title>
            </rect>
            <rect x={x} y={y + posH} width={barW} height={neuH} fill="#9ca3af">
              <title>{`Neutral: ${w.neutral}`}</title>
            </rect>
            <rect x={x} y={y + posH + neuH} width={barW} height={negH} fill="#f87171">
              <title>{`Negative: ${w.negative}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

// Line chart — null values create gaps
function LineChart({ weeks, valueKey, min = 0, max: maxProp, color = '#3b82f6', dotColor }) {
  const values = weeks.map(w => w[valueKey] ?? null);
  const nonNull = values.filter(v => v !== null);
  if (nonNull.length < 2) return null;
  const maxVal = maxProp ?? Math.max(...nonNull, 1);
  const minVal = min;
  const W = 600, H = 80, PAD = 4;
  const range = maxVal - minVal || 1;

  const pts = values.map((v, i) => {
    if (v === null) return null;
    const x = PAD + (i / (weeks.length - 1)) * (W - PAD * 2);
    const y = PAD + ((maxVal - v) / range) * (H - PAD * 2);
    return [x, y];
  });

  // Build polyline segments (break on null)
  const segments = [];
  let current = [];
  for (const pt of pts) {
    if (pt === null) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length > 1) segments.push(current);

  const dot = dotColor || color;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true" focusable="false">
      {/* Guide line at midpoint */}
      <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="#e5e7eb" strokeWidth="1" />
      {segments.map((seg, si) => (
        <polyline
          key={si}
          points={seg.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {pts.map((pt, i) => pt && (
        <circle key={i} cx={pt[0]} cy={pt[1]} r="3" fill={dot}>
          <title>{`${values[i]}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ChartCard({ title, desc, children }) {
  return (
    <section className="card p-5">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{title}</h2>
      {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{desc}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

// `unit` is explicit ('%' for percentage deltas, '' for raw deltas like
// star-rating diff). Was previously inferring `%` from `Number.isInteger(delta)`,
// which broke when a rating delta happened to be exactly 1.0 → rendered as
// "1%" instead of "1". Caller now states intent.
function DeltaBadge({ delta, unit = '%' }) {
  if (delta == null) return null;
  const pos = delta > 0;
  const zero = delta === 0;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-1 py-0.5 rounded ml-1
      ${zero ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        : pos ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
      title="vs prior 12 weeks"
    >
      {pos ? '▲' : zero ? '–' : '▼'} {Math.abs(delta)}{unit}
    </span>
  );
}

function StatCard({ label, value, sub, color = 'text-gray-900 dark:text-gray-100', delta, deltaUnit }) {
  return (
    <div className="card p-4">
      <dl>
        <dt className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</dt>
        <dd className={`text-2xl font-bold ${color} flex items-baseline flex-wrap gap-0.5`}>
          {value ?? '—'}
          <DeltaBadge delta={delta} unit={deltaUnit} />
        </dd>
        {sub && <dd className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</dd>}
      </dl>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Analytics() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  usePageTitle(t('page.analytics'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [displayWeeks, setDisplayWeeks] = useState(12);
  const { seed: seedDemo, seeding } = useSeedDemo();

  async function handleSeedDemo() {
    const added = await seedDemo();
    // On success send the user to the dashboard so they see the reviews, not
    // just the charts the seeded data now populates.
    if (added > 0) navigate('/dashboard');
  }

  const [keywords, setKeywords] = useState([]);
  const [kwLoading, setKwLoading] = useState(false);
  const [kwUpgradeRequired, setKwUpgradeRequired] = useState(false);
  const [kwSentiment, setKwSentiment] = useState('');
  const [kwPlatform, setKwPlatform] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/reviews/analytics')
      .then(({ data: res }) => { if (!cancelled) setData(res); })
      .catch((err) => {
        if (!cancelled) {
          if (err?.response?.status === 403 && err?.response?.data?.upgrade) {
            setUpgradeRequired(true);
          } else {
            setError(t('analytics.failed'));
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setKwLoading(true);
    const params = new URLSearchParams();
    if (kwSentiment) params.set('sentiment', kwSentiment);
    if (kwPlatform) params.set('platform', kwPlatform);
    api.get(`/reviews/keywords?${params}`)
      .then(({ data: res }) => { if (!cancelled) setKeywords(res.keywords || []); })
      .catch((err) => {
        if (!cancelled) {
          if (err?.response?.status === 403 && err?.response?.data?.upgrade) {
            setKwUpgradeRequired(true);
          }
          setKeywords([]);
        }
      })
      .finally(() => { if (!cancelled) setKwLoading(false); });
    return () => { cancelled = true; };
  }, [kwSentiment, kwPlatform]);

  const allWeeks = data?.weeks || [];
  // Server returns 24 weeks. displayWeeks controls the current period length;
  // the same-length window before it becomes the prior period for delta badges.
  const currentWeeks = useMemo(
    () => allWeeks.slice(Math.max(0, allWeeks.length - displayWeeks)),
    [allWeeks, displayWeeks]
  );
  const priorWeeks = useMemo(
    () => allWeeks.slice(Math.max(0, allWeeks.length - displayWeeks * 2), Math.max(0, allWeeks.length - displayWeeks)),
    [allWeeks, displayWeeks]
  );

  const localizedWeeks = useMemo(
    () => currentWeeks.map(w => ({ ...w, label: formatWeekLabel(w.week, lang) })),
    [currentWeeks, lang]
  );

  // Compute per-field totals for period comparison deltas
  const periodTotals = useMemo(() => {
    function sum(weeks, key) { return weeks.reduce((acc, w) => acc + (w[key] || 0), 0); }
    function avgRating(weeks) {
      const total = sum(weeks, 'count');
      if (!total) return null;
      const ratingSum = weeks.reduce((acc, w) => acc + (w.avg_rating != null ? w.avg_rating * w.count : 0), 0);
      return Math.round((ratingSum / total) * 10) / 10;
    }
    const cur = {
      total: sum(currentWeeks, 'count'),
      avg_rating: avgRating(currentWeeks),
      positive: sum(currentWeeks, 'positive'),
      responded: sum(currentWeeks, 'responded'),
    };
    const pri = {
      total: sum(priorWeeks, 'count'),
      avg_rating: avgRating(priorWeeks),
      positive: sum(priorWeeks, 'positive'),
      responded: sum(priorWeeks, 'responded'),
    };
    function pct(cur, pri) {
      if (!pri) return null;
      return Math.round(((cur - pri) / pri) * 100);
    }
    return {
      totalDelta: pct(cur.total, pri.total),
      // Both sides must be present — `cur.avg_rating` is null when this
       // period has zero reviews; subtracting null produces NaN which then
       // renders as "NaN" in the DeltaBadge.
      ratingDelta: (pri.avg_rating != null && cur.avg_rating != null)
        ? +(cur.avg_rating - pri.avg_rating).toFixed(1)
        : null,
      posRateDelta: pri.positive && pri.total
        ? pct(cur.total ? cur.positive / cur.total : 0, pri.positive / pri.total)
        : null,
      responseRateDelta: pri.responded && pri.total
        ? pct(cur.total ? cur.responded / cur.total : 0, pri.responded / pri.total)
        : null,
    };
  }, [currentWeeks, priorWeeks]);

  const hasData = data?.overview?.total > 0;
  const ov = data?.overview;

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t('analytics.eyebrow', 'Analytics')}
            </p>
            <h1>{t('analytics.title')}</h1>
            <p className="rh-page-sub">{t('analytics.subtitle')}</p>
          </div>
          <div className="rh-page-actions">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1" role="group" aria-label={t('analytics.periodLabel')}>
              {[4, 12, 24].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDisplayWeeks(w)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    displayWeeks === w
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                  aria-pressed={displayWeeks === w}
                >
                  {t(`analytics.period${w}w`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-7 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Upgrade gate */}
        {upgradeRequired && !loading && (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">📈</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1 text-lg">{t('analytics.upgradeTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">{t('analytics.upgradeDesc')}</p>
            <Link to="/pricing" className="btn-primary text-sm inline-block">{t('analytics.upgradeCta')}</Link>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="card p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && !upgradeRequired && !hasData && (
          <EmptyState
            icon="📊"
            title={t('analytics.noData')}
            body={t('analytics.noDataHint')}
          >
            <Link to="/settings" className="btn-primary text-sm inline-block">
              {t('dashboard.connectAPlatform')}
            </Link>
            <span className="text-xs text-gray-400 dark:text-gray-500">{t('onboarding.or')}</span>
            <button
              type="button"
              onClick={handleSeedDemo}
              disabled={seeding}
              className="btn-secondary text-sm disabled:opacity-60"
            >
              {seeding ? t('onboarding.loading') : t('onboarding.tryDemo')}
            </button>
          </EmptyState>
        )}

        {!loading && !error && !upgradeRequired && hasData && (
          <>
            {/* Overview stat cards */}
            <section aria-label={t('analytics.overview')} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatCard label={t('analytics.totalReviews')} value={ov.total.toLocaleString(lang)} delta={periodTotals.totalDelta} />
              <StatCard
                label={t('analytics.overallRating')}
                value={ov.avg_rating ? `${ov.avg_rating} ★` : '—'}
                color="text-amber-600 dark:text-amber-400"
                delta={periodTotals.ratingDelta}
                deltaUnit=""
              />
              <StatCard
                label={t('analytics.positiveRate')}
                value={ov.total ? `${Math.round((ov.positive / ov.total) * 100)}%` : '—'}
                sub={`${ov.positive} ${t('analytics.positive').toLowerCase()}`}
                color="text-green-600 dark:text-green-400"
                delta={periodTotals.posRateDelta}
              />
              <StatCard
                label={t('analytics.responseRate')}
                value={ov.total > 0 && ov.response_rate != null ? `${ov.response_rate}%` : '—'}
                sub={`${ov.responded} / ${ov.total}`}
                color="text-blue-600 dark:text-blue-400"
                delta={periodTotals.responseRateDelta}
              />
            </section>
            {/* Period comparison footnote */}
            {(periodTotals.totalDelta != null) && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-4 mb-5">
                {t('analytics.deltaNote')}
              </p>
            )}

            {/* Weekly volume (sentiment stacked bars) */}
            <div className="mb-5">
              <ChartCard title={t('analytics.weeklyVolume')} desc={t('analytics.weeklyVolumeDesc')}>
                {localizedWeeks.some(w => w.count > 0) ? (
                  <>
                    <SentimentBarChart weeks={localizedWeeks} />
                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {[
                        { color: 'bg-green-400', label: t('analytics.positive') },
                        { color: 'bg-gray-400', label: t('analytics.neutral') },
                        { color: 'bg-red-400', label: t('analytics.negative') },
                      ].map(({ color, label }) => (
                        <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`w-2.5 h-2.5 rounded-sm ${color}`} aria-hidden="true" />
                          {label}
                        </span>
                      ))}
                    </div>
                    <XAxis weeks={localizedWeeks} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400">{t('analytics.noRatingData')}</p>
                )}
              </ChartCard>
            </div>

            {/* Rating trend + Response rate side by side on wider screens */}
            <div className="grid sm:grid-cols-2 gap-5 mb-5">
              <ChartCard title={t('analytics.ratingTrend')} desc={t('analytics.ratingTrendDesc')}>
                {localizedWeeks.some(w => w.avg_rating !== null) ? (
                  <>
                    <LineChart weeks={localizedWeeks} valueKey="avg_rating" min={1} max={5} color="#f59e0b" dotColor="#d97706" />
                    <XAxis weeks={localizedWeeks} />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>1★</span><span>3★</span><span>5★</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">{t('analytics.noRatingData')}</p>
                )}
              </ChartCard>

              <ChartCard title={t('analytics.responseTrend')} desc={t('analytics.responseTrendDesc')}>
                {localizedWeeks.some(w => w.count > 0) ? (
                  <>
                    <LineChart
                      weeks={localizedWeeks.map(w => ({
                        ...w,
                        response_pct: w.count > 0 ? Math.round((w.responded / w.count) * 100) : null,
                      }))}
                      valueKey="response_pct"
                      min={0}
                      max={100}
                      color="#3b82f6"
                    />
                    <XAxis weeks={localizedWeeks} />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">{t('analytics.noResponseData')}</p>
                )}
              </ChartCard>
            </div>

            {/* Platform breakdown + Top reviewers side by side */}
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Platform breakdown */}
              <section className="card p-5">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {t('analytics.platformBreakdown')}
                </h2>
                {data.platforms.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('analytics.noPlatformData', 'No platform data yet')}</p>
                ) : (
                  <div className="space-y-3">
                    {data.platforms.map(p => {
                      const pct = ov.total > 0 ? Math.round((p.count / ov.total) * 100) : 0;
                      const platformColors = {
                        google: 'bg-blue-400',
                        yelp: 'bg-red-400',
                        facebook: 'bg-indigo-400',
                        tripadvisor: 'bg-green-400',
                        trustpilot: 'bg-emerald-400',
                        wongnai: 'bg-orange-400',
                      };
                      const barColor = platformColors[p.platform] || 'bg-gray-400';
                      return (
                        <div key={p.platform}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">
                              {p.platform}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {p.count} · {p.avg_rating ? `${p.avg_rating}★` : '—'} · {p.response_rate}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Top reviewers */}
              <section className="card p-5">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {t('analytics.topReviewers')}
                </h2>
                {data.topReviewers.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('analytics.noTopReviewers')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="pb-2 font-normal">{t('analytics.reviewer')}</th>
                        <th className="pb-2 font-normal text-right">{t('analytics.reviews')}</th>
                        <th className="pb-2 font-normal text-right">{t('analytics.avgRating')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topReviewers.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="py-1.5 text-gray-700 dark:text-gray-200 truncate max-w-[160px]">{r.reviewer_name}</td>
                          <td className="py-1.5 text-right text-gray-600 dark:text-gray-300 font-medium">{r.count}</td>
                          <td className="py-1.5 text-right text-amber-500 font-medium">
                            {r.avg_rating ? `${r.avg_rating}★` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>

            {/* Keyword Frequency */}
            <section className="card p-5 mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {t('analytics.keywords')}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('analytics.keywordsDesc')}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={kwSentiment}
                    onChange={e => setKwSentiment(e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    aria-label={t('analytics.keywordsFilterSentiment')}
                  >
                    <option value="">{t('dashboard.filter.allSentiments')}</option>
                    <option value="positive">{t('analytics.positive')}</option>
                    <option value="neutral">{t('analytics.neutral')}</option>
                    <option value="negative">{t('analytics.negative')}</option>
                  </select>
                  <select
                    value={kwPlatform}
                    onChange={e => setKwPlatform(e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    aria-label={t('analytics.keywordsFilterPlatform')}
                  >
                    <option value="">{t('dashboard.filter.allPlatforms')}</option>
                    <option value="google">Google</option>
                    <option value="yelp">Yelp</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
              </div>

              {kwLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${70 - i * 15}%` }} />
                  ))}
                </div>
              ) : kwUpgradeRequired ? (
                <div className="text-center py-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('analytics.kwUpgradeTitle')}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t('analytics.kwUpgradeDesc')}</p>
                  <Link to="/pricing" className="btn-primary text-xs inline-block">{t('analytics.upgradeCta')}</Link>
                </div>
              ) : keywords.length === 0 ? (
                <p className="text-xs text-gray-400">{t('analytics.keywordsEmpty')}</p>
              ) : (
                <div className="space-y-1.5">
                  {keywords.slice(0, 20).map(({ word, count }) => {
                    const pct = Math.round((count / keywords[0].count) * 100);
                    return (
                      <div key={word} className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-200 w-28 shrink-0 truncate">{word}</span>
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full rounded bg-blue-400 dark:bg-blue-500 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-right shrink-0">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Tag Distribution */}
            {data.tagStats && data.tagStats.length > 0 && (
              <section className="card p-5 mt-6">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  {t('analytics.tagDistribution')}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t('analytics.tagDistributionDesc')}</p>
                <div className="space-y-1.5">
                  {data.tagStats.map(tag => {
                    const pct = Math.round((tag.count / data.tagStats[0].count) * 100);
                    return (
                      <div key={tag.id} className="flex items-center gap-3">
                        <span
                          className="text-xs font-medium w-28 shrink-0 truncate"
                          style={{ color: tag.color || '#6b7280' }}
                        >
                          {tag.name}
                        </span>
                        <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: tag.color || '#6b7280', opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-right shrink-0">{tag.count}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Response Time */}
            <section className="card p-5 mt-6">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {t('analytics.responseTime')}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t('analytics.responseTimeDesc')}</p>
              {data.responseTime ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
                    <dl>
                      <dt className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('analytics.avgResponseTime')}</dt>
                      <dd className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {data.responseTime.avg_hours < 24
                          ? `${data.responseTime.avg_hours}h`
                          : `${Math.round(data.responseTime.avg_hours / 24)}d`}
                      </dd>
                    </dl>
                  </div>
                  <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
                    <dl>
                      <dt className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('analytics.within24h')}</dt>
                      <dd className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {data.responseTime.pct_within_24h}%
                      </dd>
                    </dl>
                  </div>
                  <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
                    <dl>
                      <dt className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('analytics.within7d')}</dt>
                      <dd className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {data.responseTime.pct_within_7d}%
                      </dd>
                    </dl>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">{t('analytics.responseTimeNoData')}</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// X-axis week labels: show every 3rd to avoid crowding
function XAxis({ weeks }) {
  return (
    <div className="flex mt-1">
      {weeks.map((w, i) => (
        <div key={w.week} className="flex-1 text-center">
          {i % 3 === 0 && (
            <span className="text-[9px] text-gray-400 dark:text-gray-500">{w.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
