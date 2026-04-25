// Tests for the auth helper (lib/auth.js). This file is tiny but it gates
// every authenticated request in the app — a bug here means either "user
// is signed out even though they shouldn't be" or "expired token stays
// valid". Both are bad.

import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, clearToken, isLoggedIn, getTokenExpiryMs } from '../lib/auth';

// Build a minimal JWT-ish string with a given `exp` claim (seconds since epoch).
// Signature is a dummy — auth.js only base64-decodes the middle segment.
function makeToken(expSecondsFromNow) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: 1, email: 't@e.c', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${b64(header)}.${b64(payload)}.sig`;
}

describe('lib/auth', () => {
  beforeEach(() => { localStorage.clear(); });

  it('getToken returns null when nothing is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken / getToken round-trip', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
  });

  it('clearToken removes the entry', () => {
    setToken('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('isLoggedIn is false when no token', () => {
    expect(isLoggedIn()).toBe(false);
  });

  it('isLoggedIn is true for a fresh token', () => {
    setToken(makeToken(3600));
    expect(isLoggedIn()).toBe(true);
  });

  it('isLoggedIn is false for an expired token, and clears it', () => {
    setToken(makeToken(-1));
    expect(isLoggedIn()).toBe(false);
    // Expired token is also proactively cleared from storage.
    expect(getToken()).toBeNull();
  });

  it('isLoggedIn is false for malformed tokens and clears them', () => {
    setToken('not-a-jwt');
    expect(isLoggedIn()).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('getTokenExpiryMs returns positive for fresh tokens', () => {
    setToken(makeToken(600));
    const ms = getTokenExpiryMs();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(600_000);
  });

  it('getTokenExpiryMs returns negative for expired tokens', () => {
    setToken(makeToken(-10));
    const ms = getTokenExpiryMs();
    expect(ms).toBeLessThan(0);
  });

  it('getTokenExpiryMs returns null for malformed tokens', () => {
    setToken('bad');
    expect(getTokenExpiryMs()).toBeNull();
  });

  it('setToken sets the rh_logged_in marker', () => {
    setToken(makeToken(3600));
    expect(localStorage.getItem('rh_logged_in')).toBe('1');
  });

  it('clearToken removes the marker', () => {
    setToken(makeToken(3600));
    clearToken();
    expect(localStorage.getItem('rh_logged_in')).toBeNull();
  });

  it('isLoggedIn returns true when only the marker is present (cookie-era)', () => {
    // Post-cookie clients don't put the JWT in localStorage — just the marker.
    localStorage.setItem('rh_logged_in', '1');
    expect(isLoggedIn()).toBe(true);
  });
});
