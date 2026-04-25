import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isLoggedIn } from '../lib/auth';

// Two-key "g <letter>" sequence navigator, Gmail-style. `g` primes a
// short-lived flag; the next letter within 1.2s navigates. Skipped when
// focus is in a text input so "go to settings" from the search box still
// works normally.
//
// Paths are gated by isLoggedIn() so `g d` from the landing page doesn't
// jump past auth — we bounce to /login which then brings them back via
// PrivateRoute's state.from.
const TIMEOUT_MS = 1200;

export default function GlobalHotkeys() {
  const navigate = useNavigate();

  useEffect(() => {
    let primed = false;
    let timer = null;

    function clearPrime() {
      primed = false;
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function onKey(e) {
      // Ignore if user is typing somewhere
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Respect modifier keys — "Ctrl+G" shouldn't trigger the sequence
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!primed) {
        if (e.key === 'g') {
          primed = true;
          timer = setTimeout(clearPrime, TIMEOUT_MS);
        }
        return;
      }
      // Primed — interpret the next letter
      clearPrime();
      switch (e.key) {
        case 'd':
          navigate(isLoggedIn() ? '/dashboard' : '/login');
          break;
        case 'a':
          navigate(isLoggedIn() ? '/analytics' : '/login');
          break;
        case 's':
          navigate(isLoggedIn() ? '/settings' : '/login');
          break;
        case 'p':
          navigate('/pricing');
          break;
        case 'r':
          navigate(isLoggedIn() ? '/review-requests' : '/login');
          break;
        case 'h':
          navigate('/');
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearPrime();
    };
  }, [navigate]);

  return null;
}
