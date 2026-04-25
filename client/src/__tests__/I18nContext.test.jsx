// Tests for the i18n translation layer. This is load-bearing for the whole
// UI — silent regressions (wrong fallback, broken placeholder interpolation,
// lost localStorage persistence) would show up as mysterious bad strings in
// every user-visible surface.

import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useI18n } from '../context/I18nContext';

// Tiny consumer that exposes the context for assertions.
function Probe({ k, vars }) {
  const { t, lang, setLang, languages } = useI18n();
  return (
    <div>
      <div data-testid="lang">{lang}</div>
      <div data-testid="langcount">{languages.length}</div>
      <div data-testid="value">{t(k, vars)}</div>
      <button onClick={() => setLang('es')}>es</button>
      <button onClick={() => setLang('zz')}>bad</button>
    </div>
  );
}

describe('I18nContext', () => {
  it('defaults to English', () => {
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('exposes all supported languages', () => {
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    // Current set: en, es, fr, de, pt, it, th, ja, zh, ko. If this changes,
    // update the count — don't over-assert specific codes here; the Pricing
    // and Settings language pickers render the full LANGUAGES array anyway.
    expect(screen.getByTestId('langcount')).toHaveTextContent('10');
  });

  it('returns the key back when nothing matches', () => {
    render(<I18nProvider><Probe k="totally.made.up.key" /></I18nProvider>);
    expect(screen.getByTestId('value')).toHaveTextContent('totally.made.up.key');
  });

  it('interpolates {placeholders}', () => {
    render(<I18nProvider><Probe k="review.stars" vars={{ rating: 4 }} /></I18nProvider>);
    expect(screen.getByTestId('value').textContent).toMatch(/4/);
  });

  it('setLang persists to localStorage and updates output', () => {
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    act(() => { screen.getByText('es').click(); });
    expect(screen.getByTestId('lang')).toHaveTextContent('es');
    expect(localStorage.getItem('reviewhub_lang')).toBe('es');
  });

  it('ignores unknown language codes', () => {
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    act(() => { screen.getByText('bad').click(); });
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('falls back to English for keys missing in the active language', () => {
    // Load Spanish then request a legal-body key that we deliberately ship
    // only in English (see translations.js header comment).
    render(<I18nProvider><Probe k="legal.terms.acceptanceBody" /></I18nProvider>);
    act(() => { screen.getByText('es').click(); });
    // Fallback should be the English string, not the literal key.
    expect(screen.getByTestId('value').textContent).not.toBe('legal.terms.acceptanceBody');
    expect(screen.getByTestId('value').textContent).toMatch(/ReviewHub/);
  });

  it('restores language from localStorage on reload', () => {
    localStorage.setItem('reviewhub_lang', 'ja');
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('ja');
  });

  it('syncs document.documentElement.lang', () => {
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    act(() => { screen.getByText('es').click(); });
    expect(document.documentElement.lang).toBe('es');
  });

  it('auto-detects language from navigator.languages when nothing is stored', () => {
    // Simulate a Thai browser — navigator.languages = ['th-TH', 'en']
    const orig = Object.getOwnPropertyDescriptor(navigator, 'languages');
    Object.defineProperty(navigator, 'languages', {
      value: ['th-TH', 'en'], configurable: true,
    });
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('th');
    if (orig) Object.defineProperty(navigator, 'languages', orig);
  });

  it('falls back to English when navigator.languages has no supported primary subtag', () => {
    const orig = Object.getOwnPropertyDescriptor(navigator, 'languages');
    Object.defineProperty(navigator, 'languages', {
      value: ['xx-ZZ', 'qq'], configurable: true,
    });
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    if (orig) Object.defineProperty(navigator, 'languages', orig);
  });

  it('stored preference beats browser auto-detect', () => {
    localStorage.setItem('reviewhub_lang', 'ja');
    const orig = Object.getOwnPropertyDescriptor(navigator, 'languages');
    Object.defineProperty(navigator, 'languages', {
      value: ['th-TH'], configurable: true,
    });
    render(<I18nProvider><Probe k="auth.signIn" /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('ja');
    if (orig) Object.defineProperty(navigator, 'languages', orig);
  });
});
