import { useEffect } from 'react';

// Frill feedback widget. Renders a feedback button that opens Frill's
// portal so users can suggest features, vote on roadmap items, and see
// what's planned/shipped.
//
// Inert until VITE_FRILL_KEY is set at build time. Drop your widget key
// into Railway env (VITE_FRILL_KEY=…) and redeploy — the widget then
// auto-mounts on every page through App.jsx.
//
// Setup runbook: docs/runbooks/frill-setup.md
//
// CSP: server allows widget.frill.co + api.frill.co.

const FRILL_SCRIPT = 'https://widget.frill.co/v2/widget.js';

export default function FrillWidget() {
  useEffect(() => {
    const key = import.meta.env.VITE_FRILL_KEY;
    if (!key) return; // Inert when unconfigured — no script, no globals.

    // Frill's expected boot config — array form supports multiple widgets
    // on the same page (we only ever use one).
    window.Frill_Config = window.Frill_Config || [];
    window.Frill_Config.push({ key });

    // Idempotent script load — guard against double-mount in dev under
    // React StrictMode and against navigation re-mounts.
    if (document.querySelector(`script[src="${FRILL_SCRIPT}"]`)) return;
    const s = document.createElement('script');
    s.src = FRILL_SCRIPT;
    s.defer = true;
    s.setAttribute('data-frill', '1');
    document.head.appendChild(s);
  }, []);

  return null;
}
