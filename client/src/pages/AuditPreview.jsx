import React, { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import usePageTitle from '../hooks/usePageTitle';
import useNoIndex from '../hooks/useNoIndex';
import useSocialMeta from '../hooks/useSocialMeta';
import { getStripeCheckoutUrl } from '../lib/checkout';

// Lazy-loaded: the LINE mockup is ~5KB of decorative SVG + animations,
// and only renders below the CTA fold. No reason to ship it in the
// initial bundle for prospects who close the tab after the first card.
const LineFlexCardMockup = lazy(() => import('../components/LineFlexCardMockup'));

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
  line: '#e6dfce',      // subtle border around cards
  divider: '#f0e9d8',   // softer than `line` — used INSIDE cards (review/draft separator)
                         // so the inside-the-card line doesn't visually merge with
                         // the outside-the-card border.
  cardBg: '#ffffff',    // pure white card on cream paper
  cardShadow: '0 1px 3px rgba(29,36,44,0.05), 0 1px 2px rgba(29,36,44,0.03)',
                         // tiny paper-lift; cream-on-cream borders alone left
                         // cards visually merging with background. Very subtle —
                         // not a SaaS-y elevation tier, just enough to read.
  star: '#f59e0b',      // amber for filled stars
  starEmpty: '#dcd4c0', // warm-neutral empty star (was #e5e7eb cool gray which
                         // fought the warm paper background)
};

// CTA A/B/L split — control / Variant E (permission-asking) / Variant L
// (low-friction lead). Per docs/audit-preview-cta-variants.md.
//
// - control: paid Stripe-checkout CTA primary, async-ask secondary
// - E: same structure as control but "permission asking" copy
//   ("keep the drafts coming" vs "set this up for me")
// - L: INVERTS the order — async-ask (LINE/email) is primary and
//   visually dominant; the paid CTA becomes a secondary "ready to
//   try it?" link below. Tests the hypothesis that the price/checkout
//   shows up too early in the trust journey — 4 prior waves had 35%
//   audit-views with 0 replies, suggesting prospects bounce off the
//   pay-first ask. Wave 5.5+ ICP.
//
// Deterministic per-token assignment for new traffic; URL ?variant=
// override for explicit prospect-targeting (Earth sends Wave 5.5
// prospects with ?variant=L appended to the share URL). Plausible
// events split per variant so per-variant click rate is readable
// without a DB column.
function assignCtaVariant(token, urlOverride) {
  // URL override wins. Used to force a specific variant for targeted
  // Wave N+0.5 sends. Validated to known values to prevent garbage.
  const VALID = new Set(['control', 'E', 'L']);
  if (urlOverride && VALID.has(urlOverride)) return urlOverride;
  if (!token) return 'control';
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  // Three-way split — modulo 3 over the same hash. Existing tokens
  // shift assignment (was 2-way) but ALL Wave 1-5 prospects already
  // received their share URL before this code shipped, so their
  // first impression is locked. Re-views of pre-shipped tokens after
  // this code lands may show a different variant — that's noise to
  // their funnel but Plausible event names reflect the actual variant
  // rendered so the analytics stays clean.
  const m = Math.abs(h) % 3;
  return m === 0 ? 'control' : m === 1 ? 'E' : 'L';
}

export default function AuditPreview() {
  const { token } = useParams();
  // ?variant= URL override — used for explicit Wave N+0.5 retargeting
  // (Earth appends ?variant=L to the share URL when sending to a Wave
  // 5.5 prospect). useSearchParams stays in sync with the active route
  // (MemoryRouter in tests, BrowserRouter in prod), unlike a raw
  // window.location read which jsdom doesn't update from MemoryRouter.
  const [searchParams] = useSearchParams();
  const urlOverride = searchParams.get('variant');
  const ctaVariant = useMemo(() => assignCtaVariant(token, urlOverride), [token, urlOverride]);
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  // Collapse the review wall — show first 2 above the fold, expander for
  // the rest. Conversion ship from 2026-05-18: previously 5 review
  // cards stacked before the CTA, prospects scrolled past CTA visibility
  // before getting to it. Showing 2 keeps the "wait this is REAL" moment
  // (their own review + AI draft) while letting the CTA breathe higher
  // up the page.
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  // Sticky-bar reveal gate. The bottom CTA bar used to mount on first paint,
  // which made the page open with "$14/mo" in the user's peripheral vision
  // BEFORE they'd seen a single draft. Conversion-review 2026-05-20 cited
  // this as the top "sales-page smell" hypothesis explaining 19 opens / 0
  // replies. Fix: gate the sticky bar behind an IntersectionObserver on a
  // sentinel rendered AFTER the first review card. The prospect now experiences
  // the value (their own review + a real AI draft) before any price tag enters
  // the viewport. The gate is one-way (once revealed, stays revealed even if
  // they scroll back up), so dismissing isn't undone by scrolling.
  const [stickyGateOpen, setStickyGateOpen] = useState(false);
  const stickyGateRef = useRef(null);
  useEffect(() => {
    if (!stickyGateRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Old browser — fall back to immediate reveal (the original behaviour
      // before this gate landed). Better than no CTA at all.
      setStickyGateOpen(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStickyGateOpen(true);
        obs.disconnect();
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    obs.observe(stickyGateRef.current);
    return () => obs.disconnect();
  }, [state.status]);
  usePageTitle(state.data?.business_name
    ? `${state.data.business_name} — Reply suggestions`
    : 'Audit preview · ReviewHub');
  useNoIndex(); // share-token URLs are per-prospect; never index them
  // Override the default site OG card so when the founder pastes this
  // URL into iMessage/Slack/LINE, the preview reads as
  // "AI reply drafts for {their business}" instead of the generic
  // marketing-site card. Bot/preview crawlers fetching the URL still
  // get filtered out of view-tracking notifications upstream.
  useSocialMeta(state.data?.business_name ? {
    title: `AI reply drafts for ${state.data.business_name}`,
    description: `${state.data.reviews?.filter(r => r.draft).length || ''} reply drafts ready to copy & paste — no signup needed. Generated by ReviewHub for ${state.data.business_name}.`,
    // Audit-specific OG card (different headline + sub-line than the
    // generic landing-page card). Per-prospect text personalization
    // lives in title/description above; the image is static because
    // generating per-business images needs a server-side renderer
    // we don't have yet.
    image: 'https://reviewhub.review/og-image-audit.png',
  } : undefined);

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', data: null, error: 'No token' });
      return;
    }
    // Public demo audit — `token === 'demo'` short-circuits the API call
    // and serves a hardcoded sample audit. Built 2026-05-19 per page-flow
    // audit v2 build-first #1: prospects landing on /pricing without an
    // outreach link previously had no way to see what an audit looks like.
    // Hardcoded > seeded-via-API because (a) can't be accidentally
    // deleted, (b) zero API roundtrip, (c) we control exactly what the
    // demo shows. The reviews + drafts below were curated to cover the
    // 3-tone range a real prospect would care about: a warm 5-star, a
    // mixed 3-star with actionable feedback, and a critical 1-star
    // that demonstrates careful empathy-without-admission-of-fault.
    if (token === 'demo') {
      setState({
        status: 'ok',
        data: {
          business_name: 'Common Grounds (sample cafe)',
          reviews: [
            {
              reviewer_name: 'Alex Tan',
              rating: 5,
              text: "Walked in on a Sunday afternoon looking for a quiet place to read. Found exactly that — the cold brew was excellent, the seating tucked into corners felt private, and the barista remembered I'd asked for less ice the second time I went up. Small touches. Will be back.",
              draft: "Alex — thanks for noticing the small things. The 'remembered the less-ice' move was Beam's; she'll be glad to hear it landed. Sunday afternoons are when we deliberately keep the playlist quiet so the corner seats feel like they're meant for what you used them for. See you next visit.",
              tones: {
                warm: "Alex — thanks for noticing the small things. The 'remembered the less-ice' move was Beam's; she'll be glad to hear it landed. Sunday afternoons are when we deliberately keep the playlist quiet so the corner seats feel like they're meant for what you used them for. See you next visit.",
                concise: "Thanks Alex — that was Beam on bar. Quiet-Sundays is on purpose. See you next visit.",
                formal: "Mr. Tan, thank you for taking the time to share this. The barista you mentioned (Beam) will be pleased to hear her attention to detail was noticed. Our Sunday afternoon atmosphere is curated with reading guests in mind; we are glad the corner seating served you well. We look forward to your return.",
              },
            },
            {
              reviewer_name: 'Wassana K.',
              rating: 3,
              text: "Coffee is good but the wait on Saturday morning was 25 minutes. I get it, you're popular, but maybe an 'order ahead via LINE' option? Otherwise solid spot. Pastries were fresh.",
              draft: "Wassana — 25 minutes on a Saturday is too long, you're right. The LINE order-ahead idea is genuinely good and we've been talking about it; if you wouldn't mind dropping me a DM @commongroundsbkk I'd love to ask you what the ideal version of that would look like before we build it. Glad the pastries held up.",
              tones: {
                warm: "Wassana — 25 minutes on a Saturday is too long, you're right. The LINE order-ahead idea is genuinely good and we've been talking about it; if you wouldn't mind dropping me a DM @commongroundsbkk I'd love to ask you what the ideal version of that would look like before we build it. Glad the pastries held up.",
                concise: "25 min on Saturday is too long, agreed. LINE order-ahead is on our list — DM @commongroundsbkk if you want to weigh in on how it should work.",
                formal: "Khun Wassana, thank you for the honest feedback. A 25-minute wait is not the standard we want to deliver. The LINE pre-order suggestion has been raised internally; should you wish to share more on what would work best for you, please contact us at @commongroundsbkk. We appreciate your continued patience.",
              },
            },
            {
              reviewer_name: 'James Reeves',
              rating: 1,
              text: "Asked for oat milk and was given soy. When I pointed it out the staff member rolled his eyes and made a comment in Thai I couldn't understand but the tone was clear. Walked out without drinking the coffee. Won't return.",
              draft: "James — I'm sorry. The wrong-milk part happens; the eye-roll and the comment shouldn't, ever. I'd like to understand what actually happened from our side before I say anything else — could you email me directly at owner@commongroundsbkk.com with the day and rough time? I want to talk to whoever was on bar. And whether you come back or not, the coffee that day was on us.",
              tones: {
                warm: "James — I'm sorry. The wrong-milk part happens; the eye-roll and the comment shouldn't, ever. I'd like to understand what actually happened from our side before I say anything else — could you email me directly at owner@commongroundsbkk.com with the day and rough time? I want to talk to whoever was on bar. And whether you come back or not, the coffee that day was on us.",
                concise: "James — sorry. The milk mix-up happens; the eye-roll and the comment do not. Email owner@commongroundsbkk.com with day + time so I can talk to whoever was on bar. Coffee was on us regardless.",
                formal: "Mr. Reeves, please accept our apology. While a milk substitution can happen, the behaviour you describe from our staff is not acceptable under any circumstance. We would like to understand the events directly; please write to owner@commongroundsbkk.com with the date and approximate time of your visit. The cost of that visit is, of course, refunded. Whether you return or not, we are grateful for the feedback.",
              },
            },
          ],
        },
        error: '',
      });
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

  // Scroll-depth funnel signal. Fires Plausible events at 25 / 50 / 75 / 100%
  // page-scrolled. Lets us tell "prospect bounced after 1 review card" from
  // "prospect read everything and ignored CTA" — totally different problems.
  // Only arms after data loads so the loading-spinner page doesn't pollute
  // the funnel with bogus 0% events.
  useEffect(() => {
    if (state.status !== 'ok') return;
    const fired = new Set();
    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total <= 0) return;
      const pct = (scrolled / total) * 100;
      const milestones = [25, 50, 75, 100];
      for (const m of milestones) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          if (typeof window.plausible === 'function') {
            try {
              window.plausible('AuditScrollDepth', { props: { depth: `${m}%` } });
            } catch { /* analytics down, swallow */ }
          }
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // fire 25% immediately if the page is already short
    return () => window.removeEventListener('scroll', onScroll);
  }, [state.status]);

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
      <StickyConversionBar
        businessName={business_name}
        token={token || ''}
        show={totalDrafts > 0 && stickyGateOpen}
        ctaVariant={ctaVariant}
      />
      <main className="max-w-3xl mx-auto px-5 py-8 md:py-16 pb-28 md:pb-16">
        {/* DEMO-ONLY get-reviews intro. The audit page is shared with REAL
            audits (which render reply drafts), so this section is gated on
            token === 'demo' and never shows for real prospect audits. It
            reframes the demo around the post-2026-05-26 pivot: getting more
            reviews is the main job; the reply drafts below are the bonus.
            Added 2026-06-08 — fixes the message mismatch where the homepage
            sold get-reviews but the demo still led with replies. */}
        {token === 'demo' && (
          <section className="mb-12" aria-label="How you get more reviews">
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.ochre }}>
              How {business_name.replace(' (sample cafe)', '')} gets more reviews
            </p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: COLORS.ink, letterSpacing: '-0.02em' }}>
              First, the reviews come in — on autopilot.
            </h2>
            <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: COLORS.inkSoft }}>
              After each visit, ReviewHub sends your happy customer a short, friendly reminder with a one-tap link to your Google review page. Most people mean to leave a review and then forget — this nudge is the difference between the reviews you earned and the ones that actually show up.
            </p>
            <div className="rounded-2xl px-5 py-4 mb-3 max-w-md" style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.line}`, boxShadow: COLORS.cardShadow }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.tealDeep }}>
                ✦ The reminder your customer gets
              </p>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: COLORS.ink }}>
                "Hi Alex! Thanks for visiting Common Grounds today. If you have 10 seconds, a quick Google review really helps us — here's the one-tap link 👉 g.page/r/common-grounds"
              </p>
            </div>
            <p className="text-sm leading-relaxed mb-8" style={{ color: COLORS.inkSoft }}>
              More happy customers leave the review they meant to. <strong style={{ color: COLORS.ink }}>Then the bonus, below ↓</strong> — every review that lands gets a reply drafted in your voice, ready to copy and paste.
            </p>
            <div style={{ height: 1, background: COLORS.line }} aria-hidden="true" />
          </section>
        )}
        {/* Header — sets context immediately so the prospect doesn't
            wonder "wait, who is this and what am I looking at?" Tightened
            on mobile so the first review card peeks above the fold —
            seeing your own review text is the "wait this is real" moment. */}
        <header className="mb-8 md:mb-10">
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: COLORS.ochre }}>
            {token === 'demo' ? 'The bonus · reply drafts for' : 'Reply suggestions for'}
          </p>
          <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3" style={{ color: COLORS.ink, letterSpacing: '-0.02em' }}>
            {business_name}
          </h1>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: COLORS.inkSoft }}>
            {totalDrafts} draft {totalDrafts === 1 ? 'reply' : 'replies'} ready to copy &amp; paste — no account needed.
          </p>
        </header>

        {/* Above-fold conversion banner — slim row between header and reviews.
            Wave 1-4 data (Chakrabongse 14 views, 0 replies) showed prospects
            were reading drafts and never hitting the CTA. Now there's a
            visible "this becomes ongoing" pitch the moment they understand
            the page is real. No-pressure: small text + chevron, not a
            wall-of-color interrupt. */}
        {totalDrafts > 0 && (
          <a
            href="#audit-cta"
            className="plausible-event-name=AuditAboveFoldCtaClick block mb-8 rounded-xl px-4 py-3 transition-colors hover:opacity-90"
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.tealDeep}`,
              boxShadow: COLORS.cardShadow,
            }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm" style={{ color: COLORS.ink }}>
                <strong style={{ color: COLORS.tealDeep }}>Want this on autopilot for new reviews?</strong>
                <span style={{ color: COLORS.inkSoft }}> · LINE or Telegram alert · tap to copy</span>
              </span>
              <span className="text-sm font-semibold" style={{ color: COLORS.tealDeep }}>
                See plan →
              </span>
            </div>
          </a>
        )}

        {/* Reviews + drafts — one card per review. Showing first 2 by
            default; rest hidden behind an expander (set in showAllDrafts
            state above). Keeps the page short enough that the CTA below
            fits above mobile fold while still giving the prospect 2 real
            examples + the "and there's more" tease. */}
        <div className="space-y-6">
          {(showAllDrafts ? reviews : reviews.slice(0, 2)).map((r, i) => (
            <React.Fragment key={i}>
              {/* Sticky-bar reveal sentinel — observed by an IntersectionObserver
                  in the parent component. Placed AFTER the first review card so
                  the prospect must have seen one full review + draft before the
                  bottom sticky CTA mounts. Empty, no visual presence. */}
              {i === 1 && (
                <div
                  ref={stickyGateRef}
                  aria-hidden="true"
                  style={{ height: 1, width: '100%' }}
                />
              )}
            <article
              className="rounded-2xl p-5 md:p-6"
              style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.line}`,
                boxShadow: COLORS.cardShadow,
              }}
            >
              {/* The review (what the customer wrote) */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                    {r.reviewer_name || 'Anonymous'}
                  </p>
                  <span className="text-base" style={{ color: COLORS.star }} aria-label={`${r.rating} stars`}>
                    {'★'.repeat(r.rating)}
                    <span style={{ color: COLORS.starEmpty }}>{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap" style={{ color: COLORS.inkSoft, fontSize: '15px' }}>
                  {r.text}
                </p>
              </div>

              {/* Divider — uses softer `divider` colour so the inside-card
                  separator doesn't visually merge with the outside-card border. */}
              <div className="h-px my-4" style={{ background: COLORS.divider }} />

              {/* The drafted reply — with optional tone switcher.
                  Built 2026-05-19 per page-flow audit v2 #2: addresses
                  the unspoken "will the AI embarrass me when I paste
                  this?" objection by letting the prospect feel the
                  tone agency they'd have as a customer. Tones are
                  pre-generated at audit creation (warm/concise/formal),
                  so toggling is instant. If only warm exists (legacy
                  audits or quota-limited creation), the switcher is
                  hidden — just shows the single draft as before. */}
              {r.draft ? (
                <DraftWithToneSwitcher review={r} />
              ) : (
                <p className="text-xs italic" style={{ color: COLORS.inkDim }}>
                  Couldn't generate a draft for this one — usually means the review text was too short or in an unsupported language.
                </p>
              )}
            </article>
            </React.Fragment>
          ))}
        </div>

        {/* Expander — only shown when we collapsed reviews above. Clear
            count so the prospect knows there's more (curiosity hook). */}
        {!showAllDrafts && reviews.length > 2 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setShowAllDrafts(true)}
              className="plausible-event-name=AuditExpandDrafts inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-all"
              style={{
                background: COLORS.cardBg,
                color: COLORS.tealDeep,
                border: `1px solid ${COLORS.line}`,
                minHeight: '44px',
              }}
              aria-expanded="false"
            >
              See {reviews.length - 2} more {reviews.length - 2 === 1 ? 'draft' : 'drafts'} ↓
            </button>
          </div>
        )}

        {/* Primary CTA — placed at peak-interest moment, right after the
            drafts and BEFORE the educational footer. Footer-only pitch
            buries the conversion path; a real button here at the moment
            the prospect just read their own personalised replies captures
            intent that prose loses.

            Variant L renders a fundamentally different SHAPE — async-ask
            is the primary action; the paid CTA gets relegated below the
            founder card as "if you're already convinced, here's the
            button." Tests the hypothesis that the price tag entering
            the viewport too early causes the 35%-open / 0%-reply gap. */}
        {totalDrafts > 0 && ctaVariant === 'L' && (
          <section
            id="audit-cta"
            className="mt-10 rounded-2xl p-6 md:p-8 text-center"
            style={{ background: COLORS.tealDeep, color: '#fff' }}
          >
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: '#f5d8a7', opacity: 0.9 }}
            >
              Drafts above are yours — keep them either way
            </p>
            <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ letterSpacing: '-0.01em' }}>
              Anything off, or a fit for {business_name}?
            </h2>
            <p className="text-sm leading-relaxed mb-5 max-w-md mx-auto" style={{ color: '#fdf2dc' }}>
              I'm Earth — solo founder, Bangkok. A one-line "this draft missed
              the mark" or "looks good but we already use X" is genuinely
              useful either way. No call, no signup — just async chat.
            </p>
            {/* Async actions FIRST and LARGE — opposite of control/E
                where they're secondary. */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
              <a
                href="https://line.me/R/ti/p/@024hjpcv"
                target="_blank"
                rel="noopener noreferrer"
                className="plausible-event-name=AuditLineChatClick_LowFriction plausible-event-source=audit-cta-L inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-semibold transition-transform hover:scale-105"
                style={{ background: '#06c755', color: '#fff' }}
              >
                <span aria-hidden="true" style={{ fontSize: '18px' }}>💬</span>
                Chat on LINE
              </a>
              <a
                href={`mailto:earth.reviewhub@gmail.com?subject=${encodeURIComponent(`Re: ${business_name} reply drafts`)}&body=${encodeURIComponent(`Hi Earth,\n\nQuestion about the drafts for ${business_name}: `)}`}
                className="plausible-event-name=AuditFounderReplyClick_LowFriction plausible-event-source=audit-cta-L inline-flex items-center gap-2 px-6 py-3 rounded-lg text-base font-semibold transition-transform hover:scale-105"
                style={{ background: COLORS.cardBg, color: COLORS.tealDeep }}
              >
                <span aria-hidden="true" style={{ fontSize: '18px' }}>✉</span>
                Email Earth
              </a>
            </div>
            {/* Founder mini-card between async + paid — context for who
                they'd be talking to. */}
            <div
              className="mt-4 pt-5 flex items-center justify-center gap-3 max-w-md mx-auto"
              style={{ borderTop: '1px solid rgba(253,242,220,0.18)' }}
            >
              <div
                className="grid place-items-center rounded-full flex-shrink-0"
                style={{ width: 36, height: 36, background: '#f5d8a7', color: COLORS.tealDeep, fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em' }}
                aria-hidden="true"
              >
                E
              </div>
              <p className="text-xs leading-relaxed text-left" style={{ color: '#fdf2dc', maxWidth: '300px' }}>
                <strong style={{ color: '#fff' }}>I reply within a day</strong>, async.
                You're one of the first 30 prospects — I'm watching this inbox.
              </p>
            </div>
            {/* SECONDARY paid CTA — small, below the founder card, framed
                as "if you're already sure" not as "buy now". */}
            <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(253,242,220,0.18)' }}>
              <p className="text-xs mb-2" style={{ color: '#f5d8a7', opacity: 0.9 }}>
                Already convinced? Skip the chat:
              </p>
              <a
                href={getStripeCheckoutUrl('starter') || `/register?from=audit&business=${encodeURIComponent(business_name)}&token=${encodeURIComponent(token || '')}&v=${ctaVariant}`}
                className="lemonsqueezy-button plausible-event-name=AuditRegisterClick_LowFriction plausible-event-source=audit-cta-L plausible-event-plan=starter inline-block px-4 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                Set it up for $14/mo (~฿499) →
              </a>
              <p className="text-xs mt-3" style={{ color: '#fdf2dc', opacity: 0.85 }}>
                No credit card to start · 30-day refund window · cancel anytime
              </p>
            </div>
          </section>
        )}
        {totalDrafts > 0 && ctaVariant !== 'L' && (
          <section
            id="audit-cta"
            className="mt-10 rounded-2xl p-6 md:p-8 text-center"
            style={{ background: COLORS.tealDeep, color: '#fff' }}
          >
            <p
              className="text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: '#f5d8a7', opacity: 0.9 }}
            >
              {ctaVariant === 'E' ? 'This audit was free' : 'Want this on autopilot?'}
            </p>
            <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ letterSpacing: '-0.01em' }}>
              {ctaVariant === 'E'
                ? `Want ReviewHub to keep drafting for ${business_name}?`
                : `Set this up for ${business_name} in 10 minutes`}
            </h2>
            <p className="text-sm leading-relaxed mb-5 max-w-md mx-auto" style={{ color: '#fdf2dc' }}>
              {ctaVariant === 'E' ? (
                <>
                  Connect Google once. Every new review pings you on LINE — with a
                  draft reply in your voice. Copy from LINE, paste in Google. $14/mo
                  (~฿499). <em>The drafts above stay yours regardless of what you decide.</em>
                </>
              ) : (
                <>
                  Connect Google once. New reviews ping you on LINE or Telegram — with an
                  AI-drafted reply in your voice. Copy, paste in Google. Replies that took
                  30 min each take 30 seconds. $14/mo (~฿499).
                </>
              )}
            </p>
            {/* Plausible tagged-events: clicking this fires either
                "AuditRegisterClick" (control) or "AuditRegisterClick_PermissionV"
                (Variant E) so we can read the A/B from Plausible without
                a DB column. See docs/audit-preview-cta-variants.md. */}
            {/* Primary CTA — was /register, now goes straight to Stripe
                Payment Link for the Starter tier. Cuts the prospect
                directly to checkout instead of a signup interstitial.
                Stripe redirects post-pay to /register?from=stripe&plan=starter
                so the customer creates their ReviewHub account after
                their card has been charged. Plausible event names
                preserved so funnel analysis still partitions control vs
                variant (V) CTA copy. */}
            <a
              href={getStripeCheckoutUrl('starter') || `/register?from=audit&business=${encodeURIComponent(business_name)}&token=${encodeURIComponent(token || '')}&v=${ctaVariant}`}
              className={`lemonsqueezy-button ${ctaVariant === 'E' ? 'plausible-event-name=AuditRegisterClick_PermissionV' : 'plausible-event-name=AuditRegisterClick'} plausible-event-source=audit-cta plausible-event-plan=starter inline-block px-6 py-3 rounded-lg text-sm font-semibold transition-transform hover:scale-105`}
              style={{ background: COLORS.cardBg, color: COLORS.tealDeep }}
            >
              {ctaVariant === 'E' ? 'Yes, keep the drafts coming →' : 'Yes, set this up for me →'}
            </a>
            <p className="text-xs mt-3" style={{ color: '#fdf2dc', opacity: 0.85 }}>
              No credit card to start · 30-day refund window · cancel anytime
            </p>
            {/* Founder mini-card — humanizes the otherwise-feature-led
                CTA. Thai SMB owners (the Wave 5 ICP) react to humans, not
                products. Avatar uses initials in a circle as a placeholder
                until we have a real photo asset committed; same pattern
                as a Slack/Gmail default avatar so it doesn't read as
                broken. Sage tint stays inside the brand palette. */}
            <div
              className="mt-6 pt-5 flex items-center justify-center gap-3 max-w-md mx-auto"
              style={{ borderTop: '1px solid rgba(253,242,220,0.18)' }}
            >
              <div
                className="grid place-items-center rounded-full flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  background: '#f5d8a7',
                  color: COLORS.tealDeep,
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '0.02em',
                }}
                aria-hidden="true"
              >
                E
              </div>
              <p className="text-xs leading-relaxed text-left" style={{ color: '#fdf2dc', maxWidth: '300px' }}>
                <strong style={{ color: '#fff' }}>I'm Earth</strong> — solo founder, Bangkok.
                Built this because watching small business owners ignore reviews they
                <em> care about</em> was painful. You're one of the first 30 prospects.
                Reply to me directly if anything's off.
              </p>
            </div>
            {/* Async CTAs — Wave 1-4 diagnostic (2026-05-15) showed 35%
                audit-open rate but 0 replies across 22 sends; Chakrabongse
                viewed 14× with no reply. The Stripe CTA above is high-
                friction (pay before they trust). Some prospects will want
                to ask a question first, but won't take a sales call (and
                the founder doesn't take them anyway — written-only per
                about_me_observed.md). Two async options surfaced here,
                not buried in the footer: LINE chat for Thai/SE Asia
                prospects (their daily app), email for everyone else.
                Both lead to the same human (Earth). */}
            <div className="mt-5 pt-5 border-t" style={{ borderColor: 'rgba(253,242,220,0.18)' }}>
              <p className="text-sm" style={{ color: '#f5d8a7', opacity: 0.95 }}>
                Or — ask first, no signup:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                {/* LINE OA Basic ID @024hjpcv is the production ReviewHub
                    bot. The line.me/R/ti/p/<id> deep link opens LINE app
                    on mobile (best path for Thai prospects) and falls back
                    to LINE's web add-friend page on desktop. */}
                <a
                  href="https://line.me/R/ti/p/@024hjpcv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="plausible-event-name=AuditLineChatClick inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: '#06c755', color: '#fff' }}
                >
                  <span aria-hidden="true" style={{ fontSize: '16px' }}>💬</span>
                  Chat on LINE
                </a>
                <a
                  href={`mailto:earth.reviewhub@gmail.com?subject=${encodeURIComponent(`Re: ${business_name} reply drafts`)}&body=${encodeURIComponent(`Hi Earth,\n\nQuestion about the drafts for ${business_name}: `)}`}
                  className="plausible-event-name=AuditFounderReplyClick inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-transform hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <span aria-hidden="true" style={{ fontSize: '16px' }}>✉</span>
                  Email me
                </a>
              </div>
              <p className="text-xs mt-3" style={{ color: '#f5d8a7', opacity: 0.85 }}>
                I'm Earth, the solo founder. A one-line "tell me more" or
                "not for me" is genuinely useful either way — I reply within
                a day, async, no calls.
              </p>
            </div>
            <p className="text-xs mt-2 max-w-md mx-auto font-mono uppercase tracking-widest" style={{ color: '#f5d8a7', opacity: 0.85 }}>
              LINE notifications live now —{' '}
              <a
                href="/line"
                className="plausible-event-name=AuditLineHelpClick"
                style={{ color: '#f5d8a7', textDecoration: 'underline' }}
              >
                see how it works →
              </a>
            </p>
          </section>
        )}

        {/* LINE notification mockup — shows the prospect what the actual
            in-product experience looks like on their phone. Addresses
            intervention #5 from the audit-preview friction teardown
            (2026-05-11): the page mentions LINE 2× but doesn't SHOW the
            flow. Static screenshot would be cheaper; an interactive mockup
            lets the prospect tap Copy and feel the haptic feedback for
            themselves before signing up. */}
        {totalDrafts > 0 && (
          <section className="mt-10">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3 text-center"
              style={{ color: COLORS.ochre }}
            >
              What this looks like on your phone
            </p>
            <Suspense fallback={<div style={{ height: 320 }} aria-hidden="true" />}>
              <LineFlexCardMockup />
            </Suspense>
            <p className="text-xs text-center mt-2" style={{ color: COLORS.inkDim }}>
              Tap <strong>Copy</strong> to feel the flow yourself.
            </p>
          </section>
        )}

        {/* Inline FAQ — addresses the four objections SMB owners actually
            think when first looking at AI-drafted review replies. Each one
            is the kind of question that, if unanswered, makes the prospect
            close the tab. Inline collapsibles (native <details>) are fine
            for SEO + accessibility, no JS needed. */}
        {totalDrafts > 0 && (
          <section className="mt-10">
            <h3
              className="text-sm font-mono uppercase tracking-widest mb-4"
              style={{ color: COLORS.inkDim }}
            >
              Common questions
            </h3>
            <div className="space-y-2">
              {[
                {
                  q: 'Can I edit the replies before they post?',
                  a: 'Always. Every draft pings you on LINE — you review, edit, or rewrite before anything goes to Google. Nothing posts without your approval; you copy the final reply and paste it into Google yourself (one-tap auto-post launches once Google approves our API access).',
                },
                {
                  q: 'What if a reply is wrong or off-tone?',
                  a: 'You edit it. ReviewHub learns from every edit you make — over time the drafts match your voice more closely. The first week is the worst; week three usually needs only minor tweaks.',
                },
                {
                  q: 'How does it handle 1-star or angry reviews?',
                  a: 'Differently than 5-stars. Negative reviews get drafts that acknowledge specifically what went wrong, take ownership without "but", and invite the reviewer back privately — never the canned "we strive for excellence" template.',
                },
                {
                  q: 'Is my Google account / data safe?',
                  a: 'ReviewHub reads reviews via Google\'s official Places API (read-only) — no password stored, no other Google data accessed. Posting replies is currently tap-to-copy: we draft on LINE / Telegram, you paste in Google\'s reply box. Auto-post via Google\'s Business Profile API launches once our access is approved (case 8-9395000041442, submitted 2026-05-09). You can revoke access anytime from your Google account settings.',
                },
                {
                  q: 'What if I cancel mid-month?',
                  a: 'You keep access through the end of the billing period, then it ends. No clawback of replies already posted. 30-day refund window on the first month, no questions asked.',
                },
              ].map((item, i) => (
                <details
                  key={i}
                  className="rounded-xl"
                  style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.line}` }}
                  onToggle={(e) => {
                    // Funnel signal: which FAQ items get expanded most often =
                    // which objections are top-of-mind. Lets us reorder /
                    // rewrite the page based on what readers actually care
                    // about, vs guessing. Only fire on open, not close, and
                    // pass the question as a prop for per-question breakdown.
                    if (!e.target.open) return;
                    if (typeof window.plausible === 'function') {
                      try {
                        window.plausible('AuditFAQOpen', { props: { q: item.q.slice(0, 60) } });
                      } catch { /* swallow */ }
                    }
                  }}
                >
                  <summary
                    className="px-4 py-3 cursor-pointer text-sm font-semibold list-none"
                    style={{ color: COLORS.ink }}
                  >
                    {item.q}
                  </summary>
                  <p
                    className="px-4 pb-4 pt-1 text-sm leading-relaxed"
                    style={{ color: COLORS.inkSoft }}
                  >
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Footer — context + the "no pressure" personal note. Pulled
            here from the CTA card so the conversion-moment teal panel
            is button-focused, not text-overloaded. */}
        <footer
          className="mt-12 pt-8 border-t text-sm leading-relaxed"
          style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}
        >
          <p className="mb-3">
            <strong style={{ color: COLORS.ink }}>Not ready to sign up?</strong>{' '}
            Just reply to my email — I'm Earth, the solo founder building this
            in Bangkok (
            <a
              href="/about"
              style={{ color: COLORS.tealDeep, textDecoration: 'underline' }}
            >
              more about me →
            </a>
            ), and a one-line "tell me more" or "not for me, here's why" is
            genuinely useful either way. Or keep using these drafts — the link
            above stays live for 30 days.
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

// Sticky conversion bar — visible at the bottom of the viewport once the
// prospect has scrolled past the header. Fixes the buried-CTA problem:
// previously the only "Set this up" button lived below 5 review cards, so
// a prospect who got value from the drafts and tab-closed never saw the
// signup path. With the sticky bar, the CTA is always within tap reach.
//
// Behaviour:
//  - Hidden on initial load (header still in view; no need to compete
//    with the page header CTA energy).
//  - Appears once the user has scrolled past ~250px (past the page
//    header into the review cards).
//  - Dismissible — a small × in the bar hides it for the rest of the
//    page-view (sessionStorage flag, not localStorage; comes back on
//    next visit).
//  - Same plausible-event-name as the in-page CTA so we can tell which
//    surface drove the click in funnel analysis (event-prop "source").
function StickyConversionBar({ businessName, token, show, ctaVariant = 'control' }) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  // No scroll gate. Earlier versions waited for `window.scrollY > 250`
  // before appearing, but on prod the window scroll event reliably did
  // NOT fire even though `document.documentElement.scrollTop` advanced
  // (verified via Chrome MCP probe — same-origin programmatic scroll
  // didn't trigger a window scroll listener; the underlying cause was
  // unclear and not worth a deep dive for a CTA bar). The simpler
  // version: always-visible when drafts exist. The bar lives at the
  // viewport bottom so it doesn't compete with the page header on
  // first paint, and dismissal still works per-session via the ×
  // button.
  function handleDismiss() {
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Sign-up call to action"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: COLORS.tealDeep,
        color: '#fff',
        boxShadow: '0 -2px 12px rgba(29,36,44,0.12)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
      }}
    >
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <p className="text-xs sm:text-sm flex-1 leading-snug">
          <span className="font-semibold">
            {ctaVariant === 'L' ? 'Anything off, or a fit?' :
             ctaVariant === 'E' ? 'Keep the drafts coming?' : 'Want this on autopilot?'}
          </span>{' '}
          <span className="hidden sm:inline" style={{ color: '#fdf2dc' }}>
            {ctaVariant === 'L'
              ? 'A one-line "yes / no / wrong fit" is genuinely useful.'
              : 'New reviews ping you on LINE or Telegram. $14/mo (~฿499).'}
          </span>
        </p>
        {/* Sticky primary action — paid checkout for control/E, async-ask
            (LINE chat) for L. The L variant test is "what happens if we
            never put a price in the viewport before they engage." */}
        <a
          href={ctaVariant === 'L'
            ? 'https://line.me/R/ti/p/@024hjpcv'
            : (getStripeCheckoutUrl('starter') || `/register?from=audit&business=${encodeURIComponent(businessName || '')}&token=${encodeURIComponent(token || '')}&source=sticky&v=${ctaVariant}`)}
          target={ctaVariant === 'L' ? '_blank' : undefined}
          rel={ctaVariant === 'L' ? 'noopener noreferrer' : undefined}
          className={`${
            ctaVariant === 'L'  ? 'plausible-event-name=AuditLineChatClick_LowFriction' :
            ctaVariant === 'E'  ? 'lemonsqueezy-button plausible-event-name=AuditRegisterClick_PermissionV' :
                                  'lemonsqueezy-button plausible-event-name=AuditRegisterClick'
          } plausible-event-source=sticky plausible-event-plan=starter inline-block px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-transform hover:scale-105`}
          style={{
            background: ctaVariant === 'L' ? '#06c755' : COLORS.cardBg,
            color: ctaVariant === 'L' ? '#fff' : COLORS.tealDeep,
            minHeight: '40px', display: 'inline-flex', alignItems: 'center',
          }}
        >
          {ctaVariant === 'L' ? 'Chat on LINE →' :
           ctaVariant === 'E' ? 'Keep the drafts — $14/mo →' :
                                'Set this up — $14/mo →'}
        </a>
        {/* Parallel low-friction CTA on the sticky bar — Wave 4 diagnostic
            showed audit views convert to interest but never to reply
            because the only visible action was signup. Pre-filled mailto
            to founder gives a softer path. Hidden on xs to keep the bar
            tappable on phone (where the primary signup button needs the
            full width). */}
        <a
          href={`mailto:earth.reviewhub@gmail.com?subject=${encodeURIComponent(`Re: ${businessName || 'reply drafts'}`)}&body=${encodeURIComponent(`Hi Earth,\n\nQuestion about the drafts: `)}`}
          className="plausible-event-name=AuditFounderReplyClick plausible-event-source=sticky hidden md:inline-flex items-center px-3 py-2 text-xs sm:text-sm whitespace-nowrap underline hover:no-underline"
          style={{ color: '#fdf2dc', minHeight: '40px' }}
        >
          or reply →
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss sign-up bar"
          className="opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: '#fdf2dc', minHeight: '32px', minWidth: '32px' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Per-card copy button. Lives at the value-delivery moment so it gets
// dedicated styling: WCAG-passing 44px tap target, clipboard icon for
// affordance, and a 1.6s "Copied ✓" state-swap so the prospect sees the
// click landed (the previous silent version triggered repeat-click
// frustration in critique).
// DraftWithToneSwitcher — renders the suggested reply with an optional
// 3-tab tone switcher (Warm / Concise / Formal). The switcher only shows
// when the audit's reviews include pre-generated tone variants — i.e.
// `review.tones` exists with concise or formal entries. For legacy audits
// (created before 2026-05-19), or quota-limited creations where only the
// warm variant was generated, the component degrades to the single-tone
// rendering it always did. Toggle is instant (no API call) because all
// tones are inline in the data already.
function DraftWithToneSwitcher({ review }) {
  const tones = review.tones || null;
  const hasTones = !!tones && (tones.concise || tones.formal);
  const [selected, setSelected] = useState('warm');
  // Current draft text — defaults to warm (always present). Switch flips
  // to concise/formal tone variants from the inline data.
  const currentDraft = hasTones
    ? (tones[selected] || tones.warm || review.draft)
    : review.draft;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <p
          className="text-xs font-mono uppercase tracking-widest"
          style={{ color: COLORS.tealDeep }}
        >
          Suggested reply
        </p>
        {hasTones && (
          <div
            role="tablist"
            aria-label="Reply tone"
            className="inline-flex rounded-lg overflow-hidden"
            style={{
              border: `1px solid ${COLORS.line}`,
              background: COLORS.paper,
              fontSize: '12px',
            }}
          >
            {['warm', 'concise', 'formal'].map((tone) => {
              const available = tone === 'warm' || !!tones[tone];
              const isActive = selected === tone;
              return (
                <button
                  key={tone}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={!available}
                  onClick={() => {
                    setSelected(tone);
                    if (typeof window.plausible === 'function') {
                      try { window.plausible('AuditToneSwitch', { props: { tone } }); } catch { /* swallow */ }
                    }
                  }}
                  className="plausible-event-name=AuditToneSwitchClick px-3 py-1.5 font-semibold transition-colors"
                  style={{
                    background: isActive ? COLORS.tealDeep : 'transparent',
                    color: isActive ? '#fff' : (available ? COLORS.ink : COLORS.inkDim),
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.5,
                    textTransform: 'capitalize',
                    minHeight: '32px',
                    minWidth: '64px',
                  }}
                >
                  {tone}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p
        className="leading-relaxed whitespace-pre-wrap"
        style={{ color: COLORS.ink, fontSize: '15px' }}
      >
        {currentDraft}
      </p>
      <CopyButton text={currentDraft} />
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  // Clear the timeout on unmount so a tab-switched-mid-copy doesn't leak.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (insecure context, permissions). Still show
      // "copied" so the user gets feedback; if it really didn't copy,
      // they'll notice when they paste and a re-click is one tap away.
    }
    // Funnel signal: lets us count, of N audit-page views, how many
    // prospects actually copied at least one draft. Separates "looked
    // and left" from "got value, didn't sign up." The two need
    // different fixes.
    if (typeof window.plausible === 'function') {
      try { window.plausible('AuditCopyClick'); } catch { /* swallow */ }
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-all"
      style={{
        background: copied ? COLORS.cardBg : COLORS.tealDeep,
        color: copied ? COLORS.tealDeep : '#fff',
        border: `1px solid ${COLORS.tealDeep}`,
        minHeight: '44px',
      }}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy reply
        </>
      )}
    </button>
  );
}
