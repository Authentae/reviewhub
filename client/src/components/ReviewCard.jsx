import React, { useState, useEffect, useMemo, useRef } from 'react';
import SentimentBadge from './SentimentBadge';
import PlatformBadge from './PlatformBadge';
import StarRating from './StarRating';
import TagBadge from './TagBadge';
import { useToast } from './Toast';
import api from '../lib/api';
import { platformLabel as registryPlatformLabel } from '../lib/platforms';
import { platformLink, platformLinkLabel } from '../lib/platformLinks';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';
import { Link } from 'react-router-dom';

// Module-level tag cache shared across all cards (same refresh strategy as templates)
let _tagCache = null;
let _tagFetch = null;
function fetchTagsOnce() {
  if (_tagCache !== null) return Promise.resolve(_tagCache);
  if (_tagFetch) return _tagFetch;
  _tagFetch = import('../lib/api').then(m => m.default.get('/tags'))
    .then(({ data }) => { _tagCache = data || []; return _tagCache; })
    .catch(() => { _tagCache = []; return []; });
  return _tagFetch;
}
export function invalidateTagCache() { _tagCache = null; _tagFetch = null; }

// Highlights all case-insensitive occurrences of `query` within `text`.
// Returns an array of React nodes — safe to render.
function Highlight({ text, query }) {
  if (!query || !query.trim() || !text) return text;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === trimmed.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-[2px] px-0.5">{part}</mark>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
  'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name || !name.trim()) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
}

const TEXT_LIMIT = 280; // ~4 lines on desktop
// One-time AI disclaimer acknowledgement key — legally a secondary layer on
// top of ToS §4a (see handleDraft).
const AI_ACK_KEY = 'reviewhub_ai_disclaimer_acked';

// Auto-save for in-progress response drafts. Keyed per review so switching
// between cards doesn't conflict. Stored in localStorage as a JSON map so we
// can expire old entries on access (prevents unbounded growth on heavy users).
const DRAFT_STORE_KEY = 'reviewhub_inprogress_drafts';
const DRAFT_EXPIRY_MS = 7 * 24 * 3600 * 1000; // 7 days

function readDraftStore() {
  try { return JSON.parse(localStorage.getItem(DRAFT_STORE_KEY)) || {}; }
  catch { return {}; }
}
function writeDraftStore(store) {
  try { localStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(store)); }
  catch { /* quota exceeded → drop silently, this is best-effort */ }
}
function loadSavedDraft(reviewId) {
  const store = readDraftStore();
  const entry = store[reviewId];
  if (!entry) return null;
  if (Date.now() - entry.savedAt > DRAFT_EXPIRY_MS) {
    // Expired — delete and ignore
    delete store[reviewId];
    writeDraftStore(store);
    return null;
  }
  return entry.text;
}
const DRAFT_MAX_ENTRIES = 500; // cap so the JSON blob stays small on every save
function saveDraft(reviewId, text) {
  const store = readDraftStore();
  const now = Date.now();
  for (const [id, entry] of Object.entries(store)) {
    if (now - entry.savedAt > DRAFT_EXPIRY_MS) delete store[id];
  }
  if (text && text.trim()) {
    store[reviewId] = { text, savedAt: now };
  } else {
    delete store[reviewId];
  }
  // Hard cap — keep the N most-recent entries to bound per-save parse/stringify cost.
  const keys = Object.keys(store);
  if (keys.length > DRAFT_MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => store[b].savedAt - store[a].savedAt);
    for (const k of sorted.slice(DRAFT_MAX_ENTRIES)) delete store[k];
  }
  writeDraftStore(store);
}
function clearDraft(reviewId) {
  const store = readDraftStore();
  delete store[reviewId];
  writeDraftStore(store);
}

// Module-level template cache — one fetch per render, not one per card.
let _templateCache = null;
let _templateFetch = null;
function fetchTemplatesOnce() {
  if (_templateCache !== null) return Promise.resolve(_templateCache);
  if (_templateFetch) return _templateFetch;
  _templateFetch = import('../lib/api').then(m => m.default.get('/templates'))
    .then(({ data }) => { _templateCache = data.templates || []; return _templateCache; })
    .catch(() => { _templateCache = []; return []; });
  return _templateFetch;
}
// Expose a reset so Settings can invalidate after CRUD operations
export function invalidateTemplateCache() { _templateCache = null; _templateFetch = null; }

function ReviewCard({ review, highlight, onResponseSaved, business = null }) {
  const toast = useToast();
  const { t, lang } = useI18n();
  const { subscription, refresh: refreshUser } = useUser();
  // AI quota: null = unlimited (Starter+), number = finite (Free)
  const aiMax = subscription?.ai_drafts_max_per_month;
  const aiRemaining = subscription?.ai_drafts_remaining;
  const aiLimited = aiMax != null;
  const aiExhausted = aiLimited && aiRemaining === 0;
  // Memoised relative-time formatter — updates when language changes
  const rtf = useMemo(() => {
    try { return new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }); }
    catch { return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); }
  }, [lang]);
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(!!review.response_text);
  const [optimisticResponse, setOptimisticResponse] = useState(review.response_text || null);
  const [expanded, setExpanded] = useState(false);
  // Translation state — translated text replaces the original visually until
  // the user toggles back. Lazy-loaded; never fetched until user clicks 🌐.
  const [translatedText, setTranslatedText] = useState(null);
  const [translatedTarget, setTranslatedTarget] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPostReminder, setShowPostReminder] = useState(false);
  // Response templates
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateDropdownRef = useRef(null);
  const templateTriggerRef = useRef(null);
  const templateItemRefs = useRef([]);
  // Ref to the review-card root for click-outside detection on the
  // inline delete-confirm (escape from a transient destructive prompt).
  const cardRef = useRef(null);
  const confirmYesRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const draftTextareaRef = useRef(null);
  // Private note
  const [note, setNote] = useState(review.note || '');
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(review.note || '');
  const [savingNote, setSavingNote] = useState(false);

  // Sentiment override state
  const [sentiment, setSentiment] = useState(review.sentiment || 'neutral');
  const [showSentimentPicker, setShowSentimentPicker] = useState(false);
  const [savingSentiment, setSavingSentiment] = useState(false);
  const sentimentPickerRef = useRef(null);

  // Pin state
  const [pinned, setPinned] = useState(!!review.pinned);
  const [pinning, setPinning] = useState(false);

  // Flag state
  const [flagged, setFlagged] = useState(!!review.flagged);
  const [flagging, setFlagging] = useState(false);

  // Custom status state
  const [reviewStatus, setReviewStatus] = useState(review.status || null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const statusPickerRef = useRef(null);

  // Tag state
  const [tags, setTags] = useState(review.tags || []);
  const [allTags, setAllTags] = useState(null); // null = not yet loaded
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const tagPickerRef = useRef(null);
  const tagTriggerRef = useRef(null);

  useEffect(() => {
    setSaved(!!review.response_text);
    setOptimisticResponse(review.response_text || null);
  }, [review.response_text]);

  // Auto-resize the response textarea as the user types
  useEffect(() => {
    const el = draftTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draftText]);

  // Auto-save the in-progress draft (debounced). Only runs while the editor
  // is actually open so we don't write on every render. Keyed per review so
  // drafting one review doesn't overwrite another.
  useEffect(() => {
    if (!drafting) return;
    const id = setTimeout(() => saveDraft(review.id, draftText), 400);
    return () => clearTimeout(id);
  }, [drafting, draftText, review.id]);

  // Auto-focus first template menu item when it opens; trim stale refs on close
  useEffect(() => {
    if (showTemplates) {
      // Trim to current template count so filter(Boolean) won't find stale entries
      templateItemRefs.current = templateItemRefs.current.slice(0, templates.length);
      // Wait one frame for the menu to be painted before focusing
      requestAnimationFrame(() => { templateItemRefs.current[0]?.focus(); });
    }
  }, [showTemplates, templates.length]);

  // Close template dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!showTemplates) return;
    function onClickOutside(e) {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [showTemplates]);

  // Move focus to the "Yes, delete" button when confirm-delete UI appears,
  // and back to the ✕ trigger when it disappears. The focus-restore path
  // has to run AFTER the re-render — calling focus() synchronously with
  // setConfirmDelete(false) would target a button that doesn't exist yet
  // (the trigger is conditionally rendered only when !confirmDelete).
  // Tracking the previous value via a ref lets this effect fire only on
  // the true→false transition, so it doesn't focus the trigger on initial mount.
  const prevConfirmDelete = useRef(confirmDelete);
  useEffect(() => {
    if (confirmDelete && !prevConfirmDelete.current) {
      confirmYesRef.current?.focus();
    } else if (!confirmDelete && prevConfirmDelete.current) {
      deleteTriggerRef.current?.focus();
    }
    prevConfirmDelete.current = confirmDelete;
  }, [confirmDelete]);

  // Same pattern for the template picker: focus restoration on close must
  // happen after the re-render that removes the menu.
  const prevShowTemplates = useRef(showTemplates);
  useEffect(() => {
    if (!showTemplates && prevShowTemplates.current) {
      templateTriggerRef.current?.focus();
    }
    prevShowTemplates.current = showTemplates;
  }, [showTemplates]);

  // Escape key cancels confirm-delete, template picker, and draft editor.
  // We only flip state here; focus restoration is handled by the effects
  // above so it lands in the right frame.
  useEffect(() => {
    if (!confirmDelete && !drafting && !showTemplates) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showTemplates) { setShowTemplates(false); return; }
        if (confirmDelete) { setConfirmDelete(false); return; }
        setDrafting(false);
      }
    }
    // Click-outside dismissal for the inline delete-confirm. Without
    // this the only way out is Escape or the No button — mouse users
    // expect clicking elsewhere to bail out of a transient confirm.
    function onClick(e) {
      if (!confirmDelete) return;
      // The confirm renders inline inside the review card. If the
      // click target is OUTSIDE this review card's root, dismiss.
      const card = cardRef.current;
      if (card && !card.contains(e.target)) {
        setConfirmDelete(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [confirmDelete, drafting, showTemplates]);

  // AI disclaimer gate. First time the user clicks "Quick Reply" on any card
  const [showAiDisclaimer, setShowAiDisclaimer] = useState(false);

  // Open the editor with an empty textarea (or restore a saved-in-progress
  // draft if the user was typing previously). No AI call — preserves the
  // user's AI draft quota so a click to start typing manually doesn't burn
  // a credit. Templates are pre-fetched here so the picker is ready without
  // another round-trip.
  function handleStartReply() {
    const saved = loadSavedDraft(review.id);
    setDraftText(saved || '');
    setDrafting(true);
    fetchTemplatesOnce().then(setTemplates);
    if (saved) toast(t('review.draftRestored'), 'success');
    // Focus the textarea on next paint so keyboard users can type immediately
    requestAnimationFrame(() => { draftTextareaRef.current?.focus(); });
  }

  async function handleDraft() {
    // Show disclaimer once per device before the first draft.
    if (!localStorage.getItem(AI_ACK_KEY)) {
      setShowAiDisclaimer(true);
      return;
    }
    await actuallyDraft();
  }

  async function actuallyDraft() {
    setLoading(true);
    // Enter drafting mode immediately so the user sees the editor even if
    // the AI call fails (quota exhausted, network, etc). They can still
    // type manually or pick a template.
    if (!drafting) {
      setDrafting(true);
      fetchTemplatesOnce().then(setTemplates);
    }
    try {
      const [{ data }, tmplList] = await Promise.all([
        api.get(`/reviews/${review.id}/draft`),
        fetchTemplatesOnce(),
      ]);
      setDraftText(data.draft);
      setTemplates(tmplList);
      // Bump the /me cache so the quota badge reflects the drafted credit.
      // Fire-and-forget — failure to refresh doesn't break the draft itself.
      if (aiLimited) refreshUser?.();
    } catch (err) {
      if (err?.response?.status === 402) {
        const { quota, upgradeTo } = err.response.data || {};
        const quotaMsg = quota ? ` (${quota.used}/${quota.max})` : '';
        const upgrade = upgradeTo
          ? t('toast.aiDraftLimitUpgrade', { plan: upgradeTo })
          : t('toast.aiDraftLimit');
        toast(`${upgrade}${quotaMsg}`, 'error');
      } else {
        toast(t('toast.failedDraft'), 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAckDisclaimer() {
    localStorage.setItem(AI_ACK_KEY, '1');
    setShowAiDisclaimer(false);
    void actuallyDraft();
  }

  async function handleSend() {
    if (!draftText.trim()) return;
    setLoading(true);
    setOptimisticResponse(draftText);
    setSaved(true);
    setDrafting(false);
    try {
      const { data } = await api.post(`/reviews/${review.id}/respond`, { response_text: draftText });
      // Three cases:
      //   posted === true          → platform accepted the reply (no need for manual-post reminder)
      //   posted === false + error → saved locally, but the platform call failed — show why
      //   posted === false + no err → feature not enabled; user needs to manually post (existing flow)
      clearDraft(review.id);
      if (data?.posted) {
        toast(t('toast.responsePosted', { platform: registryPlatformLabel(review.platform) }), 'success');
      } else if (data?.postError) {
        toast(t('toast.responseSavedPostFailed', { err: data.postError }), 'warning');
        setShowPostReminder(true);
      } else {
        toast(t('toast.responseSaved'), 'success');
        setShowPostReminder(true);
      }
      onResponseSaved?.();
    } catch (err) {
      setOptimisticResponse(review.response_text || null);
      setSaved(!!review.response_text);
      setDrafting(true);
      toast(err?.response?.data?.error || t('toast.failedResponse'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/reviews/${review.id}`);
      toast(t('toast.reviewDeleted'), 'info');
      onResponseSaved?.();
    } catch (err) {
      toast(err?.response?.data?.error || t('toast.failedDelete'), 'error');
      setConfirmDelete(false);
      setDeleting(false);
    }
  }

  async function handleSentimentOverride(newSentiment) {
    if (savingSentiment || newSentiment === sentiment) { setShowSentimentPicker(false); return; }
    setSavingSentiment(true);
    const prev = sentiment;
    setSentiment(newSentiment); // optimistic
    setShowSentimentPicker(false);
    try {
      await api.put(`/reviews/${review.id}/sentiment`, { sentiment: newSentiment });
    } catch (err) {
      setSentiment(prev);
      toast(err?.response?.data?.error || t('review.sentimentFailed'), 'error');
    } finally {
      setSavingSentiment(false);
    }
  }

  // Close sentiment picker on outside click OR Escape key. The earlier
  // Escape-handler effect above only fires for the draft / template /
  // delete states — without this branch, an open sentiment picker
  // ignored Escape, leaving keyboard users stuck.
  useEffect(() => {
    if (!showSentimentPicker) return;
    function onClose(e) {
      if (sentimentPickerRef.current && !sentimentPickerRef.current.contains(e.target)) {
        setShowSentimentPicker(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setShowSentimentPicker(false);
    }
    document.addEventListener('mousedown', onClose);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClose);
      document.removeEventListener('keydown', onKey);
    };
  }, [showSentimentPicker]);

  async function handleTogglePin() {
    if (pinning) return;
    setPinning(true);
    const prev = pinned;
    setPinned(!prev); // optimistic
    try {
      const { data } = await api.put(`/reviews/${review.id}/pin`);
      setPinned(data.pinned);
    } catch {
      setPinned(prev); // rollback
      toast(t('review.pinFailed'), 'error');
    } finally {
      setPinning(false);
    }
  }

  async function handleToggleFlag() {
    if (flagging) return;
    setFlagging(true);
    const prev = flagged;
    setFlagged(!prev); // optimistic
    try {
      const { data } = await api.put(`/reviews/${review.id}/flag`);
      setFlagged(data.flagged);
    } catch {
      setFlagged(prev); // rollback
      toast(t('review.flagFailed'), 'error');
    } finally {
      setFlagging(false);
    }
  }

  async function handleSetStatus(newStatus) {
    if (savingStatus) return;
    setSavingStatus(true);
    setShowStatusPicker(false);
    const prev = reviewStatus;
    setReviewStatus(newStatus); // optimistic
    try {
      const { data } = await api.put(`/reviews/${review.id}/status`, { status: newStatus });
      setReviewStatus(data.status);
    } catch {
      setReviewStatus(prev); // rollback
      toast(t('review.statusFailed'), 'error');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveNote() {
    if (savingNote) return;
    setSavingNote(true);
    try {
      await api.put(`/reviews/${review.id}/note`, { note: noteText });
      setNote(noteText);
      setEditingNote(false);
      toast(noteText.trim() ? t('toast.noteSaved') : t('toast.noteCleared'), 'success');
    } catch {
      toast(t('toast.failedNote'), 'error');
    } finally {
      setSavingNote(false);
    }
  }

  // Close status picker on outside click OR Escape — keyboard parity
  // with the sentiment + tag pickers.
  useEffect(() => {
    if (!showStatusPicker) return;
    function onClickOutside(e) {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target)) {
        setShowStatusPicker(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setShowStatusPicker(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showStatusPicker]);

  // Close tag picker on outside click OR Escape key. Without the Escape
  // branch, keyboard users couldn't dismiss the picker — same gap that
  // existed on the sentiment picker before the recent polish pass.
  useEffect(() => {
    if (!showTagPicker) return;
    function onClickOutside(e) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setShowTagPicker(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setShowTagPicker(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [showTagPicker]);

  async function handleOpenTagPicker() {
    if (allTags === null) {
      const loaded = await fetchTagsOnce();
      setAllTags(loaded);
    }
    setShowTagPicker(v => !v);
  }

  async function handleToggleTag(tag) {
    const alreadyOn = tags.some(t => t.id === tag.id);
    const newTags = alreadyOn ? tags.filter(t => t.id !== tag.id) : [...tags, tag];
    setTags(newTags);
    setSavingTags(true);
    try {
      const { data } = await api.put(`/reviews/${review.id}/tags`, { tag_ids: newTags.map(t => t.id) });
      setTags(data.tags);
    } catch {
      setTags(tags); // rollback
      toast(t('tags.saveFailed'), 'error');
    } finally {
      setSavingTags(false);
    }
  }

  function handleTemplateMenuKeyDown(e) {
    const items = templateItemRefs.current.filter(Boolean);
    const current = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(current + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      // Close on Tab so focus naturally moves to next element
      setShowTemplates(false);
    }
    // Escape is handled by the global onKey listener above
  }

  async function handleCopy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (plain HTTP)
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast(t('toast.copied'), 'info');
    } catch {
      toast(t('toast.copyFailed'), 'error');
    }
  }

  const fullDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString(lang, {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  // Uses Intl.RelativeTimeFormat so the output automatically matches the active UI language
  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const ts = new Date(dateStr).getTime();
    if (isNaN(ts)) return '';
    const diffMs = Date.now() - ts;
    const seconds = Math.floor(Math.abs(diffMs) / 1000);
    // Skip the rtf "0 seconds ago" output — most locales render it
    // awkwardly ("0 seconds ago" / "in 0 seconds"). "Just now" reads
    // better and matches what every modern feed does.
    if (seconds < 60)   return t('common.justNow', 'just now');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)   return rtf.format(-minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24)     return rtf.format(-hours, 'hour');
    const days = Math.floor(hours / 24);
    if (days < 30)      return rtf.format(-days, 'day');
    const months = Math.floor(days / 30);
    if (months < 12)    return rtf.format(-months, 'month');
    return rtf.format(-Math.floor(days / 365), 'year');
  };

  const rawText = review.review_text || '';
  const text = (showTranslated && translatedText) ? translatedText : rawText;
  const isTruncatable = text.length > TEXT_LIMIT;
  // Best-effort link to the original review on the source platform.
  // Null when we have no usable URL (e.g. manual entry).
  const externalLink = platformLink({ review, business });

  async function handleTranslate() {
    if (translating) return;
    if (translatedText) {
      setShowTranslated((v) => !v);
      return;
    }
    setTranslating(true);
    try {
      const { data } = await api.post(`/reviews/${review.id}/translate`);
      setTranslatedText(data.translated_text);
      // Capture the target language so we can show a "Translated to X"
      // badge — without it the review text just silently swaps and the
      // user has no signal which language they're reading. Server returns
      // an ISO code like 'en', 'th', 'ja' in `target`.
      setTranslatedTarget(data.target || null);
      setShowTranslated(true);
    } catch (err) {
      const msg = err?.response?.data?.error || t('review.translateFailed', 'Translation failed. Try again later.');
      toast(msg, 'error');
    } finally {
      setTranslating(false);
    }
  }
  // Map ISO code → display label so the user sees "Thai" not "th".
  // Reuse the i18n locale display names if available, fall back to upper-cased code.
  function targetLangLabel(code) {
    if (!code) return null;
    const labels = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', th: 'Thai', ja: 'Japanese', zh: 'Chinese', ko: 'Korean' };
    return labels[code] || code.toUpperCase();
  }
  const displayText = isTruncatable && !expanded ? text.slice(0, TEXT_LIMIT) + '…' : text;

  return (
    <div ref={cardRef} className="card p-4 hover:shadow-md transition-shadow dark:hover:shadow-gray-700/40">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-full ${getAvatarColor(review.reviewer_name)} flex items-center justify-center text-white text-xs font-bold`}>
          {getInitials(review.reviewer_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  <Highlight text={review.reviewer_name} query={highlight} />
                </span>
                <PlatformBadge platform={review.platform} />
                <div className="relative" ref={sentimentPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowSentimentPicker(v => !v)}
                    aria-haspopup="menu"
                    aria-expanded={showSentimentPicker}
                    aria-controls={`sentiment-menu-${review.id}`}
                    aria-label={t('review.overrideSentimentAria')}
                    title={t('review.overrideSentimentAria')}
                    className="focus:outline-none"
                  >
                    <SentimentBadge sentiment={sentiment} />
                  </button>
                  {showSentimentPicker && (
                    <div
                      id={`sentiment-menu-${review.id}`}
                      role="menu"
                      aria-label={t('review.overrideSentimentAria')}
                      className="absolute left-0 top-7 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[130px]"
                    >
                      {['positive', 'neutral', 'negative'].map(s => (
                        <button
                          key={s}
                          type="button"
                          role="menuitem"
                          onClick={() => handleSentimentOverride(s)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${s === sentiment ? 'font-semibold' : ''}`}
                        >
                          <SentimentBadge sentiment={s} />
                          {s === sentiment && <span className="ml-auto text-blue-500">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={review.rating} />
                <span className="text-xs text-gray-400 cursor-default" title={fullDate(review.created_at)}>
                  {timeAgo(review.created_at)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {!saved && !drafting && (
                <button type="button" onClick={handleStartReply}
                  aria-label={t('review.replyAria', { name: review.reviewer_name })}
                  className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap">
                  {t('review.reply')}
                </button>
              )}
              {saved && !drafting && (
                <button type="button" onClick={() => { setDraftText(optimisticResponse || ''); setDrafting(true); fetchTemplatesOnce().then(setTemplates); }}
                  aria-label={t('review.editReplyAria', { name: review.reviewer_name })}
                  className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700/60 py-1.5 px-2 rounded whitespace-nowrap transition-colors">
                  {t('review.editReply')}
                </button>
              )}
              <button
                type="button"
                onClick={handleTogglePin}
                disabled={pinning}
                aria-label={pinned ? t('review.unpinAria') : t('review.pinAria')}
                title={pinned ? t('review.unpin') : t('review.pin')}
                className={`text-base py-1 px-1.5 transition-colors disabled:opacity-50 ${pinned ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
              >
                {pinned ? '★' : '☆'}
              </button>
              <button
                type="button"
                onClick={handleToggleFlag}
                disabled={flagging}
                aria-label={flagged ? t('review.unflagAria') : t('review.flagAria')}
                title={flagged ? t('review.unflag') : t('review.flag')}
                className={`text-sm py-1 px-1.5 transition-colors disabled:opacity-50 ${flagged ? 'text-red-500 hover:text-red-600' : 'text-gray-300 hover:text-red-400'}`}
              >
                🚩
              </button>
              {/* Status picker */}
              <div className="relative" ref={statusPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowStatusPicker(v => !v)}
                  disabled={savingStatus}
                  aria-expanded={showStatusPicker}
                  aria-haspopup="menu"
                  aria-controls={`status-menu-${review.id}`}
                  aria-label={t('review.statusAriaLabel')}
                  title={reviewStatus ? t(`review.status.${reviewStatus}`) : t('review.status.none')}
                  className={`text-xs py-1 px-1.5 rounded transition-colors disabled:opacity-50 ${
                    reviewStatus === 'follow_up' ? 'text-amber-600 dark:text-amber-400' :
                    reviewStatus === 'escalated' ? 'text-red-600 dark:text-red-400' :
                    reviewStatus === 'resolved' ? 'text-green-600 dark:text-green-400' :
                    'text-gray-300 dark:text-gray-600 hover:text-gray-500'
                  }`}
                >
                  {reviewStatus === 'follow_up' ? '⚑' : reviewStatus === 'escalated' ? '⚡' : reviewStatus === 'resolved' ? '✓' : '◎'}
                </button>
                {showStatusPicker && (
                  <div
                    id={`status-menu-${review.id}`}
                    role="menu"
                    aria-label={t('review.statusAriaLabel')}
                    className="absolute right-0 top-7 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[130px]"
                  >
                    {[null, 'follow_up', 'resolved', 'escalated'].map(s => (
                      <button
                        key={s ?? 'none'}
                        type="button"
                        role="menuitem"
                        onClick={() => handleSetStatus(s)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${s === reviewStatus ? 'font-semibold' : ''}`}
                      >
                        <span>{s === 'follow_up' ? '⚑' : s === 'escalated' ? '⚡' : s === 'resolved' ? '✓' : '◎'}</span>
                        <span>{s ? t(`review.status.${s}`) : t('review.status.none')}</span>
                        {s === reviewStatus && <span className="ml-auto text-blue-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {confirmDelete ? (
                // Visual hierarchy: "No" is now a real button (border + padding)
                // so it doesn't read as a tiny gray footnote next to a bold red
                // "Yes". Focus still lands on Yes via confirmYesRef (preserves
                // the keyboard power-user flow: ✕ → Enter to confirm). This
                // matches GitHub's "Delete branch?" pattern where Cancel has
                // visual weight but focus is on Confirm so Enter completes the
                // action; mouse users tend to read first, then click — and now
                // No is no longer mistakable for inert label text.
                <span className="flex items-center gap-1.5">
                  <span className="text-xs text-red-700 dark:text-red-400 font-medium mr-1">{deleting ? t('review.deleting') : t('review.deleteConfirm')}</span>
                  <button
                    type="button"
                    ref={confirmYesRef}
                    onClick={handleDelete}
                    disabled={deleting}
                    aria-busy={deleting}
                    className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline px-1 disabled:opacity-50"
                  >{t('review.yes')}</button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >{t('review.no')}</button>
                </span>
              ) : (
                <button
                  type="button"
                  ref={deleteTriggerRef}
                  onClick={() => setConfirmDelete(true)}
                  aria-label={t('review.deleteAria')}
                  // 32x32 minimum hit target — the previous py-1.5 px-2 was
                  // ~16x14, far below WCAG 2.5.5 + Apple/Google guidance.
                  // Hover gets a subtle red wash so it reads as the delete
                  // affordance, not just a stray glyph.
                  className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {text && (
            <div className="mb-2">
              {/* "Translated to X" badge — without this, the review text
                  silently swaps language with no signal which one is on
                  screen. */}
              {showTranslated && translatedText && (
                <p className="text-[10px] font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
                  {t('review.translatedTo', 'Translated to')} {targetLangLabel(translatedTarget) || ''}
                </p>
              )}
              {/* whitespace-pre-wrap preserves the reviewer's paragraph breaks
                  (common in long Google reviews). Without it, \n collapses
                  and multi-paragraph reviews read as one wall of text. */}
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                <Highlight text={displayText} query={highlight} />
              </p>
              {isTruncatable && (
                <button
                  type="button"
                  onClick={() => setExpanded(e => !e)}
                  aria-expanded={expanded}
                  className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-1"
                >
                  {expanded ? t('review.showLess') : t('review.showMore')}
                </button>
              )}
              {/* QoL action row — translate + open on source platform.
                  Both are no-ops for manual entries. */}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {rawText && (
                  <button
                    type="button"
                    onClick={handleTranslate}
                    disabled={translating}
                    aria-pressed={showTranslated}
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1 disabled:opacity-50"
                    title={showTranslated
                      ? t('review.showOriginal', 'Show original')
                      : t('review.translateAria', 'Translate to your language')}
                  >
                    <span aria-hidden="true">🌐</span>
                    {translating
                      ? t('review.translating', 'Translating…')
                      : showTranslated
                      ? t('review.showOriginalShort', 'Original')
                      : t('review.translate', 'Translate')}
                  </button>
                )}
                {externalLink && (
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
                  >
                    {platformLinkLabel(review.platform)}
                  </a>
                )}
              </div>
            </div>
          )}

          {optimisticResponse && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-r-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{t('review.yourResponse')}</p>
                  {review.updated_at && (
                    <span className="text-xs text-blue-400 cursor-default" title={fullDate(review.updated_at)}>
                      · {timeAgo(review.updated_at)}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => handleCopy(optimisticResponse)} aria-label={t('review.copyAria')} className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  {t('review.copy')}
                </button>
              </div>
              <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">{optimisticResponse}</p>
            </div>
          )}

          {/* Platform posting reminder — shown once after saving a new response */}
          {showPostReminder && (
            <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <span aria-hidden="true">💡</span>
              <span className="flex-1">
                {t('review.postReminder', { platform: registryPlatformLabel(review.platform) })}
              </span>
              <button
                type="button"
                onClick={() => setShowPostReminder(false)}
                aria-label={t('common.dismiss')}
                className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-400"
              >✕</button>
            </div>
          )}

          {/* Private note — only visible to the business owner */}
          <div className="mt-2">
            {!editingNote && (
              <div className="flex items-start gap-2">
                {note ? (
                  <div className="flex-1 flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-gray-400 text-xs mt-0.5" aria-hidden="true">📝</span>
                    <p className="flex-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{note}</p>
                    <button
                      type="button"
                      onClick={() => { setNoteText(note); setEditingNote(true); }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                      aria-label={t('review.editNoteAria')}
                    >{t('review.editNote')}</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setNoteText(''); setEditingNote(true); }}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                    aria-label={t('review.addNoteAria')}
                  >
                    {t('review.addNote')}
                  </button>
                )}
              </div>
            )}
            {editingNote && (
              <div className="space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setNoteText(note); setEditingNote(false); } }}
                  rows={2}
                  maxLength={2000}
                  aria-label={t('review.noteAria')}
                  className="input text-xs resize-none"
                  placeholder={t('review.notePlaceholder')}
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs ${noteText.length > 1800 ? 'text-red-500' : 'text-gray-400'}`} aria-live="polite" aria-atomic="true">{noteText.length}/2000</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                    >{savingNote ? t('review.noteSaving') : t('review.saveNote')}</button>
                    <button
                      type="button"
                      onClick={() => { setNoteText(note); setEditingNote(false); }}
                      className="btn-secondary text-xs py-1 px-2"
                    >{t('review.cancel')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {tags.map(tag => (
              <TagBadge key={tag.id} tag={tag} small onRemove={() => handleToggleTag(tag)} />
            ))}
            <div className="relative" ref={tagPickerRef}>
              <button
                type="button"
                ref={tagTriggerRef}
                onClick={handleOpenTagPicker}
                aria-label={t('tags.addTag')}
                aria-expanded={showTagPicker}
                aria-controls={`tag-menu-${review.id}`}
                aria-haspopup="menu"
                aria-busy={savingTags}
                className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-full px-1.5 py-0.5 leading-none"
              >
                {savingTags ? '…' : '+ ' + t('tags.addTag')}
              </button>
              {showTagPicker && (
                <div id={`tag-menu-${review.id}`} role="menu" className="absolute left-0 top-6 z-20 min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                  {allTags && allTags.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">{t('tags.noTags')}</p>
                  )}
                  {(allTags || []).map(tag => {
                    const active = tags.some(t => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="text-xs text-gray-800 dark:text-gray-100 flex-1 truncate">{tag.name}</span>
                        {active && <span className="text-[10px] text-blue-500">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {showAiDisclaimer && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`ai-disc-title-${review.id}`}
              className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
            >
              <p id={`ai-disc-title-${review.id}`} className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                {t('auth.aiDraftDisclaimerTitle')}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
                {t('auth.aiDraftDisclaimerBody')}
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAckDisclaimer}
                  className="btn-primary text-xs py-1.5 px-3"
                  autoFocus
                >
                  {t('auth.aiDraftDisclaimerAck')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiDisclaimer(false)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {t('review.cancel')}
                </button>
              </div>
            </div>
          )}

          {drafting && (
            <div className="mt-3 space-y-2">
              <textarea
                ref={draftTextareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
                rows={3}
                maxLength={1000}
                aria-label={t('review.responseToAria', { name: review.reviewer_name })}
                aria-describedby={`draft-counter-${review.id}`}
                className="input text-sm resize-none overflow-hidden"
                style={{ minHeight: '72px' }}
                placeholder={t('review.editPlaceholder')}
              />
              {/* Template variable hint chips */}
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-xs text-gray-400 dark:text-gray-500 mr-0.5">{t('templateVars.hint')}</span>
                {['{reviewer_name}', '{rating}', '{platform}', '{business_name}'].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraftText(prev => prev + v)}
                    className="text-xs font-mono bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded px-1.5 py-0.5 transition-colors border border-gray-200 dark:border-gray-600 hover:border-blue-300"
                    title={t('templateVars.insertVar', { v })}
                  >{v}</button>
                ))}
              </div>
              {/* Template picker — only shown when user has saved templates */}
              {templates.length > 0 && (
                <div className="relative" ref={templateDropdownRef}>
                  <button
                    type="button"
                    ref={templateTriggerRef}
                    onClick={() => setShowTemplates(v => !v)}
                    aria-expanded={showTemplates}
                    aria-haspopup="menu"
                    aria-controls={`templates-menu-${review.id}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                  >
                    <span aria-hidden="true">📋</span> {t('templates.insertBtn')} ({templates.length})
                  </button>
                  {showTemplates && (
                    <div
                      id={`templates-menu-${review.id}`}
                      role="menu"
                      aria-label={t('templates.insertBtn')}
                      onKeyDown={handleTemplateMenuKeyDown}
                      className="absolute left-0 top-6 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto"
                    >
                      {templates.map((tmpl, idx) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          role="menuitem"
                          ref={el => { templateItemRefs.current[idx] = el; }}
                          onClick={() => {
                            // Insert template at the caret instead of replacing
                            // the entire draft. The previous behaviour silently
                            // wiped any in-progress text — a user who'd typed
                            // half a personalised reply lost it the moment they
                            // peeked at the template menu.
                            const ta = draftTextareaRef.current;
                            const cur = draftText || '';
                            if (!ta || !cur) {
                              setDraftText(tmpl.body);
                            } else {
                              const start = ta.selectionStart ?? cur.length;
                              const end = ta.selectionEnd ?? cur.length;
                              const next = cur.slice(0, start) + tmpl.body + cur.slice(end);
                              setDraftText(next);
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
              {/* Inline upgrade card — shown only when AI quota is fully exhausted */}
              {aiExhausted && (
                <div role="alert" className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-3 py-2 rounded-lg">
                  <span aria-hidden="true">⚡</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t('review.aiQuotaExhausted', { max: aiMax })}</p>
                    <p className="mt-0.5">{t('review.aiQuotaExhaustedHint')}</p>
                  </div>
                  <Link to="/pricing" className="btn-primary text-xs py-1 px-2 whitespace-nowrap">
                    {t('review.upgrade')}
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span id={`draft-counter-${review.id}`} className={`text-xs ${draftText.length > 800 ? 'text-red-500' : 'text-gray-400'}`} aria-live="polite">
                    {draftText.length}/1000
                  </span>
                  {/* Proactive AI quota badge — only shown on plans with a finite cap */}
                  {aiLimited && aiRemaining != null && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${aiRemaining === 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : aiRemaining <= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                      title={t('review.aiQuotaTitle', { used: aiMax - aiRemaining, max: aiMax })}
                    >
                      {t('review.aiQuotaBadge', { n: aiRemaining })}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={handleDraft} disabled={loading || aiExhausted} aria-busy={loading}
                    title={aiExhausted ? t('review.aiQuotaExhausted', { max: aiMax }) : draftText ? t('review.regenerateTitle') : t('review.aiDraftTitle')}
                    aria-label={aiExhausted ? t('review.aiQuotaExhausted', { max: aiMax }) : draftText ? t('review.regenerateTitle') : t('review.aiDraftTitle')}
                    className="inline-flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <span aria-hidden="true">✨</span>
                    {loading ? t('review.drafting') : draftText ? t('review.regenerate') : t('review.aiDraft')}
                  </button>
                  <button type="button" onClick={handleSend} disabled={loading || !draftText.trim() || draftText.length > 1000} aria-busy={loading}
                    className="btn-primary text-xs py-1.5 disabled:opacity-50">
                    {loading ? t('review.saving') : t('review.saveResponse')}
                  </button>
                  <button type="button" onClick={() => { setDrafting(false); setShowTemplates(false); }} className="btn-secondary text-xs py-1.5">
                    {t('review.cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ReviewCard);
