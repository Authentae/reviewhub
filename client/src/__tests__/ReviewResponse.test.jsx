// Tests for ReviewResponse — public-facing response card.
//
// Covers: hidden when no response, owner sees Edit/Delete, non-owner does not,
// edit flow swaps to ReviewResponseForm and back on save, optimistic delete
// removes the card immediately and rolls back on server error, "edited" badge
// when updated_at differs from created_at.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../lib/api';
import ReviewResponse from '../components/ReviewResponse';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

const RESPONSE = {
  text: 'Thanks so much for the kind words, Alice — see you soon!',
  owner_name: 'Bob (Owner)',
  created_at: '2026-04-20T12:00:00Z',
  updated_at: '2026-04-20T12:00:00Z',
};

function renderResponse(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ReviewResponse reviewId={9} response={RESPONSE} {...props} />
      </ToastProvider>
    </I18nProvider>
  );
}

describe('ReviewResponse', () => {
  beforeEach(() => {
    api.delete.mockReset();
    api.put.mockReset();
  });

  it('renders nothing when response is null', () => {
    const { container } = render(
      <I18nProvider>
        <ToastProvider>
          <ReviewResponse reviewId={9} response={null} />
        </ToastProvider>
      </I18nProvider>
    );
    expect(container.querySelector('[data-testid="review-response"]')).toBeNull();
  });

  it('renders the badge, owner name, and text for everyone', () => {
    renderResponse();
    expect(screen.getByText(/owner response/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob \(Owner\)/)).toBeInTheDocument();
    expect(screen.getByText(/thanks so much/i)).toBeInTheDocument();
  });

  it('hides Edit/Delete affordances when isOwner is false', () => {
    renderResponse({ isOwner: false });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('shows Edit and Delete buttons when isOwner is true', () => {
    renderResponse({ isOwner: true });
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('does NOT show "edited" when created_at === updated_at', () => {
    renderResponse();
    expect(screen.queryByText(/· edited/i)).not.toBeInTheDocument();
  });

  it('shows the "edited" badge when updated_at differs from created_at', () => {
    renderResponse({
      response: { ...RESPONSE, updated_at: '2026-04-21T15:00:00Z' },
    });
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it('clicking Edit swaps to the inline form with current text', async () => {
    renderResponse({ isOwner: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = await screen.findByRole('textbox');
    expect(textarea).toHaveValue(RESPONSE.text);
  });

  it('Cancel inside the edit form returns to the read-only card', async () => {
    renderResponse({ isOwner: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(await screen.findByText(/thanks so much/i)).toBeInTheDocument();
  });

  it('delete confirm flow: requires Yes then optimistically removes', async () => {
    api.delete.mockResolvedValue({ data: {} });
    const onChanged = vi.fn();
    renderResponse({ isOwner: true, onChanged });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    // confirm UI
    const yes = await screen.findByRole('button', { name: /^yes/i });
    expect(screen.getByRole('button', { name: /^no/i })).toBeInTheDocument();
    await user.click(yes);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/reviews/9/response'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
    // Card is gone
    await waitFor(() => {
      expect(screen.queryByText(/thanks so much/i)).not.toBeInTheDocument();
    });
  });

  it('delete confirm: clicking No dismisses without API call', async () => {
    renderResponse({ isOwner: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: /^no/i }));
    expect(api.delete).not.toHaveBeenCalled();
    // Edit/Delete reappear
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('rolls back optimistic delete on server error', async () => {
    api.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } });
    renderResponse({ isOwner: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: /^yes/i }));
    await waitFor(() => expect(api.delete).toHaveBeenCalled());
    // Text is restored
    expect(await screen.findByText(/thanks so much/i)).toBeInTheDocument();
    // Error toast shown
    expect(await screen.findByText(/cannot delete/i)).toBeInTheDocument();
  });
});
