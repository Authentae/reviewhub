import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';

// Top-of-app banner shown when the user's subscription is in a failed-billing
// state (`past_due`) — payment method declined, card expired, etc. Without a
// prompt to fix it, they'd continue to have access during the grace window
// and then get unexpectedly downgraded when LS flips the status to `expired`.
//
// Also shown for `cancelled` when `cancel_at` is in the future — the user
// has asked to end the subscription and will retain access until that date.
// This reassures them they won't be double-billed AND flags the upcoming
// downgrade.
//
// Dismiss is per-session only — if the user closes the tab, the banner
// returns on next visit. Dismiss state PER-STATUS so fixing past_due doesn't
// inherit a stale dismiss from a previous cancelled state.

const DISMISSED_KEY = 'reviewhub_sub_status_dismissed';

export default function PastDueBanner() {
  const { t, lang } = useI18n();
  const { subscription } = useUser();
  const status = subscription?.status;
  const cancelAt = subscription?.cancel_at;
  const key = `${status}|${cancelAt || ''}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === key);

  // Only show for actionable states
  const showPastDue = status === 'past_due';
  const showCancelled = status === 'cancelled' && cancelAt && new Date(cancelAt).getTime() > Date.now();
  if (!showPastDue && !showCancelled) return null;
  if (dismissed) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, key);
    setDismissed(true);
  }

  const isError = showPastDue;
  const cls = isError
    ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
    : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200';
  const message = showPastDue
    ? t('billing.pastDueBanner')
    : t('billing.cancelledBanner', { date: new Date(cancelAt).toLocaleDateString(lang) });

  return (
    <div role={isError ? 'alert' : 'status'} className={`border-b px-4 py-2 flex items-center justify-between gap-3 text-sm ${cls}`}>
      <span className="flex items-center gap-2 min-w-0">
        <span aria-hidden="true">{isError ? '⚠️' : '📅'}</span>
        <span className="truncate">{message}</span>
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          to="/settings"
          className="text-xs font-semibold underline hover:opacity-80"
        >
          {t('billing.manageBilling')}
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.dismiss')}
          className="text-xs opacity-70 hover:opacity-100"
        >✕</button>
      </div>
    </div>
  );
}
