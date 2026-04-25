// Vitest setup — runs before every test file.
//
// - Extends expect with @testing-library/jest-dom matchers (toBeInTheDocument,
//   toHaveTextContent, etc.).
// - Stubs browser APIs that jsdom doesn't implement (matchMedia, scrollTo).
// - Resets localStorage between tests so a test that writes auth tokens
//   doesn't leak into the next.

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's cleanup unmounts components between tests — otherwise the previous
// test's DOM would still be attached and queries would find stale elements.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; ThemeContext uses it to detect system
// dark-mode preference.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom doesn't implement scrollTo; the Dashboard's "Back to top" button calls it.
if (!window.scrollTo) {
  window.scrollTo = () => {};
}

// Fresh localStorage for every test.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
