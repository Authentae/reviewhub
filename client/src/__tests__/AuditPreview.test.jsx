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

    // Wave 2 founder-transparency line — pin it down so a future
    // copy edit doesn't silently delete the alt-CTA path.
    expect(screen.getByText(/Not ready to sign up/i)).toBeTruthy();
    expect(
      screen.getByText(/I'm Earth, the solo founder/i)
    ).toBeTruthy();
  });

  it('register CTA href carries audit attribution params (from + business + token)', async () => {
    apiGet.mockResolvedValue({ data: SAMPLE });
    renderAt('/audit-preview/sharetoken123');

    await waitFor(() => {
      expect(screen.getByText('Old Capital Bike Inn')).toBeTruthy();
    });

    const cta = screen.getByText(/set this up for me/i).closest('a');
    expect(cta).toBeTruthy();
    const href = cta.getAttribute('href');
    expect(href).toContain('/register');
    expect(href).toContain('from=audit');
    expect(href).toContain('business=Old%20Capital%20Bike%20Inn');
    expect(href).toContain('token=sharetoken123');
  });
});
