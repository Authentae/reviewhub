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
// Single-column on mobile, two-column on desktop. No login wall, no
// "sign up first" pop-up, no upsell modal — the article's whole
// genius is "send the result, no friction." Honour that.
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

  if (state.status === 'loading') {
    return (
      <div className="rh-design min-h-screen grid place-items-center px-4" style={{ background: 'var(--rh-paper)' }}>
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rh-design min-h-screen grid place-items-center px-4 py-12" style={{ background: 'var(--rh-paper)' }}>
        <div className="max-w-md text-center">
          <p className="text-5xl mb-4" aria-hidden="true">🔗</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--rh-ink)' }}>Preview not available</h1>
          <p className="text-sm" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>{state.error}</p>
        </div>
      </div>
    );
  }

  const { business_name, reviews } = state.data;
  const totalDrafts = reviews.filter((r) => r.draft).length;

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <main className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        {/* Header — sets context immediately so the prospect doesn't
            wonder "wait, who is this and what am I looking at?" */}
        <header className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--rh-ochre, #c48a2c)' }}>
            Reply suggestions for
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
            {business_name}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
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
              style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}
            >
              {/* The review (what the customer wrote) */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: 'var(--rh-ink)' }}>
                    {r.reviewer_name || 'Anonymous'}
                  </p>
                  <span className="text-sm" style={{ color: '#f59e0b' }} aria-label={`${r.rating} stars`}>
                    {'★'.repeat(r.rating)}
                    <span style={{ color: '#e5e7eb' }}>{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
                  {r.text}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px my-4" style={{ background: 'var(--rh-line, #e6dfce)' }} />

              {/* The drafted reply */}
              {r.draft ? (
                <div>
                  <p
                    className="text-xs font-mono uppercase tracking-widest mb-2"
                    style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}
                  >
                    Suggested reply
                  </p>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--rh-ink)' }}
                  >
                    {r.draft}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.draft);
                        // Tiny inline confirmation — no toast library to
                        // keep this page dependency-light. Just flash the
                        // button text via setState would need a per-card
                        // index; cheaper to use the title attr trick.
                      } catch { /* clipboard blocked, oh well */ }
                    }}
                    className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--rh-teal-deep, #1e4d5e)', color: '#fff' }}
                  >
                    Copy reply
                  </button>
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: 'var(--rh-ink-soft, #9aa3ac)' }}>
                  Couldn't generate a draft for this one — usually means the review text was too short or in an unsupported language.
                </p>
              )}
            </article>
          ))}
        </div>

        {/* Footer — soft pitch, not a hard sell */}
        <footer
          className="mt-12 pt-8 border-t text-sm leading-relaxed"
          style={{ borderColor: 'var(--rh-line, #e6dfce)', color: 'var(--rh-ink-soft, #4a525a)' }}
        >
          <p className="mb-3">
            <strong style={{ color: 'var(--rh-ink)' }}>How this got made:</strong>{' '}
            ReviewHub pulls your reviews from Google (and 60+ other platforms),
            drafts replies in your voice, sends you an alert when a new review lands.
            You always edit before publishing — nothing posts without your approval.
          </p>
          <p className="mb-3">
            If you want this running for {business_name} on autopilot, the cheapest
            plan is $14/mo (~฿490). Or if you'd rather just use these drafts and
            keep doing it manually, that's also totally fine.
          </p>
          <p className="text-xs" style={{ color: 'var(--rh-ink-soft, #9aa3ac)' }}>
            <a
              href="https://reviewhub.review/"
              style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}
            >
              reviewhub.review →
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
