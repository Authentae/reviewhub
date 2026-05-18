// Tests for the AuditPreview page (/audit-preview/<token>) — the
// per-prospect page that's the entire CTA target of cold outreach.
//
// Wave 2 lesson (3/3 opens, 0 replies) singled out the audit-preview
// CTA as the conversion bottleneck. So once Wave 4 starts iterating
// CTA variants, regressions in this page directly cost outreach
// signal. These tests pin down the load + render contract so a
// future copy/CTA change doesn't silently break the funnel.
//
// Coverage:
// - Loading state shows a spinner
// - 404 from the share-token API renders the "expired link" message
// - Happy path renders business name + draft + Copy button
// - Founder-reply alt-CTA is present on the CTA section
// - Register CTA href encodes the audit attribution params

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuditPreview from '../pages/AuditPreview';

const apiGet = vi.fn();

vi.mock('../lib/api', () => ({
  default: { get: (...args) => apiGet(...args) },
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/audit-preview/:token" element={<AuditPreview />} />
      </Routes>
    </MemoryRouter>
  );
}

const SAMPLE = {
  business_name: 'Old Capital Bike Inn',
  reviews: [
    {
      reviewer_name: 'Anna L.',
      rating: 5,
      text: 'Charming place near the temples.',
      draft: 'Khun Anna — thank you so much for staying with us!',
    },
    {
      reviewer_name: 'James',
      rating: 4,
      text: 'Bikes were great, breakfast a bit thin.',
      draft: 'Hi James — appreciate the honest feedback on breakfast.',
    },
  ],
};

describe('AuditPreview', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('renders a loading spinner before the share-token resolves', () => {
    apiGet.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = renderAt('/audit-preview/abc123');
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows the expired-link message when the API returns 404', async () => {
    apiGet.mockRejectedValue({ response: { status: 404 } });
    renderAt('/audit-preview/badtoken');
    await waitFor(() => {
      expect(screen.getByText(/Preview not available/i)).toBeTruthy();
    });
    expect(
      screen.getByText(/expired or doesn't exist/i)
    ).toBeTruthy();
  });

  it('renders business name, drafts, and the founder-reply alt-CTA on happy path', async () => {
    apiGet.mockResolvedValue({ data: SAMPLE });
    renderAt('/audit-preview/sharetoken123');

    // Business name in header
    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    // Reviews and drafts both render
    expect(screen.getByText('Anna L.')).toBeTruthy();
    expect(
      screen.getByText(/Khun Anna — thank you so much/)
    ).toBeTruthy();

    // Two Copy buttons (one per draft)
    const copyButtons = screen.getAllByRole('button', { name: /Copy reply/i });
    expect(copyButtons.length).toBe(2);

    // Async alt-CTA path (LINE + email) — pin it down so a future copy
    // edit doesn't silently delete the founder-async-reply path. The
    // founder is written-only (no calls per about_me_observed.md), so
    // BOTH the LINE chat button and the email mailto must remain present.
    expect(screen.getByText(/Chat on LINE/i)).toBeTruthy();
    expect(screen.getByText(/Email me/i)).toBeTruthy();
    // The async-first reassurance line is specific to the new LINE/email
    // CTA block (the existing footer also mentions "I'm Earth" so a
    // less-specific regex would match twice and throw).
    expect(
      screen.getByText(/async, no calls/i)
    ).toBeTruthy();
  });

  it('primary CTA goes to Stripe Payment Link for Starter, with fallback /register if Stripe is null', async () => {
    apiGet.mockResolvedValue({ data: SAMPLE });
    renderAt('/audit-preview/sharetoken123');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    const cta = screen.getByText(/set this up for me/i).closest('a');
    expect(cta).toBeTruthy();
    const href = cta.getAttribute('href');
    // Post-Stripe-pivot (2026-05-15): primary CTA routes directly to
    // the Starter Stripe Payment Link. The /register fallback only
    // fires if getStripeCheckoutUrl returns null (e.g. plan gated).
    // Either path is acceptable; both bypass the old register-first
    // interstitial. Audit attribution lives in plausible-tagged-events
    // classes now, not URL params (Stripe strips them).
    expect(
      href.includes('buy.stripe.com') || href.includes('/register')
    ).toBe(true);
  });

  it('register CTA carries the Plausible tagged-events class so clicks are tracked', async () => {
    // The class `plausible-event-name=AuditRegisterClick` is parsed by
    // script.tagged-events.js (loaded inline on prod hostname). Without
    // it we have no signal on whether audit-preview viewers actually
    // click the register CTA — the entire Wave 4 conversion-funnel
    // measurement depends on this class staying put. Pin it down.
    apiGet.mockResolvedValue({ data: SAMPLE });
    renderAt('/audit-preview/sharetoken123');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    const cta = screen.getByText(/set this up for me/i).closest('a');
    expect(cta.className).toContain('plausible-event-name=AuditRegisterClick');
  });
});
