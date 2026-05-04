import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../context/I18nContext';

// Saved filter presets — let users save the current dashboard filter
// combination under a name and recall it with one click.
//
// Storage strategy: localStorage. v1 doesn't sync across devices, but
// for the dashboard's "I always check unanswered 1-stars first thing
// in the morning" use case, that's fine — heavy users live on one
// device. Server-backed sync is a future addition that doesn't change
// the UX shape; only the storage layer.
//
// Why localStorage and not URL state: the URL already holds the
// current filters (Dashboard syncs them in handleFilterChange), but
// presets are persistent across sessions and not tied to a specific
// URL. Putting presets in localStorage keeps them durable without
// requiring the user to bookmark or remember URLs.
//
// Storage key is namespaced per business so users with multiple
// businesses don't see each other's presets.

const STORAGE_KEY_PREFIX = 'rh_filter_presets_';
const MAX_PRESETS = 20; // sanity cap — UI gets unwieldy past this

function storageKey(businessId) {
  return `${STORAGE_KEY_PREFIX}${businessId || 'default'}`;
}

function readPresets(businessId) {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePresets(businessId, presets) {
  try {
    localStorage.setItem(storageKey(businessId), JSON.stringify(presets.slice(0, MAX_PRESETS)));
  } catch { /* quota / disabled — non-fatal */ }
}

export default function FilterPresets({
  businessId,
  currentFilters,    // { platform, sentiment, responded, rating, search, tagFilter, pinnedOnly, flaggedOnly, statusFilter, dateFrom, dateTo, sort }
  applyPreset,        // (filters) => void — Dashboard sets all the filter states
  hasActiveFilters,   // boolean — disables Save button when there's nothing to save
}) {
  const { t } = useI18n();
  const [presets, setPresets] = useState(() => readPresets(businessId));
  const [showMenu, setShowMenu] = useState(false);

  // Re-load when the business changes (different business → different
  // saved set).
  useEffect(() => {
    setPresets(readPresets(businessId));
  }, [businessId]);

  const handleSave = useCallback(() => {
    if (!hasActiveFilters) return;
    // eslint-disable-next-line no-alert
    const name = window.prompt(t('filterPresets.namePrompt', 'Name this filter preset:'));
    if (!name) return;
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return;
    const next = [
      // Replace by name if it already exists (prevents accidental dupes
      // and gives users a natural "update" path: save again with same name).
      ...presets.filter(p => p.name !== trimmed),
      { name: trimmed, filters: currentFilters, savedAt: Date.now() },
    ];
    setPresets(next);
    writePresets(businessId, next);
    setShowMenu(false);
  }, [hasActiveFilters, presets, currentFilters, businessId, t]);

  const handleApply = useCallback((preset) => {
    applyPreset(preset.filters);
    setShowMenu(false);
  }, [applyPreset]);

  const handleDelete = useCallback((e, name) => {
    // Stop propagation so clicking the trash doesn't trigger the
    // outer button's apply handler. Without this the user clicks
    // delete and the filter applies first, then the row vanishes —
    // confusing.
    e.stopPropagation();
    e.preventDefault();
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    writePresets(businessId, next);
  }, [presets, businessId]);

  // Click-outside-to-close. Without this, the dropdown stays open
  // forever once toggled, which interferes with other dashboard UI.
  useEffect(() => {
    if (!showMenu) return undefined;
    function onDocClick(e) {
      // Don't close if the click is on the toggle button itself —
      // that handler will toggle and we'd close-then-open.
      if (e.target.closest?.('[data-filter-presets-root]')) return;
      setShowMenu(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMenu]);

  return (
    <div className="relative inline-block" data-filter-presets-root>
      <button
        type="button"
        onClick={() => setShowMenu(v => !v)}
        className="input w-auto text-sm flex items-center gap-1.5"
        aria-haspopup="menu"
        aria-expanded={showMenu}
        title={t('filterPresets.menuTitle', 'Saved filter presets')}
      >
        <span aria-hidden="true">★</span>
        <span>{t('filterPresets.label', 'Presets')}</span>
        {presets.length > 0 && (
          <span
            className="ml-1 inline-flex items-center justify-center text-xs font-semibold rounded-full px-1.5 py-0.5"
            style={{ background: 'var(--rh-line, #e6dfce)', color: 'var(--rh-ink, #1d242c)', minWidth: '1.25rem' }}
          >
            {presets.length}
          </span>
        )}
      </button>

      {showMenu && (
        <div
          role="menu"
          className="absolute z-20 mt-1 right-0 min-w-[14rem] max-h-[60vh] overflow-y-auto rounded-lg shadow-lg"
          style={{
            background: 'var(--rh-paper, #fff)',
            border: '1px solid var(--rh-line, #e6dfce)',
          }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasActiveFilters}
            className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--rh-line, #e6dfce)' }}
            title={hasActiveFilters
              ? t('filterPresets.saveTooltip', 'Save current filters under a name')
              : t('filterPresets.saveDisabledTooltip', 'Apply some filters first')}
          >
            <span aria-hidden="true">＋</span>
            <span>{t('filterPresets.saveCurrent', 'Save current as preset')}</span>
          </button>

          {presets.length === 0 ? (
            <p className="text-xs px-3 py-3" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
              {t('filterPresets.empty', 'No saved presets yet. Apply some filters and click "Save" above.')}
            </p>
          ) : (
            <ul role="none" className="py-1">
              {presets.map((preset) => (
                <li key={preset.name} role="none" className="flex items-stretch group">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleApply(preset)}
                    className="flex-1 text-left text-sm px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 truncate"
                    title={t('filterPresets.applyTooltip', 'Apply this preset')}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, preset.name)}
                    className="px-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title={t('filterPresets.deleteTooltip', 'Delete this preset')}
                    aria-label={t('filterPresets.deleteAria', { name: preset.name })}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
