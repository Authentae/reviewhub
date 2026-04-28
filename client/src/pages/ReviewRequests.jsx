import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import usePageTitle from '../hooks/usePageTitle';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';

const PLATFORMS = ['google', 'yelp', 'facebook'];
const PLATFORM_LABELS = { google: 'Google', yelp: 'Yelp', facebook: 'Facebook' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StatCard({ label, value, color = '' }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function ReviewRequests() {
  const { t, lang } = useI18n();
  const toast = useToast();
  usePageTitle(t('page.reviewRequests'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [resending, setResending] = useState(null);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkPlatform, setBulkPlatform] = useState('google');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState('google');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/review-requests?page=${p}&limit=20`);
      setData(res);
    } catch {
      toast(t('requests.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(page); }, [fetchData, page]);

  async function handleSend(e) {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError(t('requests.nameRequired')); return; }
    if (!EMAIL_RE.test(email.trim())) { setFormError(t('requests.invalidEmail')); return; }

    setSending(true);
    try {
      await api.post('/review-requests', {
        customer_name: name.trim(),
        customer_email: email.trim(),
        platform,
        message: message.trim() || undefined,
      });
      toast(t('requests.sent'), 'success');
      setName('');
      setEmail('');
      setMessage('');
      setPage(1);
      fetchData(1);
    } catch (err) {
      const msg = err.response?.data?.error || t('requests.sendFailed');
      setFormError(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleBulkSend(e) {
    e.preventDefault();
    if (!bulkFile) return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const csvText = await bulkFile.text();
      const params = new URLSearchParams({ platform: bulkPlatform });
      if (bulkMessage.trim()) params.set('message', bulkMessage.trim());
      const { data: res } = await api.post(`/review-requests/bulk?${params}`, csvText, {
        headers: { 'Content-Type': 'text/csv' },
      });
      setBulkResult(res);
      if (res.sent > 0) {
        toast(t('requests.bulkSent', { n: res.sent }), 'success');
        setBulkFile(null);
        setBulkMessage('');
        fetchData(1);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        toast(t('requests.bulkUpgradeRequired'), 'error');
      } else {
        toast(err.response?.data?.error || t('requests.bulkFailed'), 'error');
      }
    } finally {
      setBulkSending(false);
    }
  }

  async function handleResend(id) {
    setResending(id);
    try {
      await api.post(`/review-requests/${id}/resend`);
      toast(t('requests.resent'), 'success');
      fetchData(page);
    } catch (err) {
      toast(err.response?.data?.error || t('requests.resentFailed'), 'error');
    } finally {
      setResending(null);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/review-requests/${id}`);
      toast(t('requests.deleted'), 'info');
      fetchData(page);
    } catch {
      toast(t('requests.deleteFailed'), 'error');
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  const formatDate = (str) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return str; }
  };

  const clickRate = data?.stats?.sent > 0
    ? Math.round((data.stats.clicked / data.stats.sent) * 100)
    : 0;

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              № 05 · {t('requests.eyebrow', 'Outreach')}
            </p>
            <h1>{t('requests.title')}</h1>
            <p className="rh-page-sub">{t('requests.subtitle')}</p>
          </div>
        </div>

        {/* Stats */}
        {data?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label={t('requests.statSent')} value={data.stats.sent} />
            <StatCard label={t('requests.statClicked')} value={data.stats.clicked} color="text-green-600 dark:text-green-400" />
            <StatCard label={t('requests.statClickRate')} value={`${clickRate}%`} color="text-blue-600 dark:text-blue-400" />
            {data.stats.followed_up > 0 && (
              <StatCard label={t('requests.statFollowedUp')} value={data.stats.followed_up} color="text-purple-600 dark:text-purple-400" />
            )}
          </div>
        )}

        {/* Send form */}
        <section className="card p-5 mb-6" aria-labelledby="send-request-title">
          <h2 id="send-request-title" className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
            {t('requests.sendRequest')}
          </h2>
          <form onSubmit={handleSend} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.customerName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={200}
                  className="input text-sm w-full"
                  placeholder={t('requests.customerNamePlaceholder')}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.customerEmail')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  maxLength={320}
                  className="input text-sm w-full"
                  placeholder="customer@example.com"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.platform')}
                </label>
                <select value={platform} onChange={e => setPlatform(e.target.value)} className="input text-sm w-full">
                  {PLATFORMS.map(p => (
                    <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.personalMessage')} <span className="text-xs text-gray-400">({t('common.optional')})</span>
                </label>
                <input
                  type="text"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={500}
                  className="input text-sm w-full"
                  placeholder={t('requests.messagePlaceholder')}
                />
              </div>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={sending} aria-busy={sending} className="btn-primary text-sm disabled:opacity-50">
                {sending ? t('requests.sending') : t('requests.send')}
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('requests.sendHint')}</p>
            </div>
          </form>
        </section>

        {/* Bulk send */}
        <section className="card p-5 mb-6" aria-labelledby="bulk-request-title">
          <h2 id="bulk-request-title" className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
            {t('requests.bulkTitle')}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{t('requests.bulkSubtitle')}</p>
          <form onSubmit={handleBulkSend} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.bulkFile')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={e => { setBulkFile(e.target.files?.[0] || null); setBulkResult(null); }}
                  className="text-sm text-gray-600 dark:text-gray-300 w-full"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('requests.bulkFileHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t('requests.platform')}
                </label>
                <select value={bulkPlatform} onChange={e => setBulkPlatform(e.target.value)} className="input text-sm w-full">
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('requests.personalMessage')} <span className="text-xs text-gray-400">({t('common.optional')})</span>
              </label>
              <input
                type="text"
                value={bulkMessage}
                onChange={e => setBulkMessage(e.target.value)}
                maxLength={500}
                className="input text-sm w-full"
                placeholder={t('requests.messagePlaceholder')}
              />
            </div>
            {bulkResult && (
              <div className={`text-xs p-3 rounded-lg ${bulkResult.sent > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                {t('requests.bulkResult', { sent: bulkResult.sent, skipped: bulkResult.skipped })}
                {bulkResult.errors?.length > 0 && (
                  <ul className="mt-1 list-disc list-inside opacity-80">
                    {bulkResult.errors.slice(0, 5).map((e, i) => <li key={i}>{t('requests.bulkErrorRow', { row: e.row, reason: e.reason })}</li>)}
                    {bulkResult.errors.length > 5 && <li>+{bulkResult.errors.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
            <button type="submit" disabled={bulkSending || !bulkFile} aria-busy={bulkSending} className="btn-primary text-sm disabled:opacity-50">
              {bulkSending ? t('requests.bulkSending') : t('requests.bulkSend')}
            </button>
          </form>
        </section>

        {/* History table */}
        <section aria-labelledby="history-title">
          <h2 id="history-title" className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            {t('requests.history')}
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="card p-4 animate-pulse h-12" />
              ))}
            </div>
          ) : !data?.requests?.length ? (
            <EmptyState
              icon="📧"
              title={t('requests.noHistory')}
              body={t('requests.noHistoryHint')}
              className="p-8"
            />
          ) : (
            <>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{t('requests.customer')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">{t('requests.platform')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">{t('requests.sentAt')}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{t('requests.status')}</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.requests.map(rr => (
                      <tr key={rr.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]">{rr.customer_name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{rr.customer_email}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="capitalize text-gray-600 dark:text-gray-300 text-xs">{PLATFORM_LABELS[rr.platform] || rr.platform}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(rr.sent_at)}
                        </td>
                        <td className="px-4 py-3">
                          {rr.clicked_at ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                              ✓ {t('requests.clicked')}
                            </span>
                          ) : rr.follow_up_sent_at ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full" title={t('requests.followUpSentAt', { date: formatDate(rr.follow_up_sent_at) })}>
                              ↺ {t('requests.followedUp')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
                              {t('requests.pending')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleResend(rr.id)}
                              disabled={resending === rr.id}
                              aria-label={t('requests.resendAria', { name: rr.customer_name })}
                              className="text-gray-400 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400 text-xs px-1 disabled:opacity-40"
                              title={t('requests.resend')}
                            >
                              {resending === rr.id ? '…' : '↺'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rr.id)}
                              aria-label={t('requests.deleteAria', { name: rr.customer_name })}
                              className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 text-xs px-1"
                            >✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                    className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
                  >{t('dashboard.prevPage')}</button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('dashboard.paginationInfo', { from: (page-1)*20+1, to: Math.min(page*20, data.total), total: data.total })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                    className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
                  >{t('dashboard.nextPage')}</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Tip: configure platform IDs */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
          <span aria-hidden="true">💡 </span>
          {t('requests.configTip')}{' '}
          <Link to="/settings" className="underline font-medium">{t('requests.configTipLink')}</Link>
        </div>
      </main>
    </div>
  );
}
