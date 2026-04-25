import React from 'react';
import { useI18n } from '../context/I18nContext';

function getStrengthScore(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_COLORS = ['', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-600'];
const STRENGTH_KEYS = ['', 'pw.weak', 'pw.fair', 'pw.good', 'pw.strong', 'pw.veryStrong'];
const STRENGTH_TEXT_COLORS = ['', 'text-red-500', 'text-amber-500', 'text-yellow-600', 'text-green-600', 'text-green-700'];

export default function PasswordStrength({ password }) {
  const { t } = useI18n();
  const score = getStrengthScore(password);
  const label = score > 0 ? t(STRENGTH_KEYS[score]) : '';
  const color = STRENGTH_COLORS[score];
  const textColor = STRENGTH_TEXT_COLORS[score];

  if (!password) return null;
  return (
    <div className="mt-1.5" role="status" aria-label={t('pw.strengthLabel', { label })}>
      {/* role="status" implies aria-live="polite" — explicit aria-live is redundant */}
      <div className="flex gap-1 mb-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? color : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>
      <p className={`text-xs ${textColor}`}>{label}</p>
    </div>
  );
}
