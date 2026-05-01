// Tests for the MFA challenge page. Contract:
//   - No pending token → bounce back to /login.
//   - OTP mode (default): submit → exchange → token set → /dashboard.
//   - Recovery mode: submit → exchange → token set → /dashboard, with
//     low-count sessionStorage breadcrumb if codes_remaining <= 2.
//   - Resend button hits the /login/mfa/resend endpoint.
//   - Error responses surface in an alert; user stays on the page.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}));

import api from '../lib/api';
import LoginMfa from '../pages/LoginMfa';
import Login from '../pages/Login';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';

function renderAt(path, state) {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[{ pathname: path, state }]}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/login/mfa" element={<LoginMfa />} />
              <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

describe('LoginMfa', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('redirects to /login when no pending token is in state', async () => {
    renderAt('/login/mfa', null);
    // react-router redirect lands us on /login — form renders (email + sign-in button)
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument());
  });

  it('renders the OTP input by default with one-time-code autocomplete', () => {
    renderAt('/login/mfa', { pendingToken: 'pending-abc' });
    const input = screen.getByLabelText(/verification code/i);
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('submits OTP code to /login/mfa with pending token in header', async () => {
    api.post.mockResolvedValue({
      data: { token: 'full-jwt', user: { id: 1, email: 'u@e.com', mfa_enabled: true } },
    });
    renderAt('/login/mfa', { pendingToken: 'pending-xyz' });
    const user = userEvent.setup();
    // Typing 6 digits auto-submits (parity with Google/Apple/bank OTP UX —
    // see LoginMfa.jsx requestSubmit on /^[0-9]{6}$/). On success the page
    // navigates to /dashboard before any explicit click could land, so we
    // await the navigation rather than clicking the now-unmounted button.
    await user.type(screen.getByLabelText(/verification code/i), '123456');

    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith(
      '/auth/login/mfa',
      { code: '123456' },
      { headers: { Authorization: 'Bearer pending-xyz' } }
    );
    expect(localStorage.getItem('token')).toBe('full-jwt');
  });

  it('surfaces server errors and stays on the page', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Incorrect code' } } });
    renderAt('/login/mfa', { pendingToken: 'pending-x' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/verification code/i), '999999');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Incorrect code/);
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('switches to recovery mode and calls /login/recovery', async () => {
    api.post.mockResolvedValue({
      data: { token: 'jwt', user: { id: 1 }, recovery_codes_remaining: 5 },
    });
    renderAt('/login/mfa', { pendingToken: 'p' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /recovery/i }));
    // Label switches to "Recovery code"
    const input = screen.getByLabelText(/recovery code/i);
    await user.type(input, 'ABCD-EFGH');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(api.post).toHaveBeenLastCalledWith(
      '/auth/login/recovery',
      { recovery_code: 'ABCD-EFGH' },
      { headers: { Authorization: 'Bearer p' } }
    );
  });

  it('sets a sessionStorage breadcrumb when recovery codes are running low', async () => {
    api.post.mockResolvedValue({
      data: { token: 'jwt', user: { id: 1 }, recovery_codes_remaining: 1 },
    });
    renderAt('/login/mfa', { pendingToken: 'p' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /recovery/i }));
    await user.type(screen.getByLabelText(/recovery code/i), 'XXXX-YYYY');
    await user.click(screen.getByRole('button', { name: /^verify$/i }));
    await waitFor(() =>
      expect(sessionStorage.getItem('mfa_low_recovery_warn')).toBe('1')
    );
  });

  it('resend button calls the resend endpoint', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    renderAt('/login/mfa', { pendingToken: 'p' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /resend/i }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/auth/login/mfa/resend',
        null,
        { headers: { Authorization: 'Bearer p' } }
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/new code sent/i);
  });
});
