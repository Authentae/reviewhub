// Auto-respond rules sub-page — extracted from Settings.jsx for bundle splitting.
//
// Power-user feature: customers configure rules like "for any 1-star Google
// review with the word 'cold' in it, auto-reply with template X and tag Y."
// Most users never open this section; lazy-loading saves them ~10-12 KB
// gzipped on first paint.
//
// Default-export so it can be loaded via React.lazy() in Settings.jsx.

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../context/I18nContext';
import api from '../../lib/api';
import { platformsForLocale, platformLabel } from '../../lib/platforms';

const RULE_SENTIMENTS = ['', 'positive', 'neutral', 'negative'];
const BLANK_RULE = { name: '', platform: '', min_rating: '', max_rating: '', sentiment: '', response_text: '', enabled: true, match_keywords_text: '', tag_id: '' };

export default function AutoRules() {
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
      setTags(Array.isArray(tagsData) ? tagsData : (tagsData?.tags || []));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newRule.name.trim() || !newRule.response_text.trim()) {
      toast(t('rules.fieldsRequired'), 'error'); return;
    }
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
          <textarea ref={responseTextareaRef} value={value.response_text} onChange={e => onChange({ ...value, response_text: e.target.value })} rows={2} maxLength={4000} className="input text-xs w-full resize-none" placeholder={t('rules.responseTextPlaceholder')} />
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
          <button type="submit" disabled={saving} aria-busy={saving} className="btn-primary text-xs py-1 px-2 disabled:opacity-50">{saving ? '…' : submitLabel}</button>
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
                  <button type="button" onClick={() => setConfirmDeleteId(rule.id)} aria-label={t('autoRules.deleteAria', 'Delete rule')} className="text-xs text-gray-300 hover:text-red-400 px-1">✕</button>
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
