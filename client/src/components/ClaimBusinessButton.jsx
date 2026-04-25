import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';
import { useI18n } from '../context/I18nContext';
import { isLoggedIn } from '../lib/auth';
import { Link } from 'react-router-dom';
import { makeT } from '../utils/tFallback';

// ClaimBusinessButton
// ----------------------------------------------------------------------------
// Drop-in CTA shown on a public business detail page. Lets a signed-in user
// submit an ownership claim. Surfaces the current claim status (none /
// pending / approved / rejected) so the same component covers every state.
//
// Backend contract:
//   GET  /api/businesses/:id/claim   → { status, claim?: {...} } | 404 (none)
//   POST /api/businesses/:id/claim   → { status: 'pending' }
//
// The submit form is intentionally minimal — name + role + optional note.
// All copy uses the existing i18n keys with English fallback so this ships
// without translation churn.
export default function ClaimBusinessButton({ businessId, businessName }) {
  const toast = useToast();
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // null = unknown, 'none' | 'pending' | 'approved' | 'rejected'
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const triggerRef = useRef(null);

  // Look up the current user's claim status on mount (once per businessId).
  useEffect(() => {
    if (!isLoggedIn()) { setStatus('anonymous'); setLoadingStatus(false); return; }
    let cancelled = false;
    setLoadingStatus(true);
    api.get(`/businesses/${businessId}/claim`)
      .then(({ data }) => {
        if (cancelled) return;
        setStatus(data?.status || 'none');
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 = no claim yet, treat as 'none'
        if (err?.response?.status === 404) setStatus('none');
        else setStatus('none');
      })
      .finally(() => { if (!cancelled) setLoadingStatus(false); });
    return () => { cancelled = true; };
  }, [businessId]);

  // Focus the first field when the modal opens; restore focus on close
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => firstFieldRef.current?.focus());
    } else {
      triggerRef.current?.focus?.();
    }
  }, [open]);

  // Escape closes the modal
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim() || !role.trim()) {
      toast(t('claim.missingFields', 'Name and role are required'), 'error');
      return;
    }
    setSubmitting(true);
    // Optimistic flip — server confirms shortly after
    const prev = status;
    setStatus('pending');
    try {
      await api.post(`/businesses/${businessId}/claim`, {
        contact_name: name.trim(),
        role: role.trim(),
        note: note.trim() || undefined,
      });
      toast(t('claim.submitted', 'Claim submitted — we’ll review it shortly'), 'success');
      setOpen(false);
    } catch (err) {
      setStatus(prev);
      const msg = err?.response?.data?.error || t('claim.failed', 'Could not submit claim — please try again');
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingStatus) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-gray-400" aria-live="polite">
        <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        {t('claim.checking', 'Checking ownership status…')}
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <Link to="/login" className="btn-secondary text-sm">
        {t('claim.signInToClaim', 'Sign in to claim this business')}
      </Link>
    );
  }

  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
        <span aria-hidden="true">✓</span>
        {t('claim.approved', 'Verified owner')}
      </span>
    );
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <span aria-hidden="true">⏳</span>
        {t('claim.pending', 'Claim under review')}
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
        {t('claim.rejected', 'Claim was not approved')}
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary text-sm"
        aria-haspopup="dialog"
      >
        {t('claim.claimCta', 'Claim this business')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-modal-title"
            className="card w-full max-w-md p-6 shadow-lg"
          >
            <h2 id="claim-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {t('claim.modalTitle', 'Claim this business')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {(t('claim.modalSubtitle', 'Tell us who you are at {name}. We’ll verify and grant owner-response access.')).replace('{name}', businessName || 'this business')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="claim-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('claim.fieldName', 'Your name')} <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  ref={firstFieldRef}
                  id="claim-name"
                  type="text"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="claim-role" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('claim.fieldRole', 'Your role')} <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="claim-role"
                  type="text"
                  required
                  maxLength={120}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('claim.fieldRolePlaceholder', 'Owner, Manager, Marketing Lead…')}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="claim-note" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {t('claim.fieldNote', 'Anything we should know? (optional)')}
                </label>
                <textarea
                  id="claim-note"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input resize-none"
                  placeholder={t('claim.fieldNotePlaceholder', 'e.g. company email domain, business registration number')}
                />
                <p className="mt-1 text-xs text-gray-400">{note.length}/500</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm" disabled={submitting}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn-primary text-sm" disabled={submitting} aria-busy={submitting}>
                  {submitting
                    ? (t('claim.submitting', 'Submitting…'))
                    : (t('claim.submit', 'Submit claim'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
