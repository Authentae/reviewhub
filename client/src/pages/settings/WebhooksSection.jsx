// Webhooks settings sub-page — extracted from Settings.jsx for bundle splitting.
//
// Power-user feature (HMAC-signed outbound webhooks for Zapier / Make /
// custom integrations). Most Free / Starter / Pro users never open this
// section; lazy-loading saves them ~12-15KB of gzipped JS on first paint.
//
// Default-export so it can be loaded via React.lazy() in Settings.jsx.

import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../context/I18nContext';
import api from '../../lib/api';

const WEBHOOK_EVENTS = ['review.created', 'review.responded'];

export default function WebhooksSection() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState(['review.created']);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [showDeliveries, setShowDeliveries] = useState({});
  const [deliveries, setDeliveries] = useState({});
  const [loadingDeliveries, setLoadingDeliveries] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmRotateId, setConfirmRotateId] = useState(null);
  const [rotating, setRotating] = useState({});
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
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.updateFailed'), 'error');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/webhooks/${id}`);
      setHooks(prev => prev.filter(h => h.id !== id));
      toast(t('webhooks.deleted'), 'info');
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.deleteFailed'), 'error');
    }
  }

  async function handleRotate(id) {
    setRotating(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.post(`/webhooks/${id}/rotate`);
      const hook = hooks.find(h => h.id === id);
      if (data.secret) setRevealedSecret({ id: data.id, secret: data.secret, url: hook?.url || '' });
      toast(t('webhooks.rotated', 'New signing secret generated. Save it now — you won\'t see it again.'), 'success');
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.rotateFailed', 'Rotation failed'), 'error');
    } finally {
      setRotating(prev => ({ ...prev, [id]: false }));
      setConfirmRotateId(null);
    }
  }

  async function handleTest(id) {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.post(`/webhooks/${id}/test`);
      const baseMsg = data.ok
        ? t('webhooks.testOk', { status: data.status })
        : t('webhooks.testFailed', { status: data.status || 0 });
      const detail = data.errorReason
        ? ` — ${data.errorReason}`
        : (!data.ok && data.responseSnippet
            ? ` — ${data.responseSnippet.slice(0, 200)}`
            : '');
      toast(baseMsg + detail, data.ok ? 'success' : 'error');
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.testError'), 'error');
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
    } catch (err) {
      toast(err?.response?.data?.error || t('webhooks.deliveriesError'), 'error');
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
                        {confirmRotateId === hook.id ? (
                          <>
                            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium" title={t('webhooks.rotateWarning', 'Receiver will fail until you update its secret')}>{t('webhooks.rotateConfirm', 'Rotate?')}</span>
                            <button type="button" onClick={() => handleRotate(hook.id)} disabled={rotating[hook.id]}
                              className="text-xs text-amber-700 font-semibold hover:underline px-1 disabled:opacity-50">{rotating[hook.id] ? '…' : t('tags.yes')}</button>
                            <button type="button" onClick={() => setConfirmRotateId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1">{t('tags.no')}</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmRotateId(hook.id)}
                            title={t('webhooks.rotateTooltip', 'Generate a new signing secret')}
                            className="text-xs text-gray-400 hover:text-amber-600 dark:hover:text-amber-400">{t('webhooks.rotate', 'Rotate')}</button>
                        )}
                        <button type="button" onClick={() => handleToggle(hook)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${hook.enabled ? 'border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-900/20 hover:bg-green-100' : 'border-gray-200 text-gray-400 hover:bg-gray-50 dark:border-gray-600'}`}>
                          {hook.enabled ? t('webhooks.active') : t('webhooks.disabled')}
                        </button>
                        {confirmDeleteId === hook.id ? (
                          <>
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('webhooks.deleteConfirm')}</span>
                            <button
                              type="button"
                              onClick={() => { handleDelete(hook.id); setConfirmDeleteId(null); }}
                              className="text-xs text-red-600 font-semibold hover:underline px-1"
                            >{t('tags.yes')}</button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            >{t('tags.no')}</button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(hook.id)}
                            aria-label={t('webhooks.deleteAria', 'Delete webhook')}
                            className="text-xs text-gray-300 hover:text-red-400 px-1"
                          >✕</button>
                        )}
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
                                  <td className="pr-3 py-1 text-gray-500 whitespace-nowrap">{new Date(d.triggered_at).toLocaleString(lang)}</td>
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
                  {newUrl.trim().toLowerCase().startsWith('http://') && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                      <span aria-hidden="true">⚠️</span>
                      <span>{t('webhooks.httpWarning', 'http:// URLs send the signing secret in cleartext. Use https:// in production.')}</span>
                    </p>
                  )}
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
                  <button type="submit" disabled={saving || newEvents.length === 0} aria-busy={saving} className="btn-primary text-xs py-1 px-3 disabled:opacity-50">
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
