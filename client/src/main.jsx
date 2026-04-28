import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
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
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
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
