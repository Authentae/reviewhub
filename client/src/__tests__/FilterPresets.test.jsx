// Tests for FilterPresets — the dashboard widget that lets users save
// and recall filter combinations. Uses localStorage as the storage
// layer; tests mock storage per-test to keep isolation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterPresets from '../components/FilterPresets';
import { I18nProvider } from '../context/I18nContext';

function renderPresets(props = {}) {
  const defaults = {
    businessId: 1,
    currentFilters: { sentiment: 'negative', responded: 'no' },
    applyPreset: vi.fn(),
    hasActiveFilters: true,
  };
  return {
    ...render(
      <I18nProvider>
        <FilterPresets {...defaults} {...props} />
      </I18nProvider>
    ),
    props: { ...defaults, ...props },
  };
}

describe('FilterPresets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the Presets button with a count of saved presets', () => {
    localStorage.setItem(
      'rh_filter_presets_1',
      JSON.stringify([
        { name: 'Mornings', filters: { sentiment: 'negative' }, savedAt: Date.now() },
      ])
    );
    renderPresets();
    expect(screen.getByRole('button', { name: /presets/i })).toBeInTheDocument();
    // Count badge for 1 saved preset
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens menu and shows empty-state when no presets saved', async () => {
    const user = userEvent.setup();
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    expect(screen.getByText(/no saved presets/i)).toBeInTheDocument();
  });

  it('saves a new preset under a user-provided name', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('My morning view');
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByRole('button', { name: /save current/i }));

    // Saved to localStorage
    const stored = JSON.parse(localStorage.getItem('rh_filter_presets_1'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('My morning view');
    expect(stored[0].filters).toEqual({ sentiment: 'negative', responded: 'no' });
    promptSpy.mockRestore();
  });

  it('does not save when prompt is cancelled (returns null)', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByRole('button', { name: /save current/i }));

    expect(localStorage.getItem('rh_filter_presets_1')).toBeNull();
    promptSpy.mockRestore();
  });

  it('does not save an empty/whitespace name', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('   ');
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByRole('button', { name: /save current/i }));

    expect(localStorage.getItem('rh_filter_presets_1')).toBeNull();
    promptSpy.mockRestore();
  });

  it('save button disabled when hasActiveFilters is false', async () => {
    const user = userEvent.setup();
    renderPresets({ hasActiveFilters: false });
    await user.click(screen.getByRole('button', { name: /presets/i }));
    const saveBtn = screen.getByRole('button', { name: /save current/i });
    expect(saveBtn).toBeDisabled();
  });

  it('saving with the same name as an existing preset replaces it (no dupes)', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'rh_filter_presets_1',
      JSON.stringify([
        { name: 'Existing', filters: { sentiment: 'positive' }, savedAt: 100 },
      ])
    );
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Existing');
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByRole('button', { name: /save current/i }));

    const stored = JSON.parse(localStorage.getItem('rh_filter_presets_1'));
    expect(stored).toHaveLength(1);
    expect(stored[0].filters).toEqual({ sentiment: 'negative', responded: 'no' });
    promptSpy.mockRestore();
  });

  it('clicking a preset calls applyPreset with its saved filters', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'rh_filter_presets_1',
      JSON.stringify([
        { name: 'Mornings', filters: { sentiment: 'negative', responded: 'no' }, savedAt: Date.now() },
      ])
    );
    const apply = vi.fn();
    renderPresets({ applyPreset: apply });
    await user.click(screen.getByRole('button', { name: /presets/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Mornings' }));

    expect(apply).toHaveBeenCalledWith({ sentiment: 'negative', responded: 'no' });
  });

  it('deleting a preset removes it from localStorage and the list', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'rh_filter_presets_1',
      JSON.stringify([
        { name: 'Keep me', filters: {}, savedAt: 1 },
        { name: 'Delete me', filters: {}, savedAt: 2 },
      ])
    );
    renderPresets();
    await user.click(screen.getByRole('button', { name: /presets/i }));
    // Find the delete button for "Delete me"
    const deleteBtn = screen.getByRole('button', { name: /delete preset delete me/i });
    await user.click(deleteBtn);

    const stored = JSON.parse(localStorage.getItem('rh_filter_presets_1'));
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Keep me');
  });

  it('presets are namespaced by businessId', () => {
    localStorage.setItem(
      'rh_filter_presets_1',
      JSON.stringify([{ name: 'For biz 1', filters: {}, savedAt: 1 }])
    );
    localStorage.setItem(
      'rh_filter_presets_2',
      JSON.stringify([{ name: 'For biz 2', filters: {}, savedAt: 1 }])
    );

    const { rerender } = render(
      <I18nProvider>
        <FilterPresets businessId={1} currentFilters={{}} applyPreset={vi.fn()} hasActiveFilters />
      </I18nProvider>
    );
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <FilterPresets businessId={2} currentFilters={{}} applyPreset={vi.fn()} hasActiveFilters />
      </I18nProvider>
    );
    // Re-renders with biz 2's single preset
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('handles malformed localStorage data gracefully', () => {
    localStorage.setItem('rh_filter_presets_1', 'not-valid-json{');
    // Should render without throwing; treat as empty
    renderPresets();
    expect(screen.getByRole('button', { name: /presets/i })).toBeInTheDocument();
  });
});
