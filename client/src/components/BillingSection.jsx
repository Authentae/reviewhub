import React, { useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useToast } from './Toast';

// Billing section for Settings.
//
// Three states:
//   Free plan (no billing record)   → show Upgrade buttons per paid tier
//   Paid plan (active subscription) → show current plan + "Manage billing"
//                                     button that opens LemonSqueezy portal
//   Cancelled / past_due            → show warning + resubscribe / fix-card
//
// Props:
//   subscription  — the subscription object from /me (plan, status, plan_meta,
//                   cancel_at, billing_provider)
//   onRefresh()   — called after portal return to refetch /me

export default function BillingSection({ subscription, onRefresh }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState('monthly');

  const plan = subscription?.plan || 'free';
  const meta = subscription?.plan_meta;
  const status = subscription?.status || 'active';
  const isFree = plan === 'free';

  async function handleUpgrade(targetPlan) {
    setBusy(true);
    try {
      const { data } = await api.post('/billing/checkout', { plan: targetPlan, cycle });
      if (!data?.url) throw new Error('No checkout URL');
      // Full-page navigate so the user ends up at LS's hosted checkout.
      // Don't use window.open() — pop-up blockers kill it.
      window.location.href = data.url;
    } catch (err) {
      toast(err.response?.data?.error || t('billing.checkoutFailed'), 'error');
      setBusy(false);
    }
  }

  async function handleManage() {
    setBusy(true);
    try {
      const { data } = await api.post('/billing/portal');
      if (!data?.url) throw new Error('No portal URL');
      // Open the LemonSqueezy portal in a NEW tab (was full-page redirect).
      // Popup blockers don't block window.open() inside a direct user-click
      // handler, and a new tab means the user comes back to ReviewHub
      // when they're done managing card / cancelling — they don't have to
      // hit "back" through the LS host's own pages to get back here.
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err.response?.data?.error || t('billing.portalFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6" aria-labelledby="settings-billing">
      <h2 id="settings-billing" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {t('billing.sectionTitle')}
      </h2>
      <div className="card p-5 space-y-4">
        {/* Current plan summary */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('billing.currentPlan')}: <span className="capitalize">{meta?.name || plan}</span>
              {!isFree && meta?.priceMonthlyUsd > 0 && (
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                  · {lang === 'th' && meta.priceMonthlyThb
                      ? `฿${meta.priceMonthlyThb.toLocaleString('th-TH')}/mo`
                      : `$${meta.priceMonthlyUsd}/mo`}
                </span>
              )}
            </p>
            {status !== 'active' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {t('billing.status')}: <strong>{status}</strong>
                {subscription?.cancel_at && (
                  <> · {t('billing.endsOn', { date: new Date(subscription.cancel_at).toLocaleDateString(lang) })}</>
                )}
              </p>
            )}
            {/* Renewal-date hint for active paid plans — answers the
                "when does this charge me again?" question without making
                the user dig into the billing portal. Skipped on Free
                (no renewal) and on cancelled/past_due (the amber line
                above already shows the relevant date). */}
            {status === 'active' && !isFree && subscription?.renewal_date && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('billing.renewsOn', { date: new Date(subscription.renewal_date).toLocaleDateString(lang) })}
              </p>
            )}
          </div>
          {!isFree && (
            <button
              type="button"
              onClick={handleManage}
              disabled={busy}
              aria-busy={busy}
              className="btn-secondary text-sm disabled:opacity-60"
            >
              {busy ? t('billing.loading') : t('billing.manageBilling')}
            </button>
          )}
        </div>

        {/* AI draft usage meter — only shown for plans with a finite cap
            (Free). Paid plans have unlimited drafts, so showing a meter
            there would add noise without signal. */}
        {(() => {
          const max = subscription?.ai_drafts_max_per_month;
          if (max == null) return null;
          const used = subscription?.ai_drafts_used_this_month ?? 0;
          const pct = Math.min(100, Math.round((used / max) * 100));
          const barColor = pct >= 100 ? 'bg-red-500' : pct >= 67 ? 'bg-amber-500' : 'bg-blue-500';
          return (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('billing.aiUsageTitle')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {used} / {max}
                </p>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={used}
                  aria-valuemin={0}
                  aria-valuemax={max}
                  aria-label={t('billing.aiUsageAria', { used, max })}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {used >= max ? t('billing.aiUsageExhausted') : t('billing.aiUsageResetHint')}
              </p>
            </div>
          );
        })()}

        {/* Upgrade UI — only for Free plan */}
        {isFree && (
          <>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('billing.upgradeTitle')}
                </p>
                {/* Monthly / annual toggle */}
                <div role="radiogroup" aria-label={t('billing.cycle')} className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={cycle === 'monthly'}
                    onClick={() => setCycle('monthly')}
                    className={`px-3 py-1 rounded-md transition-colors ${cycle === 'monthly' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >{t('billing.monthly')}</button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={cycle === 'annual'}
                    onClick={() => setCycle('annual')}
                    className={`px-3 py-1 rounded-md transition-colors ${cycle === 'annual' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                  >{t('billing.annual')} <span className="text-green-600 ml-1">-20%</span></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PlanCard id="starter" cycle={cycle} onUpgrade={handleUpgrade} busy={busy} t={t} />
                <PlanCard id="pro" cycle={cycle} onUpgrade={handleUpgrade} busy={busy} t={t} highlighted />
                <PlanCard id="business" cycle={cycle} onUpgrade={handleUpgrade} busy={busy} t={t} />
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('billing.processorNote')}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// Small presentational card for each paid tier. Pulls its data from the
// static plan catalogue via /api/plans would be better, but hard-coding
// names here is fine — the catalogue is also a code file, not DB state.
function PlanCard({ id, cycle, onUpgrade, busy, t, highlighted }) {
  // Keep labels and prices aligned with server's lib/billing/plans.js
  const PLANS_UI = {
    starter: { name: 'Starter', monthly: 14, annual: 134, pitch: 'billing.starter.pitch' },
    pro: { name: 'Pro', monthly: 29, annual: 278, pitch: 'billing.pro.pitch' },
    business: { name: 'Business', monthly: 59, annual: 567, pitch: 'billing.business.pitch' },
  };
  const plan = PLANS_UI[id];
  const price = cycle === 'annual' ? plan.annual : plan.monthly;
  const suffix = cycle === 'annual' ? t('billing.perYear') : t('billing.perMonth');
  return (
    <div className={`rounded-lg p-3 border ${highlighted ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.name}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t(plan.pitch)}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
        ${price}<span className="text-xs font-normal text-gray-500 dark:text-gray-400">{suffix}</span>
      </p>
      <button
        type="button"
        onClick={() => onUpgrade(id)}
        disabled={busy}
        aria-busy={busy}
        className={`${highlighted ? 'btn-primary' : 'btn-secondary'} text-xs w-full mt-2 py-1.5 disabled:opacity-60`}
      >
        {busy ? t('billing.loading') : t('billing.upgrade')}
      </button>
    </div>
  );
}
