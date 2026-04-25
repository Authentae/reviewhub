// Tests for ThemeContext. This context had a subtle bug (localStorage being
// written on every dark-mode change rendered the system-preference listener
// dead code). These tests lock down the contract so that regression can't
// come back silently.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

function Probe() {
  const { dark, toggle } = useTheme();
  return (
    <div>
      <div data-testid="dark">{String(dark)}</div>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

describe('ThemeContext', () => {
  it('defaults from system preference when no localStorage entry exists', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, // system is dark
      addEventListener: () => {}, removeEventListener: () => {},
    });
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('dark')).toHaveTextContent('true');
  });

  it('respects stored user preference over system', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, // system dark
      addEventListener: () => {}, removeEventListener: () => {},
    });
    localStorage.setItem('reviewhub_theme', 'light'); // but user picked light
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('dark')).toHaveTextContent('false');
  });

  it('toggle() persists to localStorage and flips the class on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    const initial = screen.getByTestId('dark').textContent;
    act(() => { screen.getByText('toggle').click(); });
    expect(screen.getByTestId('dark')).not.toHaveTextContent(initial);
    expect(['dark', 'light']).toContain(localStorage.getItem('reviewhub_theme'));
    // Final state should match html class
    const isDark = screen.getByTestId('dark').textContent === 'true';
    expect(document.documentElement.classList.contains('dark')).toBe(isDark);
  });

  it('does NOT write localStorage during initial render (regression guard)', () => {
    // The previous bug: the DOM-sync useEffect also called
    // localStorage.setItem(), which made the system-preference listener's
    // `!localStorage.getItem(THEME_KEY)` guard always false on first render.
    // Keep this test green to ensure the fix doesn't regress.
    expect(localStorage.getItem('reviewhub_theme')).toBeNull();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    // After render, no toggle was called, so no explicit pref should be stored.
    expect(localStorage.getItem('reviewhub_theme')).toBeNull();
  });
});
