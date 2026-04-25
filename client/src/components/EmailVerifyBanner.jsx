import React, { useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useUser } from '../context/UserContext';
import { useToast } from './Toast';

// Soft prompt shown at the top of the authenticated app when the current user
// hasn't verified their email yet. Reads from the shared UserContext so we
// don't pile a duplicate /me fetch on top of what Navbar etc. already triggered.
//
// Not blocking: the app is usable without verification. This is a reminder
// plus a "resend" action for users who lost the original email.
const DISMISSED_KEY = 'reviewhub_verify_banner_dismissed';

export default function EmailVerifyBanner() {
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useUser();
  const verified = user ? !!user.email_verified : null;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === 'true');
  const [sending, setSending] = useState(false);

  async function handleResend() {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast(t('verify.resendSent'), 'success');
    } catch (err) {
      toast(err.response?.data?.error || t('verify.resendFailed'), 'error');
    } finally {
      setSending(false);
    }
  }

  function handleDismiss() {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }

  if (verified !== false || dismissed) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-2 flex items-center justify-between gap-3 text-sm"
    >
      <span className="text-amber-800 dark:text-amber-200 flex items-center gap-2 min-w-0">
        <span aria-hidden="true">✉️</span>
        <span className="truncate">{t('verify.bannerText')}</span>
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          aria-busy={sending}
          className="text-xs font-semibold text-amber-700 dark:text-amber-300 underline hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-50"
        >
          {sending ? t('verify.resending') : t('verify.resendAction')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.dismiss')}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
