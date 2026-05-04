import React, { useState } from 'react';

// ReviewHub Dashboard — self-contained artifact for claude.ai design canvas.
// All API calls / contexts / sub-components are inlined and mocked. Goal:
// preserve visual structure and editorial brand voice so the artifact can
// be redesigned in Claude and the wins ported back to the real React app.
//
// Brand tokens (mirrors client/src/styles/dashboard-system.css):
//   --rh-paper:  #fbf8f1   (warm off-white)
//   --rh-ink:    #1d242c   (near-black)
//   --rh-ink-2:  #4a525a   (secondary text)
//   --rh-ink-3:  #8b939c   (tertiary / mono labels)
//   --rh-rule:   #e8e3d6   (hairlines)
//   --rh-teal:   #1e4d5e   (primary brand — buttons, links)
//   --rh-rose:   #c2566c   (alert / danger)
//   --rh-sage:   #6b8e7a   (positive / success)
// Typography: serif headings (Source Serif), sans body (Inter), mono labels (JetBrains Mono).

const MOCK_REVIEWS = [
  {
    id: 1, reviewer_name: 'Sarah Mitchell', rating: 5, platform: 'google',
    text: 'Absolutely loved the truffle pasta — best meal in Bangkok this year. Service was warm without being intrusive. Will be back next month with friends.',
    posted_at: '2 days ago', sentiment: 'positive', responded: true, pinned: true,
    reply: 'Thank you so much, Sarah! The truffle pasta is a chef favourite. We can\'t wait to welcome you back — let us know when you\'re returning and we\'ll save your favourite table.',
  },
  {
    id: 2, reviewer_name: 'Mark T.', rating: 2, platform: 'google',
    text: 'Waited 45 minutes for our mains. Server seemed overwhelmed. Food was fine when it finally came but the wait killed the night.',
    posted_at: '5 hours ago', sentiment: 'negative', responded: false, flagged: true,
  },
  {
    id: 3, reviewer_name: 'Priya K.', rating: 5, platform: 'tripadvisor',
    text: 'Hidden gem near Asok BTS. The som tum was perfectly balanced. Took our visiting parents — they couldn\'t stop talking about it.',
    posted_at: '1 day ago', sentiment: 'positive', responded: true,
  },
  {
    id: 4, reviewer_name: 'Lukas H.', rating: 4, platform: 'facebook',
    text: 'Solid evening. Cocktails were creative, mains were good but not amazing. Would recommend for date night, prices fair for the area.',
    posted_at: '3 days ago', sentiment: 'positive', responded: false,
  },
  {
    id: 5, reviewer_name: 'Anonymous', rating: 1, platform: 'yelp',
    text: 'Found a hair in my food. Manager apologized and comped the dish but the experience was ruined.',
    posted_at: '6 days ago', sentiment: 'negative', responded: false, flagged: true,
  },
];

const MOCK_STATS = {
  total: 247, avg_rating: 4.3, positive: 198, responded: 189,
  unresponded_negative: 3,
  r5: 142, r4: 56, r3: 28, r2: 13, r1: 8,
};

const MOCK_PLATFORM_COUNTS = {
  google: 156, tripadvisor: 42, facebook: 28, yelp: 21,
};

const PLATFORM_META = {
  google:      { icon: '🔵', label: 'Google' },
  yelp:        { icon: '🔴', label: 'Yelp' },
  facebook:    { icon: '🟣', label: 'Facebook' },
  tripadvisor: { icon: '🟢', label: 'TripAdvisor' },
  trustpilot:  { icon: '⭐', label: 'Trustpilot' },
};

const RATING_ROWS = [
  { stars: 5, count: MOCK_STATS.r5, color: 'bg-emerald-400' },
  { stars: 4, count: MOCK_STATS.r4, color: 'bg-lime-400' },
  { stars: 3, count: MOCK_STATS.r3, color: 'bg-amber-400' },
  { stars: 2, count: MOCK_STATS.r2, color: 'bg-orange-400' },
  { stars: 1, count: MOCK_STATS.r1, color: 'bg-rose-400' },
];

export default function DashboardArtifact() {
  const [platform, setPlatform] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [responded, setResponded] = useState('');
  const [activeRating, setActiveRating] = useState('');
  const [search, setSearch] = useState('');

  const respondedPct = Math.round((MOCK_STATS.responded / MOCK_STATS.total) * 100);

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{
        background: '#fbf8f1',
        color: '#1d242c',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: 'rgba(251, 248, 241, 0.85)',
          borderBottom: '1px solid #e8e3d6',
          height: 60,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-sm"
                style={{ background: '#1e4d5e' }}
              >R</div>
              <span className="font-semibold tracking-tight">ReviewHub</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: '#4a525a' }}>
              <a href="#" className="font-semibold" style={{ color: '#1d242c' }}>Inbox</a>
              <a href="#">Analytics</a>
              <a href="#">Requests</a>
              <a href="#">Settings</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm relative" aria-label="Notifications">
              <span className="text-lg" aria-hidden="true">🔔</span>
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: '#c2566c' }}
              >3</span>
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{ background: '#1e4d5e' }}
            >E</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ─── Page head: editorial eyebrow + serif title ───────────────── */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.15em] mb-2"
              style={{ color: '#8b939c', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
            >
              Inbox
            </p>
            <h1
              className="text-4xl tracking-tight"
              style={{ fontFamily: 'Source Serif Pro, Georgia, serif', fontWeight: 600 }}
            >
              The Corner Bistro
            </h1>
            <p className="text-sm mt-1" style={{ color: '#4a525a' }}>
              Reply to reviews across every platform from one inbox.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="text-sm px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium"
              style={{ border: '1px solid #e8e3d6', background: '#ffffff', color: '#4a525a' }}
            >
              <span aria-hidden="true">☑</span> Select
            </button>
            <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid #e8e3d6' }}>
              <button className="bg-white text-sm font-semibold px-3 py-2 flex items-center gap-1.5">
                <span aria-hidden="true">↓</span> Export CSV
              </button>
              <button
                className="bg-white text-[11px] px-2 py-2"
                style={{ borderLeft: '1px solid #e8e3d6', color: '#8b939c', fontFamily: 'JetBrains Mono, monospace' }}
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* ─── Negative-review alert ────────────────────────────────────── */}
        <div
          role="alert"
          className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'rgba(194, 86, 108, 0.06)',
            border: '1px solid rgba(194, 86, 108, 0.3)',
          }}
        >
          <span><span aria-hidden="true">⚠️ </span>You have <strong>3 unresponded negative reviews</strong>. Replying within 24 hours triples conversion.</span>
          <button
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: '#c2566c', border: '1px solid rgba(194, 86, 108, 0.35)' }}
          >
            Show them
          </button>
        </div>

        {/* ─── Stat cards ───────────────────────────────────────────────── */}
        <section aria-label="Review statistics" className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total reviews" value={MOCK_STATS.total.toLocaleString()} />
          <StatCard label="Average rating" value={`${MOCK_STATS.avg_rating} ★`} />
          <StatCard label="Positive" value={MOCK_STATS.positive.toLocaleString()} accent="#6b8e7a" />
          <StatCard label="Response rate" value={`${respondedPct}%`} accent="#1e4d5e" />
        </section>

        {/* ─── Platform chips ───────────────────────────────────────────── */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {Object.entries(MOCK_PLATFORM_COUNTS).map(([p, count]) => {
            const active = platform === p;
            return (
              <button
                key={p}
                onClick={() => setPlatform(active ? '' : p)}
                className="text-sm px-3 py-1.5 rounded-full flex items-center gap-2 transition-colors"
                style={{
                  background: active ? '#1e4d5e' : '#ffffff',
                  color: active ? '#ffffff' : '#1d242c',
                  border: `1px solid ${active ? '#1e4d5e' : '#e8e3d6'}`,
                }}
              >
                <span aria-hidden="true">{PLATFORM_META[p]?.icon}</span>
                <span>{PLATFORM_META[p]?.label}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(255,255,255,0.2)' : '#fbf8f1',
                    color: active ? '#ffffff' : '#8b939c',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >{count}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Rating distribution ──────────────────────────────────────── */}
        <section
          aria-label="Rating distribution"
          className="rounded-xl p-5 mb-8"
          style={{ background: '#ffffff', border: '1px solid #e8e3d6' }}
        >
          <h2
            className="text-[11px] uppercase tracking-[0.15em] mb-4"
            style={{ color: '#8b939c', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Rating breakdown
            {activeRating && (
              <button
                onClick={() => setActiveRating('')}
                className="ml-2 inline-flex items-center gap-1 normal-case font-normal lowercase"
                style={{ color: '#1e4d5e' }}
              >
                <span>{activeRating}★ only</span>
                <span aria-hidden="true">✕</span>
              </button>
            )}
          </h2>
          <div className="space-y-1.5">
            {RATING_ROWS.map(({ stars, count, color }) => {
              const pct = Math.round((count / MOCK_STATS.total) * 100);
              const isActive = activeRating === String(stars);
              return (
                <button
                  key={stars}
                  onClick={() => setActiveRating(isActive ? '' : String(stars))}
                  className="w-full flex items-center gap-3 rounded px-1 -mx-1 transition-colors"
                  style={{ background: isActive ? 'rgba(30, 77, 94, 0.06)' : 'transparent' }}
                >
                  <span className="text-xs w-8 text-right flex-shrink-0" style={{ color: '#8b939c' }}>{stars} ★</span>
                  <div
                    className="flex-1 rounded-full h-2 overflow-hidden"
                    style={{ background: '#f3eddd' }}
                  >
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span
                    className="text-xs w-10 text-right flex-shrink-0"
                    style={{ color: isActive ? '#1e4d5e' : '#8b939c', fontWeight: isActive ? 600 : 400 }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Search + filter bar (sticky in real app) ─────────────────── */}
        <section className="space-y-3 mb-6">
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base"
              style={{ color: '#8b939c' }}
              aria-hidden="true"
            >🔍</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews… (press / to focus)"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg outline-none transition-colors focus:ring-2"
              style={{
                background: '#ffffff',
                border: '1px solid #e8e3d6',
                color: '#1d242c',
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <FilterSelect value={platform} onChange={setPlatform} options={[
              { value: '', label: 'All platforms' },
              { value: 'google', label: 'Google' },
              { value: 'tripadvisor', label: 'TripAdvisor' },
              { value: 'facebook', label: 'Facebook' },
              { value: 'yelp', label: 'Yelp' },
            ]} />
            <FilterSelect value={sentiment} onChange={setSentiment} options={[
              { value: '', label: 'All sentiments' },
              { value: 'positive', label: 'Positive' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'negative', label: 'Negative' },
            ]} />
            <FilterSelect value={responded} onChange={setResponded} options={[
              { value: '', label: 'All reviews' },
              { value: 'no', label: 'Needs response' },
              { value: 'yes', label: 'Responded' },
            ]} />
            <FilterChip>★ Pinned only</FilterChip>
            <FilterChip>🚩 Flagged only</FilterChip>
          </div>
        </section>

        <p className="text-sm mb-3" style={{ color: '#4a525a' }}>
          Showing {MOCK_REVIEWS.length} of {MOCK_STATS.total} reviews
        </p>

        {/* ─── Review feed ──────────────────────────────────────────────── */}
        <ul className="space-y-3 list-none" role="list">
          {MOCK_REVIEWS.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>

        {/* ─── Pagination ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            disabled
            className="text-sm px-3 py-1.5 rounded-lg font-medium opacity-40 cursor-not-allowed"
            style={{ border: '1px solid #e8e3d6', background: '#ffffff' }}
          >
            ← Previous
          </button>
          <span className="text-sm" style={{ color: '#8b939c' }}>
            Showing 1–10 of 247
          </span>
          <button
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ border: '1px solid #e8e3d6', background: '#ffffff' }}
          >
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: '#ffffff', border: '1px solid #e8e3d6' }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.15em] mb-2"
        style={{ color: '#8b939c', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </div>
      <div
        className="text-3xl"
        style={{
          fontFamily: 'Source Serif Pro, Georgia, serif',
          fontWeight: 600,
          color: accent || '#1d242c',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer"
      style={{ background: '#ffffff', border: '1px solid #e8e3d6', color: '#1d242c' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function FilterChip({ children }) {
  return (
    <button
      className="text-sm px-2.5 py-1.5 rounded-lg font-medium transition-colors"
      style={{ border: '1px solid #e8e3d6', color: '#4a525a', background: '#ffffff' }}
    >
      {children}
    </button>
  );
}

function ReviewCard({ review }) {
  const sentimentColor = {
    positive: '#6b8e7a',
    negative: '#c2566c',
    neutral: '#8b939c',
  }[review.sentiment];
  const platformIcon = PLATFORM_META[review.platform]?.icon || '⚪';
  const platformLabel = PLATFORM_META[review.platform]?.label || review.platform;

  return (
    <article
      className="rounded-xl p-5 transition-shadow hover:shadow-sm"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e3d6',
        borderLeft: review.flagged
          ? `4px solid #c2566c`
          : review.pinned
          ? '4px solid #d4a843'
          : '1px solid #e8e3d6',
      }}
    >
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white text-sm flex-shrink-0"
            style={{ background: '#1e4d5e' }}
          >
            {review.reviewer_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{review.reviewer_name}</span>
              {review.pinned && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(212, 168, 67, 0.15)', color: '#a07d20' }}
                >★ Pinned</span>
              )}
              {review.flagged && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(194, 86, 108, 0.12)', color: '#9b3a52' }}
                >🚩 Flagged</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: '#8b939c' }}>
              <span aria-hidden="true">{platformIcon}</span>
              <span>{platformLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{review.posted_at}</span>
              <span aria-hidden="true">·</span>
              <span aria-label={`${review.rating} out of 5 stars`}>
                {'★'.repeat(review.rating)}<span style={{ color: '#e8e3d6' }}>{'★'.repeat(5 - review.rating)}</span>
              </span>
            </div>
          </div>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded flex-shrink-0"
          style={{
            background: `${sentimentColor}15`,
            color: sentimentColor,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {review.sentiment}
        </span>
      </header>

      <p className="text-sm leading-relaxed mb-4" style={{ color: '#1d242c' }}>
        {review.text}
      </p>

      {review.responded && review.reply ? (
        <div
          className="rounded-lg p-3 text-sm"
          style={{
            background: 'rgba(30, 77, 94, 0.04)',
            borderLeft: '3px solid #1e4d5e',
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.15em] mb-1.5 font-semibold"
            style={{ color: '#1e4d5e', fontFamily: 'JetBrains Mono, monospace' }}
          >
            Your reply
          </div>
          <p style={{ color: '#1d242c' }}>{review.reply}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
            style={{ background: '#1e4d5e' }}
          >
            ✨ Draft a reply
          </button>
          <button
            className="text-sm font-medium px-3 py-2 rounded-lg"
            style={{ border: '1px solid #e8e3d6', color: '#4a525a' }}
          >
            Mark as resolved
          </button>
          <button
            className="text-sm px-3 py-2 rounded-lg ml-auto"
            style={{ color: '#8b939c' }}
            aria-label="More actions"
          >
            ⋯
          </button>
        </div>
      )}
    </article>
  );
}
