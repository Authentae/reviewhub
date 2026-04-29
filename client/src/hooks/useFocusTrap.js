import { useEffect, useRef } from 'react';

// Reusable focus trap + restoration for modal dialogs.
//
// Usage:
//   const dialogRef = useFocusTrap(open);
//   return open ? <div role="dialog" ref={dialogRef}>...</div> : null;
//
// Behaviour:
// - On open: captures `document.activeElement`, focuses the first focusable
//   inside the dialog (or the ref'd element if none found).
// - On close: restores focus to the element that had it before opening.
// - While open: Tab and Shift+Tab cycle between the first/last focusables
//   inside the dialog instead of escaping back to the page underneath.
//
// Why a hook: every modal in the app needs the same three behaviours
// (capture/restore/trap) and they were quietly missing on most of them
// — KeyboardShortcuts, the email-change modal in Settings, the verify-mfa
// modal, etc. This hook centralises the pattern so adding `useFocusTrap`
// to a dialog is a one-line opt-in.
//
// Returns a ref that the caller attaches to the dialog's outermost focus-
// holding element (usually the `<div role="dialog">`).
export default function useFocusTrap(active) {
  const containerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  // Capture / restore.
  useEffect(() => {
    if (active) {
      previouslyFocusedRef.current = document.activeElement;
      // Defer a tick so the ref'd container is in the DOM and the focus
      // call can find it.
      const id = setTimeout(() => {
        if (!containerRef.current) return;
        const focusables = containerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        (focusables[0] || containerRef.current)?.focus?.();
      }, 0);
      return () => clearTimeout(id);
    }
    // Closing: restore the previously-focused element.
    const target = previouslyFocusedRef.current;
    if (target && typeof target.focus === 'function') {
      // setTimeout 0 lets the dialog finish unmounting before we move focus.
      const id = setTimeout(() => { try { target.focus(); } catch { /* gone */ } }, 0);
      previouslyFocusedRef.current = null;
      return () => clearTimeout(id);
    }
  }, [active]);

  // Tab trap.
  useEffect(() => {
    if (!active) return;
    function onTab(e) {
      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = containerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [active]);

  return containerRef;
}
