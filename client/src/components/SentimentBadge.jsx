import React from 'react';
import { useI18n } from '../context/I18nContext';

const config = {
  positive: { cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', key: 'sentiment.positive', dot: 'bg-green-500' },
  negative: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', key: 'sentiment.negative', dot: 'bg-red-500' },
  neutral:  { cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', key: 'sentiment.neutral', dot: 'bg-gray-400 dark:bg-gray-500' },
};

export default function SentimentBadge({ sentiment }) {
  const { t } = useI18n();
  const s = config[sentiment] || config.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
      {t(s.key)}
    </span>
  );
}
