// Tests for makeT — i18n fallback wrapper.
//
// Covers: returns translation when present, returns fallback when t echoes
// the key (unresolved), returns echoed key when no fallback was provided,
// passes vars through to the underlying t().

import { describe, it, expect, vi } from 'vitest';
import { makeT } from '../utils/tFallback';

describe('makeT', () => {
  it('returns the underlying translation when t resolves the key', () => {
    const t = vi.fn(() => 'Welcome!');
    const tt = makeT(t);
    expect(tt('common.welcome', 'Hi')).toBe('Welcome!');
  });

  it('returns the fallback when t echoes the key (unresolved)', () => {
    const t = vi.fn((k) => k);
    const tt = makeT(t);
    expect(tt('claim.modalTitle', 'Claim this business')).toBe('Claim this business');
  });

  it('returns the echoed key when no fallback is supplied', () => {
    const t = vi.fn((k) => k);
    const tt = makeT(t);
    expect(tt('something.missing')).toBe('something.missing');
  });

  it('forwards vars to the wrapped t()', () => {
    const t = vi.fn(() => 'resolved');
    const tt = makeT(t);
    tt('greet.user', 'Hi {name}', { name: 'Alice' });
    expect(t).toHaveBeenCalledWith('greet.user', { name: 'Alice' });
  });

  it('passes an empty vars object when none is supplied', () => {
    const t = vi.fn(() => 'x');
    const tt = makeT(t);
    tt('a.key', 'fb');
    expect(t).toHaveBeenCalledWith('a.key', {});
  });

  it('does not substitute fallback when t returns empty string', () => {
    // Empty string is a valid translation; only key-echo means "unresolved".
    const t = vi.fn(() => '');
    const tt = makeT(t);
    expect(tt('a.key', 'fb')).toBe('');
  });
});
