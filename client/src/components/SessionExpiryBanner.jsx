import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { clearToken, getTokenExpiryMs } from '../lib/auth';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';

const WARN_THRESHOLD_MS = 24 * 60 * 60 * 1000; // warn when < 24 h left

// Session-expiring soft banner.
//
// Post-cookie-migration: we can't read the httpOnly cookie from the client,
// so the source of truth for expiry is the `session_expires_at` field
// returned by GET /me. We fetch it once on mount, cache it in state, and
// recompute time-left locally every minute. When expiry passes, we clear
// state and bounce to /login.
//
// Legacy fallback: if /me returns no expiry (older server) or the fetch
// fails, we try to read the cached legacy token's exp from localStorage.
// Once all clients are on the new build, this fallback becomes dead code.

export default function SessionExpiryBanner() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const rtf = useMemo(() => {
    try { return new Intl.RelativeTimeFormat(lang, { numeric: 'always' }); }
    catch { return new Intl.RelativeTimeFormat('en', { numeric: 'always' }); }
  }, [lang]);

  const { sessionExpires } = useUser();
  const [expiresAtMs, setExpiresAtMs] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);

  // Source of truth: UserContext's session_expires_at (single /me fetch for
  // the whole app). Legacy fallback: cached JWT's exp in localStorage.
  useEffect(() => {
    if (sessionExpires) {
      setExpiresAtMs(new Date(sessionExpires).getTime());
      return;
    }
    const ms = getTokenExpiryMs();
    if (ms !== null) setExpiresAtMs(Date.now() + ms);
  }, [sessionExpires]);

  // Tick local clock every minute to re-evaluate the banner.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-logout once the session has actually expired. We call /auth/logout
  // to clear the cookie, then clear local state and bounce to /login —
  // preserving the current path as ?next= so re-auth lands the user back
  // exactly where their session timed out (matches the api.js 401 path).
  useEffect(() => {
    if (expiresAtMs === null) return;
    if (expiresAtMs - now <= 0) {
      api.post('/auth/logout').catch(() => {});
      clearToken();
      const here = window.location.pathname + window.location.search;
      const next = here && !here.startsWith('/login') ? `?next=${encodeURIComponent(here)}` : '';
      navigate(`/login${next}`);
    }
  }, [expiresAtMs, now, navigate]);

  if (dismissed || expiresAtMs === null) return null;
  const timeLeft = expiresAtMs - now;
  if (timeLeft > WARN_THRESHOLD_MS) return null;

  const hours = Math.floor(timeLeft / 3_600_000);
  const minutes = Math.floor((timeLeft % 3_600_000) / 60_000);
  const label = hours > 0 ? rtf.format(hours, 'hour') : rtf.format(minutes, 'minute');

  return (
    <div
      role="alert"
      className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-2 flex items-center justify-between gap-4 text-sm"
    >
      <span className="text-amber-800 dark:text-amber-200">
        <span aria-hidden="true">⚠️ </span>
        {t('session.expiresIn', { time: label })}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs font-medium"
      >
        {t('session.dismiss')}
      </button>
    </div>
  );
}
