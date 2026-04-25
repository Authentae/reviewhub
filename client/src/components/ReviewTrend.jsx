import React, { useEffect, useState, useMemo } from 'react';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';

// Format a YYYY-MM-DD string as "Mon D" using the given locale
function formatWeekLabel(dateStr, locale) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    // Use noon to avoid any DST-related date shifts
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function ReviewTrend() {
  const { t, lang } = useI18n();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/reviews/trend')
      .then(({ data }) => { if (!cancelled) setWeeks(data.weeks || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Re-derive labels in the current app language whenever lang or weeks change
  const localizedWeeks = useMemo(
    () => weeks.map(w => ({ ...w, label: formatWeekLabel(w.week, lang) })),
    [weeks, lang]
  );

  if (loading) return null;

  const hasData = localizedWeeks.some(w => w.count > 0);
  if (!hasData) return null;

  const maxCount = Math.max(...localizedWeeks.map(w => w.count), 1);

  return (
    <section aria-label={t('dashboard.trendTitle')} className="card p-4 mb-6">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
        {t('dashboard.trendTitle')}
      </h2>
      <div className="flex items-end gap-1 h-16" role="img" aria-label={t('dashboard.trendTitle')} aria-hidden="true">
        {localizedWeeks.map((w) => {
          const pct = maxCount > 0 ? Math.round((w.count / maxCount) * 100) : 0;
          return (
            <div
              key={w.week}
              className="flex-1 flex flex-col items-center gap-1 group relative"
              title={t('dashboard.trendBarAria', { label: w.label, n: w.count })}
            >
              {/* Bar */}
              <div className="w-full flex flex-col justify-end" style={{ height: '52px' }}>
                <div
                  className={`w-full rounded-t transition-all ${
                    w.count === 0 ? 'bg-gray-100 dark:bg-gray-700' : 'bg-blue-400 dark:bg-blue-500 group-hover:bg-blue-500 dark:group-hover:bg-blue-400'
                  }`}
                  style={{ height: w.count === 0 ? '4px' : `${Math.max(4, pct * 0.52)}px` }}
                  aria-hidden="true"
                />
              </div>
              {/* Count label — only show if nonzero */}
              {w.count > 0 && (
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-5">
                  {w.count}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* X-axis labels: show every 3rd week label to avoid crowding */}
      <div className="flex gap-1 mt-1">
        {localizedWeeks.map((w, i) => (
          <div key={w.week} className="flex-1 text-center">
            {i % 3 === 0 && (
              <span className="text-[9px] text-gray-400 dark:text-gray-500">{w.label}</span>
            )}
          </div>
        ))}
      </div>
      {/* Visually-hidden data table for screen readers — the bar chart is decorative */}
      <table className="sr-only" aria-label={t('dashboard.trendTitle')}>
        <thead>
          <tr><th scope="col">{t('dashboard.trendWeek')}</th><th scope="col">{t('dashboard.trendCount')}</th></tr>
        </thead>
        <tbody>
          {localizedWeeks.map(w => (
            <tr key={w.week}><td>{w.label}</td><td>{w.count}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
