// Response Templates sub-page — extracted from Settings.jsx for bundle splitting.
//
// Power-user feature: customers save up to 10 reusable reply templates with
// variable placeholders ({reviewer_name}, {rating}, etc.). Most users
// haven't created any; lazy-loading saves them ~9-11 KB gzipped on first
// paint of the Settings page.
//
// Default-export so it can be loaded via React.lazy() in Settings.jsx.

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../context/I18nContext';
import api from '../../lib/api';
import { invalidateTemplateCache } from '../../components/ReviewCard';

const MAX_TEMPLATES = 10;

export default function ResponseTemplates() {
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
                    <button type="submit" disabled={editSaving} aria-busy={editSaving} className="btn-primary text-xs py-1 px-2">
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
