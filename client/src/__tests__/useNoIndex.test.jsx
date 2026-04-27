// Tests for the useNoIndex hook — injects <meta name="robots"
// content="noindex, nofollow"> for the duration of mount.
//
// Lock down:
//   - meta tag is added on mount with the right content
//   - meta tag is removed on unmount (so navigating to a public page
//     doesn't leave the noindex behind on the next route)
//   - tolerates manual removal between mount and unmount (defensive)

import { describe, test, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import useNoIndex from '../hooks/useNoIndex';

function Probe() {
  useNoIndex();
  return null;
}

function getRobotsMeta() {
  return document.head.querySelector('meta[name="robots"]');
}

describe('useNoIndex', () => {
  beforeEach(() => {
    // Clean any leftover meta from a previous test.
    document.head.querySelectorAll('meta[name="robots"]').forEach((n) => n.remove());
  });

  test('adds a noindex,nofollow meta tag on mount', () => {
    expect(getRobotsMeta()).toBeNull();
    render(<Probe />);
    const meta = getRobotsMeta();
    expect(meta).not.toBeNull();
    expect(meta.getAttribute('content')).toBe('noindex, nofollow');
  });

  test('removes the meta tag on unmount', () => {
    const { unmount } = render(<Probe />);
    expect(getRobotsMeta()).not.toBeNull();
    unmount();
    expect(getRobotsMeta()).toBeNull();
  });

  test('does not throw if the meta tag was removed externally before unmount', () => {
    const { unmount } = render(<Probe />);
    document.head.querySelectorAll('meta[name="robots"]').forEach((n) => n.remove());
    expect(() => unmount()).not.toThrow();
  });
});
