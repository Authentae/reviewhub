// NewsletterSignup — small inline component used on Landing (above
// footer) and on /blog index. POSTs to /api/newsletter with the email
// + a `source` string for attribution.
//
// Built 2026-05-20 per overnight queue item 8. Backend writes to a
// local SQLite newsletter_signups table — no third-party integration
// today. We export to ConvertKit/Loops when the list grows.
//
// Props:
//   source — short string ('landing', 'blog-index', 'blog-post:<slug>')
//   variant — 'panel' (default) | 'inline' (slimmer for footer/blog use)

import React, { useState } from 'react';

const C = {
  paper: '#fbf8f1',
  ink: '#1d242c',
  inkSoft: '#4a525a',
  teal: '#1e4d5e',
  tealDeep: '#163d4a',
  ochre: '#c08a3e',
  sage: '#6b8e7a',
  rose: '#c2566c',
  hairline: 'rgba(29,36,44,0.08)',
};
const serif = "'Instrument Serif', Georgia, serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

export default function NewsletterSignup({ source = 'unknown', variant = 'panel' }) {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState(''); // bot trap
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (state === 'loading' || state === 'ok') return;
    setState('loading');
    setError('');
    try {
      // Raw fetch — public endpoint, no auth client wrapper needed.
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email: email.trim(), source, website: honeypot }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Something went wrong');
        setState('error');
        return;
      }
      setState('ok');
      if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
        try { window.plausible('NewsletterSignup', { props: { source } }); } catch { /* swallow */ }
      }
    } catch {
      setError('Network error');
      setState('error');
    }
  }

  // Slim inline variant — fits in blog index footer / above MarketingFooter.
  const isInline = variant === 'inline';

  if (state === 'ok') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: isInline ? '14px 18px' : '24px 26px',
          background: 'color-mix(in oklab, #6b8e7a 14%, #fbf8f1)',
          border: `1px solid color-mix(in oklab, #6b8e7a 35%, ${C.hairline})`,
          borderRadius: 12,
          color: C.ink,
          fontSize: isInline ? 14.5 : 16,
          textAlign: 'center',
        }}
      >
        ✓ You're on the list. We'll email when something's worth saying.
      </div>
    );
  }

  return (
    <section
      aria-label="Newsletter signup"
      style={{
        padding: isInline ? '18px 22px' : '32px 32px',
        background: '#fff',
        border: `1px solid ${C.hairline}`,
        borderRadius: 14,
        boxShadow: isInline ? 'none' : '0 1px 2px rgba(0,0,0,0.04), 0 6px 14px rgba(20,30,40,0.04)',
      }}
    >
      {!isInline && (
        <p style={{
          fontFamily: mono, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: C.ochre, margin: '0 0 8px',
        }}>NEWSLETTER · OCCASIONAL</p>
      )}
      <h3 style={{
        fontFamily: isInline ? "'Inter Tight', sans-serif" : serif,
        fontSize: isInline ? 17 : 24,
        fontWeight: isInline ? 600 : 500,
        lineHeight: 1.2, letterSpacing: '-0.01em',
        color: C.ink, margin: 0,
      }}>
        Practical writing about Google reviews, in your inbox.
      </h3>
      <p style={{
        fontSize: isInline ? 13.5 : 15,
        lineHeight: 1.55, color: C.inkSoft,
        margin: isInline ? '6px 0 12px' : '10px 0 18px',
        maxWidth: 540,
      }}>
        New posts when we have something useful to say. No spam, no
        send-something-weekly-because-the-schedule-said-so. Unsubscribe
        in one click.
      </p>
      <form onSubmit={handleSubmit} style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start',
      }}>
        {/* Honeypot — hidden from real users, irresistible to dumb bots. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          aria-hidden="true"
          style={{
            position: 'absolute', left: '-9999px',
            width: 1, height: 1, opacity: 0, pointerEvents: 'none',
          }}
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="your@email.com"
          aria-label="Email for newsletter"
          disabled={state === 'loading'}
          style={{
            flex: '1 1 220px',
            padding: '11px 14px',
            borderRadius: 8,
            border: `1px solid ${C.hairline}`,
            fontSize: 14.5,
            background: C.paper,
            color: C.ink,
            minHeight: 42,
          }}
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          style={{
            padding: '11px 22px', borderRadius: 8,
            background: C.teal, color: C.paper,
            border: 'none', cursor: state === 'loading' ? 'wait' : 'pointer',
            fontWeight: 600, fontSize: 14.5,
            minHeight: 42,
          }}
        >
          {state === 'loading' ? 'Saving…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && error && (
        <div role="alert" style={{
          fontSize: 13, color: C.rose, marginTop: 10,
        }}>{error}</div>
      )}
    </section>
  );
}
