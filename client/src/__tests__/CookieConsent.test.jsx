// Tests for the CookieConsent banner — first-touch UX every visitor
// sees before any other interaction.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import CookieConsent from '../components/CookieConsent';
import { I18nProvider } from '../context/I18nContext';

// Don't actually POST anything to the server in tests.
vi.mock('../lib/api', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: {} })) },
}));
// Treat the user as logged-out so the syncToServer path is a no-op.
vi.mock('../lib/auth', () => ({ isLoggedIn: () => false }));

function renderBanner() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the banner on first visit', () => {
    renderBanner();
    expect(screen.getByText(/Your privacy choices/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Decline non-essential/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customize/i })).toBeInTheDocument();
  });

  it('does NOT render when consent already exists in localStorage', () => {
    localStorage.setItem(
      'rh_consent_v1',
      JSON.stringify({ consents: { essential: true, analytics: false }, recordedAt: new Date().toISOString() })
    );
    renderBanner();
    expect(screen.queryByText(/Your privacy choices/i)).toBeNull();
  });

  it('hides itself after Accept all', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Accept all/i }));
    expect(screen.queryByText(/Your privacy choices/i)).toBeNull();
    // Decision must persist so a refresh doesn't re-show.
    const stored = JSON.parse(localStorage.getItem('rh_consent_v1'));
    expect(stored.consents.analytics).toBe(true);
    expect(stored.consents.essential).toBe(true);
  });

  it('hides itself after Decline non-essential and persists essential-only consent', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Decline non-essential/i }));
    expect(screen.queryByText(/Your privacy choices/i)).toBeNull();
    const stored = JSON.parse(localStorage.getItem('rh_consent_v1'));
    expect(stored.consents.essential).toBe(true);
    expect(stored.consents.analytics).toBe(false);
    expect(stored.consents.marketing).toBe(false);
    expect(stored.consents.third_party).toBe(false);
    expect(stored.consents.profiling).toBe(false);
  });

  it('shows the customize panel when Customize is clicked, with essential locked on', () => {
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));
    // The Essential checkbox should be present, checked, and disabled.
    const essential = screen.getByRole('checkbox', { name: /Essential/i });
    expect(essential.checked).toBe(true);
    expect(essential.disabled).toBe(true);
  });
});
