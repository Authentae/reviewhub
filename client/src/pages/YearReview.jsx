import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// /year-review/:year — printable recap of the year's reviews. Counts,
// rating delta vs prior year, ratings histogram, busiest month, top
// review keywords.
//
// Why this exists: the data was already in the DB; surfacing it once
// a year as a single celebratory/diagnostic page gives owners a
// reason to log back in (retention) and a screenshot-able artifact
// for "look at our 2026" social posts (organic marketing).
//
// V1 is auth-required (the URL is /year-review/2026, not a per-share
// token). Owners can screenshot to share. Future: a "share this
// publicly" toggle that mints a read-only token, like the audit-
// preview pattern.

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function YearReview() {
  const { t } = useI18n();
  const { year } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  usePageTitle(data?.year ? `${data.year} year in reviews · ReviewHub` : 'Year in reviews · ReviewHub');

  useEffect(() => {
    setLoading(true);
    api.get(`/year-review/${year}`)
      .then(({ data }) => { setData(data); setError(null); })
      .catch((err) => {
        setError(err?.response?.data?.error || err?.message || 'Failed to load');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div className="rh-design rh-app min-h-screen">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-500">
          {t('common.loading', 'Loading…')}
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rh-design rh-app min-h-screen">
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">{t('yearReview.notAvailable', 'Year recap not available')}</h1>
          <p className="text-gray-500 mb-6">{error || ''}</p>
          <Link to="/dashboard" className="text-rh-teal-deep font-semibold">
            ← {t('yearReview.backToDashboard', 'Back to dashboard')}
          </Link>
        </main>
      </div>
    );
  }

  const ratingDelta = data.average_rating_change;
  const ratingDeltaArrow = ratingDelta == null ? '' : ratingDelta > 0.05 ? '↑' : ratingDelta < -0.05 ? '↓' : '→';
  const ratingDeltaColor = ratingDelta == null ? '' : ratingDelta > 0.05 ? '#16a34a' : ratingDelta < -0.05 ? '#dc2626' : '#9aa3ac';

  // Histogram bars sized to the largest single bucket
  const maxBucket = Math.max(...Object.values(data.ratings_breakdown || {}), 1);

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#c48a2c' }}>
          {data.business_name} · {data.year} {t('yearReview.eyebrow', 'recap')}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
          {t('yearReview.headline', '{year} in reviews', { year: data.year })}
        </h1>
        <p className="text-base mb-12" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
          {t('yearReview.subhead', 'A quick look at how the year went, by the numbers.')}
        </p>

        {/* Headline stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Stat
            value={data.total_reviews}
            label={t('yearReview.totalReviews', 'Reviews this year')}
          />
          <Stat
            value={data.average_rating != null ? data.average_rating.toFixed(2) : '—'}
            unit="★"
            label={t('yearReview.avgRating', 'Average rating')}
            sub={ratingDelta != null && (
              <span style={{ color: ratingDeltaColor, fontWeight: 600 }}>
                {ratingDeltaArrow} {Math.abs(ratingDelta).toFixed(2)} {t('yearReview.vsLastYear', 'vs last year')}
              </span>
            )}
          />
          <Stat
            value={(data.response_rate * 100).toFixed(0)}
            unit="%"
            label={t('yearReview.responseRate', 'Response rate')}
            sub={`${data.total_responded} / ${data.total_reviews}`}
          />
          <Stat
            value={data.busiest_month ? MONTHS[data.busiest_month] : '—'}
            label={t('yearReview.busiestMonth', 'Busiest month')}
            sub={data.busiest_month_count ? `${data.busiest_month_count} ${t('yearReview.reviews', 'reviews')}` : ''}
          />
        </div>

        {/* Ratings breakdown */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--rh-ink)' }}>
            {t('yearReview.ratingsBreakdown', 'Ratings breakdown')}
          </h2>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = data.ratings_breakdown?.[rating] || 0;
              const pct = (count / maxBucket) * 100;
              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="w-12 text-sm font-mono" style={{ color: 'var(--rh-ink)' }}>
                    {rating}★
                  </div>
                  <div className="flex-1 h-6 rounded relative overflow-hidden" style={{ background: 'var(--rh-line, #e6dfce)' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded"
                      style={{
                        width: `${pct}%`,
                        background: rating >= 4 ? '#1e4d5e' : rating === 3 ? '#c48a2c' : '#dc2626',
                        transition: 'width 0.6s ease-out',
                      }}
                    />
                  </div>
                  <div className="w-16 text-sm tabular-nums text-right" style={{ color: 'var(--rh-ink-soft)' }}>
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top words */}
        {data.top_words && data.top_words.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--rh-ink)' }}>
              {t('yearReview.topWords', 'Most-mentioned in reviews')}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {t('yearReview.topWordsHint', 'A naive count — useful for spotting themes (good or bad) at a glance.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.top_words.map(({ word, count }) => (
                <span
                  key={word}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--rh-line, #e6dfce)',
                    color: 'var(--rh-ink)',
                    // Size up by frequency — biggest term ~1.2x base
                    fontSize: `${0.85 + Math.min(count / (data.top_words[0].count * 2), 0.4)}rem`,
                  }}
                >
                  <span className="font-medium">{word}</span>
                  <span className="text-xs" style={{ color: 'var(--rh-ink-soft)' }}>×{count}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="mt-16 pt-8 border-t flex flex-wrap gap-4 items-center" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-sm"
          >
            {t('yearReview.print', 'Print / save as PDF')}
          </button>
          <Link to={`/year-review/${data.year - 1}`} className="text-sm" style={{ color: 'var(--rh-ink-soft)' }}>
            ← {data.year - 1}
          </Link>
          <span style={{ color: 'var(--rh-ink-soft)' }}>·</span>
          <Link to="/dashboard" className="text-sm" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
            {t('yearReview.backToDashboard', 'Back to dashboard')} →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ value, unit, label, sub }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}
    >
      <p className="text-3xl font-bold leading-none mb-2" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
        {value}
        {unit && <span className="text-xl ml-0.5" style={{ color: 'var(--rh-ink-soft)' }}>{unit}</span>}
      </p>
      <p className="text-xs uppercase font-mono tracking-widest" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
        {label}
      </p>
      {sub && <p className="text-xs mt-2" style={{ color: 'var(--rh-ink-soft)' }}>{sub}</p>}
    </div>
  );
}
