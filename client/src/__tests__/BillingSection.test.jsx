// Tests for the BillingSection AI-drafts usage meter.
//
// Only shown for plans with a finite quota (Free). Hidden on Starter+ where
// drafts are unlimited — a "0 / null" meter would be meaningless.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BillingSection from '../components/BillingSection';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}));

function renderSection(subscription) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <BillingSection subscription={subscription} onRefresh={() => {}} />
      </ToastProvider>
    </I18nProvider>
  );
}

const FREE_SUB = {
  plan: 'free',
  status: 'active',
  plan_meta: { name: 'Free', priceMonthlyUsd: 0, features: {} },
  ai_drafts_max_per_month: 3,
  ai_drafts_used_this_month: 0,
};

const STARTER_SUB = {
  plan: 'starter',
  status: 'active',
  plan_meta: { name: 'Starter', priceMonthlyUsd: 14, features: {} },
  ai_drafts_max_per_month: null,
  ai_drafts_remaining: null,
};

describe('BillingSection AI quota meter', () => {
  it('renders meter for Free plan with 0/3 used', () => {
    renderSection(FREE_SUB);
    expect(screen.getByText(/ai drafts this month/i)).toBeInTheDocument();
    expect(screen.getByText('0 / 3')).toBeInTheDocument();
    // Progress bar ARIA
    const bar = screen.getByRole('progressbar', { name: /0 of 3/i });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });

  it('renders meter with used=2/3 and amber bar color', () => {
    renderSection({ ...FREE_SUB, ai_drafts_used_this_month: 2 });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    // 2/3 = 67% — triggers the amber threshold (>= 67%)
    expect(bar.className).toMatch(/amber-500|bg-amber/);
  });

  it('shows the "exhausted" hint when used >= max', () => {
    renderSection({ ...FREE_SUB, ai_drafts_used_this_month: 3 });
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText(/quota used up/i)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar.className).toMatch(/red-500|bg-red/);
  });

  it('shows the reset hint when below threshold', () => {
    renderSection({ ...FREE_SUB, ai_drafts_used_this_month: 1 });
    expect(screen.getByText(/resets on the 1st/i)).toBeInTheDocument();
  });

  it('hides the meter for Starter plan (unlimited)', () => {
    renderSection(STARTER_SUB);
    expect(screen.queryByText(/ai drafts this month/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('hides the meter when subscription has no ai_drafts_max_per_month field (backward-compat)', () => {
    const noQuota = { plan: 'free', status: 'active', plan_meta: { name: 'Free', priceMonthlyUsd: 0, features: {} } };
    renderSection(noQuota);
    expect(screen.queryByText(/ai drafts this month/i)).not.toBeInTheDocument();
  });
});
