import React from 'react';
import { platformLabel } from '../lib/platforms';

// Per-platform color + icon styling. Falls back to a neutral gray badge with
// the registry's display label for any platform we haven't styled explicitly
// (Tabelog, Naver, Dianping, etc.) — better than rendering nothing or a
// crashed component when a new locale platform ships.
const styles = {
  google:      { cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',             icon: 'G' },
  yelp:        { cls: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',                 icon: 'Y' },
  facebook:    { cls: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',     icon: 'f' },
  tripadvisor: { cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: 'T' },
  trustpilot:  { cls: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',         icon: '★' },
  wongnai:     { cls: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',     icon: 'W' },
  tabelog:     { cls: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',     icon: '食' },
  retty:       { cls: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',             icon: 'R' },
  hotpepper:   { cls: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',         icon: 'H' },
  gurunavi:    { cls: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',             icon: 'ぐ' },
  naver:       { cls: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',         icon: 'N' },
  kakaomap:    { cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',     icon: 'K' },
  mangoplate:  { cls: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',     icon: 'M' },
  dianping:    { cls: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',                 icon: '点' },
  meituan:     { cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',     icon: '美' },
  xiaohongshu: { cls: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',                 icon: '红' },
  thefork:     { cls: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', icon: '🍴' },
  mercadolibre:{ cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',     icon: 'M' },
  pagesjaunes: { cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',     icon: 'PJ' },
  avisverifies:{ cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',             icon: '✓' },
  holidaycheck:{ cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',             icon: '✈' },
  ekomi:       { cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',             icon: 'eK' },
  kununu:      { cls: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',         icon: 'k' },
  reclameaqui: { cls: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',     icon: 'RA' },
  paginegialle:{ cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',     icon: 'PG' },
  manual:      { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',               icon: '✎' },
  mock:        { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',               icon: '🧪' },
};

const FALLBACK_CLS = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';

export default function PlatformBadge({ platform }) {
  const style = styles[platform] || { cls: FALLBACK_CLS, icon: null };
  const label = platform === 'mock' ? 'Demo' : platformLabel(platform);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${style.cls}`}>
      {style.icon && <span aria-hidden="true" className="font-bold">{style.icon}</span>}
      {label}
    </span>
  );
}
