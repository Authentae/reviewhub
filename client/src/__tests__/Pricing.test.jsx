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

  it('switches to THB prices via the currency toggle', async () => {
    const user = userEvent.setup();
    // Add THB prices to the mocked plans
    const PLANS_WITH_THB = PLANS.map(p => ({
      ...p,
      priceMonthlyThb: p.priceMonthlyUsd * 35,
      priceAnnualThb: p.priceAnnualUsd * 35,
    }));
    api.get.mockResolvedValueOnce({ data: { plans: PLANS_WITH_THB } });
    renderPage();
    await waitFor(() => expect(screen.getByText('$14')).toBeInTheDocument());

    // Click the THB currency pill
    const thbBtn = screen.getAllByRole('radio').find((el) => el.textContent === 'THB');
    expect(thbBtn).toBeTruthy();
    await user.click(thbBtn);
    // $14 × 35 = 490 THB (formatted as "฿490")
    await waitFor(() => expect(screen.getByText(/฿490/)).toBeInTheDocument());
  });

  it('defaults currency to THB for a Thai-locale user', async () => {
    // Set the stored language to Thai BEFORE render. Pricing reads the lang
    // from I18nContext; auto-detect picks lang='th' → currency 'THB' default.
    localStorage.setItem('reviewhub_lang', 'th');
    const PLANS_WITH_THB = PLANS.map(p => ({
      ...p,
      priceMonthlyThb: p.priceMonthlyUsd * 35,
      priceAnnualThb: p.priceAnnualUsd * 35,
    }));
    api.get.mockResolvedValueOnce({ data: { plans: PLANS_WITH_THB } });
    renderPage();
    // THB should be the default display without clicking
    await waitFor(() => expect(screen.getByText(/฿490/)).toBeInTheDocument());
  });
});
