import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { isLoggedIn } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import api from '../lib/api';
import { getStripeCheckoutUrl } from '../lib/checkout';

// Pricing page — renders tier cards from /api/plans so the server is the
// source of truth. Adding a tier or changing a price is a server-only change.
// Language → default currency. Thai users get THB; everyone else USD.
// Overridable via the pill toggle on the page itself — stored in localStorage
// so it persists across sessions.
const LANG_CURRENCY = { th: 'THB' };
const CURRENCY_PREF_KEY = 'reviewhub_currency';
const CURRENCY_META = {
  USD: { symbol: '$', position: 'prefix' },
  THB: { symbol: '฿', position: 'prefix' },
};
// Waitlist email-capture for gated tiers (Pro / Business). Replaces the
// dead 'Coming soon' button with a real demand-signal instrument.
// Submits to POST /api/waitlist; shows inline success state on 200.
// Plausible event `WaitlistSignup` fires with the plan slug so we can
// see in funnel analysis: pricing pageviews -> Pro waitlist signups vs
// Business waitlist signups vs Stripe checkout clicks.
function WaitlistInput({ plan, lang }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'ok' | 'error'
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (state === 'loading' || state === 'ok') return;
    setState('loading');
    setError('');
    try {
      // Use raw fetch (not the auth-aware api client) — this is a
      // public endpoint and the prospect is not logged in. The auth
      // client would attach a session cookie that's harmless but adds
      // a needless preflight on some browsers.
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ email: email.trim(), plan, source: 'pricing' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || (lang === 'th' ? 'มีบางอย่างผิดพลาด ลองอีกครั้ง' : 'Something went wrong'));
        setState('error');
        return;
      }
      setState('ok');
      if (typeof window.plausible === 'function') {
        try { window.plausible('WaitlistSignup', { props: { plan } }); } catch { /* swallow */ }
      }
    } catch {
      setError(lang === 'th' ? 'เครือข่ายมีปัญหา ลองอีกครั้ง' : 'Network error');
      setState('error');
    }
  }

  if (state === 'ok') {
    return (
      <div
        className="rh-btn rh-btn-ghost"
        style={{
          justifyContent: 'center', width: '100%', cursor: 'default',
          background: 'color-mix(in oklab, var(--rh-sage) 12%, var(--rh-paper))',
          borderColor: 'color-mix(in oklab, var(--rh-sage) 35%, var(--rh-rule))',
          color: 'var(--rh-ink)',
          fontWeight: 600,
        }}
        role="status"
        aria-live="polite"
      >
        ✓ {lang === 'th' ? 'รออีเมลจากเรานะคะ' : "We'll email you when it launches"}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
        placeholder={lang === 'th' ? 'อีเมล' : 'your@email.com'}
        aria-label={lang === 'th' ? 'อีเมลสำหรับรอแพ็กเกจ' : 'Email for waitlist'}
        disabled={state === 'loading'}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--rh-rule)',
          fontSize: 14,
          background: 'var(--rh-paper, #fbf8f1)',
          color: 'var(--rh-ink)',
          minHeight: 42,
        }}
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="rh-btn rh-btn-ghost"
        style={{ justifyContent: 'center', width: '100%', cursor: state === 'loading' ? 'wait' : 'pointer', minHeight: 42 }}
      >
        {state === 'loading'
          ? (lang === 'th' ? 'กำลังบันทึก…' : 'Saving…')
          : (lang === 'th' ? 'แจ้งให้ทราบเมื่อเปิดใช้' : 'Notify me when it launches')}
      </button>
      {state === 'error' && error && (
        <div style={{ fontSize: 12, color: 'var(--rh-rose, #c2566c)' }} role="alert">
          {error}
        </div>
      )}
    </form>
  );
}

function formatPrice(n, currency, lang) {
  const m = CURRENCY_META[currency] || CURRENCY_META.USD;
  // Thai baht prices are whole numbers; USD might be whole. Use the user's
  // locale (was hardcoded 'en-US') so Thai readers see "฿1,234" with the
  // separators their OS uses, German users see "1.234", etc. Fall back to
  // 'en-US' when lang isn't supplied so existing callers don't break.
  const rounded = Math.round(n * 100) / 100;
  const body = rounded.toLocaleString(lang || 'en-US', { maximumFractionDigits: 2 });
  return m.position === 'prefix' ? `${m.symbol}${body}` : `${body}${m.symbol}`;
}

export default function Pricing() {
  const { t, lang } = useI18n();
  usePageTitle(t('page.pricing'));
  const loggedIn = isLoggedIn();
  const toast = useToast();
  const [cycle, setCycle] = useState('monthly');
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(false);
  const [currency, setCurrency] = useState(() => {
    const stored = localStorage.getItem(CURRENCY_PREF_KEY);
    if (stored && CURRENCY_META[stored]) return stored;
    return LANG_CURRENCY[lang] || 'USD';
  });
  function chooseCurrency(c) {
    localStorage.setItem(CURRENCY_PREF_KEY, c);
    setCurrency(c);
  }

  // Inject Product+Offer JSON-LD when plans load. Lets Google show the
  // pricing page as a rich result with starting price; helps capture
  // bottom-of-funnel "reviewhub price" / "reviewhub starter cost" queries.
  useEffect(() => {
    if (!plans || !plans.length) return;
    // Exclude coming_soon plans from structured data — Google rich
    // results would otherwise advertise them as 'InStock' offers that
    // we cannot fulfil, which is misleading at best and a search-policy
    // violation at worst (false advertising of availability).
    const offers = plans
      .filter(p => p.id !== 'free' && !p.coming_soon)
      .map(p => ({
        '@type': 'Offer',
        'name': p.name,
        'price': String(p.priceMonthlyUsd ?? 0),
        'priceCurrency': 'USD',
        'availability': 'https://schema.org/InStock',
        'url': 'https://reviewhub.review/pricing',
      }));
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': 'ReviewHub',
      'description': 'AI review reply tool for local businesses. Drafts replies for every Google review in 10 seconds.',
      'image': 'https://reviewhub.review/og-image.png',
      'url': 'https://reviewhub.review/pricing',
      'brand': { '@type': 'Brand', 'name': 'ReviewHub' },
      'offers': {
        '@type': 'AggregateOffer',
        'lowPrice': '14',
        'highPrice': '59',
        'priceCurrency': 'USD',
        'offerCount': offers.length,
        'offers': offers,
      },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch { /* removed elsewhere */ } };
  }, [plans]);

  // Surface cancel-checkout redirect. LS bounces back to /pricing?checkout=cancelled
  // when the user closes the hosted checkout without paying.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('checkout') === 'cancelled') {
      toast(t('pricing.checkoutCancelled'), 'info');
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
    }
  }, [t, toast]);

  useEffect(() => {
    let cancelled = false;
    api.get('/plans')
      .then(({ data }) => { if (!cancelled) setPlans(data.plans || []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  // Fetch the user's current plan (logged-in only) so we can mark the
  // matching card as "Current plan" instead of showing a misleading
  // "Upgrade" CTA on the plan they're already on.
  // Track BOTH plan + status. A cancelled subscription still has
  // subscription.plan === 'pro' (or whatever), but the user no longer
  // has access — they should be able to RE-subscribe to that plan via
  // a fresh Stripe checkout. So 'current' means active, not historical.
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [currentPlanStatus, setCurrentPlanStatus] = useState(null);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setCurrentPlanId(data.subscription?.plan || 'free');
        setCurrentPlanStatus(data.subscription?.status || null);
      })
      .catch(() => { /* silent — fall back to default copy */ });
    return () => { cancelled = true; };
  }, [loggedIn]);
  // Effective plan for "Current plan ✓" badging. Cancelled/past_due/
  // unpaid subscriptions are treated as 'free' so the user can click
  // their old tier and resubscribe via Stripe.
  const hasActivePlan = currentPlanStatus === 'active';
  const effectiveCurrentPlanId = hasActivePlan ? currentPlanId : 'free';

  const faqs = [
    { q: t('pricing.faq1q'), a: t('pricing.faq1a') },
    { q: t('pricing.faq2q'), a: t('pricing.faq2a') },
    { q: t('pricing.faq3q'), a: t('pricing.faq3a') },
    { q: t('pricing.faq4q'), a: t('pricing.faq4a') },
  ];

  // Feature key → display label. Keys match server's plans.js features bag.
  const featureLabels = {
    ai_drafts: t('pricing.feature.ai_drafts'),
    email_alerts_new: t('pricing.feature.email_alerts_new'),
    email_alerts_negative: t('pricing.feature.email_alerts_negative'),
    weekly_digest: t('pricing.feature.weekly_digest'),
    csv_export: t('pricing.feature.csv_export'),
    templates: t('pricing.feature.templates'),
    trend_analytics: t('pricing.feature.trend_analytics'),
    multi_location: t('pricing.feature.multi_location'),
    priority_support: t('pricing.feature.priority_support'),
    api_access: t('pricing.feature.api_access'),
  };

  return (
    <div className="rh-design rh-pricing-page min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-[color:var(--rh-paper)] focus:text-[color:var(--rh-teal)] focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      {/* When the user is logged in (e.g. clicked Pricing from the dashboard
          to upgrade), show the in-app Navbar — the marketing nav has
          "Sign in" / "Start free" CTAs which are nonsense to an authed
          user and create a "did I just get logged out?" moment. The
          Pricing page below adapts its CTAs the same way (loggedIn ?
          Upgrade : Start free) — this keeps the chrome consistent. */}
      {loggedIn ? <Navbar /> : <MarketingNav />}

      <main id="main-content">
        {/* Editorial header — cream paper backdrop, big serif headline */}
        <section className="rh-pricing-hero" aria-label="Pricing overview">
          <div className="rh-hero-bg" />
          <div className="rh-hero-grid" />
          <div className="rh-shell rh-pricing-hero-inner">
            {/* Editorial "04" numeral removed (read as a notification count).
                Stacked layout overrides the .rh-section-head 2-column grid
                — without the big serif numeral in column 1 the grid left
                an awkward empty 220px gutter and the headline drifted right.
                Inline grid-template-columns: 1fr forces a single-column
                stack so kicker + h1 sit naturally above the controls. */}
            <div className="rh-section-head" style={{ marginBottom: 32, gridTemplateColumns: '1fr', gap: 16, alignItems: 'flex-start' }}>
              <div className="kicker">
                <div className="cat">§ Pricing</div>
              </div>
              <h1 style={{
                color: 'var(--rh-ink)',
                fontFamily: 'var(--rh-serif)',
                fontWeight: 400,
                // Mobile floor lowered from 40px -> 28px (2026-05-17 mobile
                // sweep). At 375px viewport "Simple, honest pricing" rendered
                // at 40px overflowed the 335px content width by ~140px and
                // got clipped at the right edge. 28px fits cleanly.
                fontSize: 'clamp(28px, 7vw, 72px)',
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                margin: 0,
                maxWidth: '22ch',
                textWrap: 'balance',
              }}>
                {t('pricing.headline').split(/[—.]/, 1)[0] || t('pricing.headline')}<em style={{ color: 'var(--rh-sage)', fontStyle: 'italic' }}>.</em>
              </h1>
            </div>
            <p className="rh-lede" style={{ maxWidth: '60ch' }}>{t('pricing.subheadline')}</p>

            {/* Monthly / annual + currency toggles, restyled */}
            <div className="rh-pricing-controls">
              <div role="radiogroup" aria-label={t('billing.cycle')} className="rh-seg">
                <button
                  type="button" role="radio" aria-checked={cycle === 'monthly'}
                  onClick={() => setCycle('monthly')}
                  className={cycle === 'monthly' ? 'on' : ''}
                >{t('billing.monthly')}</button>
                <button
                  type="button" role="radio" aria-checked={cycle === 'annual'}
                  onClick={() => setCycle('annual')}
                  className={cycle === 'annual' ? 'on' : ''}
                >{t('billing.annual')} <span style={{ color: 'var(--rh-sage)', marginLeft: 6, fontWeight: 500 }}>−20%</span></button>
              </div>
              <div role="radiogroup" aria-label={t('pricing.currency')} className="rh-seg">
                {['USD', 'THB'].map((c) => (
                  <button
                    type="button" key={c} role="radio" aria-checked={currency === c}
                    onClick={() => chooseCurrency(c)}
                    className={currency === c ? 'on' : ''}
                  >{c}</button>
                ))}
              </div>
            </div>
            {/* THB pricing affordance — checkout is via LemonSqueezy (the
                Merchant of Record), which collects + remits Thai VAT 7% on
                our behalf. PromptPay deliberately not listed: it's a Thai
                bank rail with no MoR coverage, which would put VAT
                compliance back on us — defeats the point of LS. */}
            {currency === 'THB' && (
              <p style={{
                marginTop: 18,
                fontFamily: 'var(--rh-mono)',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--rh-ink-3)',
              }}>
                <span style={{ color: 'var(--rh-ochre-deep)' }}>฿ Thai pricing.</span>{' '}
                Card checkout via secure global processor. Thai VAT 7% included.
              </p>
            )}
            {currency === 'USD' && (
              <p style={{
                marginTop: 18,
                fontFamily: 'var(--rh-mono)',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--rh-ink-3)',
              }}>
                {t('pricing.usdNote', 'Prices in USD. Your card is charged in your local currency at your bank\'s rate; any local VAT/sales tax is calculated at checkout.')}
              </p>
            )}
          </div>
        </section>

        {/* Plan grid */}
        <section className="rh-pricing-grid-wrap" aria-label="Plan comparison">
          <div className="rh-shell">
            {error ? (
              <div className="rh-pricing-loadstate">{t('pricing.loadError')}</div>
            ) : !plans ? (
              <div className="rh-pricing-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rh-pricing-card skeleton">
                    <div className="sk-line w-half" />
                    <div className="sk-line w-third tall" />
                    <div className="sk-line" /><div className="sk-line" /><div className="sk-line" /><div className="sk-line" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rh-pricing-grid">
                {plans.map((plan) => {
                  const priceMonthly = currency === 'THB' ? plan.priceMonthlyThb : plan.priceMonthlyUsd;
                  const priceAnnual = currency === 'THB' ? plan.priceAnnualThb : plan.priceAnnualUsd;
                  const price = cycle === 'annual' ? priceAnnual : priceMonthly;
                  const perUnit = cycle === 'annual' ? t('billing.perYear') : t('billing.perMonth');
                  const isFree = plan.id === 'free';
                  // Starter is the featured tier (changed 2026-05-12). Cold
                  // outreach surfaces all advertise $14 Starter; landing +
                  // pricing now match to avoid bait-and-switch when a
                  // prospect clicks through.
                  const highlighted = plan.id === 'starter';
                  const activeFeatures = Object.entries(plan.features).filter(([, v]) => v);
                  // Visually de-emphasise the Free card when the user is
                  // on a paid plan. Treating Free as a peer of Starter/
                  // Pro/Business creates a false-equivalence — Free is an
                  // EXIT not a lateral choice. Greyed-out card + muted CTA
                  // signals "this is an off-ramp, not a tier you upgrade
                  // toward." Active OR cancelled paid history both count
                  // — we don't want a cancelled-Pro user clicking Free
                  // and thinking they're recovering value.
                  const isDowngradeFromPaid = isFree && loggedIn
                    && currentPlanId && currentPlanId !== 'free';
                  // Server-flagged coming-soon plan (Pro / Business as of
                  // 2026-05-16). Card stays visible for price-anchoring
                  // but loses Stripe CTA + gets the muted treatment +
                  // shows a 'Coming soon' chip. Flip back by removing the
                  // coming_soon field from plans.js once features ship.
                  const isComingSoon = !!plan.coming_soon;
                  // Don't mute the user's actually-active plan even if
                  // it's coming-soon (grandfathered Pro user scenario —
                  // they'd see their active subscription greyed out).
                  // Same logic for downgrade — though Free can never be
                  // both 'current' and 'downgrade'.
                  const isCurrentForMuteCheck = loggedIn
                    && hasActivePlan
                    && currentPlanId === plan.id;
                  const isMuted = (isDowngradeFromPaid || isComingSoon)
                    && !isCurrentForMuteCheck;
                  return (
                    <div
                      key={plan.id}
                      className={'rh-pricing-card' + (highlighted && !isComingSoon ? ' featured' : '') + (isMuted ? ' rh-pricing-card--muted' : '')}
                      style={isMuted
                        ? { opacity: 0.55, filter: 'saturate(0.5)' }
                        : undefined}
                    >
                      {isComingSoon && !isCurrentForMuteCheck && (
                        <span
                          style={{
                            position: 'absolute', top: 12, right: 12,
                            fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            padding: '2px 8px', borderRadius: 999,
                            background: 'rgba(160,125,32,0.15)',
                            color: 'var(--rh-ochre-deep, #a07d20)',
                            border: '1px solid rgba(160,125,32,0.30)',
                            // Mobile sweep safety: prevent chip from
                            // overflowing card edge at narrow widths.
                            maxWidth: 'calc(100% - 24px)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {lang === 'th' ? 'เร็วๆ นี้' : 'Coming soon'}
                        </span>
                      )}
                      {highlighted && <span className="badge">{t('pricing.badge')}</span>}
                      <h2 className="plan-name">{plan.name}</h2>
                      <p className="plan-sub">{t(`pricing.${plan.id}Desc`, plan.description)}</p>
                      <div className="plan-price">
                        {isFree ? t('pricing.freePrice') : formatPrice(price, currency, lang)}
                        {!isFree && <small>{perUnit}</small>}
                      </div>
                      {!isFree && cycle === 'annual' && priceMonthly > 0 && (
                        <p className="plan-effective">
                          ≈ {formatPrice(Math.round((priceAnnual / 12) * 100) / 100, currency, lang)}/mo
                        </p>
                      )}
                      <p className="plan-meta">
                        {t('pricing.platformsCount', { n: plan.maxPlatforms })}
                        {plan.maxAiDraftsPerMonth !== null
                          ? ` · ${t('pricing.aiDraftsLimited', { n: plan.maxAiDraftsPerMonth })}`
                          : ` · ${t('pricing.aiDraftsUnlimited')}`}
                      </p>

                      <ul aria-label={t('pricing.featuresListAria')}>
                        {activeFeatures.map(([key]) => (
                          <li key={key}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5L13 4" /></svg>
                            {featureLabels[key] || key}
                          </li>
                        ))}
                      </ul>

                      {(() => {
                        const isCurrent = loggedIn && effectiveCurrentPlanId === plan.id;
                        // 'Resubscribe' instead of 'Get started' when the
                        // user previously subscribed to this exact plan
                        // and then cancelled. Reads more accurately for
                        // them ("oh right, I had this before") and
                        // separates the funnel signal: resub vs first-buy.
                        const wasPreviousPlan = loggedIn && !hasActivePlan && currentPlanId === plan.id;
                        // Current plan → disabled "Current plan ✓" button that
                        // routes to Settings (where they can manage billing /
                        // change plan via the LS portal). Other plans → upgrade/
                        // start CTA. Removes the "Upgrade to Starter" copy that
                        // appeared even when the user was already on Starter.
                        if (isCurrent) {
                          return (
                            <Link
                              to="/settings"
                              className={'rh-btn rh-btn-ghost'}
                              style={{ justifyContent: 'center', width: '100%', opacity: 0.85 }}
                              aria-current="true"
                            >
                              {t('pricing.ctaCurrentPlan', 'Current plan ✓')}
                            </Link>
                          );
                        }
                        // Coming-soon plans render a real email-capture
                        // waitlist instead of a dead 'Coming soon' button.
                        // Strategic audit ship 2026-05-19 (option 2b):
                        // converts dead pricing real-estate into a
                        // demand-signal research instrument. If 5+ people
                        // sign up for a tier over 30 days, that's the
                        // validation needed to build it. 0 signups = kill
                        // the tier with confidence.
                        if (isComingSoon) {
                          return <WaitlistInput plan={plan.id} lang={lang} />;
                        }
                        // Any non-current paid tier → Stripe Payment Link.
                        // Works for logged-out prospects AND logged-in
                        // users (existing customers can upgrade/downgrade
                        // or resubscribe after a cancellation). Falls back
                        // to /register for the free tier and for any plan
                        // id we haven't mapped to a Stripe URL. Manual
                        // provisioning era — Stripe webhook isn't wired,
                        // so double-subscribes can theoretically happen
                        // (we'll refund + reconcile manually if so).
                        const stripeUrl = !isFree
                          ? getStripeCheckoutUrl(plan.id)
                          : null;
                        // CTA copy: 'Current plan' only when actually
                        // current. For logged-in users on a paid plan
                        // viewing the Free card, show 'Downgrade to free'.
                        // For logged-in users with cancelled subs, show
                        // 'Resubscribe' so the action reads right.
                        let ctaLabel;
                        if (isFree) {
                          // For paying users, "Downgrade to free" reads as
                          // an exit ramp, not a feature. Route to /settings
                          // (where the cancel/downgrade flow lives) rather
                          // than /register, and use lighter copy that
                          // matches the subordinate visual treatment.
                          ctaLabel = isDowngradeFromPaid
                            ? t('pricing.ctaManagePlan', 'Manage plan in settings →')
                            : (loggedIn
                                ? t('pricing.ctaDowngradeFree', 'Downgrade to free')
                                : t('pricing.ctaFree'));
                        } else if (wasPreviousPlan) {
                          ctaLabel = t('pricing.ctaResubscribe', 'Resubscribe');
                        } else {
                          ctaLabel = loggedIn
                            ? t('pricing.ctaUpgrade')
                            : t('pricing.ctaStart');
                        }
                        const ctaClassName = 'rh-btn ' + (highlighted ? 'rh-btn-amber' : 'rh-btn-ghost');
                        const ctaStyle = { justifyContent: 'center', width: '100%' };
                        if (stripeUrl) {
                          // Plain <a> (not React Router Link) because the
                          // destination is an external Stripe-hosted URL.
                          // Plausible custom-event lets us measure which
                          // tier the prospect clicked from pricing vs the
                          // audit page CTA in funnel analysis.
                          return (
                            <a
                              href={stripeUrl}
                              className={ctaClassName + ` plausible-event-name=PricingCheckoutClick plausible-event-plan=${plan.id}`}
                              style={ctaStyle}
                            >
                              {ctaLabel}
                            </a>
                          );
                        }
                        return (
                          <Link
                            to={loggedIn ? '/settings' : '/register'}
                            className={ctaClassName}
                            style={ctaStyle}
                          >
                            {ctaLabel}
                          </Link>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="rh-pricing-foot rh-mono">{t('billing.processorNote')}</p>
          </div>
        </section>

        {/* Pricing in context — anchor block. $14 looks cheap or expensive
            depending on what you compare it against. We compare against
            the three alternatives an SMB owner already considers: doing
            it themselves, hiring a VA, or going with a managed agency.
            Numbers are conservative and defensible (no fake "save $5k!"
            claims). Inline EN/TH so we don't add 10 translation keys for
            one block. */}
        <section className="rh-section" aria-label="Pricing in context" style={{ paddingTop: 0 }}>
          <div className="rh-shell" style={{ maxWidth: 920 }}>
            <div className="rh-section-head" style={{ marginBottom: 24 }}>
              <div className="kicker">
                <div className="num">04</div>
                <div className="cat">§ {lang === 'th' ? 'เปรียบเทียบราคา' : 'Pricing in context'}</div>
              </div>
              <h2
                lang={lang === 'th' ? 'th' : 'en'}
                style={{
                  fontFamily: 'var(--rh-serif)', fontWeight: 400,
                  fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1,
                  letterSpacing: '-0.02em', margin: 0, maxWidth: '24ch',
                }}
              >
                {lang === 'th' ? (
                  <>
                    {/* Thai: split into two natural clauses with an explicit
                        break to prevent the browser from breaking mid-phrase
                        (between เทียบ and กับ). CSS word-break:keep-all only
                        covers CJK, not Thai, so we control the break manually. */}
                    <span style={{ whiteSpace: 'nowrap' }}>$14/เดือน</span>
                    {' '}
                    <span style={{ whiteSpace: 'nowrap' }}>เทียบกับทางเลือกอื่น</span>
                  </>
                ) : '$14/mo vs. the alternatives.'}
              </h2>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {[
                {
                  label: lang === 'th' ? 'จ้าง VA / ฟรีแลนซ์' : 'Hire a VA / freelancer',
                  cost: lang === 'th' ? '$200–500/เดือน' : '$200–500/mo',
                  tradeoff: lang === 'th'
                    ? 'จ่ายตามชั่วโมง · ตอนกลางคืนต้องรอ · ไม่รู้โทนของคุณ'
                    : 'Hourly billing · sleeps when you need them · doesn\'t know your tone',
                },
                {
                  label: lang === 'th' ? 'จ้างเอเจนซี่จัดการรีวิว' : 'Managed-review agency',
                  cost: lang === 'th' ? '$300–800/เดือน' : '$300–800/mo',
                  tradeoff: lang === 'th'
                    ? 'สัญญารายปี · ใช้เทมเพลตทั่วไป · รอ 24–48 ชม. ก่อนตอบ'
                    : 'Annual contracts · generic templates · 24-48h reply turnaround',
                },
                {
                  label: lang === 'th' ? 'ทำเองทั้งหมด (ฟรี)' : 'Do it all yourself (free)',
                  cost: lang === 'th' ? '~3 ชม./สัปดาห์' : '~3 hrs/week',
                  tradeoff: lang === 'th'
                    ? 'ที่ $30/ชม. คือ ~$360/เดือน · เป็นงานที่หยุดไม่ได้และเลื่อนไม่ได้'
                    : 'At $30/hr = ~$360/mo of your time · the work you can\'t skip but can\'t delegate',
                },
                {
                  // ChatGPT-clipboard is the real silent competitor — most
                  // owners considering AI drafting would default to this.
                  // Naming it explicitly + showing the friction (manual
                  // copy-paste each time, no ambient trigger, no voice
                  // memory across sessions) is the honest answer to
                  // "why pay $14 when ChatGPT is $20 and does the same."
                  label: lang === 'th' ? 'ChatGPT + clipboard ด้วยตัวเอง' : 'ChatGPT + clipboard yourself',
                  cost: lang === 'th' ? '$20/เดือน + เวลา' : '$20/mo + your time',
                  tradeoff: lang === 'th'
                    ? 'ต้องเปิด ChatGPT ทุกครั้ง · เริ่ม prompt ใหม่ทุกที · ไม่จำโทนคุณ · ไม่รู้ว่ามีรีวิวใหม่จนเปิด Maps'
                    : 'Open ChatGPT each time · re-prompt every reply · doesn\'t remember your tone · doesn\'t know when a new review lands',
                },
                {
                  label: 'ReviewHub',
                  cost: lang === 'th' ? '$14/เดือน' : '$14/mo',
                  tradeoff: lang === 'th'
                    ? 'ไม่มีสัญญา · ตอบใน 30 วินาทีผ่าน LINE · เรียนรู้โทนคุณจากการแก้แต่ละครั้ง'
                    : 'No contract · 30-second tap-to-copy from LINE · learns your tone from your edits',
                  highlight: true,
                },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    padding: '18px 20px',
                    borderRadius: 12,
                    background: row.highlight ? 'color-mix(in oklab, var(--rh-teal) 8%, var(--rh-paper))' : 'var(--rh-card)',
                    border: row.highlight
                      ? '1px solid color-mix(in oklab, var(--rh-teal) 35%, var(--rh-rule))'
                      : '1px solid var(--rh-rule)',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--rh-mono)', fontSize: 10, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--rh-ink-3)', marginBottom: 8,
                  }}>{row.label}</div>
                  <div style={{
                    fontFamily: 'var(--rh-serif)', fontSize: 22, fontWeight: 600,
                    color: row.highlight ? 'var(--rh-teal-deep)' : 'var(--rh-ink)',
                    marginBottom: 6, letterSpacing: '-0.01em',
                  }}>{row.cost}</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-ink-2)', lineHeight: 1.45 }}>
                    {row.tradeoff}
                  </div>
                </div>
              ))}
            </div>
            <p style={{
              fontSize: 12, color: 'var(--rh-ink-3)', marginTop: 16,
              fontFamily: 'var(--rh-mono)', letterSpacing: '0.05em',
            }}>
              {lang === 'th'
                ? '* ตัวเลขประมาณการสำหรับร้านขนาดเล็ก ~30 รีวิว/เดือน ในไทยและสหรัฐฯ'
                : '* Rough numbers for a small business with ~30 reviews/month in Thailand or US.'}
            </p>
          </div>
        </section>

        {/* FAQ — same accordion semantics as the Landing FAQ.
            Section-head styling mirrors section 04 explicitly so the
            kicker + heading typography stays consistent down the page.
            Default .rh-section-head h2 styling was much larger and broke
            the editorial rhythm next to section 04. */}
        <section className="rh-section rh-faq-section" aria-label="Pricing FAQ">
          <div className="rh-shell">
            <div className="rh-section-head" style={{ marginBottom: 24 }}>
              <div className="kicker">
                <div className="num">05</div>
                <div className="cat">§ {lang === 'th' ? 'คำถามที่เจอบ่อย' : 'Common questions'}</div>
              </div>
              <h2
                lang={lang === 'th' ? 'th' : 'en'}
                style={{
                  fontFamily: 'var(--rh-serif)', fontWeight: 400,
                  fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1,
                  letterSpacing: '-0.02em', margin: 0, maxWidth: '24ch',
                }}
              >
                {t('pricing.faqTitle')}
              </h2>
            </div>
            <div className="rh-faq">
              {faqs.map((faq, i) => (
                <details key={faq.q} className="faq-item" {...(i === 0 ? { open: true } : {})}>
                  <summary>
                    <span>{faq.q}</span>
                    <span className="ico">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 2v10M2 7h10" /></svg>
                    </span>
                  </summary>
                  <p className="faq-panel">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
