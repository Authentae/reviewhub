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
