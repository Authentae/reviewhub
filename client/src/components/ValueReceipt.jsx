import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';

// "Value receipt" — a small monthly summary callout that surfaces the concrete
// value the user has gotten from ReviewHub this month: reviews handled and
// rough time saved.
//
// Why it exists: customers don't perceive value of a SaaS tool from a feature
// list — they perceive it from outcomes they can attribute to the tool. By
// showing "you've responded to 47 reviews this month, ~3 hrs saved" right on
// the dashboard, we (a) reinforce the upgrade decision for paying users, and
// (b) give Free users a concrete reason to upgrade ("imagine if I could draft
// 47 of these in seconds"). Dismissible — power users will hide it after
// the first month.
//
// Conservative time-saved math: each review response takes ~4 minutes from
// scratch (read review, draft thoughtful reply, post). AI drafts cut that
// to ~1 minute. We don't know per-review which path was used, so we use the
// conservative midpoint of 4 min/response — under-promise, over-deliver.
const DISMISSED_KEY = 'reviewhub_value_receipt_dismissed_month';
const MIN_RESPONDED_TO_SHOW = 5; // hide for trivially-low counts

function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ValueReceipt({ stats }) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  // Re-evaluate dismissal state on every mount and when the month changes.
  // The dismissal is keyed to the *month* so the receipt re-appears next
  // month even if the user dismissed this one — that's intentional, the
  // monthly recap is the value moment.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      setDismissed(stored === getCurrentMonthKey());
    } catch { /* ignore */ }
  }, []);

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, getCurrentMonthKey()); } catch { /* ignore */ }
    setDismissed(true);
  }

  const responded = stats?.responded ?? 0;
  if (dismissed || responded < MIN_RESPONDED_TO_SHOW) return null;

  // 4 min per response, rounded to nearest 0.5 hour for human readability.
  const minutesSaved = responded * 4;
  const hoursSaved = Math.round((minutesSaved / 60) * 2) / 2; // .5 increments
  const hoursLabel = hoursSaved < 1
    ? `${minutesSaved} min`
    : hoursSaved === 1
      ? '1 hour'
      : `${hoursSaved} hours`;

  return (
    <section
      className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3 sm:gap-4"
      aria-label={t('value.receiptAria') || 'Monthly value summary'}
    >
      <div
        aria-hidden="true"
        className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800/40 items-center justify-center text-xl"
      >
        ✨
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
          {t('value.thisMonthLabel') || 'This month with ReviewHub'}
        </p>
        <p className="text-sm text-emerald-900 dark:text-emerald-100 mt-0.5">
          {t('value.receiptBody', { responded, hours: hoursLabel })
            || `You responded to ${responded} review${responded === 1 ? '' : 's'} — about ${hoursLabel} of work handled.`}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t('common.dismiss') || 'Dismiss'}
        className="flex-shrink-0 text-emerald-400 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 text-lg leading-none px-1"
      >
        ✕
      </button>
    </section>
  );
}
