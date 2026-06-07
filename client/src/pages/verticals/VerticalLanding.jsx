// Per-vertical landing page template — single component, three routes:
// /for-restaurants, /for-dentists, /for-hotels.
//
// SEO play: long-tail keywords like "AI google review reply tool for
// restaurants" have lower competition than the head term "AI google
// reviews", and the visitor intent is much higher (they know exactly
// what they want). Three focused pages instead of one generic one
// triples the surface area Google can match against.
//
// Design: matches the existing landing/audit/pricing editorial voice
// (Instrument Serif headline, mono eyebrow, Inter body, off-white
// paper background). Content is per-vertical: industry-specific
// review platforms, common review patterns, customer voice examples.

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../../components/MarketingNav';
import MarketingFooter from '../../components/MarketingFooter';
import usePageTitle from '../../hooks/usePageTitle';
import useSocialMeta from '../../hooks/useSocialMeta';

// Inject a Service JSON-LD schema while mounted, restore on unmount.
// Google uses this to render rich-result cards in SERP — name, provider,
// price range, audience type. Without it, the page is just a regular
// blue-link result; with it, eligible for Service / SoftwareApplication
// rich snippets.
function useServiceSchema(vertical, v) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'rh-service-schema';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: v.title,
      description: v.sub,
      provider: {
        '@type': 'Organization',
        name: 'ReviewHub',
        url: 'https://reviewhub.review/',
      },
      areaServed: 'Worldwide',
      audience: { '@type': 'BusinessAudience', audienceType: v.eyebrow },
      offers: {
        '@type': 'Offer',
        price: '14',
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '14',
          priceCurrency: 'USD',
          unitText: 'MONTH',
        },
      },
      url: `https://reviewhub.review/for-${vertical}`,
    });
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [vertical, v]);
}

// Per-vertical content. Add a new vertical by adding a key here + a
// route in App.jsx. The actual SEO win is one of these per common
// industry, not a sprawling list — focus beats breadth.
// Per-vertical content. Audit 2026-05-16: stripped fabricated testimonial
// quotes (we have 0 paying customers — FTC endorsement-guide violation),
// softened HIPAA / PDPA compliance claims to "PHI-aware" / "privacy-aware"
// (we have no BAA / formal compliance audit, just prompt rules), and
// split platforms into `platformsLive` (Google only — what we poll +
// auto-draft today) and `platformsComingSoon` (industry-relevant ones
// we'll add when integrations ship). Keeps the long-tail SEO keywords
// visible while being honest about today's coverage.
const VERTICALS = {
  restaurants: {
    title: 'AI Google Review Replies for Restaurants',
    pageTitle: 'AI review replies for restaurants',
    eyebrow: 'For restaurants',
    heroLine1: 'Reply to every review',
    heroLine2: 'between dinner shifts.',
    sub: 'Your guests rate the food on Google while you\'re running the kitchen. ReviewHub pings you on LINE with a draft reply in your voice — tap to copy, paste in Google, ~30 seconds. TripAdvisor, Wongnai, foodpanda integrations coming.',
    platformsLive: ['Google'],
    platformsComingSoon: ['TripAdvisor', 'Yelp', 'Facebook', 'Wongnai (TH)', 'Tabelog (JP)', 'foodpanda', 'Grab Food'],
    painPoints: [
      'Slow service complaint at 9pm — reply needs to be empathetic, specific, and posted before they tell their friends',
      'Picture of a hair in pasta — flag for follow-up, draft an apology with a real callback (not a void coupon)',
      'Five-star regular who tags your sous chef by name — quick warm thanks that doesn\'t sound copy-pasted',
    ],
    founderNote: 'I built this for the bistro owner who skips Monday reviews because the queue is too painful. The math I want to hit: clear 12 in 8 minutes, in your voice, before service.',
  },
  dentists: {
    title: 'AI Google Review Replies for Dental Clinics',
    pageTitle: 'AI review replies for dental clinics',
    eyebrow: 'For dental clinics',
    heroLine1: 'PHI-aware reply drafts',
    heroLine2: 'between patients.',
    sub: 'Patients leave reviews about specific procedures, costs, and staff. Replying without disclosing PHI is hard. ReviewHub drafts careful replies — generic empathy + invitation to follow up privately, never confirming whether the reviewer was a patient. We make no formal HIPAA-compliance claim; we provide the prompt framing, you sign off on every send.',
    platformsLive: ['Google'],
    platformsComingSoon: ['Yelp', 'Healthgrades', 'Facebook', 'RateMDs', 'Vitals', 'Zocdoc'],
    painPoints: [
      'Reviewer mentions a specific procedure — your reply must NOT confirm or deny they were a patient (PHI)',
      'One-star "they overcharged me" — empathy + offer to discuss billing privately, never the patient\'s actual chart',
      'Anxious patient who praises Dr. Pat\'s "calm hands" — warm reply that doesn\'t cross into testimonial-by-proxy',
    ],
    founderNote: 'A US dentist gave me the original brief: every reply was 5 minutes of second-guessing whether the wording leaked PHI. The drafts here use a privacy-first prompt rule; you still review every word before it goes live.',
  },
  hotels: {
    title: 'AI Google Review Replies for Hotels & B&Bs',
    pageTitle: 'AI review replies for hotels',
    eyebrow: 'For hotels & B&Bs',
    heroLine1: 'Reply to every Google review',
    heroLine2: 'between front-desk hours.',
    sub: 'Hotels live on Google + Booking.com + Agoda + TripAdvisor. We start with the Google reviews you\'re losing today — multi-OTA pull coming once their APIs unlock for us. Drafts in your voice + the guest\'s language, tracked per platform.',
    platformsLive: ['Google'],
    platformsComingSoon: ['TripAdvisor', 'Booking.com', 'Agoda', 'Expedia', 'Hostelworld', 'Hotels.com', 'Klook'],
    painPoints: [
      'International guest reviews in Japanese / Korean / Chinese — instant translation + culturally appropriate reply',
      '"AC was too loud" complaint — diagnostic reply that signals you\'ll fix it, not a generic "sorry to hear that"',
      'Five-star Booking.com review with specific staff name — warm thanks that mentions the staff member by name',
    ],
    founderNote: 'Bangkok hospitality is what I see every day — three review tabs open, four languages, the front desk pivoting between WhatsApp and Booking inbox. The Google leg works today; OTA integrations are the next quarter\'s priority.',
  },
  spas: {
    title: 'AI Google Review Replies for Spas, Salons & Wellness',
    pageTitle: 'AI review replies for spas & salons',
    eyebrow: 'For spas, salons & wellness studios',
    heroLine1: 'Reply between treatments —',
    heroLine2: 'in your tone, not a robot\'s.',
    sub: 'Massage spas, hair salons, yoga studios, and Muay Thai gyms live or die by Google reviews. Therapists are mid-treatment, owners are at the front desk. ReviewHub pings you on LINE with each draft in your voice — relaxed and warm for spa, sharper for fitness — tap to copy and paste in Google.',
    platformsLive: ['Google'],
    platformsComingSoon: ['Yelp', 'Booksy', 'Fresha', 'Mindbody', 'Facebook', 'Instagram (link-in-bio)', 'TripAdvisor'],
    painPoints: [
      'Five-star regular naming your therapist by name — warm thanks that mentions the therapist back, not a generic "we appreciate your visit"',
      'Three-star "the music was too loud" — empathetic acknowledgment + a specific change you\'ll make, not a defensive explanation',
      'One-star "double-booked, waited 40 minutes" — apology with a concrete fix (booking system change) and a private invite to come back',
    ],
    founderNote: 'Bangkok wellness studios were the second persona I wrote drafts for. The pattern: warm five-star reviews that need a named-therapist thank-you, mixed with the occasional "wait time" complaint that needs a specific fix, not a copy-paste.',
  },
  bars: {
    title: 'AI Google Review Replies for Bars & Pubs',
    pageTitle: 'AI review replies for bars & pubs',
    eyebrow: 'For bars, pubs & cocktail rooms',
    heroLine1: 'Reply between rounds —',
    heroLine2: 'in your room\'s tone, not a robot\'s.',
    sub: 'Bar reviews skew weird. Loud music, drunk regulars, fights at last call, the bartender everyone has a crush on. ReviewHub drafts replies in your bar\'s voice — sharp, warm, never corporate — so the response on Google reads like the room felt.',
    platformsLive: ['Google'],
    platformsComingSoon: ['Yelp', 'TripAdvisor', 'Facebook', 'Foursquare', 'Untappd', 'Beer Advocate'],
    painPoints: [
      '"The music was too loud" — empathetic acknowledgment without promising to lower it (your music is the bar\'s identity); offer a quieter night instead',
      '"Bartender flirted with me" — careful, professional reply; don\'t confirm or deny, invite private follow-up; do NOT throw the bartender under the bus publicly',
      'Five-star regular who names a specific cocktail and the bartender — warm, named-back thanks that signals you actually read it',
    ],
    founderNote: 'Bar owners I\'ve talked to argue with reviews in their head all night. The whole point of having a draft ready is so you can tap approve and go pour the next round instead.',
  },
  fitness: {
    title: 'AI Google Review Replies for Gyms, Yoga Studios & Muay Thai',
    pageTitle: 'AI review replies for fitness studios',
    eyebrow: 'For gyms, yoga studios, Muay Thai & pilates',
    heroLine1: 'Reply between classes —',
    heroLine2: 'sharp tone, not soft.',
    sub: 'Fitness studios live and die on reviews. Trainers are mid-class, owners are checking the front desk. ReviewHub drafts each reply in your studio\'s voice — sharper for Muay Thai and CrossFit, calmer for yoga and pilates — so the tone on Google matches the energy of the room.',
    platformsLive: ['Google'],
    platformsComingSoon: ['Yelp', 'Facebook', 'ClassPass', 'Mindbody', 'Booksy', 'GuavaPass', 'Instagram (link-in-bio)'],
    painPoints: [
      '"Trainer was too pushy" — empathetic acknowledgment, brief explanation of the studio\'s training philosophy without sounding defensive, offer to match them with a different trainer',
      'Five-star regular naming a coach by name — warm, mention the coach back; invites the coach to thank them too',
      'One-star "wasted my money on the membership" — empathy + concrete refund-or-credit policy, never a "we don\'t do refunds, sorry" deflection',
    ],
    founderNote: 'Multi-location Muay Thai gym owners were one of the personas the multi-business support was designed for. The Google-only leg works today across all your locations; ClassPass / Mindbody pull is on the roadmap.',
  },
  pharmacies: {
    title: 'AI Google Review Replies for Pharmacies & Drugstores',
    pageTitle: 'AI review replies for pharmacies',
    eyebrow: 'For independent pharmacies & drugstores',
    heroLine1: 'Reply with care,',
    heroLine2: 'never disclose what they bought.',
    sub: 'Pharmacy reviews are a privacy minefield. A patient mentions a medication; your reply must never confirm or deny they were a patient or what they were prescribed. ReviewHub drafts privacy-aware replies — empathetic, professional, and structured to avoid disclosure. We make no formal HIPAA-compliance claim; we provide the prompt framing, you sign off on every send.',
    platformsLive: ['Google'],
    platformsComingSoon: ['Yelp', 'Facebook', 'Healthgrades', 'TripAdvisor (tourist pharmacies)'],
    painPoints: [
      'Reviewer names a medication — reply must NOT confirm they purchased it or were a patient; redirect to private channel for any specifics',
      'One-star "wrong prescription filled" — empathy + invitation to call directly; never confirm whether a dispensing error occurred publicly',
      'Five-star regular thanking the pharmacist by name — warm, mention the pharmacist back; do NOT confirm the medication or condition',
    ],
    founderNote: 'Pharmacy reviews are the hardest writing exercise I work on. The prompt framework is privacy-first by default and you review every word — but it gets you to the right tone in seconds instead of minutes.',
  },
  cafes: {
    title: 'AI Google Review Replies for Cafés & Coffee Shops',
    pageTitle: 'AI review replies for cafés',
    eyebrow: 'For cafés & coffee shops',
    heroLine1: 'Reply between pours,',
    heroLine2: 'not at midnight.',
    sub: 'Cafés get reviewed faster than they get reviewed back. ReviewHub drafts each reply in your café\'s voice — warm but quick — so you can clear ten Google reviews in the time between two pour-overs. TripAdvisor, foodpanda, Grab integrations coming.',
    platformsLive: ['Google'],
    platformsComingSoon: ['TripAdvisor', 'Yelp', 'Foursquare', 'foodpanda', 'Grab Food', 'Facebook', 'Instagram'],
    painPoints: [
      '"Best flat white in Bangkok" — quick, warm thanks that doesn\'t feel templated; mention what they liked back',
      '"Music too loud / wifi too slow" — single-line empathy + a real fix (volume note to staff, wifi upgrade); no defensiveness',
      'Tourist review in a language you don\'t read — auto-translation, draft reply in their language so it lands properly',
    ],
    founderNote: 'A Chiang Mai café owner told me her review queue gets cleared at midnight or never. I wanted a tool that fits between two pour-overs, not between two emails.',
  },
};

export default function VerticalLanding({ vertical }) {
  const v = VERTICALS[vertical];
  // Fail loudly in dev if a route passes an unknown vertical
  if (!v) {
    throw new Error(`Unknown vertical: ${vertical}. Add it to VERTICALS in VerticalLanding.jsx.`);
  }

  usePageTitle(v.pageTitle);
  useSocialMeta({
    title: v.title,
    description: v.sub,
  });
  useServiceSchema(vertical, v);

  return (
    <div className="rh-design min-h-screen" style={{ background: 'var(--rh-paper, #fbf8f1)', color: 'var(--rh-ink, #1d242c)' }}>
      <MarketingNav />

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Editorial hero: eyebrow → serif headline → sub */}
        <div className="mb-12">
          <p
            className="text-[11px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            {v.eyebrow}
          </p>
          {/* Single H1 — line 2 gets italic teal via a span, NOT a second
              h1. Splitting across two h1s (the previous shape) was an
              SEO + accessibility violation (every page has one main
              heading, period). Same visual, valid semantics. */}
          <h1
            className="font-bold mb-6"
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--rh-ink, #1d242c)',
              // Mobile sweep 2026-05-17: was Tailwind text-5xl (48px hard);
              // long vertical hero lines like "Reply across every booking
              // platform from one inbox." overflowed the 375px viewport's
              // 335px content area. clamp scales down to 32px on phones.
              fontSize: 'clamp(32px, 7.5vw, 48px)',
            }}
          >
            {v.heroLine1}{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--rh-teal, #1e4d5e)', display: 'block' }}>
              {v.heroLine2}
            </span>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            {v.sub}
          </p>
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link
              to="/audit"
              className="inline-block px-5 py-3 rounded-lg font-semibold text-sm"
              style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
            >
              Get a free audit →
            </Link>
            <Link
              to="/pricing"
              className="inline-block px-5 py-3 rounded-lg font-semibold text-sm"
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: 'var(--rh-card)', color: 'var(--rh-ink, #1d242c)', textDecoration: 'none' }}
            >
              See pricing
            </Link>
          </div>
        </div>

        {/* Platforms — split into LIVE (Google only today) and
            COMING SOON (industry-relevant integrations on the roadmap).
            Keeps long-tail platform names visible for SEO without
            misrepresenting what we actually poll today. */}
        <section className="mb-12">
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-sage, #6b8e7a)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            ● Live now
          </p>
          <div className="flex flex-wrap gap-2 mb-5">
            {(v.platformsLive || []).map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(107,142,122,0.10)', border: '1px solid rgba(107,142,122,0.30)', color: 'var(--rh-ink, #1d242c)' }}
              >
                {p}
              </span>
            ))}
          </div>
          {(v.platformsComingSoon || []).length > 0 && (
            <>
              <p
                className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
                style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
              >
                ○ Coming soon
              </p>
              <div className="flex flex-wrap gap-2">
                {v.platformsComingSoon.map((p) => (
                  <span
                    key={p}
                    className="px-3 py-1.5 rounded-full text-sm"
                    style={{
                      background: 'var(--rh-card)',
                      border: '1px solid var(--rh-rule, #e8e3d6)',
                      color: 'var(--rh-ink-3, #8b939c)',
                      opacity: 0.75,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Real examples — three pain points specific to this vertical */}
        <section className="mb-12">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.015em' }}
          >
            Three replies you'd otherwise overthink
          </h2>
          <ul className="space-y-4">
            {v.painPoints.map((p, i) => (
              <li
                key={i}
                className="flex gap-4 p-4 rounded-lg"
                style={{ background: 'var(--rh-card)', border: '1px solid var(--rh-rule, #e8e3d6)' }}
              >
                <span
                  className="text-2xl font-bold flex-shrink-0"
                  style={{ fontFamily: 'Instrument Serif, Georgia, serif', color: 'var(--rh-teal, #1e4d5e)' }}
                >
                  {i + 1}
                </span>
                <p className="text-base leading-relaxed" style={{ color: 'var(--rh-ink, #1d242c)' }}>{p}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Founder note — replaces the previous testimonial block.
            We have 0 paying customers today; fabricating "beta customer"
            quotes was an FTC endorsement-guide problem. A first-person
            founder POV is honest, builds direct connection, and serves
            the same narrative purpose without the legal exposure. */}
        <section
          className="mb-12 p-6 rounded-lg"
          style={{ background: 'rgba(30, 77, 94, 0.04)', borderLeft: '3px solid var(--rh-teal, #1e4d5e)' }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ochre-deep, #a07d20)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            Founder note
          </p>
          <p
            className="text-xl leading-relaxed mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic' }}
          >
            {v.founderNote}
          </p>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            — Founder · <Link to="/about" style={{ color: 'inherit', textDecoration: 'underline' }}>about me</Link>
          </p>
        </section>

        {/* Final CTA */}
        <section className="text-center mb-8 py-8" style={{ borderTop: '1px solid var(--rh-rule, #e8e3d6)' }}>
          <h2
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            See your own audit before you sign up.
          </h2>
          <p className="text-base mb-6" style={{ color: 'var(--rh-ink-2, #4a525a)' }}>
            Submit your Google Business URL — we generate 10 reply drafts in your tone, free, no card.
          </p>
          <Link
            to="/audit"
            className="inline-block px-6 py-3 rounded-lg font-semibold text-base"
            style={{ background: 'var(--rh-teal, #1e4d5e)', color: '#fff', textDecoration: 'none' }}
          >
            Get my free audit →
          </Link>
        </section>

        {/* Footer link to other verticals — internal linking for SEO */}
        <section className="text-center">
          <p className="text-sm" style={{ color: 'var(--rh-ink-3, #8b939c)' }}>
            Different industry? See ReviewHub for{' '}
            {Object.keys(VERTICALS).filter(k => k !== vertical).map((k, i, arr) => (
              <span key={k}>
                <Link to={`/for-${k}`} style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontWeight: 600 }}>{k}</Link>
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
            {' · '}
            <Link to="/" style={{ color: 'var(--rh-teal-deep, #1e4d5e)', fontWeight: 600 }}>everyone else</Link>
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
