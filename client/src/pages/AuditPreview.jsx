import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';

// /audit-preview/<share_token> — public, no auth.
//
// The page a prospect lands on when the founder DMs them an outbound
// audit URL. Renders the prospect's own reviews + the AI-drafted
// replies side-by-side. Mobile-first because owners open DMs on
// phones.
//
// LOCKED TO LIGHT THEME. The founder may have dark mode set in the
// dashboard, but this page is shown to PROSPECTS who never opted in
// to anything. CSS vars (--rh-paper / --rh-ink / etc.) flip with the
// founder's preference and produced unreadable dark-on-dark draft
// text. Hardcoding literal hex values + colorScheme:'light' on the
// root container makes the page render identically regardless of OS,
// browser, or founder preference. Print-document treatment.
const COLORS = {
  paper: '#fbf8f1',     // warm cream background
  ink: '#1d242c',       // dark ink for primary text
  inkSoft: '#4a525a',   // muted dark for secondary text
  inkDim: '#9aa3ac',    // dimmer muted for tertiary
  ochre: '#c48a2c',     // brand accent for "REPLY SUGGESTIONS FOR" label
  tealDeep: '#1e4d5e',  // brand teal for buttons and "Suggested reply" label
  line: '#e6dfce',      // subtle border / divider
  cardBg: '#ffffff',    // pure white card on cream paper
  star: '#f59e0b',      // amber for filled stars
  starEmpty: '#e5e7eb', // neutral for empty stars
};

export default function AuditPreview() {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  usePageTitle(state.data?.business_name
    ? `${state.data.business_name} — Reply suggestions`
    : 'Audit preview · ReviewHub');
  useNoIndex(); // share-token URLs are per-prospect; never index them

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', data: null, error: 'No token' });
      return;
    }
    let cancelled = false;
    api.get(`/audit-previews/share/${encodeURIComponent(token)}`)
      .then(({ data }) => {
        if (!cancelled) setState({ status: 'ok', data, error: '' });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.response?.status === 404
          ? 'This preview link has expired or doesn\'t exist. Ask the sender for a fresh one.'
          : 'Could not load the preview. Try refreshing.';
        setState({ status: 'error', data: null, error: msg });
      });
    return () => { cancelled = true; };
  }, [token]);

  // Root style — applied to every state branch so loading/error/ok all
  // honour the light-mode lock. colorScheme:'light' tells the browser
  // not to auto-invert form controls, and the explicit background +
  // color ensure no inheritance from the founder's dashboard theme.
  const rootStyle = {
    background: COLORS.paper,
    color: COLORS.ink,
    colorScheme: 'light',
    minHeight: '100vh',
  };

  if (state.status === 'loading') {
    return (
      <div className="grid place-items-center px-4" style={rootStyle}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLORS.tealDeep, borderTopColor: 'transparent' }} aria-hidden="true" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="grid place-items-center px-4 py-12" style={rootStyle}>
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4" aria-hidden="true">🔗</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: COLORS.ink }}>Preview not available</h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>{state.error}</p>
        </div>
      </div>
    );
  }

  const { business_name, reviews } = state.data;
  const totalDrafts = reviews.filter((r) => r.draft).length;

  return (
    <div style={rootStyle}>
      <main className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        {/* Header — sets context immediately so the prospect doesn't
            wonder "wait, who is this and what am I looking at?" */}
        <header className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.ochre }}>
            Reply suggestions for
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: COLORS.ink, letterSpacing: '-0.02em' }}>
            {business_name}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: COLORS.inkSoft }}>
            Hand-picked from your recent Google reviews — {totalDrafts} draft {totalDrafts === 1 ? 'reply' : 'replies'} ready
            to copy &amp; paste. No account needed; this page is just for
            you. Edit anything before publishing.
          </p>
        </header>

        {/* Reviews + drafts — one card per review */}
        <div className="space-y-6">
          {reviews.map((r, i) => (
            <article
              key={i}
              className="rounded-2xl p-5 md:p-6"
              style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.line}` }}
            >
              {/* The review (what the customer wrote) */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                    {r.reviewer_name || 'Anonymous'}
                  </p>
                  <span className="text-sm" style={{ color: COLORS.star }} aria-label={`${r.rating} stars`}>
                    {'★'.repeat(r.rating)}
                    <span style={{ color: COLORS.starEmpty }}>{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: COLORS.inkSoft }}>
                  {r.text}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px my-4" style={{ background: COLORS.line }} />

              {/* The drafted reply */}
              {r.draft ? (
                <div>
                  <p
                    className="text-xs font-mono uppercase tracking-widest mb-2"
                    style={{ color: COLORS.tealDeep }}
                  >
                    Suggested reply
                  </p>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: COLORS.ink }}
                  >
                    {r.draft}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.draft);
                      } catch { /* clipboard blocked, oh well */ }
                    }}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: COLORS.tealDeep, color: '#fff' }}
                  >
                    Copy reply
                  </button>
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: COLORS.inkDim }}>
                  Couldn't generate a draft for this one — usually means the review text was too short or in an unsupported language.
                </p>
              )}
            </article>
          ))}
        </div>

        {/* Footer — soft pitch, not a hard sell */}
        <footer
          className="mt-12 pt-8 border-t text-sm leading-relaxed"
          style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}
        >
          <p className="mb-3">
            <strong style={{ color: COLORS.ink }}>How this got made:</strong>{' '}
            ReviewHub pulls your reviews from Google (and 60+ other platforms),
            drafts replies in your voice, sends you an alert when a new review lands.
            You always edit before publishing — nothing posts without your approval.
          </p>
          <p className="mb-3">
            If you want this running for {business_name} on autopilot, the cheapest
            plan is $14/mo (~฿490). Or if you'd rather just use these drafts and
            keep doing it manually, that's also totally fine.
          </p>
          <p className="text-xs" style={{ color: COLORS.inkDim }}>
            <a
              href="https://reviewhub.review/"
              style={{ color: COLORS.tealDeep, fontWeight: 600 }}
            >
              reviewhub.review →
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
