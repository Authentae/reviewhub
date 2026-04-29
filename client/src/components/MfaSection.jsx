import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useI18n } from '../context/I18nContext';
import { useToast } from './Toast';

// MFA enable/disable UI, meant to drop into Settings. Encapsulates the
// full state machine — disabled → enabling (code entry) → showing recovery
// codes → enabled → disabling — so Settings.jsx just renders <MfaSection />.
//
// States:
//   'disabled'    : MFA is off. Show "Enable two-factor" button.
//   'enabling'    : user clicked enable, email sent, awaiting 6-digit code.
//   'codes'       : code verified; showing one-time recovery codes.
//                   CANNOT leave this state until user acknowledges.
//   'enabled'     : MFA is on. Show "Disable" button.
//   'disabling'   : user clicked disable; showing password prompt.
//
// Props:
//   mfaEnabled        — current server-side state (from /me)
//   onMfaChange(next) — called with the new boolean after enable/disable.
//                       Parent should reload /me to refresh its own state.

export default function MfaSection({ mfaEnabled, onMfaChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState(mfaEnabled ? 'enabled' : 'disabled');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep local state in sync with the mfaEnabled prop — but ONLY when the
  // prop actually transitions (not on every render). Using a previous-value
  // ref scoped to just the prop means: when the user completes the enable
  // flow and acknowledges recovery codes (state='enabled' locally), the
  // parent re-fetches /me async; before that lands, mfaEnabled is still
  // false, and a naive `useEffect([mfaEnabled, state])` would snap us back
  // to 'disabled'. The ref-based guard only syncs when prop changes from
  // its previous render value.
  const prevPropRef = useRef(mfaEnabled);
  useEffect(() => {
    if (prevPropRef.current !== mfaEnabled) {
      prevPropRef.current = mfaEnabled;
      if (state === 'enabled' || state === 'disabled') {
        setState(mfaEnabled ? 'enabled' : 'disabled');
      }
    }
  }, [mfaEnabled, state]);

  // Step 1: user clicks "Enable" — show password prompt (don't send email yet).
  function handleEnableStart() {
    setError('');
    setPassword('');
    setState('enable-pw');
  }

  // Step 2: user submits password — server emails the OTP and we move on.
  async function handleBeginEnable(e) {
    if (e?.preventDefault) e.preventDefault();
    if (!password) {
      setError(t('mfa.passwordRequired', 'Password is required'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/mfa/enable', { password });
      setPassword('');
      setState('enabling');
    } catch (err) {
      setError(err.response?.data?.error || t('mfa.enableError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmEnable(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/mfa/enable/confirm', { code: otp });
      setRecoveryCodes(data.recovery_codes || []);
      setState('codes');
      setOtp('');
      onMfaChange?.(true);
    } catch (err) {
      setError(err.response?.data?.error || t('mfa.enableError'));
    } finally {
      setBusy(false);
    }
  }

  // Guard against tab close / refresh while recovery codes are on screen —
  // losing them means the user can never MFA-bypass if they lose email
  // access. The "acknowledge" button clears this guard before moving on.
  useEffect(() => {
    if (state !== 'codes') return;
    function onBeforeUnload(e) {
      // Modern browsers ignore returned strings and show a generic prompt.
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state]);

  async function handleBeginDisable() {
    setState('disabling');
    setError('');
  }

  async function handleConfirmDisable(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/mfa/disable', { password });
      setPassword('');
      setState('disabled');
      toast(t('mfa.disableSuccess'), 'info');
      onMfaChange?.(false);
    } catch (err) {
      setError(err.response?.data?.error || t('mfa.disableError'));
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadCodes() {
    // Generate a simple .txt file the user can save. Hash-free plaintext,
    // labelled with the date so the user can distinguish if they regenerate later.
    const content = [
      'ReviewHub — Two-factor recovery codes',
      `Generated: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Store these somewhere safe (password manager, printed copy).',
      'Each code works once. You can use any of them to sign in if you',
      'lose access to your email.',
      '',
      ...recoveryCodes,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reviewhub-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleAcknowledgeCodes() {
    setRecoveryCodes([]);
    setState('enabled');
    toast(t('mfa.enableSuccess'), 'success');
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="mb-6" aria-labelledby="settings-mfa">
      <h2 id="settings-mfa" className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {t('mfa.sectionTitle')}
      </h2>
      <div className="card p-5">
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg mb-3">
            {error}
          </div>
        )}

        {state === 'disabled' && (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('mfa.disabledTitle')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('mfa.disabledDesc')}</p>
            </div>
            <button
              type="button"
              onClick={handleEnableStart}
              disabled={busy}
              aria-busy={busy}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {t('mfa.enable')}
            </button>
          </div>
        )}

        {state === 'enable-pw' && (
          <form onSubmit={handleBeginEnable} className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{t('mfa.confirmPasswordTitle', 'Confirm your password')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('mfa.confirmPasswordDesc', 'Enter your password to start two-factor setup.')}</p>
            </div>
            <div>
              <label htmlFor="mfa-enable-pw" className="sr-only">{t('mfa.passwordLabel', 'Password')}</label>
              <input
                id="mfa-enable-pw"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input max-w-xs"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !password} aria-busy={busy} className="btn-primary text-sm">
                {busy ? t('mfa.sending') : t('mfa.continue', 'Continue')}
              </button>
              <button
                type="button"
                onClick={() => { setState('disabled'); setPassword(''); setError(''); }}
                disabled={busy}
                className="btn-secondary text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        )}

        {state === 'enabling' && (
          <form onSubmit={handleConfirmEnable} className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{t('mfa.enterCodeTitle')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('mfa.enterCodeDesc')}</p>
            </div>
            <div>
              <label htmlFor="mfa-enable-code" className="sr-only">{t('mfa.codeLabel')}</label>
              <input
                id="mfa-enable-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                className="input text-lg tracking-widest text-center font-mono max-w-[200px]"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary text-sm">
                {busy ? t('mfa.verifying') : t('mfa.confirm')}
              </button>
              <button
                type="button"
                onClick={() => { setState('disabled'); setOtp(''); setError(''); }}
                disabled={busy}
                className="btn-secondary text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        )}

        {state === 'codes' && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('mfa.codesTitle')}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t('mfa.codesWarning')}</p>
            </div>
            <ul
              aria-label={t('mfa.codesTitle')}
              className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/40 p-3 rounded-lg font-mono text-sm"
            >
              {recoveryCodes.map((c) => (
                <li key={c} className="text-center py-1 select-all">{c}</li>
              ))}
            </ul>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={handleDownloadCodes} className="btn-secondary text-sm">
                {t('mfa.download')}
              </button>
              <button type="button" onClick={handleAcknowledgeCodes} className="btn-primary text-sm">
                {t('mfa.savedAcknowledge')}
              </button>
            </div>
          </div>
        )}

        {state === 'enabled' && (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" aria-hidden="true" />
                {t('mfa.enabledTitle')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('mfa.enabledDesc')}</p>
            </div>
            <button type="button" onClick={handleBeginDisable} className="btn-secondary text-sm">
              {t('mfa.disable')}
            </button>
          </div>
        )}

        {state === 'disabling' && (
          <form onSubmit={handleConfirmDisable} className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('mfa.disableConfirmTitle')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('mfa.disableConfirmDesc')}</p>
            </div>
            <div>
              <label htmlFor="mfa-disable-pw" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                {t('settings.currentPassword')}
              </label>
              <input
                id="mfa-disable-pw"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} aria-busy={busy} className="btn-primary text-sm">
                {busy ? t('mfa.verifying') : t('mfa.confirmDisable')}
              </button>
              <button
                type="button"
                onClick={() => { setState('enabled'); setPassword(''); setError(''); }}
                disabled={busy}
                className="btn-secondary text-sm"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
