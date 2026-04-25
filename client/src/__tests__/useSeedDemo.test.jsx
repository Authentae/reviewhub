// Tests for the useSeedDemo hook — shared demo-seeding flow used by
// Dashboard, Analytics, and the onboarding checklist.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../context/I18nContext';
import { ToastProvider } from '../components/Toast';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn() },
}));

import api from '../lib/api';
import useSeedDemo from '../hooks/useSeedDemo';

function wrapper({ children }) {
  return (
    <I18nProvider>
      <ToastProvider>{children}</ToastProvider>
    </I18nProvider>
  );
}

describe('useSeedDemo', () => {
  beforeEach(() => { api.post.mockReset(); });

  it('returns the number of reviews added on success', async () => {
    api.post.mockResolvedValueOnce({ data: { reviews_added: 12 } });
    const { result } = renderHook(() => useSeedDemo(), { wrapper });
    let added;
    await act(async () => { added = await result.current.seed(); });
    expect(added).toBe(12);
    expect(api.post).toHaveBeenCalledWith('/reviews/seed');
  });

  it('returns 0 when the account was already seeded', async () => {
    api.post.mockResolvedValueOnce({ data: { reviews_added: 0 } });
    const { result } = renderHook(() => useSeedDemo(), { wrapper });
    let added;
    await act(async () => { added = await result.current.seed(); });
    expect(added).toBe(0);
  });

  it('returns null on error (and resets seeding flag)', async () => {
    api.post.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useSeedDemo(), { wrapper });
    let added;
    await act(async () => { added = await result.current.seed(); });
    expect(added).toBeNull();
    expect(result.current.seeding).toBe(false);
  });

  it('seeding flag toggles true during the API call', async () => {
    let resolveApi;
    api.post.mockReturnValueOnce(new Promise(r => { resolveApi = r; }));
    const { result } = renderHook(() => useSeedDemo(), { wrapper });

    let seedPromise;
    act(() => { seedPromise = result.current.seed(); });
    // While the API call is pending, seeding should be true
    expect(result.current.seeding).toBe(true);

    await act(async () => {
      resolveApi({ data: { reviews_added: 5 } });
      await seedPromise;
    });
    expect(result.current.seeding).toBe(false);
  });
});
