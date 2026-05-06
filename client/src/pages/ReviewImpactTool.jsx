// Free, no-signup Review Impact Scorer.
//
// Sibling to /tools/reply-roaster (critique your draft) and
// /tools/review-reply-generator (draft from scratch). This one answers
// the OWNER'S panic question when a 1-star lands: "How bad is this?
// What kind of reviewer am I dealing with? What should I do?"
//
// Pure heuristic backend at /api/public/review-impact — no AI cost,
// instant, free to run forever. Highly shareable in restaurant /
// hospitality forums when an owner is freaking out about a fresh 1-star.
//
// SEO targets: "how bad is a bad google review", "fake review detector",
// "negative review impact", "review extortion checker". Long-tail intent
// owners actually have but no big competitor builds for.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import HoneypotField from '../components/HoneypotField';

const SAMPLE_LEGITIMATE_FRUSTRATED = {
  review_text: 'We had a reservation for 7pm last Friday and waited 45 minutes for our table. Once seated, the server (I think her name was Maria) was rushed and forgot our drink order twice. The pasta carbonara was lukewarm. We paid $84 for two and left hungry. I emailed the restaurant the next day with no response. Disappointing — we used to come every month.',
  rating: 1,
  reviewer_name: 'James K.',
};

const SAMPLE_EXTORTION = {
  review_text: 'Worst experience ever. Will keep posting 1 stars unless you give me a refund. Email me.',
  rating: 1,
  reviewer_name: 'Anonymous',
};

const SAMPLE_VENTING = {
  review_text: 'TERRIBLE!!! WORST PLACE EVER!!! NEVER COMING BACK!!!',
  rating: 1,
  reviewer_name: '',
};

const ACTION_GUIDANCE = {
  'apologize-and-fix': {
    label: 'Apologize and fix',
    next: 'Write a short reply that (a) acknowledges what specifically went wrong, (b) takes ownership without "but", (c) names a concrete change you\'re making, (d) invites them back privately.',
  },
  'clarify-respectfully': {
    label: 'Clarify respectfully',
    next: 'If facts are wrong, correct them gently — but only after acknowledging what may have been frustrating. Never lead with "actually" or "our records show".',
  },
  'flag-to-google': {
    label: 'Flag to Google for review',
    next: 'This shows extortion / fake-review red flags. Use Google Business Profile → Reviews → Flag as inappropriate. Expect 2-7 days for review. Reply with a brief, professional acknowledgment in the meantime — don\'t engage with the threat.',
  },
  'brief-acknowledgment': {
    label: 'Brief professional acknowledgment',
    next: 'Don\'t engage with the heat. Two sentences: (1) you\'re sorry it didn\'t meet expectations, (2) you welcome direct feedback. No specifics, no defensiveness, no apology for things that didn\'t happen.',
  },
  'thank-warmly': {
    label: 'Thank warmly',
    next: 'Mention something specific they said. Sign with a real name. Short and warm — don\'t over-engineer praise.',
  },
};

const REVIEWER_TYPE_LABEL = {
  'legitimate-frustrated': 'Legitimate, frustrated',
  'venting': 'Venting / emotional',
  'suspicious-extortion': 'Possible extortion',
  'competitor-likely': 'Possible competitor sabotage',
  'mild-disappointment': 'Mildly disappointed',
  'positive-or-neutral': 'Positive / neutral',
};

export default function ReviewImpactTool() {
  usePageTitle('Review Impact Scorer — how bad is this Google review?');
  useSocialMeta({
    title: 'How bad is this Google review? — Free impact scorer',
    description: 'Paste a negative review. Get an instant damage score, reviewer-type guess, and a recommended action. Free, no signup, no AI.',
  });

  const [form, setForm] = useState({
    review_text: '',
    rating: 1,
    reviewer_name: '',
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
    if (!form.review_text.trim()) {
      setError('Paste the review you want to analyze.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/public/review-impact', {
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

  // Score color by risk category
  const scoreColor = (cat) => {
    if (cat === 'critical' || cat === 'high') return 'var(--rh-rose, #c2566c)';
    if (cat === 'moderate') return 'var(--rh-ochre-deep, #a07d20)';
    return 'var(--rh-sage, #6b8e7a)';
  };

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p
          className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold"
          style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
        >
          Free tool · no signup · no AI
        </p>
        <h1
          className="text-5xl font-bold mb-4"
          style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          How bad is this review?
        </h1>
        <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          A 1-star just landed and you're spiraling. Paste it below. We score the actual damage (0-100), guess the reviewer type (legitimate, venting, possible extortion), and tell you what to do — apologize, clarify, flag, or ignore. Instant, no AI, free.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_LEGITIMATE_FRUSTRATED)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff' }}
            >
              Try a legitimate complaint →
            </button>
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_EXTORTION)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff' }}
            >
              Try a possible extortion →
            </button>
            <button
              type="button"
              onClick={() => loadSample(SAMPLE_VENTING)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff' }}
            >
              Try angry venting →
            </button>
          </div>

          <HoneypotField value={honeypot} onChange={setHoneypot} />

          <div>
            <label className="text-sm font-semibold block mb-2">The review</label>
            <textarea
              value={form.review_text}
              onChange={(e) => setForm({ ...form, review_text: e.target.value })}
              rows={6}
              maxLength={4000}
              placeholder="Paste the Google review here — the full text, exactly as the customer wrote it."
              className="w-full p-3 rounded-lg outline-none text-sm"
              style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)', resize: 'vertical' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
              {form.review_text.length}/4000 characters
            </p>
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
                placeholder="James K."
                className="w-full p-3 rounded-lg outline-none text-sm"
                style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
              />
            </div>
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
            disabled={loading || !form.review_text.trim()}
            className="px-6 py-3 rounded-lg font-semibold text-base"
            style={{
              background: 'var(--rh-teal, #1e4d5e)',
              color: '#fff',
              opacity: loading || !form.review_text.trim() ? 0.6 : 1,
              cursor: loading || !form.review_text.trim() ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {loading ? 'Scoring…' : 'Score this review →'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <section
            className="mt-12 p-6 rounded-xl"
            style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
          >
            <div className="flex items-baseline gap-4 mb-6 flex-wrap">
              <div
                className="text-6xl font-bold"
                style={{
                  fontFamily: 'Instrument Serif, Georgia, serif',
                  fontWeight: 600,
                  color: scoreColor(result.risk_category),
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {result.damage_score}
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  Damage score · 0-100
                </p>
                <p className="text-2xl mt-1" style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600 }}>
                  {result.risk_label}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-lg" style={{ background: 'var(--rh-cream, #f3ecdb)' }}>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  Reviewer type
                </p>
                <p className="text-base font-semibold" style={{ color: 'var(--rh-ink, #1d242c)' }}>
                  {REVIEWER_TYPE_LABEL[result.reviewer_type] || result.reviewer_type}
                </p>
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--rh-teal-soft, #d6e7eb)' }}>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold"
                  style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  Recommended action
                </p>
                <p className="text-base font-semibold" style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}>
                  {ACTION_GUIDANCE[result.recommended_action]?.label || result.recommended_action}
                </p>
              </div>
            </div>

            {ACTION_GUIDANCE[result.recommended_action] && (
              <div className="p-4 rounded-lg mb-6" style={{ background: 'rgba(30, 77, 94, 0.04)' }}>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  What to do next
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                  {ACTION_GUIDANCE[result.recommended_action].next}
                </p>
              </div>
            )}

            {result.findings.length > 0 && (
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
                  style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                >
                  What we noticed ({result.findings.length})
                </p>
                <ul className="space-y-2">
                  {result.findings.map((f, i) => (
                    <li
                      key={i}
                      className="flex gap-3 p-3 rounded-lg text-sm"
                      style={{
                        background: f.severity === 'good' ? 'rgba(107, 142, 122, 0.08)'
                          : f.severity === 'high' ? 'rgba(194, 86, 108, 0.08)'
                          : f.severity === 'medium' ? 'rgba(196, 138, 44, 0.08)'
                          : 'rgba(139, 147, 156, 0.08)',
                      }}
                    >
                      <span
                        className="flex-shrink-0"
                        style={{
                          color: f.severity === 'good' ? 'var(--rh-sage, #6b8e7a)'
                            : f.severity === 'high' ? 'var(--rh-rose, #c2566c)'
                            : f.severity === 'medium' ? 'var(--rh-ochre-deep, #a07d20)'
                            : 'var(--rh-ink-3, #8b939c)',
                          fontWeight: 700,
                        }}
                      >
                        {f.severity === 'good' ? '✓' : '·'}
                      </span>
                      <span style={{ color: 'var(--rh-ink-2, #4a525a)' }}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
                <strong style={{ color: 'var(--rh-ink, #1d242c)' }}>Want help drafting the actual reply?</strong> ReviewHub generates owner-tone replies in your voice — paste this review (or all your unanswered ones) into a free audit.
              </p>
              <Link
                to="/audit"
                className="inline-block px-5 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
              >
                Get a free audit →
              </Link>
            </div>
          </section>
        )}

        {/* Footer note about the heuristic — honesty earns trust */}
        <div className="mt-12 pt-8 text-xs" style={{ color: 'var(--rh-ink-3, #8b939c)', borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
          <p className="mb-2">
            <strong>How this works:</strong> No AI, no LLM. Pure heuristic scoring against patterns we\'ve seen across thousands of reviews — length, specificity markers (named staff, dates, money amounts), anger signals (CAPS, multiple !!!), extortion red flags, and resolvable-complaint detection.
          </p>
          <p>
            Heuristics aren\'t perfect — they catch most patterns but miss nuance. Use the score as a sanity check, not gospel. The real reply still needs your judgment.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
