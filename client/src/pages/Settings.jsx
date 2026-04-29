import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import { clearToken } from '../lib/auth';
import usePageTitle from '../hooks/usePageTitle';
import api from '../lib/api';
import { platformsForLocale, platformLabel } from '../lib/platforms';
import { invalidateTemplateCache, invalidateTagCache } from '../components/ReviewCard';
import TagBadge from '../components/TagBadge';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';
import PasswordStrength from '../components/PasswordStrength';
import MfaSection from '../components/MfaSection';
import BillingSection from '../components/BillingSection';

// Format a "X min ago / Y hour ago / Z day ago" string in the user's language.
// Returns empty string if the input is falsy or unparseable.
function formatSyncAgo(isoLike, rtf, t) {
  if (!isoLike) return '';
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" (UTC) — append Z so
  // JS interprets it as UTC, matching the server's clock.
  const parsed = new Date(isoLike.replace(' ', 'T') + 'Z');
  if (isNaN(parsed.getTime())) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));
  if (diffSec < 60) return t('sync.justNow');
  if (diffSec < 3600) return rtf.format(-Math.round(diffSec / 60), 'minute');
  if (diffSec < 86400) return rtf.format(-Math.round(diffSec / 3600), 'hour');
  return rtf.format(-Math.round(diffSec / 86400), 'day');
}

function ConnectCard({ platform, icon, color, connected, onConnect, syncStatus }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [id, setId] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const connectBtnRef = useRef(null);
  // Memoised so we don't recreate the Intl.RelativeTimeFormat on every render.
  const rtf = useMemo(() => {
    try { return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }); }
    catch { return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); }
  }, [lang]);

  // Close the form on Escape key and restore focus to the trigger button
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { setOpen(false); setId(''); connectBtnRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Two-step submit: form → ownership attestation modal → actual API call.
  // The attestation is both a UX signal (user must click "I confirm") and
  // an audit-log event. If a reviewer later claims "someone connected my
  // business without my permission," the audit row + IP/UA is what proves
  // the platform operator (our customer) explicitly attested ownership.
  const [showAttest, setShowAttest] = useState(false);

  function handleStartConnect(e) {
    e.preventDefault();
    // Only show attestation on a NEW connection. Updating the ID of an
    // already-connected platform is usually a typo correction; re-attesting
    // every time is UX friction without meaningful added protection.
    if (!connected) {
      setShowAttest(true);
    } else {
      void handleSave();
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Trim the ID — copy-paste from Google Maps / Yelp dashboards
      // commonly captures leading/trailing whitespace, and the server
      // either rejects or stores the whitespace, breaking later lookups.
      // Trim once at the boundary so the user doesn't have to notice.
      const cleanId = (id || '').trim();
      await onConnect(platform, cleanId, { attested: !connected ? true : undefined });
      setOpen(false);
      setShowAttest(false);
      setId('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${color}`}>
            {icon}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 capitalize">{platform}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connected ? `${t('settings.connected')}: ${connected}` : t('settings.notConnected')}
            </p>
            {connected && syncStatus && !syncStatus.last_sync_error && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {syncStatus.last_synced_at
                  ? t('sync.lastSynced', {
                      when: formatSyncAgo(syncStatus.last_synced_at, rtf, t),
                      n: syncStatus.reviews_synced_count ?? 0,
                    })
                  : t('sync.neverSynced')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" aria-hidden="true" />
              {t('settings.connected')}
            </span>
          )}
          <button
            type="button"
            ref={connectBtnRef}
            onClick={() => setOpen(!open)}
            disabled={saving}
            aria-expanded={open}
            aria-label={connected
              ? t('settings.updatePlatformAria', { platform })
              : t('settings.connectPlatformAria', { platform })}
            className={`${connected ? 'btn-secondary' : 'btn-primary'} text-xs py-1.5 disabled:opacity-50`}
          >
            {connected ? t('settings.update') : t('settings.connect')}
          </button>
        </div>
      </div>
      {/* Prominent sync error — shown only when the connector is returning
          errors. Includes the actual error text (not just an icon) so the
          user knows whether to reconnect, check their account, or wait. */}
      {connected && syncStatus?.last_sync_error && (
        <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-800 dark:text-red-200">
          <span aria-hidden="true" className="flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs">{t('sync.errorTitle')}</p>
            <p className="text-xs mt-0.5 break-words">
              {syncStatus.last_sync_error}
            </p>
            {syncStatus.last_synced_at && (
              <p className="text-[11px] mt-1 text-red-700/80 dark:text-red-300/70">
                {t('sync.lastSuccessfulSync', {
                  when: formatSyncAgo(syncStatus.last_synced_at, rtf, t),
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-shrink-0 btn-secondary text-xs py-1 px-2.5 whitespace-nowrap"
          >
            {t('sync.reconnect')}
          </button>
        </div>
      )}
      {open && !showAttest && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
          {/* Google OAuth path: one click, no Place ID copy-paste. Only
              shown for Google, where the backend supports the real OAuth flow. */}
          {platform === 'google' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  // OAuth start requires a business row. If the user hasn't
                  // set up one yet, create it with a placeholder name first
                  // — mirrors the manual handleConnect flow so the CTA "just
                  // works" on a fresh account. User can rename later.
                  //
                  // Note: this uses POST /businesses, which the server rejects
                  // with 409 if a business already exists. We swallow that
                  // case because getting 409 means we already had one.
                  try {
                    await api.post('/businesses', { business_name: 'My Business' });
                  } catch (e) {
                    if (e.response?.status !== 409) throw e;
                  }
                  const { data } = await api.get('/platforms/google/oauth/start');
                  if (data?.url) window.location.href = data.url;
                } catch (err) {
                  const msg = err.response?.data?.error || t('settings.platform.oauthUnavailable');
                  // Surface via the in-app toast (consistent with the rest
                  // of the app — no native window.alert dialogs anywhere).
                  // The manual fallback form below stays open so the user
                  // isn't stuck if OAuth isn't configured.
                  toast(msg, 'error');
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border-2 border-gray-300 text-gray-800 font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600 dark:text-gray-100"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                <path fill="#FBBC04" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
              </svg>
              {t('settings.platform.connectWithGoogle')}
            </button>
          )}

          {/* Manual fallback — always available. Useful when OAuth isn't
              configured on this deployment, or for Yelp/Facebook which
              don't have OAuth flows wired yet. */}
          <form onSubmit={handleStartConnect} className="space-y-2">
            <label htmlFor={`platform-id-${platform}`} className="block text-xs font-medium text-gray-700 dark:text-gray-200">
              {platform === 'google' ? t('settings.platform.googleLabel') : platform === 'yelp' ? t('settings.platform.yelpLabel') : t('settings.platform.facebookLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id={`platform-id-${platform}`}
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="input text-sm flex-1"
                placeholder={t('settings.platform.idPlaceholder', { platform })}
                autoComplete="off"
                maxLength={500}
                required
              />
              <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-4">
                {saving ? t('settings.saving2') : t('settings.save')}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs py-2 px-3">
                {t('settings.cancel')}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {platform === 'google' && t('settings.platform.googleHelp')}
              {platform === 'yelp' && t('settings.platform.yelpHelp')}
              {platform === 'facebook' && t('settings.platform.facebookHelp')}
            </p>
          </form>
        </div>
      )}

      {/* Ownership attestation modal. Blocks the connect until the user
          explicitly confirms — this click becomes an audit-log entry on the
          server. */}
      {showAttest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`attest-title-${platform}`}
          className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10 rounded-b-xl px-4 py-3 -mx-5 -mb-5"
        >
          <p id={`attest-title-${platform}`} className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
            {t('auth.ownershipAttestTitle')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            {t('auth.ownershipAttestBody')}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              aria-busy={saving}
              className="btn-primary text-xs py-2 px-3 disabled:opacity-60"
            >
              {saving ? t('settings.saving2') : t('auth.ownershipAttestConfirm')}
            </button>
            <button
              type="button"
              onClick={() => setShowAttest(false)}
              disabled={saving}
              className="btn-secondary text-xs py-2 px-3"
            >
              {t('auth.ownershipAttestCancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MAX_TEMPLATES = 10;

// ─── Tag Manager sub-component ───────────────────────────────────────────────
const PRESET_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6b7280'];

function TagManager() {
  const { t } = useI18n();
  const toast = useToast();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    api.get('/tags')
      .then(({ data }) => setTags(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (name.length > 50) { toast(t('tags.nameTooLong'), 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/tags', { name, color: newColor });
      setTags(prev => [...prev, { ...data, review_count: 0 }]);
      setNewName('');
      setAdding(false);
      invalidateTagCache();
      toast(t('tags.created'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('tags.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(tag) {
    const name = editName.trim();
    if (!name) { toast(t('tags.nameRequired'), 'error'); return; }
    setSaving(true);
    try {
      await api.put(`/tags/${tag.id}`, { name, color: editColor });
      setTags(prev => prev.map(t => t.id === tag.id ? { ...t, name, color: editColor } : t));
      setEditingId(null);
      invalidateTagCache();
      toast(t('tags.updated'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('tags.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tag) {
    try {
      await api.delete(`/tags/${tag.id}`);
      setTags(prev => prev.filter(t => t.id !== tag.id));
      setConfirmDeleteId(null);
      invalidateTagCache();
      toast(t('tags.deleted'), 'info');
    } catch {
      toast(t('tags.deleteFailed'), 'error');
    }
  }

  return (
    <section className="mb-6" aria-labelledby="settings-tags">
      <div className="flex items-center justify-between mb-3">
        <h2 id="settings-tags" className="text-base font-semibold text-gray-700 dark:text-gray-300">{t('tags.manage')}</h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-xs py-1.5 px-3">
            + {t('tags.newTag')}
          </button>
        )}
      </div>
      <div className="card p-4 space-y-2">
        {loading && <p className="text-xs text-gray-400">{t('analytics.loading')}</p>}
        {!loading && tags.length === 0 && !adding && (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('tags.noTags')}</p>
        )}
        {tags.map(tag => (
          <div key={tag.id} className="flex items-center gap-2 py-1">
            {editingId === tag.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={50}
                  className="input text-xs flex-1"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
                />
                <div className="flex gap-1 flex-shrink-0">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                      style={{ backgroundColor: c, borderColor: editColor === c ? '#1d4ed8' : 'transparent' }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <button type="button" onClick={() => handleUpdate(tag)} disabled={saving} className="btn-primary text-xs py-1 px-2 disabled:opacity-50">{t('tags.save')}</button>
                <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-2">{t('tags.cancel')}</button>
              </>
            ) : confirmDeleteId === tag.id ? (
              <>
                <span className="flex-1 text-xs text-red-600 dark:text-red-400">{t('tags.deleteConfirm')}</span>
                <button type="button" onClick={() => handleDelete(tag)} className="text-xs text-red-600 font-semibold hover:underline px-1">{t('tags.yes')}</button>
                <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">{t('tags.no')}</button>
              </>
            ) : (
              <>
                <TagBadge tag={tag} small />
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">{tag.review_count} {t('analytics.reviews').toLowerCase()}</span>
                <div className="flex gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
                    className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-1"
                  >{t('review.editNote')}</button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(tag.id)}
                    aria-label={t('tags.deleteAria') || 'Delete tag'}
                    className="text-xs text-gray-300 hover:text-red-400 px-1"
                  >✕</button>
                </div>
              </>
            )}
          </div>
        ))}
        {adding && (
          <form onSubmit={handleCreate} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={50}
              placeholder={t('tags.tagName')}
              className="input text-xs flex-1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            />
            <div className="flex gap-1 flex-shrink-0">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                  style={{ backgroundColor: c, borderColor: newColor === c ? '#1d4ed8' : 'transparent' }}
                  aria-label={c}
                />
              ))}
            </div>
            <button type="submit" disabled={saving || !newName.trim()} className="btn-primary text-xs py-1 px-2 disabled:opacity-50">{t('tags.create')}</button>
            <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="btn-secondary text-xs py-1 px-2">{t('tags.cancel')}</button>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Webhooks sub-component ──────────────────────────────────────────────────
const WEBHOOK_EVENTS = ['review.created', 'review.responded'];

function WebhooksSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState(['review.created']);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({}); // id → true/false
  const [showDeliveries, setShowDeliveries] = useState({}); // id → bool
  const [deliveries, setDeliveries] = useState({}); // id → array
  const [loadingDeliveries, setLoadingDeliveries] = useState({}); // id → bool
  // Last-created secret. Stored only in component memory and cleared
  // once the user dismisses or navigates away — server returns secrets
  // ONLY on the create response, never on the list, so this is the
  // user's one chance to copy it for their receiver service. Without
  // showing it here the user couldn't verify HMAC signatures on
  // incoming webhook deliveries.
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    api.get('/webhooks').then(({ data }) => setHooks(data.webhooks || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post('/webhooks', { url: newUrl.trim(), events: newEvents });
      setHooks(prev => [data, ...prev]);
      setNewUrl(''); setNewEvents(['review.created']); setAdding(false);
      // Surface the signing secret immediately — it's in `data.secret`
      // ONCE; the GET /webhooks list now omits it for security.
      if (data.secret) setRevealedSecret({ id: data.id, secret: data.secret, url: data.url });
      toast(t('webhooks.created'), 'success');
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copySecret() {
    if (!revealedSecret?.secret) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(revealedSecret.secret);
      } else {
        const ta = document.createElement('textarea');
        ta.value = revealedSecret.secret;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
    } catch {
      toast(t('webhooks.secretCopyFailed', 'Could not copy. Select and copy manually.'), 'error');
    }
  }

  async function handleToggle(hook) {
    try {
      const { data } = await api.put(`/webhooks/${hook.id}`, { enabled: !hook.enabled });
      setHooks(prev => prev.map(h => h.id === hook.id ? data : h));
    } catch {
      toast(t('webhooks.updateFailed'), 'error');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/webhooks/${id}`);
      setHooks(prev => prev.filter(h => h.id !== id));
      toast(t('webhooks.deleted'), 'info');
    } catch {
      toast(t('webhooks.deleteFailed'), 'error');
    }
  }

  async function handleTest(id) {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.post(`/webhooks/${id}/test`);
      // Build a more useful toast — include the response snippet (for "200
      // but actually broken" cases where the receiver's body explains the
      // problem) or the connection-error reason (timeout, DNS, refused).
      const baseMsg = data.ok
        ? t('webhooks.testOk', { status: data.status })
        : t('webhooks.testFailed', { status: data.status || 0 });
      const detail = data.errorReason
        ? ` — ${data.errorReason}`
        : (!data.ok && data.responseSnippet
            ? ` — ${data.responseSnippet.slice(0, 200)}`
            : '');
      toast(baseMsg + detail, data.ok ? 'success' : 'error');
    } catch {
      toast(t('webhooks.testError'), 'error');
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  }

  async function handleToggleDeliveries(id) {
    const newVisible = !showDeliveries[id];
    setShowDeliveries(prev => ({ ...prev, [id]: newVisible }));
    if (!newVisible) return;
    setLoadingDeliveries(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.get(`/webhooks/${id}/deliveries`);
      setDeliveries(prev => ({ ...prev, [id]: data.deliveries || [] }));
    } catch {
      toast(t('webhooks.deliveriesError'), 'error');
    } finally {
      setLoadingDeliveries(prev => ({ ...prev, [id]: false }));
    }
  }

  function toggleEvent(ev) {
    setNewEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  return (
    <section className="mb-6" aria-labelledby="settings-webhooks">
      <h2 id="settings-webhooks" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('webhooks.title')}</h2>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('webhooks.subtitle')}</p>

        {/* One-time signing-secret reveal banner. Shown only after a fresh
            create — server doesn't return secrets on the list endpoint, so
            the user MUST copy it now or rotate the webhook. */}
        {revealedSecret && (
          <div role="alert" className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {t('webhooks.secretShownOnceTitle', 'Save this signing secret — you won\'t see it again')}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {t('webhooks.secretShownOnceBody', 'Use this to verify the X-ReviewHub-Signature header on incoming deliveries. Copy and store it in your receiver\'s environment now.')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded p-2 break-all text-gray-800 dark:text-gray-100">
                {revealedSecret.secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
              >
                {secretCopied ? '✓ ' + t('webhooks.copied', 'Copied') : t('webhooks.copy', 'Copy')}
              </button>
              <button
                type="button"
                onClick={() => { setRevealedSecret(null); setSecretCopied(false); }}
                aria-label={t('common.dismiss', 'Dismiss')}
                className="text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-white text-lg leading-none px-2"
              >×</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">{t('common.loading')}</p>
        ) : (
          <>
            {hooks.length > 0 && (
              <ul className="space-y-2">
                {hooks.map(hook => (
                  <li key={hook.id} className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-gray-800 dark:text-gray-100 truncate">{hook.url}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{(hook.events || []).join(', ')}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hook.last_status != null && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${hook.last_status >= 200 && hook.last_status < 300 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {hook.last_status || 'err'}
                          </span>
                        )}
                        <button type="button" onClick={() => handleToggleDeliveries(hook.id)}
                          aria-expanded={!!showDeliveries[hook.id]}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1">
                          {showDeliveries[hook.id] ? '▲' : '▼'} {t('webhooks.deliveries')}
                        </button>
                        <button type="button" onClick={() => handleTest(hook.id)} disabled={testing[hook.id]}
                          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50">{testing[hook.id] ? '…' : t('webhooks.test')}</button>
                        <button type="button" onClick={() => handleToggle(hook)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${hook.enabled ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-900/20 hover:bg-green-100' : 'border-gray-200 text-gray-400 hover:bg-gray-50 dark:border-gray-600'}`}>
                          {hook.enabled ? t('webhooks.active') : t('webhooks.disabled')}
                        </button>
                        <button type="button" onClick={() => handleDelete(hook.id)}
                          aria-label={t('webhooks.deleteAria') || 'Delete webhook'}
                          className="text-xs text-gray-300 hover:text-red-400 px-1">✕</button>
                      </div>
                    </div>
                    {showDeliveries[hook.id] && (
                      <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                        {loadingDeliveries[hook.id] ? (
                          <p className="text-xs text-gray-400">{t('common.loading')}</p>
                        ) : (deliveries[hook.id] || []).length === 0 ? (
                          <p className="text-xs text-gray-400">{t('webhooks.deliveriesEmpty')}</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 text-left">
                                <th className="pr-3 pb-1 font-medium">{t('webhooks.deliveryTime')}</th>
                                <th className="pr-3 pb-1 font-medium">{t('webhooks.deliveryEvent')}</th>
                                <th className="pr-3 pb-1 font-medium">{t('webhooks.deliveryStatus')}</th>
                                <th className="pb-1 font-medium">{t('webhooks.deliveryResponse')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(deliveries[hook.id] || []).map(d => (
                                <tr key={d.id} className="border-t border-gray-100 dark:border-gray-800">
                                  <td className="pr-3 py-1 text-gray-500 whitespace-nowrap">{new Date(d.triggered_at).toLocaleString()}</td>
                                  <td className="pr-3 py-1 font-mono text-gray-600 dark:text-gray-400">{d.event}</td>
                                  <td className={`pr-3 py-1 font-semibold ${d.status >= 200 && d.status < 300 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {d.status || 'err'}
                                  </td>
                                  <td className="py-1 text-gray-400 truncate max-w-xs" title={d.response_snippet || ''}>
                                    {d.response_snippet ? d.response_snippet.slice(0, 60) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {adding ? (
              <form onSubmit={handleCreate} className="space-y-3 border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('webhooks.urlLabel')}</label>
                  <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} required
                    placeholder="https://your-server.com/webhook" className="input text-sm w-full" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{t('webhooks.eventsLabel')}</p>
                  <div className="flex flex-wrap gap-2">
                    {WEBHOOK_EVENTS.map(ev => (
                      <label key={ev} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={newEvents.includes(ev)} onChange={() => toggleEvent(ev)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="font-mono text-gray-700 dark:text-gray-300">{ev}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving || newEvents.length === 0} className="btn-primary text-xs py-1 px-3 disabled:opacity-50">
                    {saving ? t('webhooks.saving') : t('webhooks.add')}
                  </button>
                  <button type="button" onClick={() => { setAdding(false); setNewUrl(''); setNewEvents(['review.created']); }}
                    className="btn-secondary text-xs py-1 px-3">{t('tags.cancel')}</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-sm py-1.5 px-3">
                + {t('webhooks.addBtn')}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Other supported platforms ───────────────────────────────────────────────
// Shown under the auto-sync cards (Google/Yelp/Facebook) so users see the
// full surface area. With email forwarding shipped, most of these auto-import
// in real time too — they're not CSV-only anymore.
function CsvOnlyPlatforms({ lang }) {
  const { t } = useI18n();
  // Chip cloud: alphabetical by display label so users can scan A→Z.
  // (Dropdown ordering elsewhere stays locale-relevance-first; this chip
  // cloud is a "what's supported" browse view, where A→Z reads cleaner.)
  const all = platformsForLocale(lang)
    .filter((p) => !['google', 'yelp', 'facebook', 'manual'].includes(p))
    .slice()
    .sort((a, b) => platformLabel(a).localeCompare(platformLabel(b)));
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {t(
          'settings.csvOnlyPlatforms',
          '+ {n} more platforms supported. Auto-import via email forwarding (set up below) for real-time, or upload a CSV anytime — no OAuth or API keys needed.',
          { n: all.length }
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {all.map((p) => (
          <span
            key={p}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {platformLabel(p)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Inbound email forwarding section ────────────────────────────────────────
// Shows the user's personal forwarding address. They set up email forwarding
// from their review-platform notification emails (Booking.com / Wongnai /
// Tabelog / etc.) to this address; new reviews then auto-land on their
// dashboard within ~30 seconds. Saves them from CSV-importing manually.
function InboundForwardingSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [address, setAddress] = useState(null);
  const [mailgunConfigured, setMailgunConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/inbound/address')
      .then(({ data }) => {
        if (cancelled) return;
        setAddress(data.address);
        setMailgunConfigured(!!data.mailgun_configured);
      })
      .catch(() => { /* endpoint may 404 in older deploys; section just won't render */ })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(t('inbound.copyFailed', 'Could not copy. Select and copy manually.'), 'error');
    }
  }

  async function handleRegenerate() {
    if (!confirm(t('inbound.regenerateConfirm',
      'This will deactivate your current forwarding address. Any forwarding rules you set up will need to be updated. Continue?'))) return;
    try {
      const { data } = await api.post('/inbound/regenerate');
      setAddress(data.address);
      toast(t('inbound.regenerated', 'New forwarding address generated.'), 'success');
    } catch {
      toast(t('inbound.regenerateFailed', 'Could not regenerate. Try again.'), 'error');
    }
  }

  if (loading) return null;
  if (!address) return null;

  return (
    <section className="mb-6" aria-labelledby="settings-inbound">
      <h2 id="settings-inbound" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {t('inbound.title', 'Email forwarding (auto-import reviews)')}
      </h2>
      <div className="card p-5 space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('inbound.subtitle',
            'Forward your review-notification emails (Booking.com, Wongnai, Tabelog, Yelp, etc.) to the address below — new reviews land on your dashboard within ~30 seconds. No CSV needed.')}
        </p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={address}
            readOnly
            onClick={(e) => e.target.select()}
            className="input text-sm flex-1 font-mono"
            aria-label={t('inbound.addressAria', 'Your forwarding address')}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="btn-primary text-sm py-1.5 px-3 whitespace-nowrap"
          >
            {copied ? t('inbound.copied', 'Copied ✓') : t('inbound.copy', 'Copy')}
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p className="font-medium">{t('inbound.howTitle', 'How to set it up:')}</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>
              {t('inbound.howStep1',
                'In Gmail, open Settings → Filters → Create a new filter. Filter for emails from your review platform (e.g. "from:noreply@booking.com").')}
            </li>
            <li>
              {t('inbound.howStep2',
                'Click Create filter → check "Forward it to" → add this address.')}
            </li>
            <li>
              {t('inbound.howStep3',
                'Repeat for each platform (Wongnai, Tabelog, Yelp, etc.). Reviews start auto-importing.')}
            </li>
          </ol>
        </div>
        {!mailgunConfigured && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
            {t('inbound.mailgunPending',
              'Note: the inbound mail gateway is not yet activated on this deployment. Your address is reserved — emails will start flowing once the operator wires up the inbound webhook.')}
          </p>
        )}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {t('inbound.regenerateHint', 'If your address ever leaks, regenerate it.')}
          </span>
          <button
            type="button"
            onClick={handleRegenerate}
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            {t('inbound.regenerate', 'Regenerate')}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── CSV Import sub-component ────────────────────────────────────────────────
function ImportSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [result, setResult]   = useState(null); // { imported, skipped, errors }
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  // Mix locales so a Thai/Japanese SMB sees their own platform represented
  // in the sample — much more useful than an all-EN template that doesn't
  // mention Wongnai or Tabelog. The server's /import/template endpoint
  // returns this same format; we generate client-side here so the download
  // works offline if the user's tab is open.
  const SAMPLE_CSV = [
    'platform,reviewer_name,rating,review_text,response_text,created_at',
    'google,Jane Smith,5,"Excellent service!","Thank you Jane!",2026-04-15',
    'yelp,John Doe,4,Good food.,,2026-03-20',
    'booking,Maria Garcia,5,"Beautiful hotel, great breakfast.","Thank you Maria!",',
    'agoda,Somchai T.,4,"Room was clean. Staff helpful.",ขอบคุณครับ,',
    'wongnai,สมชาย,4,"กาแฟอร่อย แต่รอนาน",ขอบคุณค่ะ,',
    'tabelog,田中,3,"普通でした。",ご来店ありがとうございました。,',
    'naver,김민,5,"맛집!",,',
  ].join('\r\n');

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Client-side file-type guard. Excel (.xlsx) is the most common
    // wrong-format pick — non-technical users export reviews from a
    // spreadsheet without re-saving as CSV. Catch it before the round-
    // trip with a clear "Save as CSV first" message instead of letting
    // the server return a generic 400.
    const name = (file.name || '').toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls') || file.type.includes('spreadsheet');
    const isJson = name.endsWith('.json') || file.type === 'application/json';
    const isObviouslyNotCsv = isXlsx || isJson;
    if (isObviouslyNotCsv) {
      toast(
        isXlsx
          ? t('import.errorXlsx', 'Excel files aren\'t supported — open in Excel/Sheets and save as CSV first.')
          : t('import.errorWrongType', 'This doesn\'t look like a CSV. Use the sample as a template.'),
        'error'
      );
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    // Empty-file early exit — server returns "empty CSV" but a friendlier
    // local message saves a round-trip.
    if (file.size === 0) {
      toast(t('import.errorEmpty', 'That file is empty.'), 'error');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setResult(null);
    setLoading(true);
    try {
      const text = await file.text();
      const { data } = await api.post('/reviews/import', text, {
        headers: { 'Content-Type': 'text/plain' },
      });
      setResult(data);
      if (data.imported > 0) toast(t('import.success', { n: data.imported }), 'success');
    } catch (err) {
      toast(err?.response?.data?.error || t('import.failed'), 'error');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reviewhub-import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mb-6" aria-labelledby="settings-import">
      <h2 id="settings-import" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('import.title')}</h2>
      <div className="card p-5 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('import.subtitle')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className={`btn-primary text-sm py-1.5 px-3 cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
            {loading ? t('import.uploading') : t('import.chooseFile')}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={handleFile}
              disabled={loading}
            />
          </label>
          <button type="button" onClick={downloadSample} className="btn-secondary text-sm py-1.5 px-3">
            {t('import.downloadSample')}
          </button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2">
          <p className="font-medium mb-0.5">{t('import.columnsTitle')}</p>
          <p>{t('import.columnsDesc')}</p>
        </div>
        {result && (
          <div className="text-sm space-y-1" role="status">
            <p className="text-green-600 dark:text-green-400 font-medium">
              ✓ {t('import.imported', { n: result.imported })}{result.skipped > 0 ? ` · ${t('import.skipped', { n: result.skipped })}` : ''}
            </p>
            {result.errors.length > 0 && (
              <details className="text-red-600 dark:text-red-400">
                <summary className="cursor-pointer text-xs">{t('import.showErrors', { n: result.errors.length })}</summary>
                <ul className="mt-1 space-y-0.5 ml-3 list-disc text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i}>{t('import.rowError', { row: e.row, error: e.error })}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Widget Section sub-component ────────────────────────────────────────────
function WidgetSection({ business, onUpdate }) {
  const { t } = useI18n();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const enabled = !!business.widget_enabled;
  const baseUrl = window.location.origin;
  const badgeUrl = `${baseUrl}/api/public/widget/${business.id}/badge`;
  const iframeCode = `<iframe src="${badgeUrl}" width="280" height="110" frameborder="0" scrolling="no" style="border:none;overflow:hidden"></iframe>`;

  async function handleToggle() {
    setSaving(true);
    try {
      await api.put(`/businesses/${business.id}`, { widget_enabled: !enabled });
      onUpdate({ widget_enabled: !enabled ? 1 : 0 });
      toast(enabled ? t('widget.disabled') : t('widget.enabled'), 'success');
    } catch {
      toast(t('widget.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('toast.copyFailed'), 'error');
    }
  }

  return (
    <section className="mb-6" aria-labelledby="settings-widget">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="settings-widget" className="text-base font-semibold text-gray-700 dark:text-gray-300">{t('widget.title')}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('widget.subtitle')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          aria-label={t('widget.toggle')}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="card p-4 space-y-4">
        {!enabled ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('widget.enableHint')}</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">{t('widget.embedCode')}</p>
              <div className="flex gap-2 items-start">
                <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 font-mono break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {iframeCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                >
                  {copied ? '✓ ' + t('widget.copied') : t('widget.copy')}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">{t('widget.preview')}</p>
              <iframe
                src={badgeUrl}
                width="280"
                height="110"
                title={t('widget.previewAria')}
                className="border border-gray-200 dark:border-gray-700 rounded-lg"
                style={{ display: 'block' }}
              />
              {/* Open the badge URL standalone so the user can verify how
                  it looks in a real browser tab (full devtools, sharing,
                  device-mode preview) without screen-grabbing the tiny
                  iframe inside Settings. */}
              <a
                href={badgeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
              >
                {t('widget.openInNewTab', 'Open preview in new tab ↗')}
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Auto-respond Rules sub-component ────────────────────────────────────────
// Platform options now come from platformsForLocale(lang) inside RuleForm —
// the dropdown is locale-aware and stays in sync with lib/platforms.js.
const RULE_SENTIMENTS = ['', 'positive', 'neutral', 'negative'];

const BLANK_RULE = { name: '', platform: '', min_rating: '', max_rating: '', sentiment: '', response_text: '', enabled: true, match_keywords_text: '', tag_id: '' };

function AutoRules() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState(BLANK_RULE);
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRule, setEditRule] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/auto-rules'),
      api.get('/tags'),
    ]).then(([{ data: rulesData }, { data: tagsData }]) => {
      setRules(rulesData || []);
      setTags(tagsData?.tags || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.response_text.trim()) {
      toast(t('rules.fieldsRequired'), 'error'); return;
    }
    // Logical-impossibility guard: min > max can never match a real review
    // (a rating cannot be both ≥4 and ≤2). The server happily stored such
    // rules but they sat there silently doing nothing forever.
    const minN = newRule.min_rating ? parseInt(newRule.min_rating, 10) : null;
    const maxN = newRule.max_rating ? parseInt(newRule.max_rating, 10) : null;
    if (minN != null && maxN != null && minN > maxN) {
      toast(t('rules.minMaxRatingError', 'Min rating cannot be higher than max rating'), 'error');
      return;
    }
    setSaving(true);
    try {
      const kwText = (newRule.match_keywords_text || '').trim();
      const body = {
        name: newRule.name,
        platform: newRule.platform || undefined,
        min_rating: newRule.min_rating ? parseInt(newRule.min_rating) : undefined,
        max_rating: newRule.max_rating ? parseInt(newRule.max_rating) : undefined,
        sentiment: newRule.sentiment || undefined,
        response_text: newRule.response_text,
        enabled: true,
        match_keywords: kwText ? kwText.split(',').map(k => k.trim()).filter(Boolean) : null,
        tag_id: newRule.tag_id ? parseInt(newRule.tag_id) : null,
      };
      const { data } = await api.post('/auto-rules', body);
      setRules(prev => [...prev, data]);
      setNewRule(BLANK_RULE);
      setAdding(false);
      toast(t('rules.created'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('rules.createFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editRule.name.trim() || !editRule.response_text.trim()) {
      toast(t('rules.fieldsRequired'), 'error'); return;
    }
    const minN = editRule.min_rating ? parseInt(editRule.min_rating, 10) : null;
    const maxN = editRule.max_rating ? parseInt(editRule.max_rating, 10) : null;
    if (minN != null && maxN != null && minN > maxN) {
      toast(t('rules.minMaxRatingError', 'Min rating cannot be higher than max rating'), 'error');
      return;
    }
    setSaving(true);
    try {
      const kwText = (editRule.match_keywords_text || '').trim();
      const body = {
        name: editRule.name,
        platform: editRule.platform || null,
        min_rating: editRule.min_rating ? parseInt(editRule.min_rating) : null,
        max_rating: editRule.max_rating ? parseInt(editRule.max_rating) : null,
        sentiment: editRule.sentiment || null,
        response_text: editRule.response_text,
        enabled: editRule.enabled,
        match_keywords: kwText ? kwText.split(',').map(k => k.trim()).filter(Boolean) : null,
        tag_id: editRule.tag_id ? parseInt(editRule.tag_id) : null,
      };
      const { data } = await api.put(`/auto-rules/${editingId}`, body);
      setRules(prev => prev.map(r => r.id === editingId ? data : r));
      setEditingId(null);
      setEditRule(null);
      toast(t('rules.updated'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('rules.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule) {
    try {
      const { data } = await api.put(`/auto-rules/${rule.id}`, { ...rule, enabled: rule.enabled ? 0 : 1 });
      setRules(prev => prev.map(r => r.id === rule.id ? data : r));
    } catch {
      toast(t('rules.updateFailed'), 'error');
    }
  }

  async function handleDelete(rule) {
    try {
      await api.delete(`/auto-rules/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      setConfirmDeleteId(null);
      toast(t('rules.deleted'), 'info');
    } catch {
      toast(t('rules.deleteFailed'), 'error');
    }
  }

  function RuleForm({ value, onChange, onSubmit, onCancel, submitLabel, availableTags }) {
    const responseTextareaRef = useRef(null);
    // Insert a template variable at the textarea's caret position rather
    // than appending to the end. Power users writing "Thanks {reviewer_name}
    // for the kind words" want to drop the variable mid-sentence; the old
    // behavior forced them to backspace and retype.
    function insertVar(v) {
      const ta = responseTextareaRef.current;
      const cur = value.response_text || '';
      if (!ta) {
        onChange({ ...value, response_text: cur + v });
        return;
      }
      const start = ta.selectionStart ?? cur.length;
      const end = ta.selectionEnd ?? cur.length;
      const next = cur.slice(0, start) + v + cur.slice(end);
      onChange({ ...value, response_text: next });
      requestAnimationFrame(() => {
        if (ta && document.contains(ta)) {
          const pos = start + v.length;
          ta.focus();
          try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ }
        }
      });
    }
    return (
      <form onSubmit={onSubmit} className="space-y-2 pt-2 pb-1">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.ruleName')} *</label>
            <input type="text" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} maxLength={100} className="input text-xs w-full" placeholder={t('rules.ruleNamePlaceholder')} autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.platform')}</label>
            <select value={value.platform || ''} onChange={e => onChange({ ...value, platform: e.target.value })} className="input text-xs w-full">
              <option value="">{t('rules.anyPlatform')}</option>
              {platformsForLocale(lang).map(p => <option key={p} value={p}>{platformLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.minRating')}</label>
            <select value={value.min_rating || ''} onChange={e => onChange({ ...value, min_rating: e.target.value })} className="input text-xs w-full">
              <option value="">{t('rules.any')}</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.maxRating')}</label>
            <select value={value.max_rating || ''} onChange={e => onChange({ ...value, max_rating: e.target.value })} className="input text-xs w-full">
              <option value="">{t('rules.any')}</option>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.sentiment')}</label>
            <select value={value.sentiment || ''} onChange={e => onChange({ ...value, sentiment: e.target.value })} className="input text-xs w-full">
              <option value="">{t('rules.anySentiment')}</option>
              {RULE_SENTIMENTS.filter(Boolean).map(s => <option key={s} value={s}>{t(`sentiment.${s}`)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.keywords')}</label>
            <input
              type="text"
              value={value.match_keywords_text || ''}
              onChange={e => onChange({ ...value, match_keywords_text: e.target.value })}
              className="input text-xs w-full"
              placeholder={t('rules.keywordsPlaceholder')}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{t('rules.keywordsHint')}</p>
          </div>
          {availableTags && availableTags.length > 0 && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.applyTag')}</label>
              <select value={value.tag_id || ''} onChange={e => onChange({ ...value, tag_id: e.target.value })} className="input text-xs w-full">
                <option value="">{t('rules.noTag')}</option>
                {availableTags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-0.5">{t('rules.responseText')} *</label>
          <textarea ref={responseTextareaRef} value={value.response_text} onChange={e => onChange({ ...value, response_text: e.target.value })} rows={2} maxLength={1000} className="input text-xs w-full resize-none" placeholder={t('rules.responseTextPlaceholder')} />
          <div className="flex flex-wrap gap-1 mt-1 items-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('templateVars.hint')}</span>
            {['{reviewer_name}', '{rating}', '{platform}', '{business_name}'].map(v => (
              <button key={v} type="button" onClick={() => insertVar(v)}
                className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 rounded px-1 py-0.5 border border-gray-200 dark:border-gray-600 transition-colors">{v}</button>
            ))}
            <span className="ml-auto text-[10px] text-gray-400">{value.response_text.length}/1000</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button type="submit" disabled={saving} className="btn-primary text-xs py-1 px-2 disabled:opacity-50">{saving ? '…' : submitLabel}</button>
          <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1 px-2">{t('tags.cancel')}</button>
        </div>
      </form>
    );
  }

  function ruleDescription(rule) {
    const parts = [];
    if (rule.platform) parts.push(platformLabel(rule.platform));
    if (rule.min_rating && rule.max_rating && rule.min_rating === rule.max_rating) parts.push(`${rule.min_rating}★`);
    else if (rule.min_rating) parts.push(`≥${rule.min_rating}★`);
    else if (rule.max_rating) parts.push(`≤${rule.max_rating}★`);
    if (rule.sentiment) parts.push(rule.sentiment);
    if (rule.match_keywords) {
      try {
        const kws = JSON.parse(rule.match_keywords);
        if (kws && kws.length > 0) parts.push(`"${kws.join('", "')}"`);
      } catch { /* ignore */ }
    }
    if (rule.tag_id) {
      const tag = tags.find(tg => tg.id === rule.tag_id);
      if (tag) parts.push(`→ #${tag.name}`);
    }
    return parts.length > 0 ? parts.join(' · ') : t('rules.matchesAll');
  }

  return (
    <section className="mb-6" aria-labelledby="settings-rules">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="settings-rules" className="text-base font-semibold text-gray-700 dark:text-gray-300">{t('rules.title')}</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('rules.subtitle')}</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-xs py-1.5 px-3">
            + {t('rules.newRule')}
          </button>
        )}
      </div>
      <div className="card p-4 space-y-2">
        {loading && <p className="text-xs text-gray-400">{t('analytics.loading')}</p>}
        {!loading && rules.length === 0 && !adding && (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('rules.empty')}</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
            {editingId === rule.id ? (
              <RuleForm value={editRule} onChange={setEditRule} onSubmit={e => { e.preventDefault(); handleUpdate(); }} onCancel={() => { setEditingId(null); setEditRule(null); }} submitLabel={t('tags.save')} availableTags={tags} />
            ) : confirmDeleteId === rule.id ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-red-600 dark:text-red-400">{t('rules.deleteConfirm')}</span>
                <button type="button" onClick={() => handleDelete(rule)} className="text-xs text-red-600 font-semibold hover:underline px-1">{t('tags.yes')}</button>
                <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">{t('tags.no')}</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!rule.enabled}
                      onClick={() => handleToggle(rule)}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${rule.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${rule.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-xs font-semibold ${rule.enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500 line-through'}`}>{rule.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-9">{ruleDescription(rule)}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 ml-9 truncate">"<em>{rule.response_text.slice(0, 80)}{rule.response_text.length > 80 ? '…' : ''}</em>"</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => {
                    let kwText = '';
                    if (rule.match_keywords) {
                      try { kwText = JSON.parse(rule.match_keywords).join(', '); } catch { kwText = ''; }
                    }
                    setEditingId(rule.id);
                    setEditRule({ ...rule, platform: rule.platform || '', min_rating: rule.min_rating ?? '', max_rating: rule.max_rating ?? '', sentiment: rule.sentiment || '', match_keywords_text: kwText, tag_id: rule.tag_id ?? '' });
                  }} className="text-xs text-gray-400 hover:text-blue-600 px-1">{t('review.editNote')}</button>
                  <button type="button" onClick={() => setConfirmDeleteId(rule.id)} aria-label={t('autoRules.deleteAria') || 'Delete rule'} className="text-xs text-gray-300 hover:text-red-400 px-1">✕</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {adding && (
          <RuleForm value={newRule} onChange={setNewRule} onSubmit={handleCreate} onCancel={() => { setAdding(false); setNewRule(BLANK_RULE); }} submitLabel={t('rules.create')} availableTags={tags} />
        )}
      </div>
    </section>
  );
}

// ─── Response Templates sub-component ───────────────────────────────────────
function ResponseTemplates() {
  const { t } = useI18n();
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', body: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const editBodyRef = useRef(null);
  const addBodyRef = useRef(null);

  // Insert a template variable at the textarea caret instead of appending
  // to the end. Power users writing "Thanks {name}, glad you enjoyed
  // {platform}" need to drop variables mid-sentence.
  function insertVarAtCaret(textareaRef, currentValue, varText, setBody) {
    const ta = textareaRef.current;
    if (!ta) {
      setBody(currentValue + varText);
      return;
    }
    const start = ta.selectionStart ?? currentValue.length;
    const end = ta.selectionEnd ?? currentValue.length;
    const next = currentValue.slice(0, start) + varText + currentValue.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      if (ta && document.contains(ta)) {
        const pos = start + varText.length;
        ta.focus();
        try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ }
      }
    });
  }

  useEffect(() => {
    api.get('/templates')
      .then(({ data }) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/templates', { title: form.title, body: form.body });
      // Prepend — API now returns most-recently-created first
      setTemplates(prev => [data, ...prev]);
      setForm({ title: '', body: '' });
      setAdding(false);
      invalidateTemplateCache();
      toast(t('toast.templateSaved'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('toast.failedTemplateSave'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(tmpl) {
    setEditingId(tmpl.id);
    setEditForm({ title: tmpl.title, body: tmpl.body });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const { data } = await api.put(`/templates/${editingId}`, { title: editForm.title, body: editForm.body });
      setTemplates(prev => prev.map(tmpl => tmpl.id === editingId ? { ...tmpl, title: data.title, body: data.body } : tmpl));
      setEditingId(null);
      invalidateTemplateCache();
      toast(t('toast.templateSaved'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('toast.failedTemplateSave'), 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/templates/${id}`);
      setTemplates(prev => prev.filter(tmpl => tmpl.id !== id));
      invalidateTemplateCache();
      toast(t('toast.templateDeleted'), 'info');
    } catch {
      toast(t('toast.failedTemplateDelete'), 'error');
    }
  }

  const atLimit = templates.length >= MAX_TEMPLATES;

  return (
    <section className="mb-6" aria-labelledby="settings-templates">
      <div className="flex items-center justify-between mb-3">
        <h2 id="settings-templates" className="text-base font-semibold text-gray-700 dark:text-gray-300">{t('templates.title')}</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{t('templates.limitNote', { max: MAX_TEMPLATES })}</span>
      </div>
      <div className="card p-5 space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('templates.desc')}</p>

        {loading && (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
          </div>
        )}

        {!loading && templates.length === 0 && !adding && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">{t('templates.empty')}</p>
        )}

        {!loading && templates.map(tmpl => (
          <div key={tmpl.id} className="border border-gray-100 dark:border-gray-700 rounded-lg">
            {editingId === tmpl.id ? (
              <form onSubmit={handleEditSave} className="p-3 space-y-2">
                <input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="input text-sm"
                  placeholder={t('templates.titlePlaceholder')}
                  aria-label={t('templates.titleLabel')}
                  maxLength={100}
                  required
                  autoFocus
                />
                <textarea
                  ref={editBodyRef}
                  value={editForm.body}
                  onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                  className="input text-sm resize-none"
                  rows={3}
                  maxLength={1000}
                  placeholder={t('templates.bodyPlaceholder')}
                  aria-label={t('templates.bodyLabel')}
                  required
                />
                <div className="flex flex-wrap gap-1 items-center mt-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('templateVars.hint')}</span>
                  {['{reviewer_name}', '{rating}', '{platform}', '{business_name}'].map(v => (
                    <button key={v} type="button"
                      onClick={() => insertVarAtCaret(editBodyRef, editForm.body, v, (newBody) => setEditForm(f => ({ ...f, body: newBody })))}
                      className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 rounded px-1 py-0.5 border border-gray-200 dark:border-gray-600 transition-colors">{v}</button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">{editForm.body.length}/1000</span>
                  <div className="flex gap-2">
                    <button type="submit" disabled={editSaving} className="btn-primary text-xs py-1 px-2">
                      {editSaving ? t('templates.saving') : t('templates.save')}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-2">
                      {t('templates.cancel')}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{tmpl.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{tmpl.body}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 items-center">
                  {confirmDeleteId === tmpl.id ? (
                    <>
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('review.deleteConfirm')}</span>
                      <button
                        type="button"
                        onClick={() => { handleDelete(tmpl.id); setConfirmDeleteId(null); }}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 px-1.5 py-1 font-semibold"
                      >
                        {t('review.yes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-1"
                      >
                        {t('review.no')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(tmpl)}
                        className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1"
                        aria-label={t('templates.editAria', { title: tmpl.title })}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(tmpl.id)}
                        className="text-xs text-gray-300 hover:text-red-500 px-2 py-1"
                        aria-label={t('templates.deleteAria', { title: tmpl.title })}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <form onSubmit={handleAdd} className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2 bg-blue-50/30 dark:bg-blue-900/10">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input text-sm"
              placeholder={t('templates.titlePlaceholder')}
              aria-label={t('templates.titleLabel')}
              maxLength={100}
              required
              autoFocus
            />
            <textarea
              ref={addBodyRef}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="input text-sm resize-none"
              rows={3}
              maxLength={1000}
              placeholder={t('templates.bodyPlaceholder')}
              aria-label={t('templates.bodyLabel')}
              required
            />
            <div className="flex flex-wrap gap-1 items-center mt-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('templateVars.hint')}</span>
              {['{reviewer_name}', '{rating}', '{platform}', '{business_name}'].map(v => (
                <button key={v} type="button"
                  onClick={() => insertVarAtCaret(addBodyRef, form.body, v, (newBody) => setForm(f => ({ ...f, body: newBody })))}
                  className="text-[10px] font-mono bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 rounded px-1 py-0.5 border border-gray-200 dark:border-gray-600 transition-colors">{v}</button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">{form.body.length}/1000</span>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-3">
                  {saving ? t('templates.saving') : t('templates.save')}
                </button>
                <button type="button" onClick={() => { setAdding(false); setForm({ title: '', body: '' }); }} className="btn-secondary text-xs py-1.5 px-3">
                  {t('templates.cancel')}
                </button>
              </div>
            </div>
          </form>
        ) : (
          !atLimit && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {t('templates.add')}
            </button>
          )
        )}
        {atLimit && !adding && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('templates.limitNote', { max: MAX_TEMPLATES })}</p>
        )}
      </div>
    </section>
  );
}

const NOTIF_KEY = 'reviewhub_notif_prefs';
const NOTIF_KEYS_META = [
  { key: 'new_review',     labelKey: 'settings.notif.newReview',     subKey: 'settings.notif.newReviewSub',     defaultOn: true,  planFeature: 'email_alerts_new' },
  { key: 'negative_alert', labelKey: 'settings.notif.negativeAlert', subKey: 'settings.notif.negativeAlertSub', defaultOn: true,  planFeature: 'email_alerts_negative' },
  { key: 'weekly_summary', labelKey: 'settings.notif.weeklySummary', subKey: 'settings.notif.weeklySummarySub', defaultOn: false, planFeature: 'weekly_digest' },
];

// Email-change trigger — expands inline to a form asking for the new email +
// current password. Server flow is PUT /auth/email → user receives email at
// the new address with a confirm link → clicking it flips user.email.
// Includes:
//  - re-auth (current password) to prevent a hijacked session silently
//    taking over the account by pointing recovery at an attacker's address
//  - best-effort alert to the OLD address so the legit owner sees any
//    in-flight attempts
// Small banner shown under the email field when a change is in-flight but
// the user hasn't yet clicked the confirm link in the new inbox. Lets them
// cancel the pending request (e.g. if they typo'd the new address or it
// wasn't them who initiated the change).
function PendingEmailBanner({ refreshUserCtx, t }) {
  const { user } = useUser();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [resending, setResending] = useState(false);
  const pending = user?.pending_email;
  if (!pending?.address) return null;

  async function cancel() {
    setCancelling(true);
    try {
      await api.delete('/auth/email/pending');
      toast(t('settings.emailChangeCancelled'), 'success');
      refreshUserCtx();
    } catch (err) {
      toast(err.response?.data?.error || t('settings.emailChangeFailed'), 'error');
    } finally {
      setCancelling(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await api.post('/auth/email/resend-confirm');
      toast(t('settings.emailChangeResent', 'Confirmation email re-sent.'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('settings.emailChangeResendFailed', 'Could not re-send confirmation.'), 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs" role="status">
      <span aria-hidden="true" className="text-amber-600">⏳</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 dark:text-amber-200">
          {t('settings.emailChangePending', { email: pending.address })}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={resending || cancelling}
          aria-busy={resending}
          className="text-xs text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-50"
        >
          {resending ? t('settings.emailChangeResending', 'Resending…') : t('settings.emailChangeResend', 'Resend')}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling || resending}
          aria-busy={cancelling}
          className="text-xs text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-50"
        >
          {cancelling ? t('common.cancel') + '…' : t('settings.cancelEmailChange')}
        </button>
      </div>
    </div>
  );
}

function EmailChangeButton({ currentEmail, t }) {
  const toast = useToast();
  const { refresh: refreshUserCtx } = useUser();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const cancelBtnRef = useRef(null);
  // Hold a reference to whatever was focused BEFORE the modal opened so
  // we can restore focus there on close. Previously the Escape handler
  // tried to focus cancelBtnRef AFTER setOpen(false), but that ref points
  // at a button inside the just-unmounted modal — focus landed nowhere
  // and screen-reader users lost their place in the page.
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        // Defer until after the modal unmounts, otherwise focus targets
        // an element React is about to remove.
        requestAnimationFrame(() => {
          if (triggerRef.current && document.contains(triggerRef.current)) {
            triggerRef.current.focus();
          }
        });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/auth/email', { new_email: newEmail, password });
      setSent(true);
      setPassword('');
      toast(t('settings.emailChangeSent'), 'success');
      // Refresh UserContext so the PendingEmailBanner under the email
      // field shows immediately — without this, the banner only appears
      // on next visibilitychange.
      refreshUserCtx();
    } catch (err) {
      toast(err.response?.data?.error || t('settings.emailChangeFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setSent(false); }}
        className="btn-secondary text-xs px-3"
        aria-label={t('settings.changeEmail')}
      >
        {t('settings.changeEmail')}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="email-change-title" className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 id="email-change-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.changeEmailTitle')}</h3>
          <button ref={cancelBtnRef} type="button" onClick={() => setOpen(false)} aria-label={t('common.dismiss')} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-5">
          {sent ? (
            <div className="text-center">
              <p className="text-3xl mb-3" aria-hidden="true">📬</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('settings.emailChangeSentTitle')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t('settings.emailChangeSentDesc', { email: newEmail })}</p>
              <button type="button" onClick={() => { setOpen(false); setSent(false); setNewEmail(''); }} className="btn-primary text-sm mt-5">{t('common.done')}</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('settings.changeEmailHint', { current: currentEmail })}
              </p>
              <div>
                <label htmlFor="new-email" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.newEmail')}</label>
                <input id="new-email" type="email" required autoComplete="email" autoFocus maxLength={254}
                  className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div>
                <label htmlFor="ec-password" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.currentPassword')}</label>
                <input id="ec-password" type="password" required autoComplete="current-password"
                  className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary text-sm disabled:opacity-60">
                  {busy ? t('settings.sending') : t('settings.sendConfirmLink')}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">{t('common.cancel')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Browser-extension token UI. Available on ALL plans (no gating) because
// the extension is a PLG wedge — if we gated this to Business-tier we'd
// strangle the funnel the extension is built to feed. Shows one of three
// states: no token (Generate), token exists (Regenerate + Revoke), or the
// just-created plaintext (shown once, with copy button).
function ExtensionTokenSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, hasToken: false, createdAt: null });
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    api.get('/auth/extension-token')
      .then(r => setState({ loading: false, hasToken: r.data.has_token, createdAt: r.data.created_at }))
      .catch(() => setState(s => ({ ...s, loading: false })));
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/extension-token');
      setNewToken(data.token);
      setState({ loading: false, hasToken: true, createdAt: data.created_at });
    } catch {
      toast(t('settings.extension.generateFailed'), 'error');
    } finally { setBusy(false); }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api.delete('/auth/extension-token');
      setState({ loading: false, hasToken: false, createdAt: null });
      setNewToken(null);
      setConfirmRevoke(false);
      toast(t('settings.extension.revoked'), 'success');
    } catch {
      toast(t('settings.extension.revokeFailed'), 'error');
    } finally { setBusy(false); }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  return (
    <section className="mb-6" aria-labelledby="settings-extension">
      <h2 id="settings-extension" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {t('settings.extension.title')}
      </h2>
      <div className="card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-xl">🧩</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 dark:text-gray-200">{t('settings.extension.description')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('settings.extension.availableAllPlans')}</p>
          </div>
        </div>

        {newToken && (
          <div role="alert" className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2">
              {t('settings.extension.tokenShownOnce')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 px-2 py-1.5 rounded border border-amber-200 dark:border-amber-700 truncate">
                {newToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                className="btn-secondary text-xs py-1 px-2 whitespace-nowrap"
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">{t('settings.extension.pasteIntoExtension')}</p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {state.loading ? (
            <span className="text-xs text-gray-400">{t('common.loading')}</span>
          ) : state.hasToken ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" aria-hidden="true" />
                {t('settings.extension.tokenActive')}
              </span>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="btn-secondary text-xs disabled:opacity-60"
              >
                {busy ? t('common.loading') : t('settings.extension.regenerate')}
              </button>
              {confirmRevoke ? (
                <span className="inline-flex items-center gap-2 text-xs">
                  <span className="text-red-600 dark:text-red-400 font-medium">{t('settings.extension.revokeConfirm')}</span>
                  <button
                    type="button"
                    onClick={revoke}
                    disabled={busy}
                    aria-busy={busy}
                    className="text-red-600 dark:text-red-400 font-semibold hover:underline px-1 disabled:opacity-50"
                  >
                    {busy ? t('common.loading') : t('review.yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(false)}
                    disabled={busy}
                    className="text-gray-500 dark:text-gray-400 hover:underline px-1 disabled:opacity-50"
                  >
                    {t('review.cancel') || 'Cancel'}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRevoke(true)}
                  disabled={busy}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-60"
                >
                  {t('settings.extension.revoke')}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="btn-primary text-xs disabled:opacity-60"
            >
              {busy ? t('common.loading') : t('settings.extension.generate')}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('settings.extension.installLink')}
          </a>
        </p>
      </div>
    </section>
  );
}

function ApiKeysSection({ plan }) {
  const { t } = useI18n();
  const toast = useToast();
  const hasPlan = plan === 'business';
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    if (!hasPlan) { setLoading(false); return; }
    api.get('/apikeys').then(r => setKeys(r.data.keys)).catch(() => {}).finally(() => setLoading(false));
  }, [hasPlan]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/apikeys', { name: name.trim() });
      setNewKey(data.key);
      setKeys(prev => [{ id: data.id, name: data.name, key_prefix: data.key_prefix, created_at: data.created_at, last_used_at: null }, ...prev]);
      setName('');
      toast.success(t('settings.apiKeyCreated'));
    } catch (err) {
      toast.error(err?.response?.data?.error || t('settings.apiKeyCreateFailed', 'Error creating key'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id) {
    setRevoking(id);
    try {
      await api.delete(`/apikeys/${id}`);
      setKeys(prev => prev.filter(k => k.id !== id));
      toast.success(t('settings.apiKeyRevoked'));
    } catch (err) {
      toast.error(err?.response?.data?.error || t('settings.apiKeyRevokeFailed', 'Error revoking key'));
    } finally {
      setRevoking(null);
    }
  }

  function handleCopy() {
    if (!newKey) return;
    // The API key is shown ONCE — if clipboard.writeText silently rejects
    // (insecure context, blocked by enterprise policy, etc.) the user is
    // stuck with no recourse. Add a .catch that toasts so they know to
    // hand-select the key before navigating away.
    Promise.resolve()
      .then(() => navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(newKey)
        : Promise.reject(new Error('clipboard unavailable')))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast(t('settings.apiKeyCopyFailed', 'Could not copy. Select the key and copy manually.'), 'error');
      });
  }

  return (
    <section className="mb-6" aria-labelledby="settings-apikeys">
      <h2 id="settings-apikeys" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.apiKeys')}</h2>
      <div className="card p-5 space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.apiKeysDesc')}</p>

        {!hasPlan ? (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3">{t('settings.apiKeysUpgrade')}</p>
        ) : (
          <>
            {newKey && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-green-800 dark:text-green-300">{t('settings.apiKeyCreated')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-800 dark:text-gray-100 truncate">{newKey}</code>
                  <button type="button" onClick={handleCopy} className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline shrink-0">
                    {copied ? t('settings.apiKeyCopied') : t('settings.apiKeyCopy')}
                  </button>
                  <button type="button" onClick={() => setNewKey(null)} aria-label="Dismiss" className="text-gray-400 hover:text-gray-600 text-base leading-none">×</button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreate} className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('settings.apiKeyNamePlaceholder')}
                maxLength={100}
                className="input flex-1 text-sm"
                disabled={creating || keys.length >= 10}
              />
              <button type="submit" disabled={creating || !name.trim() || keys.length >= 10} className="btn-primary text-sm shrink-0">
                {creating ? t('settings.apiKeyCreating') : t('settings.apiKeyCreate')}
              </button>
            </form>
            {keys.length >= 10 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.apiKeyMaxReached')}</p>
            )}

            {loading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />)}
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('settings.apiKeyEmpty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {keys.map(k => (
                  <li key={k.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{k.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        <span className="font-mono">{k.key_prefix}</span>
                        {' · '}
                        {k.last_used_at
                          ? t('settings.apiKeyLastUsed', { when: new Date(k.last_used_at.replace(' ', 'T') + 'Z').toLocaleDateString() })
                          : t('settings.apiKeyNeverUsed')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline shrink-0 disabled:opacity-50"
                    >
                      {revoking === k.id ? t('settings.apiKeyRevoking') : t('settings.apiKeyRevoke')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function BusinessSwitcher({ businesses, activeBusiness, plan, onSwitch, onAdd, t }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const canAdd = plan === 'business' && businesses.length < 5;

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await onAdd(newName.trim());
    setNewName('');
    setAdding(false);
    setSaving(false);
  }

  return (
    <section className="mb-6" aria-labelledby="settings-biz-switcher">
      <h2 id="settings-biz-switcher" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {t('settings.businesses')}
      </h2>
      <div className="card p-5">
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-3">
          {businesses.map(biz => (
            <li key={biz.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{biz.business_name}</p>
              </div>
              {activeBusiness?.id === biz.id ? (
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                  {t('settings.businessActive')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSwitch(biz)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline"
                >
                  {t('settings.businessSwitch')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {canAdd && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + {t('settings.businessAdd')}
          </button>
        )}
        {adding && (
          <form onSubmit={handleAdd} className="flex gap-2 items-center mt-1">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={200}
              placeholder={t('settings.bizNamePlaceholder')}
              className="input text-sm flex-1"
              autoFocus
            />
            <button type="submit" disabled={saving || !newName.trim()} className="btn-primary text-sm px-3 disabled:opacity-50">
              {saving ? t('settings.saving') : t('common.add')}
            </button>
            <button type="button" onClick={() => { setAdding(false); setNewName(''); }} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              {t('common.cancel')}
            </button>
          </form>
        )}
        {!canAdd && plan !== 'business' && businesses.length >= 1 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            <Link to="/pricing" className="underline text-amber-600 dark:text-amber-400">{t('settings.businessUpgrade')}</Link>
          </p>
        )}
      </div>
    </section>
  );
}

export default function Settings() {
  const { t, lang, setLang, languages } = useI18n();
  usePageTitle(t('page.settings'));
  const toast = useToast();
  const navigate = useNavigate();
  const { dark, toggle: toggleTheme } = useTheme();
  const [loadingPage, setLoadingPage] = useState(true);
  const [business, setBusiness] = useState(null);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  // platform_connections rows keyed by provider for quick lookup by ConnectCard
  const [connections, setConnections] = useState({});
  const [syncing, setSyncing] = useState(false);
  const { refresh: refreshUserCtx } = useUser();

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Account deletion confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  // Type-to-confirm phrase. Industry-standard for irreversible destructive
  // actions (GitHub repo delete, Slack workspace delete, AWS console).
  // The password gate alone catches credential abuse but doesn't catch the
  // legit owner who clicked Delete by reflex.
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState('');
  const confirmDeleteRef = useRef(null);
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}; } catch { return {}; }
  });
  // useMemo so NOTIF_ITEMS is not rebuilt on every render — only when language changes
  const NOTIF_ITEMS = useMemo(
    () => NOTIF_KEYS_META.map(m => ({ ...m, label: t(m.labelKey), sub: t(m.subKey) })),
    [t]
  );
  // Auto-focus the confirm-delete button when the danger dialog appears
  useEffect(() => {
    if (confirmDelete) confirmDeleteRef.current?.focus();
  }, [confirmDelete]);

  // Escape key cancels the confirm-delete state (keyboard dismissal)
  useEffect(() => {
    if (!confirmDelete) return;
    function onKey(e) { if (e.key === 'Escape') setConfirmDelete(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDelete]);

  function getNotifChecked(item) {
    return notifPrefs[item.key] !== undefined ? notifPrefs[item.key] : item.defaultOn;
  }
  function toggleNotif(key) {
    const meta = NOTIF_KEYS_META.find(i => i.key === key);
    // Compute new value from current state (avoid capturing inside setState callback)
    const cur = notifPrefs[key] !== undefined ? notifPrefs[key] : meta.defaultOn;
    const newValue = !cur;
    const next = { ...notifPrefs, [key]: newValue };
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    setNotifPrefs(next);
    // Sync server-side. Optimistic UI is already applied above; if the
    // PUT fails we revert the local state and surface a toast so the
    // user doesn't see "ON" in the UI when the server still says OFF.
    api.put('/auth/notifications', { [`notif_${key}`]: newValue })
      .catch((err) => {
        const reverted = { ...next, [key]: cur };
        localStorage.setItem(NOTIF_KEY, JSON.stringify(reverted));
        setNotifPrefs(reverted);
        const msg = err?.response?.data?.error || t('toast.failedSaveNotificationPref', 'Failed to save preference');
        toast(msg, 'error');
      });
  }

  // Load platform_connections, keyed by provider string for O(1) lookups.
  // Failures are silent — the sync UI just won't show status and the user can retry.
  async function reloadConnections() {
    try {
      const { data } = await api.get('/platforms');
      const byProvider = {};
      for (const c of data.connections || []) byProvider[c.provider] = c;
      setConnections(byProvider);
    } catch { /* silent */ }
  }

  useEffect(() => {
    async function load() {
      try {
        const [{ data: bData }, { data: uData }] = await Promise.all([
          api.get('/businesses'),
          api.get('/auth/me'),
        ]);
        const activeId = bData.active_business_id;
        const biz = (activeId ? bData.businesses.find(b => b.id === activeId) : null) || bData.businesses[0] || null;
        setBusiness(biz);
        setAllBusinesses(bData.businesses || []);
        setName(biz?.business_name || '');
        setUser(uData.user);
        setEmail(uData.user?.email || '');
        setSubscription(uData.subscription);
        // Kick off connections load in parallel — safe to run even with no business
        reloadConnections();

        // Google OAuth callback bounces back with ?google=connected or
        // ?google=error&reason=<slug>. Surface as a toast and strip the
        // params so a refresh doesn't re-trigger.
        {
          const p = new URLSearchParams(window.location.search);
          const google = p.get('google');
          if (google === 'connected') {
            toast(t('settings.googleConnected'), 'success');
          } else if (google === 'error') {
            const reason = p.get('reason') || '';
            toast(t('settings.googleFailed', { reason }) , 'error');
          }
          if (google) {
            const url = new URL(window.location.href);
            url.searchParams.delete('google');
            url.searchParams.delete('reason');
            window.history.replaceState({}, '', url.toString());
          }

          // Upgrade-success toast after a successful LemonSqueezy checkout
          // (server redirects to /settings?upgraded=1). Matches the
          // billing.checkout route's successUrl.
          if (p.get('upgraded') === '1') {
            toast(t('settings.upgraded'), 'success');
            const url = new URL(window.location.href);
            url.searchParams.delete('upgraded');
            window.history.replaceState({}, '', url.toString());
          }
        }

        // Merge server-side notification prefs (included in /auth/me since v2)
        if (uData.notifications) {
          const serverPrefs = {
            new_review: uData.notifications.notif_new_review,
            negative_alert: uData.notifications.notif_negative_alert,
            weekly_summary: uData.notifications.notif_weekly_summary,
            follow_up_after_days: uData.notifications.follow_up_after_days ?? 0,
          };
          const merged = { ...serverPrefs }; // server is source of truth on load
          // If the user arrived via an email List-Unsubscribe one-click link
          // (?unsub=digest), honour that by toggling the weekly digest off
          // and persisting to the server. Do this BEFORE setting state so the
          // UI renders the toggled-off state on first paint.
          const params = new URLSearchParams(window.location.search);
          const unsub = params.get('unsub');
          if (unsub === 'digest' && merged.weekly_summary) {
            merged.weekly_summary = false;
            api.put('/auth/notifications', { notif_weekly_summary: false }).catch(() => {});
            toast(t('settings.unsubbedDigest'), 'success');
            // Strip the param so a refresh doesn't re-trigger the toast
            const url = new URL(window.location.href);
            url.searchParams.delete('unsub');
            window.history.replaceState({}, '', url.toString());
          }
          localStorage.setItem(NOTIF_KEY, JSON.stringify(merged));
          setNotifPrefs(merged);
        }
      } catch {
        toast(t('toast.failedLoadSettings'), 'error');
      } finally {
        setLoadingPage(false);
      }
    }
    load();
  }, []);

  async function reloadBusiness() {
    const { data } = await api.get('/businesses');
    // Honour active_business_id rather than blindly taking businesses[0].
    // GET /businesses now returns alphabetically-sorted entries, so picking
    // [0] silently switched the Settings view to a different business after
    // every save for Business-plan users with multiple locations. Mirrors
    // the pattern used by the initial-load effect above.
    const activeId = data.active_business_id;
    const biz = (activeId ? data.businesses.find(b => b.id === activeId) : null)
      || data.businesses[0] || null;
    setBusiness(biz);
    setAllBusinesses(data.businesses || []);
    if (biz) setName(biz.business_name);
    return biz;
  }

  // GDPR data export — fetch the JSON blob and trigger a browser download.
  // We go through fetch (not axios) so we can stream directly to a Blob and
  // use the Content-Disposition filename the server already set.
  const [exportingData, setExportingData] = useState(false);
  async function handleDataExport() {
    setExportingData(true);
    try {
      const token = (await import('../lib/auth')).getToken();
      // Include both the legacy Bearer token AND the session cookie so
      // cookie-only users (post-migration) auth correctly. Without
      // `credentials: 'include'`, fetch would NOT send the httpOnly
      // session cookie, and token-less clients would fail with 401.
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/auth/me/export', {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reviewhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t('settings.exportDone'), 'success');
    } catch {
      toast(t('settings.exportFailed'), 'error');
    } finally {
      setExportingData(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (business) {
        await api.put(`/businesses/${business.id}`, { business_name: name });
      } else {
        await api.post('/businesses', { business_name: name });
      }
      await reloadBusiness();
      toast(t('toast.profileSaved'), 'success');
    } catch {
      toast(t('toast.failedProfile'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(platform, id, opts = {}) {
    const key = platform === 'google' ? 'google_place_id' : platform === 'yelp' ? 'yelp_business_id' : 'facebook_page_id';
    // Ownership attestation is passed to the server alongside the ID so the
    // server can record the attestation in its audit log at the same wall-clock
    // moment the connection row is created. See routes/businesses.js for the
    // corresponding audit entry.
    const body = { [key]: id };
    if (opts.attested) body.ownership_attested = true;
    try {
      if (!business) {
        const { data } = await api.post('/businesses', { business_name: name || 'My Business' });
        await api.put(`/businesses/${data.id}`, body);
      } else {
        await api.put(`/businesses/${business.id}`, body);
      }
      await reloadBusiness();
      await reloadConnections();
      toast(t('toast.platformConnected', { platform: platformLabel(platform) }), 'success');
    } catch {
      toast(t('toast.failedConnect'), 'error');
    }
  }

  // Trigger a manual sync for all of the user's platform connections.
  // The server rate-limits this (6/minute) so rapid clicks are safe.
  async function handleSyncAll() {
    setSyncing(true);
    try {
      const { data } = await api.post('/platforms/sync');
      await reloadConnections();
      toast(
        data.totalInserted > 0
          ? t('sync.successWithNew', { n: data.totalInserted })
          : t('sync.successNoNew'),
        'success'
      );
    } catch (err) {
      toast(err.response?.data?.error || t('sync.failed'), 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return toast(t('toast.pwMismatch'), 'error');
    setPwSaving(true);
    try {
      await api.put('/auth/password', { current: pwForm.current, next: pwForm.next });
      setPwForm({ current: '', next: '', confirm: '' });
      toast(t('toast.pwChanged'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('toast.failedPw'), 'error');
    } finally {
      setPwSaving(false);
    }
  }

  async function deleteAccount() {
    if (!deletePassword) {
      setDeleteError(t('settings.deletePasswordRequired', 'Password is required'));
      return;
    }
    // Industry-standard typed confirmation. Stops reflex-clicks on
    // irreversible deletion. Phrase intentionally case-sensitive.
    if (deleteConfirmPhrase !== 'DELETE') {
      setDeleteError(t('settings.deleteTypeDelete', 'Type DELETE (in capitals) to confirm'));
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      // axios DELETE: body must travel via the `data` config field
      await api.delete('/auth/me', { data: { password: deletePassword } });
      clearToken();
      navigate('/');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || t('toast.failedDeleteAccount');
      if (status === 401) {
        setDeleteError(t('settings.deleteIncorrectPassword', 'Incorrect password'));
      } else {
        toast(msg, 'error');
      }
      setDeleting(false);
    }
  }

  const subStatus = subscription?.status;
  const subBadge = subStatus === 'active'
    ? { label: t('settings.subActive'), cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' }
    : subStatus === 'trial'
    ? { label: t('settings.subTrial'), cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' }
    : { label: subStatus ?? t('settings.subUnknown'), cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' };

  if (loadingPage) {
    return (
      <div className="rh-design rh-app min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-8 bg-gray-100 rounded w-1/4 mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-2xl mx-auto px-4 py-8">
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              № 03 · {t('settings.eyebrow', 'Settings')}
            </p>
            <h1>{t('settings.title')}</h1>
            <p className="rh-page-sub">{t('settings.subtitle', 'Account, business, integrations')}</p>
          </div>
          <div className="rh-page-actions">
            {subscription && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${subBadge.cls}`}>
                {subBadge.label}
                {subscription.renewal_date ? ` · ${t('settings.renewsOn', { date: new Date(subscription.renewal_date).toLocaleDateString(lang) })}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Multi-business switcher — only visible when user has or can add multiple businesses */}
        {(allBusinesses.length > 1 || (subscription?.plan === 'business' && allBusinesses.length >= 1)) && (
          <BusinessSwitcher
            businesses={allBusinesses}
            activeBusiness={business}
            plan={subscription?.plan}
            onSwitch={async (biz) => {
              try {
                await api.put('/businesses/active', { business_id: biz.id });
                setBusiness(biz);
                setAllBusinesses(prev => prev.map(b => b.id === biz.id ? biz : b));
                setName(biz.business_name || '');
                reloadConnections();
                toast(t('settings.businessSwitched', { name: biz.business_name }), 'success');
              } catch {
                toast(t('settings.businessSwitchFailed'), 'error');
              }
            }}
            onAdd={async (bizName) => {
              try {
                const { data } = await api.post('/businesses', { business_name: bizName });
                const newBiz = data;
                setAllBusinesses(prev => [...prev, newBiz]);
                await api.put('/businesses/active', { business_id: newBiz.id });
                setBusiness(newBiz);
                setName(newBiz.business_name || '');
                reloadConnections();
                toast(t('settings.businessAdded', { name: newBiz.business_name }), 'success');
              } catch (err) {
                toast(err.response?.data?.error || t('settings.businessAddFailed'), 'error');
              }
            }}
            t={t}
          />
        )}

        {/* Business profile */}
        <section className="mb-6" aria-labelledby="settings-biz-profile">
          <h2 id="settings-biz-profile" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.businessProfile')}</h2>
          <div className="card p-5">
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label htmlFor="biz-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('settings.businessName')}
                  <span className="text-red-500 ml-0.5" aria-label={t('common.required')}>*</span>
                </label>
                <input
                  id="biz-name"
                  name="organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder={t('settings.bizNamePlaceholder')}
                  autoComplete="organization"
                  maxLength={200}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="biz-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.email')}</label>
                <div className="flex gap-2 items-stretch">
                  <input id="biz-email" value={email} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed flex-1" autoComplete="email" />
                  <EmailChangeButton currentEmail={email} onChanged={(e) => setEmail(e)} t={t} />
                </div>
                <PendingEmailBanner refreshUserCtx={refreshUserCtx} t={t} />
              </div>
              <button type="submit" disabled={saving} aria-busy={saving} className="btn-primary text-sm">
                {saving ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </form>
          </div>
        </section>

        {/* Platform connections */}
        <section className="mb-6" aria-labelledby="settings-platforms">
          <div className="flex items-center justify-between mb-3">
            <h2 id="settings-platforms" className="text-base font-semibold text-gray-700 dark:text-gray-300">{t('settings.connectedPlatforms')}</h2>
            {Object.keys(connections).length > 0 && (
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncing}
                aria-busy={syncing}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-60"
              >
                {syncing ? t('sync.syncing') : t('sync.syncNow')}
              </button>
            )}
          </div>
          <div className="space-y-3">
            <ConnectCard platform="google" icon={<span aria-hidden="true">🔵</span>} color="bg-blue-50" connected={business?.google_place_id} onConnect={handleConnect} syncStatus={connections.google} />
            <ConnectCard platform="yelp" icon={<span aria-hidden="true">🔴</span>} color="bg-red-50" connected={business?.yelp_business_id} onConnect={handleConnect} syncStatus={connections.yelp} />
            <ConnectCard platform="facebook" icon={<span aria-hidden="true">🟣</span>} color="bg-indigo-50" connected={business?.facebook_page_id} onConnect={handleConnect} syncStatus={connections.facebook} />
          </div>
          {/* CSV-imported platforms — shown so users see the full registry
              and don't think we only support 3 platforms. The "Connected"
              cards above are auto-sync; everything below works via the CSV
              Import section further down on this page. */}
          <CsvOnlyPlatforms lang={lang} />
        </section>

        {/* Review Tags */}
        <TagManager />

        {/* Auto-respond Rules */}
        <AutoRules />

        {/* Response Templates */}
        <ResponseTemplates />

        {/* Outbound Webhooks */}
        <WebhooksSection />

        {/* Inbound email forwarding (auto-import via email) */}
        <InboundForwardingSection />

        {/* CSV Import */}
        <ImportSection />

        {/* Review Widget */}
        {business && <WidgetSection business={business} onUpdate={(updated) => setBusiness(b => ({ ...b, ...updated }))} />}

        {/* Change password */}
        <section className="mb-6" aria-labelledby="settings-change-pw">
          <h2 id="settings-change-pw" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.changePassword')}</h2>
          <div className="card p-5">
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <label htmlFor="pw-current" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.currentPassword')}</label>
                <div className="relative">
                  <input
                    id="pw-current"
                    name="current-password"
                    type={showPw ? 'text' : 'password'} required className="input pr-10"
                    autoComplete="current-password"
                    maxLength={128}
                    value={pwForm.current}
                    onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs">
                    {showPw ? t('settings.hidePw') : t('settings.showPw')}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="pw-next" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.newPassword')}</label>
                <input
                  id="pw-next"
                  name="new-password"
                  type={showPw ? 'text' : 'password'} required className="input" minLength={6} maxLength={128}
                  autoComplete="new-password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))}
                  placeholder={t('auth.pwMinCharsHint')}
                />
                <PasswordStrength password={pwForm.next} />
              </div>
              <div>
                <label htmlFor="pw-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('settings.confirmPassword')}</label>
                <input
                  id="pw-confirm"
                  name="confirm-password"
                  type={showPw ? 'text' : 'password'} required className="input"
                  autoComplete="new-password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" disabled={pwSaving} className="btn-primary text-sm">
                {pwSaving ? t('settings.updating') : t('settings.updatePassword')}
              </button>
            </form>
          </div>
        </section>

        {/* Billing — shown above 2FA so users see plan info early in Settings */}
        <BillingSection
          subscription={subscription}
          onRefresh={async () => {
            try {
              const { data } = await api.get('/auth/me');
              setSubscription(data.subscription);
              // Also refresh the shared context so Navbar/banners see the new plan
              refreshUserCtx();
            } catch { /* no-op */ }
          }}
        />

        {/* Two-factor auth */}
        <MfaSection
          mfaEnabled={!!user?.mfa_enabled}
          onMfaChange={async () => {
            // Re-fetch /me so other parts of the UI see the updated state.
            try {
              const { data } = await api.get('/auth/me');
              setUser(prev => ({ ...(prev || {}), mfa_enabled: data.user.mfa_enabled, email_verified: data.user.email_verified }));
              refreshUserCtx();
            } catch { /* no-op */ }
          }}
        />

        {/* Browser Extension (all plans) */}
        <ExtensionTokenSection />

        {/* API Keys */}
        <ApiKeysSection plan={subscription?.plan} />

        {/* Appearance */}
        <section className="mb-6" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.appearance')}</h2>
          <div className="card p-5 space-y-4">
            {/* Dark mode toggle */}
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings.darkMode')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.darkModeDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dark}
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${dark ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className="sr-only">{t('settings.darkModeToggle')}</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${dark ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>

            {/* Language selector */}
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings.language')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.languageDesc')}</p>
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                aria-label={t('settings.langAriaLabel')}
                className="input w-auto text-sm"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Email notifications */}
        <section className="mb-6" aria-labelledby="settings-notif">
          <h2 id="settings-notif" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.emailNotifications')}</h2>
          <div className="card p-5 space-y-3">
            {/* Single upgrade banner when ANY notification toggle is plan-gated.
                Previously each gated row + the follow-up row each rendered its
                own "Upgrade required" link, so a Free-tier user saw 4 nearly-
                identical links stacked in the same card. One banner is clearer. */}
            {(() => {
              const anyGated =
                NOTIF_ITEMS.some(n => n.planFeature && !subscription?.plan_meta?.features?.[n.planFeature]) ||
                !subscription?.plan_meta?.features?.templates;
              if (!anyGated) return null;
              return (
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {t('settings.notif.upgradeBanner', 'Email notifications + follow-up reminders are part of paid plans.')}
                  </p>
                  <Link to="/pricing" className="text-xs font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline whitespace-nowrap">
                    {t('settings.notif.upgradeCta', 'View plans →')}
                  </Link>
                </div>
              );
            })()}
            {NOTIF_ITEMS.map((n) => {
              const planAllowed = !n.planFeature || !!subscription?.plan_meta?.features?.[n.planFeature];
              return (
                <label key={n.key} className={`flex items-center justify-between gap-4 ${planAllowed ? 'cursor-pointer' : 'cursor-default opacity-60'}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{n.label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{n.sub}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={planAllowed && getNotifChecked(n)}
                    onChange={() => planAllowed && toggleNotif(n.key)}
                    disabled={!planAllowed}
                    aria-disabled={!planAllowed}
                    className="w-4 h-4 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                  />
                </label>
              );
            })}
            {/* Follow-up review requests — Starter+ */}
            {(() => {
              const followUpAllowed = !!subscription?.plan_meta?.features?.templates;
              const currentDays = notifPrefs.follow_up_after_days ?? 0;
              return (
                <div className={`pt-3 border-t border-gray-100 dark:border-gray-700 ${followUpAllowed ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings.notif.followUp')}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.notif.followUpSub')}</p>
                      {/* Upgrade link removed — single banner at top of the card
                          covers both notification toggles + follow-up gating. */}
                    </div>
                    <select
                      value={followUpAllowed ? currentDays : 0}
                      disabled={!followUpAllowed}
                      onChange={(e) => {
                        if (!followUpAllowed) return;
                        const days = Number(e.target.value);
                        const prev = notifPrefs.follow_up_after_days;
                        const next = { ...notifPrefs, follow_up_after_days: days };
                        localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
                        setNotifPrefs(next);
                        api.put('/auth/notifications', { follow_up_after_days: days })
                          .catch((err) => {
                            const reverted = { ...next, follow_up_after_days: prev };
                            localStorage.setItem(NOTIF_KEY, JSON.stringify(reverted));
                            setNotifPrefs(reverted);
                            const msg = err?.response?.data?.error || t('toast.failedSaveNotificationPref', 'Failed to save preference');
                            toast(msg, 'error');
                          });
                      }}
                      className="text-sm border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 disabled:cursor-not-allowed"
                      aria-label={t('settings.notif.followUp')}
                    >
                      <option value={0}>{t('settings.notif.followUpOff')}</option>
                      <option value={3}>{t('settings.notif.followUpDays', { n: 3 })}</option>
                      <option value={5}>{t('settings.notif.followUpDays', { n: 5 })}</option>
                      <option value={7}>{t('settings.notif.followUpDays', { n: 7 })}</option>
                      <option value={14}>{t('settings.notif.followUpDays', { n: 14 })}</option>
                    </select>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Data export — before the danger zone so it's reassuring rather than scary */}
        <section className="mb-6" aria-labelledby="settings-export">
          <h2 id="settings-export" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('settings.yourData')}</h2>
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.exportData')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.exportDataDesc')}</p>
              </div>
              <button
                type="button"
                onClick={handleDataExport}
                disabled={exportingData}
                aria-busy={exportingData}
                className="btn-secondary text-sm disabled:opacity-60"
              >
                {exportingData ? t('settings.exporting') : t('settings.downloadJson')}
              </button>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section aria-labelledby="settings-danger">
          <h2 id="settings-danger" className="text-base font-semibold text-red-600 mb-3">{t('settings.dangerZone')}</h2>
          <div className="card p-5 border border-red-200 dark:border-red-900/60">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.deleteAccount')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('settings.deleteAccountDesc')}</p>
              </div>
              {confirmDelete ? (
                <div className="flex flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">{t('settings.confirmDelete')}</p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('settings.deletePasswordPlaceholder', 'Enter password to confirm')}
                    value={deletePassword}
                    onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    disabled={deleting}
                    aria-label={t('settings.deletePasswordPlaceholder', 'Enter password to confirm')}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <input
                    type="text"
                    placeholder={t('settings.deletePhrasePlaceholder', 'Type DELETE to confirm')}
                    value={deleteConfirmPhrase}
                    onChange={(e) => { setDeleteConfirmPhrase(e.target.value); setDeleteError(''); }}
                    disabled={deleting}
                    aria-label={t('settings.deletePhrasePlaceholder', 'Type DELETE to confirm')}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="text-xs font-mono px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {deleteError && (
                    <p role="alert" className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      ref={confirmDeleteRef}
                      onClick={deleteAccount}
                      disabled={deleting || !deletePassword || deleteConfirmPhrase !== 'DELETE'}
                      aria-busy={deleting}
                      className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {deleting ? t('settings.deleting') : t('settings.yesDelete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteConfirmPhrase(''); setDeleteError(''); }}
                      className="text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {t('settings.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex-shrink-0 text-sm font-medium text-red-600 border border-red-300 dark:border-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t('settings.deleteAccount')}
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
