// ---- NEW: single shared countdown hook (replaces the two diverged copies in
// PrepPhase.tsx and Game2.tsx). ----
//
// Timeline for every timed phase (D = the nominal duration shown on screen):
//
//   0 ─────────── D ─────────── D + INPUT_GRACE_MS ─────────── D + INPUT_GRACE_MS + SERVER_BUFFER_MS
//   normal play     grace: still editable,          dead window: inputs locked,       server moves on
//                   "Time's up, submitting..."      auto-submit already sent
//
//   secondsLeft   → whole seconds until D (clamped at 0)
//   inGracePeriod → true from D until D + INPUT_GRACE_MS  (inputs stay live)
//   graceOver     → true from D + INPUT_GRACE_MS onward   (auto-submit fires, inputs lock)
//
// The server timer is D + INPUT_GRACE_MS + SERVER_BUFFER_MS, so auto-submits sent at
// graceOver have SERVER_BUFFER_MS to arrive before the server transitions (race guard).

import { useState, useEffect } from 'react';
import { INPUT_GRACE_MS } from '../../shared/constants';

export interface Countdown {
  secondsLeft: number;
  inGracePeriod: boolean;
  graceOver: boolean;
}

export function useCountdown(endsAt: number | undefined | null): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  if (!endsAt) return { secondsLeft: -1, inGracePeriod: false, graceOver: false };

  const remaining = endsAt - now;
  return {
    secondsLeft: Math.max(0, Math.ceil(remaining / 1000)),
    inGracePeriod: remaining <= 0 && remaining > -INPUT_GRACE_MS,
    graceOver: remaining <= -INPUT_GRACE_MS,
  };
}
