// Tests for the forgot-password flow. The contract we're locking down:
//   - Submitting an email calls the API and shows the generic "check your
//     inbox" confirmation regardless of whether the address exists.
//   - A rate-limit or network error stays on the form with a visible alert.
//   - The email field auto-focuses on mount for immediate typing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}));

import api from '../lib/api';
import ForgotPassword from '../pages/ForgotPassword';
import { I18nProvider } from '../context/I18nContext';

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe('ForgotPassword page', () => {
  beforeEach(() => { api.post.mockReset(); });

  it('auto-focuses the email field', async () => {
    renderPage();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText(/email/i))
    );
  });

  it('submits email and switches to the generic confirmation state', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'u@example.com');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // The form is replaced with the success panel — same whether or not the
    // account exists (server-side generic 200 prevents enumeration).
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    // 'website' is the honeypot field — empty for real users, server-side
    // anti-bot trap. Stays in the payload regardless.
    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'u@example.com', website: '' });
  });

  it('surfaces rate-limit / network errors in a visible alert', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Too many attempts' } } });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'u@example.com');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Too many attempts/);
    // Form is still visible — user can retry.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
