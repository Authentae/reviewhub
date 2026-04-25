import React, { useState, useMemo } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';
import { useI18n } from '../context/I18nContext';
import ReviewResponseForm from './ReviewResponseForm';
import { makeT } from '../utils/tFallback';

// ReviewResponse
// ----------------------------------------------------------------------------
// Public-facing display card for a business owner's response. Renders nested
// under the review on a business detail page. The owner sees inline edit /
// delete affordances; everyone else sees just the response text + meta.
//
// Backend contract:
//   PUT    /api/reviews/:id/response  { text }
//   DELETE /api/reviews/:id/response
//
// `response` shape (per spec):
//   { text, owner_name, created_at, updated_at }
//
// Props:
//   reviewId      — the parent review ID (used for the API verbs)
//   response      — the response object, or null
//   isOwner       — does the current user own the parent business?
//   onChanged(r)  — fired on save/delete with the new response (or null on delete)
export default function ReviewResponse({ reviewId, response, isOwner = false, onChanged }) {
  const toast = useToast();
  const { t: rawT, lang } = useI18n();
  const t = makeT(rawT);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [optimistic, setOptimistic] = useState(response);

  // Keep local state synced if the parent passes a fresh response prop
  React.useEffect(() => { setOptimistic(response); }, [response]);

  const fmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang || 'en', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }, [lang]);

  function formatDate(s) {
    if (!s) return '';
    try { return fmt.format(new Date(s)); } catch { return s; }
  }

  if (!optimistic) return null;

  if (editing) {
    return (
      <div className="mt-3 ml-4 sm:ml-8">
        <ReviewResponseForm
          reviewId={reviewId}
          initialText={optimistic.text}
          mode="edit"
          onSaved={(r) => {
            setOptimistic(r);
            setEditing(false);
            onChanged?.(r);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    const prev = optimistic;
    setOptimistic(null); // optimistic remove
    try {
      await api.delete(`/reviews/${reviewId}/response`);
      toast(t('ownerResponse.deleted', 'Response deleted'), 'info');
      onChanged?.(null);
    } catch (err) {
      setOptimistic(prev);
      setConfirmDelete(false);
      toast(err?.response?.data?.error || t('ownerResponse.deleteFailed', 'Could not delete response'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  const wasEdited = optimistic.updated_at && optimistic.created_at && optimistic.updated_at !== optimistic.created_at;

  return (
    <div
      className="mt-3 ml-4 sm:ml-8 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20"
      data-testid="review-response"
      aria-label={t('ownerResponse.regionAria', 'Owner response')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-blue-600 text-white">
            <span aria-hidden="true">✓</span>
            {t('ownerResponse.badge', 'Owner response')}
          </span>
          {optimistic.owner_name && (
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {optimistic.owner_name}
            </span>
          )}
          <span
            className="text-xs text-gray-400 cursor-default"
            title={formatDate(optimistic.created_at)}
          >
            {formatDate(optimistic.created_at)}
            {wasEdited && (
              <span className="ml-1 italic" title={formatDate(optimistic.updated_at)}>
                · {t('ownerResponse.edited', 'edited')}
              </span>
            )}
          </span>
        </div>

        {isOwner && !confirmDelete && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
              aria-label={t('ownerResponse.editAria', 'Edit owner response')}
            >
              {t('common.edit', 'Edit')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
              aria-label={t('ownerResponse.deleteAria', 'Delete owner response')}
            >
              {t('common.delete', 'Delete')}
            </button>
          </div>
        )}

        {isOwner && confirmDelete && (
          <div className="flex items-center gap-2 flex-shrink-0" role="group" aria-label={t('ownerResponse.confirmDeleteAria', 'Confirm delete')}>
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
              {t('ownerResponse.confirmDelete', 'Delete?')}
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting}
              className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline disabled:opacity-50"
            >
              {deleting ? (t('common.deleting', 'Deleting…')) : (t('common.yes', 'Yes'))}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-xs text-gray-500 hover:underline disabled:opacity-50"
            >
              {t('common.no', 'No')}
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
        {optimistic.text}
      </p>
    </div>
  );
}
