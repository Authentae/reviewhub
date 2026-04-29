import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import { useToast } from '../components/Toast';
import { isLoggedIn } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import api from '../lib/api';

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
function formatPrice(n, currency) {
  const m = CURRENCY_META[currency] || CURRENCY_META.USD;
  // Thai baht prices are whole numbers; USD might be whole. Use locale
  // formatter for thousand separators when needed.
  const rounded = Math.round(n * 100) / 100;
  const body = rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
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
    const offers = plans
      .filter(p => p.id !== 'free')
      .map(p => ({
        '@type': 'Offer',
        'name': p.name,
        'price': String(p.price?.monthly ?? 0),
        'priceCurrency': 'USD',
        'availability': 'https://schema.org/InStock',
        'url': 'https://reviewhub.review/pricing',
      }));
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': 'ReviewHub',
      'description': 'AI review reply tool for local businesses. Drafts replies for every Google review in 10 seconds.',
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
  const [currentPlanId, setCurrentPlanId] = useState(null);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => { if (!cancelled) setCurrentPlanId(data.subscription?.plan || 'free'); })
      .catch(() => { /* silent — fall back to default copy */ });
    return () => { cancelled = true; };
  }, [loggedIn]);

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
      <MarketingNav />

      <main id="main-content">
        {/* Editorial header — cream paper backdrop, big serif headline */}
        <section className="rh-pricing-hero" aria-label="Pricing overview">
          <div className="rh-hero-bg" />
          <div className="rh-hero-grid" />
          <div className="rh-shell rh-pricing-hero-inner">
            <div className="rh-section-head" style={{ marginBottom: 32 }}>
              <div className="kicker">
                <div className="num" style={{ color: 'var(--rh-sage)' }}>04</div>
                <div className="cat">§ Pricing</div>
              </div>
              <h1 style={{ color: 'var(--rh-ink)' }}>{t('pricing.headline').split(/[—.]/, 1)[0] || t('pricing.headline')}<em style={{ color: 'var(--rh-sage)' }}>.</em></h1>
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
                  const highlighted = plan.id === 'pro';
                  const activeFeatures = Object.entries(plan.features).filter(([, v]) => v);
                  return (
                    <div key={plan.id} className={'rh-pricing-card' + (highlighted ? ' featured' : '')}>
                      {highlighted && <span className="badge">{t('pricing.badge')}</span>}
                      <h2 className="plan-name">{plan.name}</h2>
                      <p className="plan-sub">{t(`pricing.${plan.id}Desc`, plan.description)}</p>
                      <div className="plan-price">
                        {isFree ? t('pricing.freePrice') : formatPrice(price, currency)}
                        {!isFree && <small>{perUnit}</small>}
                      </div>
                      {!isFree && cycle === 'annual' && priceMonthly > 0 && (
                        <p className="plan-effective">
                          ≈ {formatPrice(Math.round((priceAnnual / 12) * 100) / 100, currency)}/mo
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
                        const isCurrent = loggedIn && currentPlanId === plan.id;
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
                        return (
                          <Link
                            to={loggedIn ? '/settings' : '/register'}
                            className={'rh-btn ' + (highlighted ? 'rh-btn-amber' : 'rh-btn-ghost')}
                            style={{ justifyContent: 'center', width: '100%' }}
                          >
                            {isFree
                              ? (loggedIn ? t('pricing.ctaCurrentPlan') : t('pricing.ctaFree'))
                              : (loggedIn ? t('pricing.ctaUpgrade') : t('pricing.ctaStart'))}
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

        {/* FAQ — same accordion semantics as the Landing FAQ */}
        <section className="rh-section rh-faq-section" aria-label="Pricing FAQ">
          <div className="rh-shell">
            <div className="rh-section-head">
              <div className="kicker">
                <div className="num">05</div>
                <div className="cat">§ Common questions</div>
              </div>
              <h2>{t('pricing.faqTitle')}</h2>
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
    </div>
  );
}
