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
const VERTICALS = {
  restaurants: {
    title: 'AI Google Review Replies for Restaurants',
    pageTitle: 'AI review replies for restaurants',
    eyebrow: 'For restaurants',
    heroLine1: 'Reply to every review',
    heroLine2: 'between dinner shifts.',
    sub: 'Your guests rate the food on Google, TripAdvisor, and Wongnai while you\'re running the kitchen. ReviewHub drafts replies in your voice, you approve in 10 seconds.',
    platforms: ['Google', 'TripAdvisor', 'Yelp', 'Facebook', 'Wongnai (TH)', 'Tabelog (JP)', 'foodpanda', 'Grab Food'],
    painPoints: [
      'Slow service complaint at 9pm — reply needs to be empathetic, specific, and posted before they tell their friends',
      'Picture of a hair in pasta — flag for follow-up, draft an apology with a real callback (not a void coupon)',
      'Five-star regular who tags your sous chef by name — quick warm thanks that doesn\'t sound copy-pasted',
    ],
    quote: '"I used to skip reviews on Mondays because the queue was too painful. Now I clear 12 in 8 minutes."',
    quoteAttribution: '— Bangkok bistro owner, beta',
  },
  dentists: {
    title: 'AI Google Review Replies for Dental Clinics',
    pageTitle: 'AI review replies for dental clinics',
    eyebrow: 'For dental clinics',
    heroLine1: 'HIPAA-aware reply drafts',
    heroLine2: 'between patients.',
    sub: 'Patients leave reviews about specific procedures, costs, and staff. Replying without disclosing PHI is hard. ReviewHub drafts compliant replies — generic empathy + invitation to follow up privately, never confirming whether the reviewer was a patient.',
    platforms: ['Google', 'Yelp', 'Healthgrades', 'Facebook', 'RateMDs', 'Vitals', 'Zocdoc'],
    painPoints: [
      'Reviewer mentions a specific procedure — your reply must NOT confirm or deny they were a patient (PHI)',
      'One-star "they overcharged me" — empathy + offer to discuss billing privately, never the patient\'s actual chart',
      'Anxious patient who praises Dr. Pat\'s "calm hands" — warm reply that doesn\'t cross into testimonial-by-proxy',
    ],
    quote: '"The HIPAA-aware framing alone is worth the subscription. I stopped second-guessing every reply."',
    quoteAttribution: '— GP dentist, US',
  },
  hotels: {
    title: 'AI Google Review Replies for Hotels & B&Bs',
    pageTitle: 'AI review replies for hotels',
    eyebrow: 'For hotels & B&Bs',
    heroLine1: 'Reply across every booking',
    heroLine2: 'platform from one inbox.',
    sub: 'Hotels live on Google, Booking.com, Agoda, TripAdvisor, Hostelworld, and a dozen more. ReviewHub pulls them all into one dashboard, drafts replies in your voice and the guest\'s language, and tracks response rate per platform.',
    platforms: ['Google', 'TripAdvisor', 'Booking.com', 'Agoda', 'Expedia', 'Hostelworld', 'Hotels.com', 'Klook'],
    painPoints: [
      'International guest reviews in Japanese / Korean / Chinese — instant translation + culturally appropriate reply',
      '"AC was too loud" complaint — diagnostic reply that signals you\'ll fix it, not a generic "sorry to hear that"',
      'Five-star Booking.com review with specific staff name — warm thanks that mentions the staff member by name',
    ],
    quote: '"Replying in five languages used to mean five different copy-paste tabs. Now it\'s one click."',
    quoteAttribution: '— Phuket boutique hotel, beta',
  },
  spas: {
    title: 'AI Google Review Replies for Spas, Salons & Wellness',
    pageTitle: 'AI review replies for spas & salons',
    eyebrow: 'For spas, salons & wellness studios',
    heroLine1: 'Reply between treatments —',
    heroLine2: 'in your tone, not a robot\'s.',
    sub: 'Massage spas, hair salons, yoga studios, and Muay Thai gyms live or die by Google reviews. Therapists are mid-treatment, owners are at the front desk. ReviewHub drafts each reply in your voice — relaxed and warm for spa, sharper for fitness — and posts to Google when you approve.',
    platforms: ['Google', 'Yelp', 'Booksy', 'Fresha', 'Mindbody', 'Facebook', 'Instagram (link-in-bio)', 'TripAdvisor'],
    painPoints: [
      'Five-star regular naming your therapist by name — warm thanks that mentions the therapist back, not a generic "we appreciate your visit"',
      'Three-star "the music was too loud" — empathetic acknowledgment + a specific change you\'ll make, not a defensive explanation',
      'One-star "double-booked, waited 40 minutes" — apology with a concrete fix (booking system change) and a private invite to come back',
    ],
    quote: '"My front desk used to leave reviews unanswered for a week. Now they\'re replied to before the next session ends."',
    quoteAttribution: '— Bangkok wellness studio, beta',
  },
  cafes: {
    title: 'AI Google Review Replies for Cafés & Coffee Shops',
    pageTitle: 'AI review replies for cafés',
    eyebrow: 'For cafés & coffee shops',
    heroLine1: 'Reply between pours,',
    heroLine2: 'not at midnight.',
    sub: 'Cafés get reviewed faster than they get reviewed back. ReviewHub drafts each reply in your café\'s voice — warm but quick — so you can clear ten reviews in the time between two pour-overs. Works with Google, TripAdvisor, foodpanda, Grab, and the platforms tourists actually use.',
    platforms: ['Google', 'TripAdvisor', 'Yelp', 'Foursquare', 'foodpanda', 'Grab Food', 'Facebook', 'Instagram'],
    painPoints: [
      '"Best flat white in Bangkok" — quick, warm thanks that doesn\'t feel templated; mention what they liked back',
      '"Music too loud / wifi too slow" — single-line empathy + a real fix (volume note to staff, wifi upgrade); no defensiveness',
      'Tourist review in a language you don\'t read — auto-translation, draft reply in their language so it lands properly',
    ],
    quote: '"I run two locations. Used to mean two unread review queues. Now it\'s one inbox, ten seconds per reply."',
    quoteAttribution: '— independent café owner, Chiang Mai beta',
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
          <h1
            className="text-5xl font-bold mb-2"
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: 'var(--rh-ink, #1d242c)',
            }}
          >
            {v.heroLine1}
          </h1>
          <h1
            className="text-5xl font-bold mb-6"
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              fontStyle: 'italic',
              color: 'var(--rh-teal, #1e4d5e)',
            }}
          >
            {v.heroLine2}
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
              style={{ border: '1px solid var(--rh-rule, #e8e3d6)', background: '#fff', color: 'var(--rh-ink, #1d242c)', textDecoration: 'none' }}
            >
              See pricing
            </Link>
          </div>
        </div>

        {/* Platforms covered */}
        <section className="mb-12">
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-3 font-bold"
            style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            Platforms covered
          </p>
          <div className="flex flex-wrap gap-2">
            {v.platforms.map((p) => (
              <span
                key={p}
                className="px-3 py-1.5 rounded-full text-sm"
                style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
              >
                {p}
              </span>
            ))}
          </div>
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
                style={{ background: '#fff', border: '1px solid var(--rh-rule, #e8e3d6)' }}
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

        {/* Pull quote — beta customer */}
        <section
          className="mb-12 p-6 rounded-lg"
          style={{ background: 'rgba(30, 77, 94, 0.04)', borderLeft: '3px solid var(--rh-teal, #1e4d5e)' }}
        >
          <p
            className="text-xl leading-relaxed mb-3"
            style={{ fontFamily: 'Instrument Serif, Georgia, serif', fontStyle: 'italic' }}
          >
            {v.quote}
          </p>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--rh-ink-3, #8b939c)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
          >
            {v.quoteAttribution}
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
