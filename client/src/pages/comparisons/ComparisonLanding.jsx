// Per-competitor comparison page template — single component, three routes:
// /vs/birdeye, /vs/podium, /vs/reviewtrackers.
//
// SEO play: bottom-funnel "Birdeye alternative" / "cheaper than Podium" /
// "ReviewTrackers vs" search intent. People searching these terms have
// usually already decided they want a review-management tool — they're
// shopping between options. Lower volume, much higher intent.
//
// Outreach value: when a prospect pushes back with "we already use X,"
// linking them to /vs/X gives them a structured comparison and lets us
// land objection-handling without sounding defensive in email.
//
// Editorial stance: HONEST positioning, not "competitor sucks". If
// Birdeye is right for a 50-location chain, we say so. The trust earned
// from that honesty converts SMBs better than smear copy.

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../../components/MarketingNav';
import MarketingFooter from '../../components/MarketingFooter';
import usePageTitle from '../../hooks/usePageTitle';
import useSocialMeta from '../../hooks/useSocialMeta';

// Inject a SoftwareApplication JSON-LD with itemReviewed pointing at the
// competitor we're comparing against — Google reads this as "this page is
// a comparison" and serves it for "X vs Y" / "X alternative" searches.
function useComparisonSchema(competitor, c) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'rh-comparison-schema';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: c.title,
      description: c.lede,
      author: { '@type': 'Organization', name: 'ReviewHub', url: 'https://reviewhub.review/' },
      publisher: {
        '@type': 'Organization',
        name: 'ReviewHub',
        logo: { '@type': 'ImageObject', url: 'https://reviewhub.review/logo.svg' },
      },
      datePublished: '2026-05-06',
      mainEntityOfPage: `https://reviewhub.review/vs/${competitor}`,
      about: [
        { '@type': 'SoftwareApplication', name: c.competitorName, applicationCategory: 'BusinessApplication' },
        { '@type': 'SoftwareApplication', name: 'ReviewHub', applicationCategory: 'BusinessApplication' },
      ],
    });
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('rh-comparison-schema');
      if (existing) existing.remove();
    };
  }, [competitor, c]);
}

// Honest competitor data. The numbers come from each competitor's own
// public pricing page (where available) and customer reviews on G2 /
// Capterra. We re-check quarterly — if numbers drift, update here.
const COMPARISONS = {
  birdeye: {
    competitorName: 'Birdeye',
    competitorUrl: 'birdeye.com',
    pageTitle: 'ReviewHub vs Birdeye — honest comparison',
    title: 'Looking at Birdeye? Here\'s an honest comparison.',
    eyebrow: 'Comparison · Birdeye alternative',
    lede: 'Birdeye is a serious enterprise reputation platform — built for 50+ location chains with compliance teams and a dedicated CSM. ReviewHub is built for the 1-5 location SMB who needs Google review replies that don\'t sound robotic, at a price that doesn\'t require a procurement committee.',
    competitorPricing: {
      starting: '$299/mo',
      note: 'Lowest tier ("Standard"); volume discounts only above 5 locations. Enterprise tiers undisclosed — published as "Contact sales".',
    },
    pricingDelta: 'ReviewHub starts at $14/mo. ~21x cheaper than Birdeye\'s entry tier for the core "AI-drafted Google review replies" workflow.',
    rows: [
      { feature: 'Starting price', us: '$14/mo', them: '$299/mo' },
      { feature: 'Free tier', us: 'Yes — 3 AI drafts/mo, 1 platform', them: 'No' },
      { feature: 'Setup time', us: '~5 minutes (OAuth → done)', them: '~2 weeks (CSM-led onboarding)' },
      { feature: 'Annual contract required', us: 'No (monthly cancellation)', them: 'Typically yes (annual term)' },
      { feature: 'AI reply drafting', us: 'Claude Haiku, 10 languages', them: 'Yes (proprietary)' },
      { feature: 'Multi-location', us: 'Up to 5 (Business plan, $59/mo)', them: 'Strong — designed for 50+ locations' },
      { feature: 'Surveys / NPS / SMS', us: 'No — focused on reviews only', them: 'Yes (full reputation suite)' },
      { feature: 'Listings management', us: 'No', them: 'Yes (60+ directories)' },
      { feature: 'Local-language reply tone', us: 'Native Thai / Japanese / Korean / Chinese / 6 more', them: 'English-first; multilingual via translation' },
      { feature: 'Implementation', us: 'Self-serve only', them: 'White-glove CSM' },
      { feature: 'Honest fit', us: 'SMB owner who replies to reviews themselves', them: '50+ location enterprise with reputation team' },
    ],
    pickThemIf: [
      'You operate 25+ locations and need a single dashboard for surveys, listings, social, and reviews.',
      'You have a marketing or reputation team — not just an owner — who needs reporting, role-based access, and SLAs.',
      'You require enterprise compliance (SOC2, HIPAA-aligned workflows) or have a procurement process that needs MSAs.',
      'You\'re willing to pay $300-2000+/mo for the full reputation-management stack.',
    ],
    pickUsIf: [
      'You run 1-5 locations and the owner (or a single manager) handles review replies.',
      'You want Google reviews handled well — not surveys, SMS, listings, social, etc. all bundled together.',
      'You operate in non-English markets and want replies that read native, not translated.',
      'You want to start free, see if it works, and upgrade only when it does.',
    ],
  },

  podium: {
    competitorName: 'Podium',
    competitorUrl: 'podium.com',
    pageTitle: 'ReviewHub vs Podium — honest comparison',
    title: 'Considering Podium? Here\'s where each one wins.',
    eyebrow: 'Comparison · Podium alternative',
    lede: 'Podium is best understood as a customer-messaging platform that happens to do reviews — webchat, SMS marketing, payments, and review requests in one stack. ReviewHub is a focused tool for the one job most SMBs actually need: replying to Google reviews in your own voice, at a price that respects your size.',
    competitorPricing: {
      starting: '$249/mo',
      note: 'Essentials tier; "Standard" $349/mo, "Professional" $449/mo. Annual contracts standard. Pricing not always public; figures from G2 / customer reports as of 2026 Q2.',
    },
    pricingDelta: 'ReviewHub starts at $14/mo. ~17x cheaper than Podium\'s entry tier for the review-reply workflow.',
    rows: [
      { feature: 'Starting price', us: '$14/mo', them: '$249/mo' },
      { feature: 'Free tier', us: 'Yes — 3 AI drafts/mo', them: 'No (free trial only)' },
      { feature: 'Annual contract', us: 'No', them: 'Typically yes' },
      { feature: 'AI reply drafting', us: 'Claude Haiku, 10 languages', them: 'Yes' },
      { feature: 'SMS / webchat / payments', us: 'No', them: 'Yes (their core product)' },
      { feature: 'Review requests via SMS', us: 'No', them: 'Yes (SMS to past customers)' },
      { feature: 'Multi-location', us: 'Up to 5', them: 'Strong (designed for chains)' },
      { feature: 'Setup time', us: '~5 minutes', them: '~1-2 weeks (onboarding call)' },
      { feature: 'Local-language tone', us: 'Native Thai / Japanese / 8 more', them: 'English-first' },
      { feature: 'Honest fit', us: 'Owner-operator focused on Google review quality', them: 'Multi-channel SMB with a customer-messaging team' },
    ],
    pickThemIf: [
      'Your bottleneck is customer messaging volume — webchat, SMS, payment requests — not just reviews.',
      'You actively send review-request SMS to past customers and want that built-in.',
      'You operate enough locations to amortize $249-449/mo across them.',
      'You want one tool for marketing, payments, and reviews bundled together.',
    ],
    pickUsIf: [
      'Reviews are the bottleneck, not multi-channel customer messaging.',
      'You want the review-reply workflow done well, not as one tab in a 12-tab platform.',
      'You\'re a single-location café, B&B, dental clinic, or similar SMB.',
      'You\'d rather pay for one focused tool and use Twilio / WhatsApp / your existing stack for messaging.',
    ],
  },

  reviewtrackers: {
    competitorName: 'ReviewTrackers',
    competitorUrl: 'reviewtrackers.com',
    pageTitle: 'ReviewHub vs ReviewTrackers — honest comparison',
    title: 'Comparing ReviewTrackers? Here\'s the breakdown.',
    eyebrow: 'Comparison · ReviewTrackers alternative',
    lede: 'ReviewTrackers is a strong listings + reviews platform aimed at multi-location enterprise — restaurant chains, healthcare networks, dealerships. ReviewHub is a focused review-reply tool for owner-operators and small chains who don\'t need the full enterprise reputation stack.',
    competitorPricing: {
      starting: '$59/mo per location',
      note: 'Pricing not fully public; "Standard" tier reportedly $59/mo per location, "Pro" higher. Multi-location pricing scales linearly. Annual contracts standard.',
    },
    pricingDelta: 'ReviewHub starts at $14/mo total (not per-location). Single-location SMBs save the most — $14 vs $59 = ~4x cheaper. Multi-location savings depend on your count.',
    rows: [
      { feature: 'Starting price', us: '$14/mo total', them: '$59/mo per location' },
      { feature: 'Free tier', us: 'Yes', them: 'No (trial only)' },
      { feature: 'AI reply drafting', us: 'Claude Haiku, 10 languages', them: 'Yes (suggested replies)' },
      { feature: 'Listings sync (60+ directories)', us: 'No', them: 'Yes (their strength)' },
      { feature: 'Competitor benchmarking', us: 'No', them: 'Yes' },
      { feature: 'Sentiment analytics', us: 'Basic (positive/neutral/negative)', them: 'Detailed (themes, drivers)' },
      { feature: 'Multi-location dashboard', us: 'Up to 5', them: 'Designed for 10-1000+' },
      { feature: 'Local-language reply tone', us: 'Native Thai / Japanese / 8 more', them: 'English-first' },
      { feature: 'Setup time', us: '~5 minutes', them: '~1-3 weeks' },
      { feature: 'Honest fit', us: 'Single-location to small-chain SMB', them: 'Multi-location enterprise with analytics needs' },
    ],
    pickThemIf: [
      'You operate 10+ locations and need listings sync across 60+ directories (Yelp, TripAdvisor, Yellow Pages, etc.).',
      'You need theme-level sentiment analytics — "guests complain about parking 23% more this quarter."',
      'You benchmark against competitors and need that built into the dashboard.',
      'You have a marketing team that wants weekly reporting decks.',
    ],
    pickUsIf: [
      'You\'re 1-5 locations and the per-location pricing model gets expensive fast.',
      'Your bottleneck is reply quality and tone, not analytics depth.',
      'You operate in non-English markets where ReviewTrackers\' English-first tone falls flat.',
      'You want fast self-serve setup, not a 1-3 week onboarding.',
    ],
  },
};

export default function ComparisonLanding({ competitor }) {
  const c = COMPARISONS[competitor];
  if (!c) {
    throw new Error(`Unknown competitor: ${competitor}. Add it to COMPARISONS in ComparisonLanding.jsx.`);
  }

  usePageTitle(c.pageTitle);
  useSocialMeta({
    title: c.title,
    description: c.lede,
  });
  useComparisonSchema(competitor, c);

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Editorial hero */}
        <div className="mb-12">
          <p
            className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            {c.eyebrow}
          </p>
          <h1
            className="text-5xl font-bold mb-6"
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--rh-ink, #1d242c)',
            }}
          >
            {c.title}
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {c.lede}
          </p>
        </div>

        {/* Pricing delta — surface the headline number first */}
        <section
          className="mb-12 p-6 rounded-xl"
          style={{ background: 'var(--rh-card)', border: '1px solid var(--rh-rule, #e8e3d6)' }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold"
            style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            Pricing snapshot
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>{c.competitorName}</p>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Instrument Serif, Georgia, serif', color: 'var(--rh-ink, #1d242c)' }}>{c.competitorPricing.starting}</p>
              <p className="text-xs mt-2" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>{c.competitorPricing.note}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>ReviewHub</p>
              <p className="text-3xl font-bold" style={{ fontFamily: 'Instrument Serif, Georgia, serif', color: 'var(--rh-teal, #1e4d5e)' }}>$14/mo</p>
              <p className="text-xs mt-2" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>Starter tier. Free tier also available (3 AI drafts/mo).</p>
            </div>
          </div>
          <p className="text-sm mt-4 pt-4" style={{ color: 'var(--rh-ink-2, #4a525a)', borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
            <strong style={{ color: 'var(--rh-ink, #1d242c)' }}>What this means:</strong> {c.pricingDelta}
          </p>
        </section>

        {/* Feature-by-feature comparison table */}
        <section className="mb-12">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.015em' }}
          >
            Feature by feature
          </h2>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rh-rule, #e8e3d6)' }}>
            <table className="w-full text-sm" style={{ background: 'var(--rh-card)' }}>
              <thead style={{ background: 'var(--rh-cream, #f3ecdb)' }}>
                <tr>
                  <th className="text-left p-3 font-semibold" style={{ width: '40%' }}>Feature</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--rh-teal, #1e4d5e)' }}>ReviewHub</th>
                  <th className="text-left p-3 font-semibold">{c.competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--rh-rule, #e8e3d6)' : 'none' }}>
                    <td className="p-3 font-medium">{row.feature}</td>
                    <td className="p-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>{row.us}</td>
                    <td className="p-3" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Honest positioning — when each tool wins */}
        <section className="mb-12 grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl" style={{ background: 'var(--rh-card)', border: '1px solid var(--rh-rule, #e8e3d6)' }}>
            <h3
              className="text-xl font-bold mb-4"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600 }}
            >
              Pick {c.competitorName} if…
            </h3>
            <ul className="space-y-3 text-sm" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
              {c.pickThemIf.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: 'var(--rh-ink-3, #8b939c)', flexShrink: 0 }}>→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--rh-cream, #f3ecdb)', border: '1px solid var(--rh-teal, #1e4d5e)' }}
          >
            <h3
              className="text-xl font-bold mb-4"
              style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, color: 'var(--rh-teal, #1e4d5e)' }}
            >
              Pick ReviewHub if…
            </h3>
            <ul className="space-y-3 text-sm" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
              {c.pickUsIf.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: 'var(--rh-teal, #1e4d5e)', flexShrink: 0 }}>→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section
          className="text-center p-8 rounded-xl"
          style={{ background: 'var(--rh-card)', border: '1px solid var(--rh-rule, #e8e3d6)' }}
        >
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600 }}
          >
            See for yourself with a free audit.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            Paste your Google Maps URL. We'll generate 10 AI replies in your business voice and send them to your inbox in 24 hours. No credit card. No setup call.
          </p>
          <Link
            to="/audit"
            className="inline-block px-6 py-3 rounded-lg font-semibold text-sm"
            style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
          >
            Get a free audit →
          </Link>
        </section>

        {/* Cross-link to other comparisons */}
        <section className="mt-12 pt-8" style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            Other comparisons
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(COMPARISONS)
              .filter(([key]) => key !== competitor)
              .map(([key, val]) => (
                <Link
                  key={key}
                  to={`/vs/${key}`}
                  className="px-3 py-1.5 rounded-full text-sm"
                  style={{
                    background: 'var(--rh-card)',
                    border: '1px solid var(--rh-rule, #e8e3d6)',
                    color: 'var(--rh-ink, #1d242c)',
                    textDecoration: 'none',
                  }}
                >
                  ReviewHub vs {val.competitorName}
                </Link>
              ))}
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
            Pricing data current as of 2026 Q2 from each vendor's public pricing page and aggregated G2 / Capterra reviews. We re-check quarterly. Found a number that\'s wrong? <a href="/support" style={{ color: 'var(--rh-teal, #1e4d5e)' }}>Tell us</a>.
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
