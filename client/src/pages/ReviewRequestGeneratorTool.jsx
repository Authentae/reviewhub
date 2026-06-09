// Free, no-signup Review Request Generator.
//
// The first GET-REVIEWS free tool (siblings are reply-focused:
// /tools/review-reply-generator, /tools/reply-roaster, /tools/review-impact).
// This one answers the owner question on the get-reviews side: "what do I
// actually text/email a customer to ask for a Google review?" Purely
// client-side — fills a proven, compliant template from the business name +
// customer name + business type + channel. No API, instant, free forever.
//
// SEO targets: "review request generator", "google review request template",
// "how to ask for a google review by text". On-pivot lead-gen: every output
// ends with a nudge toward automating the ask with ReviewHub.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';

const LINK_PLACEHOLDER = '[your Google review link]';

// Each builder returns the message body. Kept short + compliant (no incentives,
// no gating). The customer name is optional; the templates read naturally with
// or without it.
const TEMPLATES = {
  general: (b, c) => `Hi${c ? ' ' + c : ''}, thanks for choosing ${b}! If you have a moment, a quick Google review really helps us — here's the link 👉 ${LINK_PLACEHOLDER}`,
  clinic: (b, c) => `Hi${c ? ' ' + c : ''}, thanks for visiting ${b} today. If you have a moment, a quick Google review really helps other patients find us 👉 ${LINK_PLACEHOLDER}`,
  salon: (b, c) => `Hi${c ? ' ' + c : ''}! Hope you're loving your visit to ${b}. A quick Google review would mean a lot to us 👉 ${LINK_PLACEHOLDER} — thank you!`,
  restaurant: (b, c) => `Thanks for coming in${c ? ', ' + c : ''}! If you enjoyed ${b}, a 10-second Google review helps us a lot 👉 ${LINK_PLACEHOLDER}`,
  home: (b, c) => `Hi${c ? ' ' + c : ''}, thanks for trusting ${b} with the job today. If you're happy with how it went, a quick Google review helps other homeowners find us 👉 ${LINK_PLACEHOLDER}`,
  auto: (b, c) => `Glad we got you sorted${c ? ', ' + c : ''}! A quick Google review for ${b} helps other drivers find us 👉 ${LINK_PLACEHOLDER}`,
  fitness: (b, c) => `Great session${c ? ', ' + c : ''}! If ${b} has helped you, a quick Google review really helps the studio 👉 ${LINK_PLACEHOLDER}`,
};

const TYPES = [
  ['general', 'General / other'],
  ['clinic', 'Clinic / dental / health'],
  ['salon', 'Salon / spa / barber'],
  ['restaurant', 'Restaurant / cafe / bar'],
  ['home', 'Home / trade service'],
  ['auto', 'Auto repair'],
  ['fitness', 'Gym / fitness studio'],
];

export default function ReviewRequestGeneratorTool() {
  const [business, setBusiness] = useState('');
  const [customer, setCustomer] = useState('');
  const [type, setType] = useState('general');
  const [channel, setChannel] = useState('sms');
  const [copied, setCopied] = useState(false);

  usePageTitle('Review Request Generator — what to text customers for a Google review');
  useSocialMeta({
    title: 'Free Google Review Request Generator',
    description: 'Generate a short, compliant Google review request to text or email your customers. No signup — fill in your business and get a ready message.',
  });

  const b = business.trim() || 'our business';
  const c = customer.trim();
  const body = (TEMPLATES[type] || TEMPLATES.general)(b, c);
  const message = channel === 'email'
    ? `Subject: A quick favour, ${c || 'and thank you'}\n\n${body}\n\nThank you,\n${b}`
    : body;

  const inputStyle = {
    border: '1px solid var(--rh-rule, #e8dec7)',
    background: 'var(--rh-card, #ffffff)',
    color: 'var(--rh-ink, #1d242c)',
  };

  function copy() {
    try {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — user can select manually */ }
  }

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold" style={{ color: 'var(--rh-teal-deep, #1e4d5e)' }}>
          Free tool · No signup
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--rh-serif), Georgia, serif', fontWeight: 500 }}>
          Google review request generator
        </h1>
        <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          Fill in your business and get a short, friendly review request you can
          paste into a text or email. Compliant by default — no incentives, no
          gating, just a clear ask.
        </p>

        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-2">Business name</label>
              <input
                value={business}
                onChange={e => setBusiness(e.target.value)}
                placeholder="e.g. Common Grounds Cafe"
                className="w-full p-3 rounded-lg outline-none text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-2">Customer name <span style={{ color: 'var(--rh-ink-3, #8b939c)' }}>(optional)</span></label>
              <input
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="e.g. Alex"
                className="w-full p-3 rounded-lg outline-none text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-2">Business type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full p-3 rounded-lg outline-none text-sm" style={inputStyle}>
                {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-2">Channel</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full p-3 rounded-lg outline-none text-sm" style={inputStyle}>
                <option value="sms">Text / SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>

          {/* Output */}
          <div>
            <label className="text-sm font-semibold block mb-2">Your review request</label>
            <div
              className="p-4 rounded-lg text-sm whitespace-pre-wrap"
              style={{ border: '1px solid var(--rh-teal-deep, #1e4d5e)', background: 'var(--rh-card, #ffffff)', color: 'var(--rh-ink, #1d242c)', lineHeight: 1.6 }}
              aria-live="polite"
            >
              {message}
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                type="button"
                onClick={copy}
                className="px-5 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: 'var(--rh-teal-deep, #1e4d5e)', color: '#fff' }}
              >
                {copied ? 'Copied ✓' : 'Copy message'}
              </button>
              <span className="text-xs" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
                Replace <code>{LINK_PLACEHOLDER}</code> with your direct review link — <Link to="/blog/how-to-make-a-google-review-qr-code" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>how to get it</Link>.
              </span>
            </div>
          </div>
        </div>

        {/* On-pivot lead-gen nudge */}
        <section
          className="mt-12 rounded-2xl p-7 text-center"
          style={{ background: 'linear-gradient(135deg, var(--rh-teal-deep, #1e4d5e), #2c7889)', color: '#fbf8f1' }}
        >
          <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--rh-serif), Georgia, serif', fontWeight: 400, color: '#fbf8f1' }}>
            Tired of sending these by hand?
          </h2>
          <p className="mb-5 text-sm" style={{ opacity: 0.92 }}>
            ReviewHub sends the request automatically after each visit, so you collect reviews without remembering to text. Free to start, no credit card.
          </p>
          <Link to="/" className="inline-block px-6 py-3 rounded-lg font-semibold text-sm" style={{ background: '#fbf8f1', color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'none' }}>
            See how it works →
          </Link>
        </section>

        <p className="text-sm mt-10" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
          New to getting reviews? Start with{' '}
          <Link to="/blog/how-to-get-more-google-reviews" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>how to get more Google reviews</Link>
          {' '}or browse the{' '}
          <Link to="/blog/google-review-request-templates" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', textDecoration: 'underline' }}>full template guide</Link>.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
