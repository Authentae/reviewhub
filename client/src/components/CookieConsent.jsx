import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { isLoggedIn } from '../lib/auth';

const STORAGE_KEY = 'rh_consent_v1';

const CONSENT_TYPES = [
  {
    key: 'essential',
    label: 'Essential',
    description: 'Required for login, security, and core service. Cannot be disabled.',
    locked: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Aggregate usage stats so we can improve the product.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Product update emails and onboarding nudges.',
  },
  {
    key: 'third_party',
    label: 'Third-party integrations',
    description: 'Sharing with review platforms (Google, Facebook, etc.) when you connect them.',
  },
  {
    key: 'profiling',
    label: 'AI personalization',
    description: 'Use your review history to tailor AI-generated reply suggestions.',
  },
];

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStored(consents) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ consents, recordedAt: new Date().toISOString() }));
  } catch {
    /* storage disabled — banner will keep reappearing, acceptable */
  }
}

async function syncToServer(consents) {
  if (!isLoggedIn()) return;
  await Promise.allSettled(
    Object.entries(consents).map(([consentType, granted]) =>
      api.post('/gdpr/consent', { consentType, granted })
    )
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [choices, setChoices] = useState({
    essential: true,
    analytics: false,
    marketing: false,
    third_party: false,
    profiling: false,
  });

  useEffect(() => {
    const stored = readStored();
    if (!stored) setVisible(true);
    else setChoices((prev) => ({ ...prev, ...stored.consents }));
  }, []);

  if (!visible) return null;

  function decide(allOn) {
    const next = {
      essential: true,
      analytics: allOn,
      marketing: allOn,
      third_party: allOn,
      profiling: allOn,
    };
    writeStored(next);
    syncToServer(next);
    setVisible(false);
  }

  function saveCustom() {
    const next = { ...choices, essential: true };
    writeStored(next);
    syncToServer(next);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        <div className="p-5 sm:p-6">
          <h2 id="cookie-consent-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Your privacy choices
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            We use cookies and similar technologies to run ReviewHub, measure usage, and personalize your experience.
            You can accept everything, decline non-essential, or customize. Read our{' '}
            <Link to="/privacy" className="text-blue-600 dark:text-blue-400 underline">privacy policy</Link>.
          </p>

          {showCustomize && (
            <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              {CONSENT_TYPES.map((t) => (
                <label key={t.key} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={choices[t.key]}
                    disabled={t.locked}
                    onChange={(e) => setChoices((c) => ({ ...c, [t.key]: e.target.checked }))}
                  />
                  <span className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">{t.label}</span>
                    {t.locked && <span className="ml-2 text-xs text-gray-500">(always on)</span>}
                    <span className="block text-gray-600 dark:text-gray-400">{t.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            {!showCustomize ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowCustomize(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Customize
                </button>
                <button
                  type="button"
                  onClick={() => decide(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Decline non-essential
                </button>
                <button
                  type="button"
                  onClick={() => decide(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Accept all
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowCustomize(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={saveCustom}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Save preferences
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
