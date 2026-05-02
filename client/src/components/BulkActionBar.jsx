import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { useToast } from './Toast';
import { useI18n } from '../context/I18nContext';

export default function BulkActionBar({ selectedIds, onSent, onDeleted, onTagged, onDeselectAll, onCancel }) {
  const { t } = useI18n();
  const toast = useToast();
  const [responseText, setResponseText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tags, setTags] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagPickerMode, setTagPickerMode] = useState('add'); // 'add' | 'remove'
  const [tagging, setTagging] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);
  const statusPickerRef = useRef(null);
  const templateDropdownRef = useRef(null);
  const tagPickerRef = useRef(null);
  const textareaRef = useRef(null);
  const count = selectedIds.size;

  useEffect(() => {
    api.get('/templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
    // GET /api/tags returns the array directly (res.json(rows)), not { tags: [...] }
    // — the previous `data.tags || []` always silently fell to [], so the
    // bulk-action tag picker was empty regardless of how many tags the user had.
    api.get('/tags').then(({ data }) => setTags(Array.isArray(data) ? data : (data?.tags || []))).catch(() => {});
  }, []);

  // Close dropdowns on outside click OR Escape — keyboard parity for the
  // three bulk-bar dropdowns. Without it, opening one with the keyboard
  // had no escape hatch except clicking somewhere else.
  useEffect(() => {
    if (!showTemplates && !showTagPicker && !showStatusPicker) return;
    function onClickOutside(e) {
      if (showTemplates && templateDropdownRef.current && !templateDropdownRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
      if (showTagPicker && tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setShowTagPicker(false);
      }
      if (showStatusPicker && statusPickerRef.current && !statusPickerRef.current.contains(e.target)) {
        setShowStatusPicker(false);
      }
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (showTemplates) setShowTemplates(false);
      if (showTagPicker) setShowTagPicker(false);
      if (showStatusPicker) setShowStatusPicker(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showTemplates, showTagPicker, showStatusPicker]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [responseText]);

  // Auto-focus the textarea the moment the bar appears with selections.
  // ReviewCard's reply path already auto-focuses; bulk should match so a
  // user who just selected 30 reviews can start typing immediately
  // (Cmd/Ctrl+Enter still sends — see onKeyDown below). Without this they
  // had to mouse-click the textarea before typing — extra step on the
  // hottest power-user path.
  useEffect(() => {
    if (count > 0) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [count]);

  async function handleSend() {
    const text = responseText.trim();
    if (!text) { toast(t('bulk.noText'), 'error'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/reviews/bulk-respond', {
        review_ids: Array.from(selectedIds),
        response_text: text,
      });
      if (data.updated === 0) {
        toast(t('bulk.allSkipped'), 'info');
      } else if (data.skipped > 0) {
        toast(t('bulk.partial', { updated: data.updated, skipped: data.skipped }), 'success');
      } else {
        toast(t('bulk.success', { updated: data.updated }), 'success');
      }
      setResponseText('');
      onSent?.();
    } catch (err) {
      // Surface the server's error message if it provided one (rate-limited,
      // plan-gated, validation, etc.) — was just showing a generic
      // "bulk failed" toast that hid the actual reason.
      toast(err?.response?.data?.error || t('bulk.failed'), 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleBulkStatus(status) {
    setSettingStatus(true);
    setShowStatusPicker(false);
    try {
      const { data } = await api.post('/reviews/bulk-status', {
        review_ids: Array.from(selectedIds),
        status,
      });
      toast(t('bulk.statusApplied', { n: data.updated }), 'success');
      onTagged?.(); // reuse callback to trigger list refresh
    } catch (err) {
      toast(err?.response?.data?.error || t('bulk.statusFailed'), 'error');
    } finally {
      setSettingStatus(false);
    }
  }

  async function handleBulkTag(tagId) {
    setTagging(true);
    setShowTagPicker(false);
    const isRemove = tagPickerMode === 'remove';
    try {
      const endpoint = isRemove ? '/reviews/bulk-untag' : '/reviews/bulk-tag';
      const { data } = await api.post(endpoint, {
        review_ids: Array.from(selectedIds),
        tag_id: tagId,
      });
      const n = isRemove ? data.untagged : data.tagged;
      toast(t(isRemove ? 'bulk.untagApplied' : 'bulk.tagApplied', { n }), 'success');
      onTagged?.();
    } catch (err) {
      toast(err?.response?.data?.error || t(isRemove ? 'bulk.untagFailed' : 'bulk.tagFailed'), 'error');
    } finally {
      setTagging(false);
    }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    try {
      const { data } = await api.post('/reviews/bulk-delete', {
        review_ids: Array.from(selectedIds),
      });
      toast(t('bulk.deleteSuccess', { n: data.deleted }), 'info');
      setConfirmDelete(false);
      onDeleted?.();
    } catch (err) {
      toast(err?.response?.data?.error || t('bulk.deleteFailed'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      role="region"
      aria-label={t('bulk.selected', { n: count })}
      className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          {/* aria-live so screen readers announce the count when the user
              checks/unchecks reviews — without it the count silently
              ticks and SR users have to Tab over to hear the change. */}
          <span
            className="text-sm font-semibold text-blue-700 dark:text-blue-300"
            aria-live="polite"
            aria-atomic="true"
          >
            {t('bulk.selected', { n: count })}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDeselectAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2"
            >
              {t('bulk.deselectAll')}
            </button>
            {/* Status picker */}
            <div className="relative" ref={statusPickerRef}>
              <button
                type="button"
                onClick={() => setShowStatusPicker(v => !v)}
                disabled={settingStatus}
                aria-expanded={showStatusPicker}
                aria-haspopup="menu"
                aria-controls="bulk-status-menu"
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 disabled:opacity-50 flex items-center gap-1"
              >
                <span aria-hidden="true">◎</span> {settingStatus ? '…' : t('bulk.setStatus')}
              </button>
              {showStatusPicker && (
                <div
                  id="bulk-status-menu"
                  role="menu"
                  className="absolute right-0 bottom-6 z-40 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1"
                >
                  {[null, 'follow_up', 'resolved', 'escalated'].map(s => (
                    <button
                      key={s ?? 'none'}
                      type="button"
                      role="menuitem"
                      onClick={() => handleBulkStatus(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors flex items-center gap-2 text-xs text-gray-800 dark:text-gray-100"
                    >
                      <span>{s === 'follow_up' ? '⚑' : s === 'escalated' ? '⚡' : s === 'resolved' ? '✓' : '◎'}</span>
                      <span>{s ? t(`review.status.${s}`) : t('review.status.none')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Tag picker */}
            <div className="relative" ref={tagPickerRef}>
              <button
                type="button"
                onClick={() => { setShowTagPicker(v => !v); setTagPickerMode('add'); }}
                disabled={tagging}
                aria-expanded={showTagPicker}
                aria-haspopup="menu"
                aria-controls="bulk-tag-menu"
                aria-label={t('bulk.tagPickerLabel')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1"
              >
                <span aria-hidden="true">🏷️</span> {tagging ? '…' : t('bulk.tagSelected', { n: count })}
              </button>
              {showTagPicker && (
                <div
                  id="bulk-tag-menu"
                  role="dialog"
                  aria-label={t('bulk.tagPickerLabel')}
                  className="absolute right-0 bottom-6 z-40 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
                >
                  {/* Add / Remove toggle */}
                  <div className="flex border-b border-gray-100 dark:border-gray-700">
                    {['add', 'remove'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTagPickerMode(mode)}
                        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${tagPickerMode === mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        {mode === 'add' ? `+ ${t('bulk.tagSelected', { n: '' }).trim()}` : `− ${t('bulk.untagSelected', { n: '' }).trim()}`}
                      </button>
                    ))}
                  </div>
                  <div role="menu" className="py-1 max-h-48 overflow-y-auto">
                    {tags.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-2">{t('bulk.noTags')}</p>
                    ) : tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        role="menuitem"
                        onClick={() => handleBulkTag(tag.id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none transition-colors flex items-center gap-2"
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color || '#6366f1' }}
                        />
                        <span className="text-xs text-gray-800 dark:text-gray-100 truncate">{tag.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {deleting ? t('bulk.deleting') : t('bulk.deleteConfirm', { n: count })}
                </span>
                <button type="button" onClick={handleBulkDelete} disabled={deleting}
                  className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline disabled:opacity-50">
                  {t('bulk.confirmYes')}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50">
                  {t('bulk.confirmNo')}
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                {t('bulk.deleteSelected', { n: count })}
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {t('bulk.cancel')}
            </button>
          </div>
        </div>

        {/* Response input row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 space-y-1.5">
            <textarea
              ref={textareaRef}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
              rows={2}
              maxLength={4000}
              disabled={sending}
              placeholder={t('bulk.responsePlaceholder')}
              aria-label={t('bulk.responsePlaceholder')}
              className="input text-sm resize-none overflow-hidden w-full disabled:opacity-60"
              style={{ minHeight: '60px' }}
            />
            {templates.length > 0 && (
              <div className="relative" ref={templateDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowTemplates(v => !v)}
                  aria-expanded={showTemplates}
                  aria-haspopup="menu"
                  aria-controls="bulk-templates-menu"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                >
                  <span aria-hidden="true">📋</span> {t('bulk.insertTemplate')} ({templates.length})
                </button>
                {showTemplates && (
                  <div
                    id="bulk-templates-menu"
                    role="menu"
                    aria-label={t('bulk.insertTemplate')}
                    className="absolute left-0 bottom-6 z-40 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto"
                  >
                    {templates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          // Insert at caret rather than replacing — same fix
                          // as ReviewCard. A user mid-draft of a bulk reply
                          // who peeks at the template menu shouldn't lose
                          // what they typed.
                          const ta = textareaRef.current;
                          const cur = responseText || '';
                          if (!ta || !cur) {
                            setResponseText(tmpl.body);
                          } else {
                            const start = ta.selectionStart ?? cur.length;
                            const end = ta.selectionEnd ?? cur.length;
                            const next = cur.slice(0, start) + tmpl.body + cur.slice(end);
                            setResponseText(next);
                            requestAnimationFrame(() => {
                              if (ta && document.contains(ta)) {
                                const pos = start + tmpl.body.length;
                                ta.focus();
                                try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ }
                              }
                            });
                          }
                          setShowTemplates(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-gray-50 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                      >
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{tmpl.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{tmpl.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !responseText.trim() || responseText.length > 4000}
              aria-busy={sending}
              className="btn-primary text-sm px-4 py-2 whitespace-nowrap disabled:opacity-50"
            >
              {sending ? t('bulk.sending') : t('bulk.send', { n: count })}
            </button>
            <span className={`text-xs ${responseText.length > 3500 ? 'text-red-500' : 'text-gray-400'}`}>
              {responseText.length}/4000
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
