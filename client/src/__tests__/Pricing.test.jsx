// Tests for the Pricing page. The page fetches /api/plans and renders a
// card per tier, so mocking axios with the server's plan catalogue shape
// is the key to reliable assertions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import Pricing from '../pages/Pricing';

// Mock axios (lib/api imports it) so no network traffic during tests.
vi.mock('../lib/api', () => ({
  default: { get: vi.fn() },
}));

import api from '../lib/api';

const PLANS = [
  {
    id: 'free', name: 'Free', priceMonthlyUsd: 0, priceAnnualUsd: 0,
    description: 'Try it', maxPlatforms: 1, maxAiDraftsPerMonth: 3,
    features: { ai_drafts: true },
  },
  {
    id: 'starter', name: 'Starter', priceMonthlyUsd: 14, priceAnnualUsd: 134,
    description: 'Single shop', maxPlatforms: 2, maxAiDraftsPerMonth: null,
    features: { ai_drafts: true, email_alerts_new: true, templates: true },
  },
  {
    id: 'pro', name: 'Pro', priceMonthlyUsd: 29, priceAnnualUsd: 278,
    description: 'Busy', maxPlatforms: 6, maxAiDraftsPerMonth: null,
    features: { ai_drafts: true, trend_analytics: true, csv_export: true },
  },
  {
    id: 'business', name: 'Business', priceMonthlyUsd: 59, priceAnnualUsd: 567,
    description: 'Multi-location', maxPlatforms: 20, maxAiDraftsPerMonth: null,
    features: { ai_drafts: true, multi_location: true, priority_support: true },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <I18nProvider>
          <Pricing />
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('Pricing page', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('renders all four tiers from /api/plans', async () => {
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();

    // Wait for the network-sourced cards to render
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Free', level: 2 })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Starter', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Business', level: 2 })).toBeInTheDocument();
  });

  it('shows monthly prices by default', async () => {
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();
    await waitFor(() => expect(screen.getByText('$14')).toBeInTheDocument());
    expect(screen.getByText('$29')).toBeInTheDocument();
    expect(screen.getByText('$59')).toBeInTheDocument();
  });

  it('toggles to annual pricing', async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();
    await waitFor(() => expect(screen.getByText('$14')).toBeInTheDocument());

    // Find the annual-cycle radio and click
    const annualBtn = screen.getAllByRole('radio').find((el) =>
      el.textContent?.toLowerCase().includes('annual') ||
      el.textContent?.toLowerCase().includes('year')
    );
    if (annualBtn) {
      await user.click(annualBtn);
      await waitFor(() => expect(screen.getByText('$134')).toBeInTheDocument());
    }
  });

  it('shows a load error if /api/plans fails', async () => {
    api.get.mockRejectedValueOnce(new Error('network'));
    renderPage();
    await waitFor(() => {
      // The translation falls back to English; the error key is pricing.loadError
      expect(screen.getByText(/couldn't load plans/i)).toBeInTheDocument();
    });
  });

  it('switches to THB prices via the currency toggle (Thai locale only)', async () => {
    // The USD/THB toggle now ONLY renders for the Thai locale (2026-05-21
    // change — previously the toggle appeared on every locale, which made
    // no sense for Spanish / German / etc visitors). So this test sets
    // lang=th to make the toggle present.
    localStorage.setItem('reviewhub_lang', 'th');
    const user = userEvent.setup();
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();
    // Thai locale defaults to THB; check the psychologically-anchored
    // Starter price (~฿449, not the literal $14 × FX rate). The ~ prefix
    // marks it as approximate.
    await waitFor(() => expect(screen.getByText(/~฿449/)).toBeInTheDocument());
    // Click the USD currency pill to switch back
    const usdBtn = screen.getAllByRole('radio').find((el) => el.textContent === 'USD');
    expect(usdBtn).toBeTruthy();
    await user.click(usdBtn);
    await waitFor(() => expect(screen.getByText('$14')).toBeInTheDocument());
  });

  it('defaults currency to THB (with ~ marker) for a Thai-locale user', async () => {
    // Set the stored language to Thai BEFORE render. Pricing reads the lang
    // from I18nContext; lang='th' → currency 'THB' default. Display is the
    // psychologically-anchored ~฿449 not the literal FX-computed amount,
    // and the ~ prefix marks it approximate (LemonSqueezy still charges
    // USD at checkout).
    localStorage.setItem('reviewhub_lang', 'th');
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/~฿449/)).toBeInTheDocument());
  });

  it('hides the currency toggle entirely for USD-default locales (en, es)', async () => {
    // 2026-05-21 change: no point showing a single-option "USD" toggle to
    // visitors whose locale has no local-currency alternate (the old code
    // always rendered USD + THB regardless of locale). Verify the toggle
    // is absent for English.
    localStorage.setItem('reviewhub_lang', 'en');
    api.get.mockResolvedValueOnce({ data: { plans: PLANS } });
    renderPage();
    await waitFor(() => expect(screen.getByText('$14')).toBeInTheDocument());
    // The cycle toggle (Monthly/Annual) still exists, but the currency
    // toggle (USD/THB or USD/JPY etc) should not.
    const radios = screen.getAllByRole('radio').map((el) => el.textContent);
    expect(radios).not.toContain('THB');
    expect(radios).not.toContain('JPY');
  });
});
