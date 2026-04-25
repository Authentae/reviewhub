import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './context/I18nContext';
import { UserProvider } from './context/UserContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
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
