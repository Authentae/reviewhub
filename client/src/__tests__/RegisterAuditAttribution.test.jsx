// Tests for the audit-flow attribution path:
//   /audit-preview/<token> → click "Sign up" CTA
//     → /register?from=audit&business=<name>&token=<share>
//        → sessionStorage("rh_signup_attribution") populated
//          → OnboardingChecklist reads it and pre-fills the new business name.
//
// Without this test, the wave-2 onboarding-attribution piece is verified
// only by manual click-through. Anyone refactoring Register.jsx or the
// attribution payload shape can silently break the prefill, costing real
// outreach signups (the whole point of the audit-funnel CTA).

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from '../pages/Register';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';

function renderRegisterAt(url) {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[url]}>
            <Routes>
              <Route path="/register" element={<Register />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

describe('Register — audit-flow attribution', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('writes attribution payload to sessionStorage when arriving with ?from=audit', () => {
    renderRegisterAt('/register?from=audit&business=The%20Corner%20Bistro&token=abc123');

    const raw = sessionStorage.getItem('rh_signup_attribution');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw);
    expect(parsed.from).toBe('audit');
    expect(parsed.business).toBe('The Corner Bistro');
    expect(parsed.token).toBe('abc123');
    // `at` is a fresh timestamp — just assert it's a number close to now
    expect(typeof parsed.at).toBe('number');
    expect(Math.abs(Date.now() - parsed.at)).toBeLessThan(5000);
  });

  it('handles URL-encoded business names with special characters', () => {
    // "Café del Mar" — exercises both the URL encoding and unicode round-trip.
    renderRegisterAt('/register?from=audit&business=Caf%C3%A9%20del%20Mar&token=xyz');

    const parsed = JSON.parse(sessionStorage.getItem('rh_signup_attribution'));
    expect(parsed.business).toBe('Café del Mar');
  });

  it('does NOT write attribution when from is missing', () => {
    // Defends the guard at Register.jsx:28 — without ?from=audit we MUST NOT
    // poison sessionStorage. A user landing at /register?business=Foo from a
    // different referrer (e.g. a forwarded link, browser autofill) shouldn't
    // get attribution credit they didn't earn from the audit funnel.
    renderRegisterAt('/register?business=Some%20Business');

    expect(sessionStorage.getItem('rh_signup_attribution')).toBeNull();
  });

  it('does NOT write attribution when from is something other than "audit"', () => {
    renderRegisterAt('/register?from=organic&business=Some%20Business&token=abc');

    expect(sessionStorage.getItem('rh_signup_attribution')).toBeNull();
  });

  it('handles missing business and token gracefully (records empty strings)', () => {
    // If the audit-preview page somehow links without business/token (a bug,
    // but defensive), the attribution still records `from=audit` so we know
    // the funnel fired — downstream consumers just see empty fields and skip
    // the prefill. Better than throwing.
    renderRegisterAt('/register?from=audit');

    const parsed = JSON.parse(sessionStorage.getItem('rh_signup_attribution'));
    expect(parsed.from).toBe('audit');
    expect(parsed.business).toBe('');
    expect(parsed.token).toBe('');
  });
});
