import React from 'react';

// Known-platform styling. For platforms that aren't wired yet (tripadvisor,
// trustpilot, wongnai) we still render a correctly-cased label via fallback.
const config = {
  google:      { cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',         label: 'Google',      icon: 'G' },
  yelp:        { cls: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',             label: 'Yelp',        icon: 'Y' },
  facebook:    { cls: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400', label: 'Facebook',    icon: 'f' },
  tripadvisor: { cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', label: 'TripAdvisor', icon: 'T' },
  trustpilot:  { cls: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',     label: 'Trustpilot',  icon: '★' },
  wongnai:     { cls: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', label: 'Wongnai',     icon: 'W' },
  mock:        { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',           label: 'Demo',        icon: '🧪' },
};

function titleCase(s) {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

export default function PlatformBadge({ platform }) {
  const p = config[platform] || {
    cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    label: titleCase(platform), icon: null,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${p.cls}`}>
      {p.icon && <span aria-hidden="true" className="font-bold">{p.icon}</span>}
      {p.label}
    </span>
  );
}
