import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useToast } from './Toast';

// Dashboard onboarding checklist. Shows 4 steps and a progress bar.
// Visible when:
//   - user hasn't dismissed it (onboarding_dismissed_at IS NULL)
//   - AND at least one step is incomplete
// Auto-dismisses client-side when everything is done so it doesn't linger.
//
// The "name your business" step is edited inline — no redirect to Settings —
// so users who land on the dashboard can complete onboarding without navigating
// away. Every other step links to the relevant page with a clear CTA.
export default function OnboardingChecklist({
  business,
  hasReviews,
  hasResponded,
  onBusinessCreated,
  onSeedDemo,
  onDismiss,
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [editingName, setEditingName] = useState(false);
  const [bizName, setBizName] = useState(business?.business_name || '');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const hasBusiness = !!business && business.business_name && business.business_name !== 'My Business';
  const steps = [
    { key: 'account', done: true, label: t('onboarding.stepAccount') },
    { key: 'business', done: hasBusiness, label: t('onboarding.stepBusiness') },
    { key: 'reviews', done: hasReviews, label: t('onboarding.stepReviews') },
    { key: 'respond', done: hasResponded, label: t('onboarding.stepRespond') },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  async function saveBusinessName() {
    const name = bizName.trim();
    if (!name || name.length < 2) {
      toast(t('onboarding.bizNameTooShort'), 'error');
      return;
    }
    setSaving(true);
    try {
      if (business?.id) {
        await api.put(`/businesses/${business.id}`, { business_name: name });
      } else {
        await api.post('/businesses', { business_name: name });
      }
      toast(t('onboarding.bizSaved'), 'success');
      setEditingName(false);
      if (onBusinessCreated) await onBusinessCreated();
    } catch (err) {
      toast(err.response?.data?.error || t('onboarding.bizSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function loadDemo() {
    setSeeding(true);
    try {
      if (onSeedDemo) await onSeedDemo();
    } finally {
      setSeeding(false);
    }
  }

  function handleDismiss() {
    // Hide locally first so the click feels instant; server POST is
    // fire-and-forget. If the POST fails the next /me fetch will show
    // dismissed=false and the checklist comes back — that's acceptable
    // given how rare the failure mode is.
    if (onDismiss) onDismiss();
    api.post('/auth/onboarding/dismiss').catch(() => {});
  }

  // Auto-hide once the user has completed every step. Without this the
  // checklist sat on the dashboard forever after onboarding finished —
  // visual clutter that pushed the actual review feed below the fold.
  // Treat completion the same as an explicit dismiss so the server flag
  // also flips (no banner re-emerges on next /me fetch).
  useEffect(() => {
    if (pct === 100) {
      handleDismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  return (
    <section
      aria-labelledby="onboarding-title"
      className="card p-5 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-900/50"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="onboarding-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
            {t('onboarding.title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('onboarding.subtitle', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white underline-offset-2 hover:underline"
          aria-label={t('onboarding.dismissAria')}
        >
          {t('onboarding.dismiss')}
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <ol className="space-y-3 list-none">
        {/* Step 1: Account (always done) */}
        <Step done={true} label={steps[0].label} />

        {/* Step 2: Name business — inline edit */}
        <li className="flex items-start gap-3">
          <StepBullet done={steps[1].done} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${steps[1].done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
              {steps[1].label}
            </p>
            {!steps[1].done && (
              <div className="mt-2">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bizName}
                      onChange={(e) => setBizName(e.target.value)}
                      className="input text-sm flex-1 max-w-xs"
                      placeholder={t('onboarding.bizNamePlaceholder')}
                      maxLength={100}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveBusinessName();
                        if (e.key === 'Escape') {
                          setEditingName(false);
                          setBizName(business?.business_name || '');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={saveBusinessName}
                      disabled={saving}
                      className="btn-primary text-xs disabled:opacity-60"
                    >
                      {saving ? t('onboarding.saving') : t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingName(false); setBizName(business?.business_name || ''); }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingName(true); setBizName(business?.business_name || ''); }}
                    className="btn-primary text-xs"
                  >
                    {business?.business_name ? t('onboarding.bizRename') : t('onboarding.bizAdd')}
                  </button>
                )}
              </div>
            )}
          </div>
        </li>

        {/* Step 3: See reviews — two paths: connect platform OR demo */}
        <li className="flex items-start gap-3">
          <StepBullet done={steps[2].done} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${steps[2].done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
              {steps[2].label}
            </p>
            {!steps[2].done && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link to="/settings" className="btn-primary text-xs">
                  {t('onboarding.connectPlatform')}
                </Link>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t('onboarding.or')}</span>
                <button
                  type="button"
                  onClick={loadDemo}
                  disabled={seeding}
                  className="btn-secondary text-xs disabled:opacity-60"
                >
                  {seeding ? t('onboarding.loading') : t('onboarding.tryDemo')}
                </button>
              </div>
            )}
          </div>
        </li>

        {/* Step 4: Respond to a review */}
        {/* Custom row instead of <Step/> so we can include a CTA. The
            previous version showed only a hint string when hasReviews,
            with no action — leaving the user reading a tooltip and
            wondering "where do I go?". The link drops them straight into
            the dashboard pre-filtered to unresponded reviews. */}
        <li className="flex items-start gap-3">
          <StepBullet done={steps[3].done} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${steps[3].done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
              {steps[3].label}
            </p>
            {!steps[3].done && hasReviews && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Link to="/dashboard?responded=no" className="btn-primary text-xs">
                  {t('onboarding.respondCta', 'Reply to your first review →')}
                </Link>
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('onboarding.respondHint')}</span>
              </div>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}

function Step({ done, label, hint }) {
  return (
    <li className="flex items-start gap-3">
      <StepBullet done={done} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
          {label}
        </p>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </li>
  );
}

function StepBullet({ done }) {
  if (done) {
    return (
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center" aria-hidden="true">
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" aria-hidden="true" />;
}
