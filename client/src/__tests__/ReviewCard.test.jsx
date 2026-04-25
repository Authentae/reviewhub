// Tests for ReviewCard — the workhorse component. It has three distinct
// interactive surfaces (quick-reply draft, private note editor, delete
// confirm), a template-insert menu with keyboard nav, and a bunch of
// accessibility affordances we've tuned over time. These tests anchor the
// most important contracts so future refactors can't silently regress them.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock api before importing the component so .get('/templates') and .post(/respond)
// are interceptable.
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../lib/api';
import ReviewCard, { invalidateTemplateCache } from '../components/ReviewCard';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

const SAMPLE_REVIEW = {
  id: 42,
  platform: 'google',
  reviewer_name: 'Alice Example',
  rating: 4,
  review_text: 'Good service, one small issue.',
  sentiment: 'positive',
  response_text: null,
  external_id: null,
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  updated_at: null,
  note: null,
};

function renderCard(review = SAMPLE_REVIEW, extraProps = {}) {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ReviewCard review={review} {...extraProps} />
      </ToastProvider>
    </I18nProvider>
  );
}

describe('ReviewCard', () => {
  beforeEach(() => {
    invalidateTemplateCache();
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
    // Skip the first-time AI disclaimer modal — we have a dedicated test for
    // that behaviour. For every other test, set the "already acknowledged"
    // flag so Quick Reply goes straight to generating a draft.
    localStorage.setItem('reviewhub_ai_disclaimer_acked', '1');
    // Default: no templates available for this user.
    api.get.mockImplementation((url) => {
      if (url.includes('/templates')) return Promise.resolve({ data: { templates: [] } });
      if (url.includes('/draft')) return Promise.resolve({ data: { draft: 'Hi Alice, thanks!', sentiment: 'positive' } });
      return Promise.resolve({ data: {} });
    });
  });

  it('renders the reviewer name, rating, and review text', () => {
    renderCard();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText(/Good service/)).toBeInTheDocument();
    // 4-star rating is exposed via StarRating's aria-label
    expect(screen.getByRole('img', { name: /4/ })).toBeInTheDocument();
  });

  it('Reply opens an empty editor without calling /draft (preserves AI quota)', async () => {
    renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^reply to/i }));
    const textarea = await screen.findByRole('textbox', { name: /response to/i });
    expect(textarea).toHaveValue('');
    expect(api.get).not.toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
  });

  it('AI Draft button inside the editor generates a draft via /draft endpoint', async () => {
    localStorage.setItem('reviewhub_ai_disclaimer_acked', '1');
    renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^reply to/i }));
    const aiBtn = await screen.findByRole('button', { name: /ai draft|generate an ai/i });
    await user.click(aiBtn);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
    });
    const textarea = await screen.findByRole('textbox', { name: /response to/i });
    await waitFor(() => expect(textarea).toHaveValue('Hi Alice, thanks!'));
  });

  it('delete button opens an inline confirm and requires Yes to fire the API', async () => {
    renderCard();
    const user = userEvent.setup();
    // ✕ icon button has an aria-label "Delete review"
    await user.click(screen.getByRole('button', { name: /delete review/i }));
    // Confirm UI renders — "Yes" / "No" buttons appear
    const yes = await screen.findByRole('button', { name: /^yes/i });
    const no = screen.getByRole('button', { name: /^no/i });
    expect(yes).toBeInTheDocument();
    // Focus should be on Yes for fast keyboard confirmation
    expect(document.activeElement).toBe(yes);

    // Clicking No dismisses without calling the API.
    await user.click(no);
    expect(api.delete).not.toHaveBeenCalled();
    // And focus returns to the trigger for keyboard users.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /delete review/i }));
    });
  });

  it('Escape during delete-confirm cancels and restores focus to the trigger', async () => {
    renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete review/i }));
    await screen.findByRole('button', { name: /^yes/i });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^yes/i })).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /delete review/i }));
  });

  it('private note: "Add a note" button opens the editor', async () => {
    renderCard();
    const user = userEvent.setup();
    const addBtn = screen.getByRole('button', { name: /add.*note/i });
    await user.click(addBtn);
    expect(screen.getByRole('textbox', { name: /note/i })).toBeInTheDocument();
  });

  it('displays an existing response as "your response" block', () => {
    renderCard({
      ...SAMPLE_REVIEW,
      response_text: 'Thanks for the feedback, Alice!',
    });
    expect(screen.getByText(/Thanks for the feedback, Alice/)).toBeInTheDocument();
    // And the primary action becomes "Edit reply" rather than "Reply"
    expect(screen.queryByRole('button', { name: /^reply to/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit reply/i })).toBeInTheDocument();
  });

  it('truncates long review text and offers Show more', () => {
    const long = 'x'.repeat(400);
    renderCard({ ...SAMPLE_REVIEW, review_text: long });
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('highlights search query matches', () => {
    renderCard(SAMPLE_REVIEW, { highlight: 'Alice' });
    // `<mark>` elements are how we highlight
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0]).toHaveTextContent('Alice');
  });

  it('AI disclaimer: first AI Draft click shows modal before hitting /draft', async () => {
    // Reset the ack flag so this test sees first-time behaviour
    localStorage.removeItem('reviewhub_ai_disclaimer_acked');
    renderCard();
    const user = userEvent.setup();
    // Open the editor first — no AI call yet
    await user.click(screen.getByRole('button', { name: /^reply to/i }));
    expect(api.get).not.toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
    // Now click AI Draft inside the editor — should trigger disclaimer
    const aiBtn = await screen.findByRole('button', { name: /ai draft|generate an ai/i });
    await user.click(aiBtn);
    // Draft endpoint should NOT have been called yet — disclaimer must be acknowledged first
    expect(api.get).not.toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
    // Modal is visible
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // Ack button is present with autofocus
    const ack = screen.getByRole('button', { name: /understand/i });
    expect(ack).toBeInTheDocument();
    // Click acknowledge → localStorage flag set + draft fetched
    await user.click(ack);
    expect(localStorage.getItem('reviewhub_ai_disclaimer_acked')).toBe('1');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
    });
  });

  it('AI disclaimer: once acknowledged, subsequent AI Draft click bypasses the modal', async () => {
    localStorage.setItem('reviewhub_ai_disclaimer_acked', '1');
    renderCard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^reply to/i }));
    const aiBtn = await screen.findByRole('button', { name: /ai draft|generate an ai/i });
    await user.click(aiBtn);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/reviews/${SAMPLE_REVIEW.id}/draft`);
    });
    // No dialog should appear
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
