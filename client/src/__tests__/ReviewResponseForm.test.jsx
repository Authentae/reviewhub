// Tests for ReviewResponseForm — owner reply composer.
//
// Covers: char-count validation (10..2000), publish disabled until valid,
// counter tone changes near the cap, Ctrl+Enter submit, Escape cancel,
// create vs edit verbs (POST vs PUT), onSaved callback gets the canonical
// response, error toasts on server failure.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../lib/api';
import ReviewResponseForm from '../components/ReviewResponseForm';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

function renderForm(props = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ReviewResponseForm reviewId={7} {...props} />
      </ToastProvider>
    </I18nProvider>
  );
}

describe('ReviewResponseForm', () => {
  beforeEach(() => {
    api.post.mockReset();
    api.put.mockReset();
  });

  it('renders the textarea, counter at 0/2000, and disabled publish button', () => {
    renderForm();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('0/2000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish response/i })).toBeDisabled();
  });

  it('shows the min-length hint while text is non-empty but under 10 chars', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'hi');
    expect(screen.getByText(/minimum 10 characters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish response/i })).toBeDisabled();
  });

  it('enables the publish button once text reaches 10 chars', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'thanks dude');
    expect(screen.getByRole('button', { name: /publish response/i })).toBeEnabled();
    expect(screen.queryByText(/minimum 10 characters/i)).not.toBeInTheDocument();
  });

  it('POSTs to /reviews/:id/response on create and fires onSaved with server payload', async () => {
    const onSaved = vi.fn();
    const echoed = { text: 'Thank you so much!', owner_name: 'Owner Bob', created_at: 't', updated_at: 't' };
    api.post.mockResolvedValue({ data: { response: echoed } });
    renderForm({ onSaved });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'Thank you so much!');
    await user.click(screen.getByRole('button', { name: /publish response/i }));
    await waitFor(() => {
      // Field name mirrors the DB column (`response_text`) — see
      // server/src/routes/reviews.js. Test was previously stale.
      expect(api.post).toHaveBeenCalledWith('/reviews/7/response', { response_text: 'Thank you so much!' });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(echoed));
  });

  it('synthesizes an optimistic response when the server omits the body', async () => {
    const onSaved = vi.fn();
    api.post.mockResolvedValue({ data: {} });
    renderForm({ onSaved });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'Thank you so much!');
    await user.click(screen.getByRole('button', { name: /publish response/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const arg = onSaved.mock.calls[0][0];
    expect(arg.text).toBe('Thank you so much!');
    expect(arg.created_at).toBeTruthy();
    expect(arg.updated_at).toBeTruthy();
  });

  it('uses PUT when mode="edit" and shows "Save changes" label', async () => {
    api.put.mockResolvedValue({ data: { response: { text: 'edited text!!', owner_name: null, created_at: 't', updated_at: 't' } } });
    renderForm({ mode: 'edit', initialText: 'old text here', onSaved: vi.fn() });
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/reviews/7/response', { response_text: 'old text here' }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the Cancel button only when onCancel is provided', () => {
    const { rerender } = renderForm();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    rerender(
      <I18nProvider>
        <ToastProvider>
          <ReviewResponseForm reviewId={7} onCancel={() => {}} />
        </ToastProvider>
      </I18nProvider>
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Escape inside textarea fires onCancel', async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    const user = userEvent.setup();
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('Ctrl+Enter submits when input is valid', async () => {
    const onSaved = vi.fn();
    api.post.mockResolvedValue({ data: {} });
    renderForm({ onSaved });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'this is a long enough response');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });

  it('marks aria-invalid when text is too short', async () => {
    renderForm();
    const user = userEvent.setup();
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'hi');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows error toast when create fails with server message', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Plan does not allow responses' } } });
    renderForm({ onSaved: vi.fn() });
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'this is long enough');
    await user.click(screen.getByRole('button', { name: /publish response/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(await screen.findByText(/plan does not allow responses/i)).toBeInTheDocument();
  });

  it('counter goes to amber within 200 chars of the cap', async () => {
    renderForm({ initialText: 'x'.repeat(1850) });
    // The aria-live counter element carries the tone class
    const counter = screen.getByText('1850/2000');
    expect(counter.className).toMatch(/amber/);
  });
});
