// Tests for ClaimBusinessButton — the public-page claim CTA.
//
// Covers: anonymous redirect-to-login, loading skeleton, four claim statuses
// (none/pending/approved/rejected), modal open + focus trap entry, Escape
// close, validation gate (name+role required), optimistic status flip on
// submit and rollback on server error.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const isLoggedInMock = vi.fn(() => true);
vi.mock('../lib/auth', () => ({
  isLoggedIn: () => isLoggedInMock(),
  getToken: () => 'tok',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  getTokenExpiryMs: () => null,
}));

import api from '../lib/api';
import ClaimBusinessButton from '../components/ClaimBusinessButton';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

function renderBtn(props = {}) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ClaimBusinessButton businessId={42} businessName="Test Cafe" {...props} />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('ClaimBusinessButton', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    isLoggedInMock.mockReturnValue(true);
  });

  it('shows the loading skeleton while checking status', () => {
    // Pending promise — never resolves during this assertion
    api.get.mockReturnValue(new Promise(() => {}));
    renderBtn();
    expect(screen.getByText(/checking ownership status/i)).toBeInTheDocument();
  });

  it('renders the "Sign in to claim" link when anonymous', async () => {
    isLoggedInMock.mockReturnValue(false);
    renderBtn();
    expect(await screen.findByRole('link', { name: /sign in to claim/i })).toHaveAttribute('href', '/login');
    // Skip the GET entirely for anonymous users
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows the Claim CTA when status is none (404 from server)', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } });
    renderBtn();
    expect(await screen.findByRole('button', { name: /claim this business/i })).toBeInTheDocument();
  });

  it('shows the Claim CTA when status is none (other error)', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderBtn();
    expect(await screen.findByRole('button', { name: /claim this business/i })).toBeInTheDocument();
  });

  it('renders verified badge when status is approved', async () => {
    api.get.mockResolvedValue({ data: { status: 'approved' } });
    renderBtn();
    expect(await screen.findByText(/verified owner/i)).toBeInTheDocument();
  });

  it('renders pending badge when status is pending', async () => {
    api.get.mockResolvedValue({ data: { status: 'pending' } });
    renderBtn();
    expect(await screen.findByText(/under review/i)).toBeInTheDocument();
  });

  it('renders rejected badge when status is rejected', async () => {
    api.get.mockResolvedValue({ data: { status: 'rejected' } });
    renderBtn();
    expect(await screen.findByText(/not approved/i)).toBeInTheDocument();
  });

  it('opens the modal and focuses the first field', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    renderBtn();
    const cta = await screen.findByRole('button', { name: /claim this business/i });
    const user = userEvent.setup();
    await user.click(cta);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus moves to the name field
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/your name/i));
    });
  });

  it('closes the modal on Escape', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    renderBtn();
    const cta = await screen.findByRole('button', { name: /claim this business/i });
    const user = userEvent.setup();
    await user.click(cta);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes the modal when clicking the backdrop', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    renderBtn();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /claim this business/i }));
    const dialog = await screen.findByRole('dialog');
    // Backdrop is the dialog's parent — first click on parent dismisses
    await user.click(dialog.parentElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('blocks submit when name or role is empty (no API call)', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    renderBtn();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /claim this business/i }));
    await screen.findByRole('dialog');
    // Submit without filling — required fields will block native form submit;
    // and even if submitted programmatically, handleSubmit short-circuits.
    const submit = screen.getByRole('button', { name: /^submit claim/i });
    await user.click(submit);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits with optimistic pending flip and closes on success', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    api.post.mockResolvedValue({ data: { status: 'pending' } });
    renderBtn();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /claim this business/i }));
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.type(screen.getByLabelText(/your role/i), 'Owner');
    await user.click(screen.getByRole('button', { name: /^submit claim/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/businesses/42/claim', expect.objectContaining({
        contact_name: 'Alice',
        role: 'Owner',
      }));
    });
    // Modal closes; on next render the pending badge replaces the trigger
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/under review/i)).toBeInTheDocument();
  });

  it('rolls back optimistic status if the server rejects the claim', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    api.post.mockRejectedValue({ response: { data: { error: 'Already claimed' } } });
    renderBtn();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /claim this business/i }));
    await screen.findByRole('dialog');
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.type(screen.getByLabelText(/your role/i), 'Owner');
    await user.click(screen.getByRole('button', { name: /^submit claim/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    // Status reverts — modal stays open and the trigger is still claimable
    // (the dialog stays open because we only close it on success)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('updates the note character counter as the user types', async () => {
    api.get.mockResolvedValue({ data: { status: 'none' } });
    renderBtn();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /claim this business/i }));
    await screen.findByRole('dialog');
    expect(screen.getByText('0/500')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/anything we should know/i), 'hello');
    expect(screen.getByText('5/500')).toBeInTheDocument();
  });
});
