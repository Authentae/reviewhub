// Integration test: Dashboard correctly shows or hides the OnboardingChecklist
// based on user state, business, review count, and response count.
//
// The widget is the primary conversion gate for new users. These tests lock
// in the visibility rules so a future refactor of the condition expression
// can't silently break first-time UX.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../lib/auth', () => ({
  getToken: () => 'test-token',
  setToken: vi.fn(),
  isLoggedIn: () => true,
  clearToken: vi.fn(),
  getTokenExpiryMs: () => null,
}));

import api from '../lib/api';
import Dashboard from '../pages/Dashboard';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';
import { UserProvider } from '../context/UserContext';
import { ThemeProvider } from '../context/ThemeContext';

function mockAuthMe(overrides = {}) {
  return {
    user: {
      id: 1, email: 't@t.com',
      email_verified: true,
      onboarding_dismissed: false,
      ...overrides.user,
    },
    subscription: { plan: 'free', status: 'active', plan_meta: { name: 'Free', features: {} } },
    notifications: {},
    session_expires_at: null,
  };
}

function mockReviewsList(overrides = {}) {
  return {
    reviews: [],
    business: null,
    stats: { total: 0, responded: 0, positive: 0, negative: 0, neutral: 0, unresponded_negative: 0 },
    filteredStats: null,
    platformCounts: {},
    total: 0,
    page: 1, limit: 20, sort: 'newest',
    ...overrides,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ThemeProvider>
          <ToastProvider>
            <UserProvider>
              <Dashboard />
            </UserProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('Dashboard → OnboardingChecklist integration', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });

  it('shows checklist at 25% for a brand-new user (no business, no reviews)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: mockAuthMe() });
      if (url === '/tags') return Promise.resolve({ data: [] });
      if (url.startsWith('/reviews')) return Promise.resolve({ data: mockReviewsList() });
      return Promise.resolve({ data: {} });
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/get started with reviewhub/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 of 4 steps complete/i)).toBeInTheDocument();
  });

  it('hides checklist when the user has already dismissed it', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: mockAuthMe({ user: { onboarding_dismissed: true } }) });
      if (url === '/tags') return Promise.resolve({ data: [] });
      if (url.startsWith('/reviews')) return Promise.resolve({ data: mockReviewsList() });
      return Promise.resolve({ data: {} });
    });
    renderDashboard();
    // Wait for initial render to settle, then assert absence
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText(/get started with reviewhub/i)).not.toBeInTheDocument();
  });

  it('hides checklist when all 4 steps are complete (business named + reviews + at least one responded)', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: mockAuthMe() });
      if (url === '/tags') return Promise.resolve({ data: [] });
      if (url.startsWith('/reviews')) return Promise.resolve({ data: mockReviewsList({
        reviews: [{ id: 1, rating: 5, reviewer_name: 'X', platform: 'google', sentiment: 'positive', response_text: 'Thanks', review_text: 'Good', external_id: null, created_at: new Date().toISOString(), updated_at: null, tags: [] }],
        business: { id: 1, business_name: 'Real Biz' },
        stats: { total: 1, responded: 1, positive: 1, negative: 0, neutral: 0, unresponded_negative: 0 },
        total: 1,
      }) });
      return Promise.resolve({ data: {} });
    });
    renderDashboard();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });
    await new Promise(r => setTimeout(r, 100));
    expect(screen.queryByText(/get started with reviewhub/i)).not.toBeInTheDocument();
  });

  it('hides checklist optimistically when user clicks dismiss (before /me refresh returns)', async () => {
    let meCalls = 0;
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') {
        meCalls++;
        // First call: dismissed=false. Subsequent calls (after dismiss): still false
        // to prove the local state is what hides the checklist (not the context refresh).
        return Promise.resolve({ data: mockAuthMe({ user: { onboarding_dismissed: false } }) });
      }
      if (url === '/tags') return Promise.resolve({ data: [] });
      if (url.startsWith('/reviews')) return Promise.resolve({ data: mockReviewsList() });
      return Promise.resolve({ data: {} });
    });
    // Dismiss POST — keep it pending until the test has verified optimistic hide
    let resolveDismiss;
    api.post.mockImplementation((url) => {
      if (url === '/auth/onboarding/dismiss') {
        return new Promise(r => { resolveDismiss = r; });
      }
      return Promise.resolve({ data: {} });
    });

    const user = (await import('@testing-library/user-event')).default.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/get started with reviewhub/i)).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole('button', { name: /dismiss the onboarding/i });
    await user.click(dismissBtn);

    // Checklist should be gone immediately even though the POST is still in flight
    await waitFor(() => {
      expect(screen.queryByText(/get started with reviewhub/i)).not.toBeInTheDocument();
    });

    // Let the pending POST finish so the test can clean up
    resolveDismiss?.({ data: { dismissed: true } });
    expect(meCalls).toBeGreaterThanOrEqual(1);
  });

  it('keeps checklist visible when business is auto-created placeholder "My Business"', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/auth/me') return Promise.resolve({ data: mockAuthMe() });
      if (url === '/tags') return Promise.resolve({ data: [] });
      if (url.startsWith('/reviews')) return Promise.resolve({ data: mockReviewsList({
        business: { id: 1, business_name: 'My Business' },
      }) });
      return Promise.resolve({ data: {} });
    });
    renderDashboard();
    await waitFor(() => {
      // With the placeholder name, step 2 stays incomplete → checklist visible at 25%
      expect(screen.getByText(/get started with reviewhub/i)).toBeInTheDocument();
      expect(screen.getByText(/1 of 4 steps complete/i)).toBeInTheDocument();
    });
  });
});
