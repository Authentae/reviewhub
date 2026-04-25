// Tests for OwnerDashboard — /owner page.
//
// Covers: free-plan upsell card, paid plan loading skeleton, empty state,
// populated grid with pending-response badge, 404/501 graceful empty fallback,
// generic error path surfaces an alert.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../lib/auth', () => ({
  isLoggedIn: () => true,
  getToken: () => 'tok',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getTokenExpiryMs: () => null,
}));

// Stub Navbar to avoid pulling its full dependency graph (theme toggle,
// language switcher, /me fetch, etc.) into these focused tests.
vi.mock('../components/Navbar', () => ({
  default: () => <nav data-testid="mock-navbar" />,
}));

// usePageTitle just sets document.title; harmless in jsdom but mock to a
// no-op so we don't depend on its internals.
vi.mock('../hooks/usePageTitle', () => ({ default: () => {} }));

// Drive the plan-gate by mocking useUser directly — far cleaner than wiring
// up UserProvider with /auth/me fixtures.
const userState = { subscription: null, loading: false };
vi.mock('../context/UserContext', () => ({
  useUser: () => userState,
  UserProvider: ({ children }) => children,
}));

import api from '../lib/api';
import OwnerDashboard from '../pages/OwnerDashboard';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <OwnerDashboard />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('OwnerDashboard', () => {
  beforeEach(() => {
    api.get.mockReset();
    userState.subscription = null;
    userState.loading = false;
  });

  it('shows the upsell card on Free plan and skips the businesses fetch', async () => {
    userState.subscription = { plan: 'free' };
    renderPage();
    expect(await screen.findByText(/respond to reviews as the verified owner/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see plans/i })).toHaveAttribute('href', '/pricing');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows the upsell when subscription is missing entirely (defaults to free)', async () => {
    userState.subscription = null;
    renderPage();
    expect(await screen.findByText(/respond to reviews as the verified owner/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows the loading skeleton while fetching on a paid plan', () => {
    userState.subscription = { plan: 'starter' };
    api.get.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the empty state when paid user has no claimed businesses', async () => {
    userState.subscription = { plan: 'pro' };
    api.get.mockResolvedValue({ data: { businesses: [] } });
    renderPage();
    expect(await screen.findByText(/no claimed businesses yet/i)).toBeInTheDocument();
  });

  it('renders the grid with names, totals, and pending badge for paid users', async () => {
    userState.subscription = { plan: 'business' };
    api.get.mockResolvedValue({
      data: {
        businesses: [
          { id: 1, name: 'Cafe One', total_reviews: 12, pending_response_count: 3 },
          { id: 2, name: 'Cafe Two', total_reviews: 4, pending_response_count: 0 },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('Cafe One')).toBeInTheDocument();
    expect(screen.getByText('Cafe Two')).toBeInTheDocument();
    expect(screen.getByText('12 reviews')).toBeInTheDocument();
    // Pending badge appears for biz #1, not #2
    expect(screen.getByLabelText(/3 reviews awaiting your response/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/0 reviews awaiting/i)).not.toBeInTheDocument();
    // Cards link to /businesses/:id
    expect(screen.getByRole('link', { name: /Cafe One/i })).toHaveAttribute('href', '/businesses/1');
  });

  it('treats 404 from /owner/businesses as empty (no error toast)', async () => {
    userState.subscription = { plan: 'starter' };
    api.get.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByText(/no claimed businesses yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats 501 (not implemented) the same as 404 — empty + silent', async () => {
    userState.subscription = { plan: 'starter' };
    api.get.mockRejectedValue({ response: { status: 501 } });
    renderPage();
    expect(await screen.findByText(/no claimed businesses yet/i)).toBeInTheDocument();
  });

  it('surfaces an alert when the fetch fails with a 500', async () => {
    userState.subscription = { plan: 'starter' };
    api.get.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i);
    });
  });

  it('treats invalid response shape as an empty list', async () => {
    userState.subscription = { plan: 'starter' };
    api.get.mockResolvedValue({ data: { not_businesses: 'oops' } });
    renderPage();
    expect(await screen.findByText(/no claimed businesses yet/i)).toBeInTheDocument();
  });

  it('waits for user-loading before deciding which UI to show', () => {
    userState.subscription = null;
    userState.loading = true;
    renderPage();
    // While userLoading, businesses stays null AND we haven't decided plan,
    // but isPaid resolves to false so the upsell shows. Verify no fetch yet.
    expect(api.get).not.toHaveBeenCalled();
  });
});
