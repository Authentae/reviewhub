// Tests for the Dashboard OnboardingChecklist component.
//
// This widget is the primary conversion gate for brand-new users: if it
// breaks, new users land on an empty dashboard with no guidance. These
// tests lock in the step-completion logic (account ✓, business named,
// reviews present, responded at least once) and the inline business-name
// edit path.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn(), put: vi.fn(), get: vi.fn() },
}));

import api from '../lib/api';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

function renderChecklist(props = {}) {
  const defaults = {
    business: null,
    hasReviews: false,
    hasResponded: false,
    onBusinessCreated: vi.fn(),
    onSeedDemo: vi.fn(),
    onDismiss: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <OnboardingChecklist {...defaults} {...props} />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    api.post.mockReset();
    api.put.mockReset();
    api.get.mockReset();
  });

  it('renders all 4 steps with progress 25% for a fresh user', () => {
    renderChecklist();
    expect(screen.getByText(/1 of 4 steps complete/i)).toBeInTheDocument();
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '25');
    // Account step should be marked done; other three are pending
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    expect(screen.getByText(/name your business/i)).toBeInTheDocument();
    expect(screen.getByText(/see your first reviews/i)).toBeInTheDocument();
    expect(screen.getByText(/respond to a review/i)).toBeInTheDocument();
  });

  it('shows 50% progress when the business has a real name', () => {
    renderChecklist({ business: { id: 1, business_name: 'Sakura Coffee' } });
    expect(screen.getByText(/2 of 4 steps complete/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('still counts business step as incomplete when name is the auto-placeholder "My Business"', () => {
    // The Google OAuth auto-create path names the business "My Business" as a
    // placeholder. We want the checklist to prompt the user to rename it.
    renderChecklist({ business: { id: 1, business_name: 'My Business' } });
    expect(screen.getByText(/1 of 4 steps complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename your business/i })).toBeInTheDocument();
  });

  it('shows 75% progress with reviews but no response yet', () => {
    renderChecklist({
      business: { id: 1, business_name: 'Real Biz' },
      hasReviews: true,
      hasResponded: false,
    });
    expect(screen.getByText(/3 of 4 steps complete/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('inline business-name save creates a business via POST /businesses', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 42, business_name: 'Sakura Coffee' } });
    const onBusinessCreated = vi.fn().mockResolvedValue();
    renderChecklist({ onBusinessCreated });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /add business name/i }));
    const input = await screen.findByPlaceholderText(/sakura coffee/i);
    await user.type(input, 'Sakura Coffee');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/businesses', { business_name: 'Sakura Coffee' });
    });
    expect(onBusinessCreated).toHaveBeenCalled();
  });

  it('renaming an existing business uses PUT /businesses/:id', async () => {
    api.put.mockResolvedValueOnce({ data: { id: 1, business_name: 'Renamed' } });
    const onBusinessCreated = vi.fn().mockResolvedValue();
    renderChecklist({
      business: { id: 1, business_name: 'My Business' },
      onBusinessCreated,
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /rename your business/i }));
    const input = await screen.findByPlaceholderText(/sakura coffee/i);
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/businesses/1', { business_name: 'Renamed' });
    });
  });

  it('pressing Escape in the inline editor cancels without saving', async () => {
    renderChecklist();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add business name/i }));
    const input = await screen.findByPlaceholderText(/sakura coffee/i);
    await user.type(input, 'Mid-type');
    await user.keyboard('{Escape}');
    // Input is gone, API was not called, "Add business name" button is back
    expect(screen.queryByPlaceholderText(/sakura coffee/i)).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /add business name/i })).toBeInTheDocument();
  });

  it('pressing Enter in the inline editor submits the form', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 42, business_name: 'Via Enter' } });
    const onBusinessCreated = vi.fn().mockResolvedValue();
    renderChecklist({ onBusinessCreated });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add business name/i }));
    const input = await screen.findByPlaceholderText(/sakura coffee/i);
    await user.type(input, 'Via Enter');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/businesses', { business_name: 'Via Enter' });
    });
  });

  it('rejects business names shorter than 2 characters', async () => {
    renderChecklist();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add business name/i }));
    const input = await screen.findByPlaceholderText(/sakura coffee/i);
    await user.type(input, 'a');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    // Should not have hit the API with the too-short name
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('dismiss button calls the dismiss endpoint and the onDismiss callback', async () => {
    api.post.mockResolvedValueOnce({ data: { dismissed: true } });
    const onDismiss = vi.fn();
    renderChecklist({ onDismiss });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /dismiss the onboarding/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/onboarding/dismiss');
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('dismiss still fires the onDismiss callback even if the API call fails', async () => {
    // If the dismiss API 404s (e.g., old server), the UI should still hide
    // the checklist locally so the user isn't stuck seeing it forever.
    api.post.mockRejectedValueOnce(new Error('network'));
    const onDismiss = vi.fn();
    renderChecklist({ onDismiss });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /dismiss the onboarding/i }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it('demo-data button calls onSeedDemo', async () => {
    const onSeedDemo = vi.fn().mockResolvedValue();
    renderChecklist({ onSeedDemo });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try with demo data/i }));
    await waitFor(() => expect(onSeedDemo).toHaveBeenCalled());
  });
});
