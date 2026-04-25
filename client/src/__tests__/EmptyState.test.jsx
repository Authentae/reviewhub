// Tests for the shared EmptyState component used on Dashboard, Analytics,
// and ReviewRequests. Small but load-bearing — a broken empty state breaks
// the first impression for every new user.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../components/EmptyState';

describe('EmptyState', () => {
  it('renders title + icon', () => {
    render(<EmptyState icon="📭" title="Nothing here" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders body text when provided', () => {
    render(<EmptyState icon="📭" title="Nothing" body="Try creating one first." />);
    expect(screen.getByText('Try creating one first.')).toBeInTheDocument();
  });

  it('omits the body when not provided (no empty paragraph)', () => {
    render(<EmptyState icon="📭" title="Nothing" />);
    const paragraphs = document.querySelectorAll('p');
    // One for icon, one for title — no empty body paragraph
    expect(paragraphs.length).toBe(2);
  });

  it('renders action children in a horizontal row', () => {
    render(
      <EmptyState title="No data">
        <button>Primary</button>
        <button>Secondary</button>
      </EmptyState>
    );
    expect(screen.getByRole('button', { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /secondary/i })).toBeInTheDocument();
  });

  it('marks the icon as decorative (aria-hidden)', () => {
    render(<EmptyState icon="📭" title="Nothing" />);
    const iconP = screen.getByText('📭');
    expect(iconP).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits the icon when not provided', () => {
    render(<EmptyState title="Nothing" />);
    // No emoji character visible
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
  });

  it('applies a custom className alongside the default card styling', () => {
    const { container } = render(<EmptyState title="T" className="custom-class" />);
    const outer = container.firstChild;
    expect(outer.className).toContain('card');
    expect(outer.className).toContain('custom-class');
  });
});
