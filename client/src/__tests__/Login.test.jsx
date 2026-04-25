// Tests for the Login page. Exercises the full happy and sad paths of the
// form — auto-focus on mount, error surfacing, loading state, navigation on
// success.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the api module before importing the component so the login call is
// interceptable. Vitest hoists vi.mock to the top so this works despite the
// import ordering.
vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}));

import api from '../lib/api';
import Login from '../pages/Login';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/Toast';

function renderLogin() {
  return render(
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it('auto-focuses the email field on mount', async () => {
    renderLogin();
    const email = screen.getByLabelText(/email/i);
    // Wait a tick for the mount effects (autoFocus is a DOM attribute).
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  it('renders the Forgot password link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /forgot/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('submits credentials and navigates to /dashboard on success', async () => {
    api.post.mockResolvedValue({ data: { token: 'fake-jwt', user: { id: 1, email: 'u@example.com' } } });
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'u@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2xyz');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'u@example.com', password: 'hunter2xyz' });
    expect(localStorage.getItem('token')).toBe('fake-jwt');
  });

  it('shows a server error message and keeps the user on the page', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } });
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'u@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Invalid credentials/);
    // Did NOT navigate — still on the login page.
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
    // Focus moved to the email field so the error is actionable for keyboard users.
    expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
  });

  it('toggles password visibility', async () => {
    renderLogin();
    const user = userEvent.setup();
    const pw = screen.getByLabelText(/^password$/i);
    expect(pw).toHaveAttribute('type', 'password');
    // The show/hide is an icon button next to the input with its own aria-label.
    const toggle = screen.getByRole('button', { name: /show password/i });
    await user.click(toggle);
    expect(pw).toHaveAttribute('type', 'text');
  });

  it('demo account button pre-fills the form', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /demo account/i }));
    expect(screen.getByLabelText(/email/i)).toHaveValue('demo@reviewhub.app');
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('demo123');
  });
});
