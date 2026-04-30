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
    // .rh-banner.warning lives in dashboard-system.css and renders as a
    // soft ochre-on-paper tint that flows seamlessly into the Navbar (which
    // uses the same --rh-paper token). Earlier this used raw Tailwind
    // `bg-amber-50 dark:bg-amber-900/30` which clashed with the editorial
    // navbar — created a visible "two-tone" stripe across the top of every
    // page for unverified users.
    <div
      role="status"
      className="rh-design rh-app rh-banner warning"
      style={{ justifyContent: 'space-between' }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span aria-hidden="true">✉️</span>
        <span className="truncate">{t('verify.bannerText')}</span>
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          aria-busy={sending}
          className="text-xs font-semibold underline disabled:opacity-50"
          style={{ color: 'var(--rh-ochre-deep)' }}
        >
          {sending ? t('verify.resending') : t('verify.resendAction')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('common.dismiss')}
          className="text-xs"
          style={{ color: 'var(--rh-ink-3)' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
