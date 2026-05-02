import React from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

// Inner class component — receives translated strings and resetKey via props.
// resetKey changes on route change, which triggers getDerivedStateFromProps to clear the error.
class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  // Reset error state when the parent passes a new resetKey (e.g. route changed)
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    // Forward to Sentry if it's loaded. window.onerror / unhandledrejection
    // are auto-instrumented by @sentry/react, but errors caught here in a
    // React render boundary never bubble to those handlers — without this
    // explicit forward, "white screen" crashes silently disappear from
    // production telemetry. Optional chain in case Sentry's dynamic import
    // (main.jsx) hasn't completed yet or VITE_SENTRY_DSN was unset.
    try {
      if (typeof window !== 'undefined' && window.Sentry?.captureException) {
        window.Sentry.captureException(error, {
          contexts: { react: { componentStack: info?.componentStack } },
        });
      }
    } catch { /* swallowing — telemetry is best-effort */ }
  }

  render() {
    if (this.state.error) {
      // In dev the raw error message is useful. In prod it can leak internal
      // structure (component names, file paths) and confuses users who can't
      // act on "Cannot read properties of undefined (reading 'x')". Show the
      // generic translated message in prod; full detail only in dev.
      const msg = import.meta.env.DEV
        ? (this.state.error?.message || String(this.state.error) || this.props.unknownError)
        : this.props.unknownError;
      return (
        <div className="rh-design rh-app min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4" role="alert">
          <div className="card p-8 max-w-md text-center">
            <p className="text-4xl mb-4" aria-hidden="true">⚠️</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{this.props.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{msg}</p>
            <button
              type="button"
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="btn-primary text-sm"
            >
              {this.props.reload}
            </button>
            {/* Crash-recovery escape hatch — users who land here usually
                CAN'T navigate anywhere else (the SPA shell errored). Give
                them a hard link to /support so they have a path forward
                that doesn't depend on whatever broke. */}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              <a href="/support" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                {this.props.tellUs}
              </a>
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Outer functional wrapper — provides i18n strings and route-based resetKey to the class component
export default function ErrorBoundary({ children }) {
  const { t } = useI18n();
  const location = useLocation();
  return (
    <ErrorBoundaryInner
      resetKey={location.pathname}
      title={t('error.title')}
      reload={t('error.reload')}
      unknownError={t('error.unknown')}
      tellUs={t('error.tellUs', 'Tell us what happened')}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
