import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes constant state threshold
const HEARTBEAT_INTERVAL_MS = 45 * 1000;  // Optimized heartbeat interval (45s) for 100,000+ students

export function usePresence(token: string | null) {
  const lastActiveRef = useRef<number>(Date.now());

  // Record user interaction (mouse movement, keydown, click, scroll)
  useEffect(() => {
    if (!token) return;

    const recordActivity = () => {
      lastActiveRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    // Throttled event listener so we don't update excessively on every pixel of mouse move
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledRecordActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          recordActivity();
          throttleTimeout = null;
        }, 1000);
      }
    };

    events.forEach(evt => {
      window.addEventListener(evt, throttledRecordActivity, { passive: true });
    });

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, throttledRecordActivity);
      });
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [token]);

  // Periodic heartbeat sender
  useEffect(() => {
    if (!token) return;

    const sendHeartbeat = async () => {
      const now = Date.now();
      const lastActive = lastActiveRef.current;
      const isIdle = (now - lastActive) >= IDLE_THRESHOLD_MS;

      try {
        await fetch(`${API_BASE}/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            lastActive,
            isIdle
          })
        });
      } catch {
        // Silently ignore network drops
      }
    };

    // Send immediate initial heartbeat
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Send offline signal when page is unloaded
    const handleBeforeUnload = () => {
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' });
          navigator.sendBeacon(`${API_BASE}/heartbeat/offline`, blob);
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [token]);
}
