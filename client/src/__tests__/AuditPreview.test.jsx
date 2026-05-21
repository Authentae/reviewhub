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
    // ?variant=control pins the assignCtaVariant URL override so these
// tests stay deterministic across hash-fn changes (mod-2 → mod-3 etc).
// Variant-specific copy assertions belong in dedicated tests below.
renderAt('/audit-preview/sharetoken123?variant=control');

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

  it('primary CTA goes to a hosted checkout URL for Starter, with fallback /register if checkout is null', async () => {
    apiGet.mockResolvedValue({ data: SAMPLE });
    // ?variant=control pins the assignCtaVariant URL override so these
// tests stay deterministic across hash-fn changes (mod-2 → mod-3 etc).
// Variant-specific copy assertions belong in dedicated tests below.
renderAt('/audit-preview/sharetoken123?variant=control');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    const cta = screen.getByText(/set this up for me/i).closest('a');
    expect(cta).toBeTruthy();
    const href = cta.getAttribute('href');
    // 2026-05-21: switched from Stripe Payment Links to LemonSqueezy
    // (LS as Merchant of Record handles VAT/sales-tax globally — see
    // checkout.js header). Test now accepts either:
    //   - LS checkout: `reviewhub.lemonsqueezy.com/checkout/buy/<UUID>`
    //   - Stripe backup: `buy.stripe.com/...` (if rolled back)
    //   - Legacy fallback: `/register?from=audit&...` (when plan is
    //     coming_soon or getCheckoutUrl returns null)
    // Audit attribution lives in plausible-tagged-events classes now,
    // not URL params (provider strips them on redirect anyway).
    expect(
      href.includes('lemonsqueezy.com') ||
      href.includes('buy.stripe.com') ||
      href.includes('/register')
    ).toBe(true);
  });

  it('register CTA carries the Plausible tagged-events class so clicks are tracked', async () => {
    // The class `plausible-event-name=AuditRegisterClick` is parsed by
    // script.tagged-events.js (loaded inline on prod hostname). Without
    // it we have no signal on whether audit-preview viewers actually
    // click the register CTA — the entire Wave 4 conversion-funnel
    // measurement depends on this class staying put. Pin it down.
    apiGet.mockResolvedValue({ data: SAMPLE });
    // ?variant=control pins the assignCtaVariant URL override so these
// tests stay deterministic across hash-fn changes (mod-2 → mod-3 etc).
// Variant-specific copy assertions belong in dedicated tests below.
renderAt('/audit-preview/sharetoken123?variant=control');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    const cta = screen.getByText(/set this up for me/i).closest('a');
    expect(cta.className).toContain('plausible-event-name=AuditRegisterClick');
  });

  it('variant=L inverts the CTA — async-ask is primary, Stripe is secondary', async () => {
    // Variant L (low-friction lead) is the Wave 5.5 hypothesis test:
    // the price tag in the viewport too early causes the 35%-open /
    // 0%-reply gap. L puts LINE chat + Email Earth as the primary
    // actions and demotes Stripe checkout to a small "already
    // convinced?" link below the founder card. If a future copy edit
    // accidentally restores the control-shape order, this test fails.
    apiGet.mockResolvedValue({ data: SAMPLE });
    renderAt('/audit-preview/sharetoken123?variant=L');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    // The L variant's signature copy. Appears in BOTH the main CTA
    // section and the sticky bar at the bottom — both should swap to
    // L's "Anything off?" tone when variant=L. getAllByText accepts ≥1.
    expect(screen.getAllByText(/Anything off, or a fit/i).length).toBeGreaterThanOrEqual(1);

    // The async primary button now reads "Email Earth" (L copy) not
    // "Email me" (control copy).
    expect(screen.getByText(/Email Earth/i)).toBeTruthy();

    // The secondary Stripe link in L still carries a Plausible class but
    // tagged with the _LowFriction suffix so funnel analysis splits L
    // from control/E.
    const stripeLink = screen.getByText(/Set it up for/i).closest('a');
    expect(stripeLink.className).toContain('plausible-event-name=AuditRegisterClick_LowFriction');

    // Control-only headline MUST NOT render under variant=L. There's
    // an unrelated inline-plan-promo above the CTA section that uses
    // "Want this on autopilot for new reviews?" so we can't match the
    // shorter regex without false-positives — match the exact CTA
    // headline instead.
    expect(screen.queryByText(/set this up for me/i)).toBeNull();
    expect(screen.queryByText(/Set this up for .* in 10 minutes/i)).toBeNull();
  });
});
