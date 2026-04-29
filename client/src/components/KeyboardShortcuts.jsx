import React, { useEffect, useState, useRef } from 'react';
import { useI18n } from '../context/I18nContext';

// App-wide keyboard-shortcuts help modal. Press "?" anywhere in the app
// (outside an input) to open. Esc closes. The list is static for now — if
// we add a shortcut we list it here AND wire it in the relevant component
// (Dashboard's `/` to focus search already works; same pattern).
//
// Why a single shared component: showing the same help overlay from every
// page means users learn one mental model, not a different one per page.
// It's keyboard-first by design (mouse users still get hover affordances
// elsewhere in the UI — this is for the keyboard-native crowd).

const SHORTCUTS = [
  { keys: ['?'],      descKey: 'shortcuts.showHelp' },
  { keys: ['/'],      descKey: 'shortcuts.focusSearch' },
  { keys: ['Esc'],    descKey: 'shortcuts.closeDialogs' },
  { keys: ['g','h'],  descKey: 'shortcuts.goHome' },
  { keys: ['g','d'],  descKey: 'shortcuts.goDashboard' },
  { keys: ['g','a'],  descKey: 'shortcuts.goAnalytics' },
  { keys: ['g','s'],  descKey: 'shortcuts.goSettings' },
  { keys: ['g','p'],  descKey: 'shortcuts.goPricing' },
  { keys: ['g','r'],  descKey: 'shortcuts.goRequests' },
];

export default function KeyboardShortcuts() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef(null);
  const dialogRef = useRef(null);
  // Where focus was BEFORE the dialog opened — so we can restore it on
  // close and the user lands back where they invoked "?".
  const previouslyFocusedRef = useRef(null);

  // Global `?` listener. Skip when focus is in an input so typing "?"
  // in a search box doesn't pop the modal.
  useEffect(() => {
    function onKey(e) {
      if (e.key === '?') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Capture the previously-focused element when opening, restore it on close.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
      closeBtnRef.current?.focus();
    } else if (previouslyFocusedRef.current) {
      // Use setTimeout 0 so the dialog has unmounted before we move focus —
      // otherwise focus moves while the dialog still owns it and is lost.
      const target = previouslyFocusedRef.current;
      setTimeout(() => { try { target.focus(); } catch { /* element gone */ } }, 0);
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  // Focus trap — keep Tab cycling between the dialog's focusables instead of
  // escaping back to the page underneath. Without this, Shift+Tab from the
  // close button jumps to whatever was focusable before the dialog,
  // partially defeating aria-modal="true".
  useEffect(() => {
    if (!open) return;
    function onTab(e) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="kbd-help-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div ref={dialogRef} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 id="kbd-help-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('shortcuts.title')}
          </h2>
          <button
            type="button"
            ref={closeBtnRef}
            onClick={() => setOpen(false)}
            aria-label={t('common.dismiss')}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none"
          >×</button>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {SHORTCUTS.map((s) => (
            <li key={s.keys.join('+')} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t(s.descKey)}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-[10px] text-gray-400 mx-0.5">{t('shortcuts.then')}</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-[11px] font-mono text-gray-800 dark:text-gray-200 shadow-sm">
                      {k}
                    </kbd>
                  </React.Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 dark:text-gray-400">
          {t('shortcuts.footerHint')}
        </div>
      </div>
    </div>
  );
}
