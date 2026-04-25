import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';
import { useI18n } from '../context/I18nContext';
import { makeT } from '../utils/tFallback';

// ReviewResponseForm
// ----------------------------------------------------------------------------
// Inline composer for an approved business owner to respond to a review (or
// edit an existing response). Used by ReviewResponse for the edit flow and
// directly underneath a review when no response exists yet.
//
// Backend contract:
//   POST /api/reviews/:id/response   { text }
//   PUT  /api/reviews/:id/response   { text }
//
// Validation: 10–2000 chars (trimmed), client-side gate matches the server.
const MIN_LEN = 10;
const MAX_LEN = 2000;

export default function ReviewResponseForm({
  reviewId,
  initialText = '',
  mode = 'create', // 'create' | 'edit'
  onSaved,
  onCancel,
}) {
  const toast = useToast();
  const { t: rawT } = useI18n();
  const t = makeT(rawT);
  const [text, setText] = useState(initialText);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const trimmedLen = text.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_LEN;
  const tooLong = trimmedLen > MAX_LEN;
  const canSubmit = !submitting && trimmedLen >= MIN_LEN && trimmedLen <= MAX_LEN;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = { text: text.trim() };
    try {
      const verb = mode === 'edit' ? 'put' : 'post';
      const { data } = await api[verb](`/reviews/${reviewId}/response`, payload);
      // Server may echo back the canonical response object; if not, synthesize
      // an optimistic shape so the parent can render without a refetch.
      const response = data?.response || {
        text: payload.text,
        owner_name: data?.owner_name || null,
        created_at: data?.created_at || new Date().toISOString(),
        updated_at: data?.updated_at || new Date().toISOString(),
      };
      toast(
        mode === 'edit'
          ? (t('ownerResponse.updated', 'Response updated'))
          : (t('ownerResponse.posted', 'Response posted')),
        'success'
      );
      onSaved?.(response);
    } catch (err) {
      const msg = err?.response?.data?.error
        || (mode === 'edit'
          ? t('ownerResponse.updateFailed', 'Could not update response')
          : t('ownerResponse.postFailed', 'Could not post response'));
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const counterTone = tooLong ? 'text-red-500' : trimmedLen > MAX_LEN - 200 ? 'text-amber-500' : 'text-gray-400';

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2" aria-label={t('ownerResponse.formAria', 'Respond as the business owner')}>
      <label htmlFor={`owner-response-${reviewId}`} className="sr-only">
        {t('ownerResponse.label', 'Owner response')}
      </label>
      <textarea
        id={`owner-response-${reviewId}`}
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) handleSubmit(e);
          if (e.key === 'Escape' && onCancel) onCancel();
        }}
        rows={3}
        maxLength={MAX_LEN + 100} // soft hard-cap; server enforces real limit
        className="input text-sm resize-none overflow-hidden"
        style={{ minHeight: '88px' }}
        placeholder={t('ownerResponse.placeholder', 'Thank the reviewer, address their feedback, invite them back…')}
        aria-describedby={`owner-response-counter-${reviewId}`}
        aria-invalid={tooShort || tooLong}
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span id={`owner-response-counter-${reviewId}`} className={counterTone} aria-live="polite">
            {trimmedLen}/{MAX_LEN}
          </span>
          {tooShort && (
            <span className="text-amber-600 dark:text-amber-400">
              {(t('ownerResponse.minHint', 'Minimum {n} characters')).replace('{n}', String(MIN_LEN))}
            </span>
          )}
          {tooLong && (
            <span className="text-red-600 dark:text-red-400">
              {(t('ownerResponse.maxHint', 'Maximum {n} characters')).replace('{n}', String(MAX_LEN))}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="btn-secondary text-xs py-1.5"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={submitting}
            className="btn-primary text-xs py-1.5"
          >
            {submitting
              ? (t('ownerResponse.saving', 'Saving…'))
              : mode === 'edit'
                ? (t('ownerResponse.saveEdit', 'Save changes'))
                : (t('ownerResponse.publish', 'Publish response'))}
          </button>
        </div>
      </div>
    </form>
  );
}
