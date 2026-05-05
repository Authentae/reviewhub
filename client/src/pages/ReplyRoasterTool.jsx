// Free, no-signup Reply Roaster.
//
// SEO sibling to /tools/review-reply-generator. Where the generator drafts
// from scratch, the roaster CRITIQUES a draft the user already wrote. Real
// use case: owner has typed a defensive reply at 11pm and wants a sanity
// check before posting. Pure heuristic backend — no AI cost — so this is
// instant and free to run forever.
//
// SEO targets: "review reply checker", "review response review", "review
// reply tone analyzer". Long-tail terms competitors miss because the
// obvious tools are all generators.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import HoneypotField from '../components/HoneypotField';
import { useI18n } from '../context/I18nContext';

const SAMPLE_BAD_REPLY = {
  review_text: 'Waited 45 minutes for a simple sandwich. Staff seemed disorganized and didn\'t even apologize. The sandwich itself was mediocre. Will not be returning.',
  rating: 1,
  reviewer_name: 'Marcus T.',
  draft: 'Thank you for your feedback. We strive for excellence and this is very unusual for our team. Our records show no wait of that length on the day in question. We\'ll be sure to share with the team.',
};

const SAMPLE_GOOD_REPLY = {
  review_text: 'Waited 45 minutes for a simple sandwich. Staff seemed disorganized and didn\'t even apologize. The sandwich itself was mediocre. Will not be returning.',
  rating: 1,
  reviewer_name: 'Marcus T.',
  draft: 'Marcus, that\'s a 45-minute wait for a sandwich, and you\'re right to be frustrated — that\'s on us. We had a kitchen schedule mix-up that day and you got the worst of it. I\'m emailing you a callback so we can make it right next time you\'re in. Sorry again.',
};

const SEVERITY_COLOR = {
  high: '#c2566c',   // rose
  medium: '#c48a2c', // ochre
  low: '#8b939c',    // ink-3
};

export default function ReplyRoasterTool() {
  const { t, lang } = useI18n();
  usePageTitle('Reply Roaster — free reply tone checker');
  useSocialMeta({
    title: 'Reply Roaster — free critique for your Google review replies',
    description: 'Paste your draft reply. Get an instant critique on tone, defensiveness, and what\'s missing. Free, no signup.',
  });

  const [form, setForm] = useState({
    review_text: '',
    rating: 1,
    reviewer_name: '',
    draft: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [honeypot, setHoneypot] = useState('');

  function loadSample(sample) {
    setForm(sample);
    setResult(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.draft.trim()) {
      setError('Paste a draft reply to roast.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/public/reply-roaster', {
        ...form,
        website: honeypot,
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p
          className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold"
          style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          Free tool · no signup
        </p>
        <h1
          className="text-5xl font-bold mb-4"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          Reply Roaster.
        </h1>
        <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          Wrote a reply at 11pm and not sure if it sounds defensive? Paste it below. We score it 0-100 against every "bad-reply" pattern we've seen — defensive clichés, generic closers, missing acknowledgment, the lot. Free, instant, no AI used.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sample loaders */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_BAD_REPLY)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff' }}
            >
              Try a defensive reply →
            </button>
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_GOOD_REPLY)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff' }}
            >
              Try a strong reply →
            </button>
          </div>

          <HoneypotField value={honeypot} onChange={setHoneypot} />

          <div>
            <label className="text-sm font-semibold block mb-2">The original review</label>
            <textarea
              value={form.review_text}
              onChange={(e) => setForm({ ...form, review_text: e.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="Paste the customer's review here so we can check if your reply addresses what they actually said."
              className="w-full p-3 rounded-lg outline-none text-sm"
              style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)', resize: 'vertical' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-2">Their rating</label>
              <select
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full p-3 rounded-lg outline-none text-sm"
                style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{'★'.repeat(n) + '☆'.repeat(5 - n)} ({n})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-2">Reviewer name (optional)</label>
              <input
                type="text"
                value={form.reviewer_name}
                onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })}
                maxLength={200}
                placeholder="Marcus T."
                className="w-full p-3 rounded-lg outline-none text-sm"
                style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-2">Your draft reply</label>
            <textarea
              value={form.draft}
              onChange={(e) => setForm({ ...form, draft: e.target.value })}
              rows={5}
              maxLength={4000}
              placeholder="Paste the reply you were about to post."
              className="w-full p-3 rounded-lg outline-none text-sm"
              style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)', resize: 'vertical' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
              {form.draft.length}/4000 characters
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg text-sm"
              style={{ background: 'rgba(194, 86, 108, 0.08)', color: 'var(--rh-rose, #c2566c)', border: '1px solid rgba(194, 86, 108, 0.25)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.draft.trim()}
            className="px-6 py-3 rounded-lg font-semibold text-base"
            style={{
              background: 'var(--rh-teal, #1e4d5e)',
              color: '#fff',
              opacity: loading || !form.draft.trim() ? 0.6 : 1,
              cursor: loading || !form.draft.trim() ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {loading ? 'Roasting…' : 'Roast my reply →'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <section
            className="mt-12 p-6 rounded-xl"
            style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
          >
            <div className="flex items-baseline gap-4 mb-4 flex-wrap">
              <div
                className="text-6xl font-bold"
                style={{
                  fontFamily: 'Instrument Serif, Georgia, serif',
                  fontWeight: 600,
                  color: result.verdict.tone === 'sage' ? 'var(--rh-sage, #6b8e7a)'
                    : result.verdict.tone === 'ochre' ? 'var(--rh-ochre-deep, #a07d20)'
                    : 'var(--rh-rose, #c2566c)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {result.score}
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  Verdict · score out of 100
                </p>
                <p className="text-2xl mt-1" style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600 }}>
                  {result.verdict.label}
                </p>
              </div>
            </div>

            {result.findings.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                No flags raised. Your reply addresses the customer specifically and avoids the common defensive patterns. Ready to post.
              </p>
            ) : (
              <>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3 mt-2"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  {result.findings.length} {result.findings.length === 1 ? 'finding' : 'findings'}
                </p>
                <ul className="space-y-2">
                  {result.findings.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{
                        background: 'var(--rh-paper, #fbf8f1)',
                        borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}`,
                      }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold mt-0.5 flex-shrink-0"
                        style={{
                          color: SEVERITY_COLOR[f.severity],
                          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                          minWidth: 50,
                        }}
                      >
                        {f.severity}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--rh-ink, #1d242c)' }}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Conversion CTA — soft. Don't punish people for using the tool. */}
            <div
              className="mt-6 pt-6"
              style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                Want AI to draft replies that pass this checker by default? ReviewHub generates 3 tone variants in your voice — relaxed / warm / formal — for every review.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link
                  to="/audit"
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
                >
                  Get a free audit →
                </Link>
                <Link
                  to="/tools/review-reply-generator"
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff', color: 'var(--rh-ink, #1d242c)', textDecoration: 'none' }}
                >
                  Or try the Reply Generator
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Footer — internal links + scoring transparency */}
        <section className="mt-12 pt-8" style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600 }}
          >
            What we check for
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            <li><strong>Defensive clichés</strong> — "we strive for excellence", "this is unusual", "our team always"</li>
            <li><strong>Confrontational framing</strong> — "you said", "actually", "our records show"</li>
            <li><strong>Promotional bait</strong> — sneaking a discount into a complaint reply looks like buying a better review</li>
            <li><strong>Missing acknowledgment</strong> — does the reply reference anything specific from the review?</li>
            <li><strong>Generic-only closer</strong> — "Thank you for your feedback" with nothing else is a non-reply</li>
            <li><strong>Length out of range</strong> — too short = curt, too long = sounds like you're arguing</li>
          </ul>
          <p className="text-xs mt-6" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
            Heuristic-based — no AI, no email required. <Link to="/blog/why-respond-to-google-reviews" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontWeight: 600 }}>Read the playbook →</Link> · <Link to="/tools/review-reply-generator" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontWeight: 600 }}>Reply Generator →</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
