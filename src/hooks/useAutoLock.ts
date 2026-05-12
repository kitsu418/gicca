import { useEffect } from 'react';
import { meta } from '../core/db';
import {
  isUnlocked,
  lockSession,
  setAutoLockMs,
  touchActivity,
} from '../core/vault/session';

// Wall-clock checkpoint, used so a backgrounded tab whose timers were
// throttled still locks at the right moment when it comes back to focus.
let lastActivityAt = Date.now();
let autoLockMs = 5 * 60 * 1000;

function onActivity() {
  lastActivityAt = Date.now();
  touchActivity();
}

export function useAutoLock() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await meta.get('autoLockMs');
      if (cancelled) return;
      if (typeof stored === 'number' && stored >= 0) {
        autoLockMs = stored;
        setAutoLockMs(stored);
      }
    })();

    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'keydown',
      'touchstart',
      'pointermove',
    ];
    for (const ev of events) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    function onVisible() {
      if (!isUnlocked()) return;
      if (document.hidden) return;
      const elapsed = Date.now() - lastActivityAt;
      if (autoLockMs > 0 && elapsed >= autoLockMs) {
        lockSession();
      } else {
        touchActivity();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      for (const ev of events) window.removeEventListener(ev, onActivity);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
