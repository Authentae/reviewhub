import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './context/I18nContext';
import { UserProvider } from './context/UserContext';
import './index.css';
import './styles/design-system.css';
import './styles/dashboard-system.css';

// Frontend Sentry — captures browser JS errors, unhandled promise
// rejections, and React render crashes. Only enabled when VITE_SENTRY_DSN
// is set at build time (so dev builds don't spam the production project).
// Server already forwards backend errors via server/src/lib/errorReporter.
//
// Dynamic import keeps the @sentry/react bundle out of the main chunk
// when Sentry isn't configured — Vite splits it into its own chunk that
// only downloads on the production hostname. Saves ~30KB gzipped on the
// initial paint for users without VITE_SENTRY_DSN.
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
    });
    // Expose on window so ErrorBoundary's componentDidCatch can forward
    // React render crashes — Sentry's window.onerror auto-instrumentation
    // doesn't see those because React swallows them inside the boundary.
    window.Sentry = Sentry;
  }).catch(() => { /* SDK load failed — silently fall back to no telemetry */ });
}

// Microsoft Clarity — free, unlimited session replays + heatmaps. Loads
// the official snippet from clarity.ms when VITE_CLARITY_PROJECT_ID is set
// at build time AND we're on production. Inert otherwise (no script, no
// global, no network).
//
// Setup: signup at clarity.microsoft.com → create project for
// reviewhub.review → copy the project ID (looks like "abc12d3ef4") into
// Railway env as VITE_CLARITY_PROJECT_ID, then redeploy.
//
// CSP allows https://*.clarity.ms in scriptSrc + connectSrc (see
// server/src/app.js). Without that, the browser silently blocks Clarity.
//
// Clarity auto-handles SPA route changes via History API hooks, so we
// only need to fire this once at startup. Privacy: we do NOT enable PII
// masking opt-in here — Clarity masks input fields and PII patterns by
// default; review your project settings if you collect anything sensitive.
if (import.meta.env.PROD && import.meta.env.VITE_CLARITY_PROJECT_ID) {
  try {
    const id = import.meta.env.VITE_CLARITY_PROJECT_ID;
    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${id}`;
    document.head.appendChild(s);
  } catch (e) { /* analytics is optional — never crash the page */ }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
          <ToastProvider>
            <UserProvider>
              <App />
            </UserProvider>
          </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>
);
