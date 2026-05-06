import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';
import api from '../lib/api';

// /status — public uptime + component-health page.
//
// Why this exists: prospects landing on the marketing site from a
// cold-email click want to see "is this thing actually working?"
// before committing to signup. A live green dot ticking every 30s
// is more credible than a "99.9% uptime!" claim. Engineering-honest
// status pages also reduce support load — "is the API down?" tickets
// vanish when the answer is one click away.
//
// Auto-refreshes every 30s. Shows overall status (the most important
// signal), then per-component breakdown (db / smtp / ai / billing /
// etc.) in a small grid so a curious user can see exactly what's
// degraded. No history yet — that requires a separate
// uptime-monitoring service or a poll-and-store table; the current
// page is "live snapshot only" which is enough to ship today.
//
// Color coding mirrors the convention prospects already know from
// other status pages: green = ok, amber = degraded/unknown, red =
// error. We don't show numeric latency — feels like over-promising
// on a SaaS that doesn't have an SLA yet.

const REFRESH_INTERVAL_MS = 30_000;

// Component labels in EN. The Status page is intentionally
// English-only for now: the audience is mostly developers / techy
// prospects checking before they sign up, plus uptime monitors —
// localizing this would inflate translations.js for marginal value
// to a small audience. If a real customer asks, revisit.
const COMPONENT_LABELS = {
  db: 'Database',
  smtp: 'Email delivery',
  ai: 'AI drafting',
  billing: 'Billing (LemonSqueezy)',
  sentry: 'Error reporting',
  analytics: 'Analytics',
  line: 'LINE provider',
  frill: 'Feature feedback (Frill)',
  promptpay: 'PromptPay',
  inbound_email: 'Inbound email',
};

function statusColor(state) {
  if (state === 'ok') return { bg: '#dcfce7', fg: '#166534', dot: '#16a34a', label: 'OK' };
  if (state === 'error') return { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626', label: 'Down' };
  // 'unknown' / 'disabled' / 'not configured' / etc. — anything that's
  // not a hard pass-or-fail. Colored amber rather than red because the
  // most common cause is "this component is intentionally not deployed
  // here," not "broken."
  return { bg: '#fef3c7', fg: '#92400e', dot: '#d97706', label: 'Idle' };
}

export default function Status() {
  const { t } = useI18n();
  usePageTitle(t('status.title', 'System status — live health snapshot'));

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/health');
      setData(res.data);
      setError(null);
    } catch (err) {
      // Treat any error from the health endpoint itself as a hard down
      // signal. This catches "API totally unreachable" cases the health
      // endpoint can't self-report (DNS failure, SSL error, edge 502).
      setError(err?.message || 'unreachable');
      setData(null);
    } finally {
      setLastChecked(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const handle = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [fetchStatus]);

  const overall = error
    ? { state: 'error', label: 'Down', detail: error }
    : data?.ok
      ? { state: 'ok', label: 'All systems operational', detail: '' }
      : data
        ? { state: 'error', label: 'Degraded', detail: 'One or more components reporting errors' }
        : { state: 'unknown', label: 'Checking…', detail: '' };

  const overallColor = statusColor(overall.state);

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <MarketingNav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
          System status
        </h1>
        <p className="text-base mb-10 leading-relaxed" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
          Live snapshot of the platform's components. Auto-refreshes every 30 seconds.
          No SLA promised — this page just tells you what we&rsquo;re seeing right now.
        </p>

        {/* Overall banner — the answer to "is it up?" should be the
            single largest piece of UI on this page. Everything else is
            a curiosity. */}
        <div
          className="rounded-2xl px-6 py-8 mb-8 flex items-center gap-4"
          style={{ background: overallColor.bg }}
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block w-4 h-4 rounded-full flex-shrink-0"
            style={{
              background: overallColor.dot,
              boxShadow: overall.state === 'ok' ? `0 0 0 4px ${overallColor.dot}33` : 'none',
              animation: overall.state === 'ok' ? 'rh-status-pulse 2s ease-in-out infinite' : 'none',
            }}
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-lg font-bold" style={{ color: overallColor.fg }}>
              {overall.label}
            </p>
            {overall.detail && (
              <p className="text-sm mt-1" style={{ color: overallColor.fg, opacity: 0.85 }}>
                {overall.detail}
              </p>
            )}
          </div>
          <style>{`
            @keyframes rh-status-pulse {
              0%, 100% { box-shadow: 0 0 0 4px ${overallColor.dot}33; }
              50% { box-shadow: 0 0 0 8px ${overallColor.dot}11; }
            }
          `}</style>
        </div>

        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--rh-ink)' }}>
          Components
        </h2>

        {loading && !data && (
          <p className="text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>Checking components&hellip;</p>
        )}

        {data?.components && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {Object.entries(data.components).map(([key, state]) => {
              const c = statusColor(state);
              const label = COMPONENT_LABELS[key] || key;
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#fff', border: '1px solid var(--rh-line, #e6dfce)' }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: c.dot }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--rh-ink)' }}>
                    {label}
                  </span>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: c.bg, color: c.fg }}
                  >
                    {c.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Last-checked timestamp — small, but reassures the user the
            page is actually live and not stale-cached. */}
        {lastChecked && (
          <p className="text-xs" style={{ color: 'var(--rh-ink-soft, #9aa3ac)' }}>
            Last checked: {lastChecked.toLocaleTimeString()} &middot;{' '}
            <button
              type="button"
              onClick={fetchStatus}
              style={{
                color: 'var(--rh-teal-deep)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Refresh now
            </button>
          </p>
        )}

        <div className="mt-16 pt-8 border-t" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
          <p className="text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            Seeing something we&rsquo;re not?{' '}
            <Link to="/support" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
              Report it via /support &rarr;
            </Link>
          </p>
          <p className="text-sm mt-2">
            <Link to="/" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              &larr; Back to home
            </Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
