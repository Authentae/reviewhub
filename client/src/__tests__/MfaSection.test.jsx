// Tests for the MFA enable/disable UI in Settings. State machine:
//   disabled → enabling (code entry) → codes (recovery codes display, must
//   acknowledge) → enabled → disabling (password prompt) → disabled.
// Each transition is gated on an API call; tests mock those and assert
// the component lands on the right state and makes the right call.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

import api from '../lib/api';
import MfaSection from '../components/MfaSection';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

function renderSection(props) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <MfaSection {...props} />
      </ToastProvider>
    </I18nProvider>
  );
}

describe('MfaSection', () => {
  beforeEach(() => {
    api.post.mockReset();
    api.get.mockReset();
  });

  it('renders the disabled-state Enable button when mfaEnabled=false', () => {
    renderSection({ mfaEnabled: false, onMfaChange: vi.fn() });
    expect(screen.getByRole('button', { name: /enable/i })).toBeInTheDocument();
    // No code entry, no disable UI
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it('renders the enabled-state Disable button when mfaEnabled=true', () => {
    renderSection({ mfaEnabled: true, onMfaChange: vi.fn() });
    expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument();
  });

  it('Enable → email sent → shows code entry form', async () => {
    api.post.mockResolvedValue({ data: { success: true } });
    renderSection({ mfaEnabled: false, onMfaChange: vi.fn() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable/i }));
    expect(api.post).toHaveBeenCalledWith('/auth/mfa/enable');
    // Code input now visible
    await waitFor(() =>
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    );
  });

  it('Submit code → shows recovery codes, calls onMfaChange(true)', async () => {
    const onMfaChange = vi.fn();
    const codes = ['AAAA-BBBB', 'CCCC-DDDD', 'EEEE-FFFF'];
    api.post
      .mockResolvedValueOnce({ data: { success: true } }) // /mfa/enable
      .mockResolvedValueOnce({ data: { success: true, recovery_codes: codes } }); // /confirm

    renderSection({ mfaEnabled: false, onMfaChange });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable/i }));
    const code = await screen.findByPlaceholderText('000000');
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    // Recovery codes appear, onMfaChange fires with true
    for (const c of codes) {
      expect(await screen.findByText(c)).toBeInTheDocument();
    }
    expect(onMfaChange).toHaveBeenCalledWith(true);
    // "I've saved them" button required to advance
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
  });

  it('Recovery-codes state cannot be left without acknowledge', async () => {
    api.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true, recovery_codes: ['AAAA-BBBB'] } });

    renderSection({ mfaEnabled: false, onMfaChange: vi.fn() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable/i }));
    await user.type(await screen.findByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    // In codes state — the generic "Disable" button should NOT be visible
    // (that's the enabled state). User MUST click "I've saved them" first.
    await screen.findByText('AAAA-BBBB');
    expect(screen.queryByRole('button', { name: /^disable/i })).not.toBeInTheDocument();
  });

  it('Acknowledge moves to enabled state', async () => {
    api.post
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValueOnce({ data: { success: true, recovery_codes: ['AAAA-BBBB'] } });

    renderSection({ mfaEnabled: false, onMfaChange: vi.fn() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable/i }));
    await user.type(await screen.findByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));
    await user.click(await screen.findByRole('button', { name: /saved/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^disable$/i })).toBeInTheDocument()
    );
  });

  it('Disable flow requires password and fires API with it', async () => {
    const onMfaChange = vi.fn();
    api.post.mockResolvedValue({ data: { success: true } });
    renderSection({ mfaEnabled: true, onMfaChange });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^disable$/i }));
    const pw = await screen.findByLabelText(/current password/i);
    await user.type(pw, 'mypass');
    await user.click(screen.getByRole('button', { name: /disable two-factor/i }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/mfa/disable', { password: 'mypass' })
    );
    expect(onMfaChange).toHaveBeenCalledWith(false);
  });

  it('Wrong password during disable stays on the form with an alert', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Incorrect password' } } });
    renderSection({ mfaEnabled: true, onMfaChange: vi.fn() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^disable$/i }));
    await user.type(await screen.findByLabelText(/current password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /disable two-factor/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect password/i);
    // Password form is still there
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('Enable-begin error surfaces and user stays on disabled state', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Too many requests' } } });
    renderSection({ mfaEnabled: false, onMfaChange: vi.fn() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /enable/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    // Still in disabled state — no code input
    expect(screen.queryByPlaceholderText('000000')).not.toBeInTheDocument();
  });
});
