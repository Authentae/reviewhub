// Tests for the GDPR-erasure confirmation page.
//
// Critical user-facing surface for an irreversible action — locking down
// what the page renders for each query-string state matters.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ConfirmErasure from '../pages/ConfirmErasure';
import { I18nProvider } from '../context/I18nContext';

// Mock the api client so we don't hit real fetch in tests.
const mockPost = vi.fn();
vi.mock('../lib/api', () => ({
  default: { post: (...args) => mockPost(...args) },
}));

function renderAt(url) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <ConfirmErasure />
      </MemoryRouter>
    </I18nProvider>
  );
}

const VALID_TOKEN = 'a'.repeat(64);

describe('ConfirmErasure', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('renders the invalid-link state when token is missing', () => {
    renderAt('/confirm-erasure');
    expect(screen.getByText(/Invalid confirmation link/i)).toBeInTheDocument();
  });

  it('renders the invalid-link state when token shape is wrong', () => {
    renderAt('/confirm-erasure?userId=42&token=not-hex');
    expect(screen.getByText(/Invalid confirmation link/i)).toBeInTheDocument();
  });

  it('renders the irreversible warning when token shape is valid', () => {
    renderAt(`/confirm-erasure?userId=42&token=${VALID_TOKEN}`);
    expect(screen.getByText(/Confirm account deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeInTheDocument();
  });

  it('does NOT auto-submit on mount — explicit click is required', () => {
    renderAt(`/confirm-erasure?userId=42&token=${VALID_TOKEN}`);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('posts to /gdpr/confirm-erasure when the destructive button is clicked', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    renderAt(`/confirm-erasure?userId=42&token=${VALID_TOKEN}`);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/gdpr/confirm-erasure', {
        userId: 42,
        token: VALID_TOKEN,
      })
    );
  });

  it('shows the success state after a successful POST', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    renderAt(`/confirm-erasure?userId=42&token=${VALID_TOKEN}`);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(await screen.findByText(/Account deleted/i)).toBeInTheDocument();
  });

  it('shows the error state and the server message when the POST fails', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { error: 'Invalid or expired erasure token' } },
    });
    renderAt(`/confirm-erasure?userId=42&token=${VALID_TOKEN}`);
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(await screen.findByText(/Invalid or expired erasure token/i)).toBeInTheDocument();
  });
});
