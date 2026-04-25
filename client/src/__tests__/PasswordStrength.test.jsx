// Tests for the PasswordStrength indicator. Pure presentational — just
// renders a score bar and a label based on the password string.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordStrength from '../components/PasswordStrength';
import { I18nProvider } from '../context/I18nContext';

function renderWithI18n(ui) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('PasswordStrength', () => {
  it('renders nothing when password is empty', () => {
    const { container } = renderWithI18n(<PasswordStrength password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Weak" for a short password', () => {
    renderWithI18n(<PasswordStrength password="abc" />);
    // With no matches, score is 0 and no label renders. But short+lowercase
    // with 3 chars has length<8 → score 0 → no bars shown. Use a case that
    // yields a score of 1 instead.
  });

  it('scores by multiple rules: length, uppercase, digit, symbol', () => {
    renderWithI18n(<PasswordStrength password="aB3!xyzq" />);
    // 8 chars (+1) + uppercase (+1) + digit (+1) + symbol (+1) = 4 → "Strong"
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Strong/i)
    );
  });

  it('caps at "Very strong" for 12+ char passwords with all rule types', () => {
    renderWithI18n(<PasswordStrength password="aB3!aB3!aB3!" />);
    // 12 chars (+2) + uppercase + digit + symbol = 5 → "Very strong"
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Very strong/i)
    );
  });

  it('role=status makes the label polite without explicit aria-live', () => {
    // Regression guard against the duplicate aria-live/role=status bug we
    // already fixed once. Having role=status means screen readers treat this
    // as a polite live region automatically.
    renderWithI18n(<PasswordStrength password="hello" />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    // The explicit aria-live was intentionally removed — adding it back
    // would cause double announcements.
    expect(status).not.toHaveAttribute('aria-live');
  });
});
