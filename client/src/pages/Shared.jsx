import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';

// /shared/:token — public, no-auth read-only dashboard mirror.
//
// Purpose: the owner generates a share-token from Settings → Team
// access, sends the URL to their accountant / agency / spouse. They
// open this page and see a read-only view of recent reviews +
// response status + stats. No editing, no billing, no settings.
//
// Locked to a print-friendly light theme (mirrors AuditPreview's
// approach) so the page renders identically regardless of the
// recipient's OS or browser preferences. Most accountants open these
// links once a month; consistent rendering matters more than
// honoring system dark-mode.

const COLORS = {
  paper: '#fbf8f1',
  ink: '#1d242c',
  inkSoft: '#4a525a',
  inkDim: '#9aa3ac',
  ochre: '#c48a2c',
  tealDeep: '#1e4d5e',
  line: '#e6dfce',
  cardBg: '#ffffff',
  star: '#f59e0b',
  starEmpty: '#e5e7eb',
  emerald: '#10b981',
};

export default function Shared() {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  usePageTitle(state.data?.business_name
    ? `${state.data.business_name} — Read-only dashboard`
    : 'Shared dashboard · ReviewHub');
  useNoIndex();

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', data: null, error: 'No token' });
      return;
    }
    let cancelled = false;
    api.get(`/share/${encodeURIComponent(token)}`)
      .then(({ data }) => { if (!cancelled) setState({ status: 'ok', data, error: '' }); })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.status === 404
          ? 'This share link has expired, been revoked, or doesn\'t exist. Ask the sender for a new one.'
          : 'Could not load the dashboard. Try refreshing.';
        setState({ status: 'error', data: null, error: msg });
      });
    return () => { cancelled = true; };
  }, [token]);

  const rootStyle = {
    background: COLORS.paper,
    color: COLORS.ink,
    colorScheme: 'light',
    minHeight: '100vh',
  };

  if (state.status === 'loading') {
    return (
      <div className="grid place-items-center px-4" style={rootStyle}>
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: COLORS.tealDeep, borderTopColor: 'transparent' }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="grid place-items-center px-4 py-12" style={rootStyle}>
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4" aria-hidden="true">🔗</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: COLORS.ink }}>Link not available</h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>{state.error}</p>
        </div>
      </div>
    );
  }

  const { business_name, label, stats, reviews } = state.data;

  return (
    <div style={rootStyle}>
      <main className="max-w-5xl mx-auto px-5 py-10 md:py-14">
        <header className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.ochre }}>
            Read-only dashboard {label && `· ${label}`}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: COLORS.ink, letterSpacing: '-0.02em' }}>
            {business_name}
          </h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            View-only. No edit access — actions on this page won't change anything.
            Contact the owner if you need to update something.
          </p>
        </header>

        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat value={stats.total} label="Total reviews" />
          <Stat value={stats.responded} label="Responded" sub={`${(stats.response_rate * 100).toFixed(0)}% rate`} />
          <Stat
            value={stats.avg_rating != null ? stats.avg_rating.toFixed(2) : '—'}
            unit="★"
            label="Average rating"
          />
          <Stat value={reviews.length} label="Showing latest" sub="capped at 100" />
        </div>

        {/* Reviews list */}
        <h2 className="text-xl font-bold mb-4" style={{ color: COLORS.ink }}>Recent reviews</h2>
        <div className="space-y-4">
          {reviews.map((r) => {
            const responded = !!r.response_text;
            const posted = !!r.response_posted_at;
            return (
              <article
                key={r.id}
                className="rounded-xl p-5"
                style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.line}` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                      {r.reviewer_name || 'Anonymous'}
                    </p>
                    <p className="text-xs" style={{ color: COLORS.inkDim }}>
                      {r.platform} · {new Date((r.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm" style={{ color: COLORS.star }} aria-label={`${r.rating} stars`}>
                    {'★'.repeat(r.rating)}
                    <span style={{ color: COLORS.starEmpty }}>{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3" style={{ color: COLORS.inkSoft }}>
                  {r.review_text || <span style={{ color: COLORS.inkDim, fontStyle: 'italic' }}>(no text)</span>}
                </p>
                {responded && (
                  <div className="border-l-4 pl-3 py-1" style={{ borderColor: COLORS.tealDeep }}>
                    <p
                      className="text-xs font-mono uppercase tracking-widest mb-1 flex items-center gap-2"
                      style={{ color: COLORS.tealDeep }}
                    >
                      Owner reply
                      {posted && (
                        <span style={{ color: COLORS.emerald, fontWeight: 600 }}>
                          ✓ posted
                        </span>
                      )}
                    </p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.ink }}>
                      {r.response_text}
                    </p>
                  </div>
                )}
                {!responded && (
                  <p className="text-xs italic" style={{ color: COLORS.inkDim }}>
                    Not yet responded
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <footer className="mt-12 pt-8 border-t text-xs" style={{ borderColor: COLORS.line, color: COLORS.inkDim }}>
          Powered by{' '}
          <a href="https://reviewhub.review/" style={{ color: COLORS.tealDeep, fontWeight: 600 }}>
            reviewhub.review
          </a>
          {' '}— this is a shared read-only view. The owner can revoke access at any time.
        </footer>
      </main>
    </div>
  );
}

function Stat({ value, unit, label, sub }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.line}` }}
    >
      <p className="text-2xl font-bold leading-none mb-1" style={{ color: COLORS.ink, letterSpacing: '-0.02em' }}>
        {value}
        {unit && <span className="text-base ml-0.5" style={{ color: COLORS.inkSoft }}>{unit}</span>}
      </p>
      <p className="text-xs uppercase font-mono tracking-widest" style={{ color: COLORS.inkSoft }}>
        {label}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: COLORS.inkDim }}>{sub}</p>}
    </div>
  );
}
