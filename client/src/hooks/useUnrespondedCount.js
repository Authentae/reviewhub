import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { isLoggedIn } from '../lib/auth';

// Polls the /reviews/summary endpoint every 60 s to keep the unresponded badge fresh.
// Returns null while loading, 0 if all caught up, or a positive integer.
//
// Polling pauses when the tab is hidden (saves server CPU, mobile battery,
// and network while the user isn't looking). On tab-visible it fires an
// immediate refresh and restarts the interval so a backgrounded tab catches
// up instantly on return.
export default function useUnrespondedCount() {
  const [count, setCount] = useState(null);

  const loadCount = useCallback(async () => {
    if (!isLoggedIn()) return;
    try {
      const { data } = await api.get('/reviews/summary');
      setCount(data.unresponded ?? 0);
    } catch {
      // Silently ignore — badge is cosmetic, must not break the UI
    }
  }, []);

  useEffect(() => {
    let id = null;
    function startPoll() {
      if (id) clearInterval(id);
      id = setInterval(loadCount, 60_000);
    }
    function stopPoll() {
      if (id) { clearInterval(id); id = null; }
    }

    // Kick off an immediate load + poll if the tab is visible on mount.
    if (document.visibilityState === 'visible') {
      loadCount();
      startPoll();
    }

    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadCount();
        startPoll();
      } else {
        stopPoll();
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopPoll(); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadCount]);

  return count;
}
