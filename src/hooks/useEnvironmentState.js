import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { getEnvironmentState } from '../lib/environment';

// Re-checks the clock once a minute and whenever the app comes back to the
// foreground — no need for anything finer-grained than that for a lighting
// mood. On native, the interval is throttled while backgrounded and
// visibilitychange isn't dependable, so Capacitor's resume event is what
// actually keeps a long-lived app from being stuck on a stale time of day.
export function useEnvironmentState() {
  const [state, setState] = useState(getEnvironmentState);

  useEffect(() => {
    function update() { setState(getEnvironmentState()); }
    const interval = setInterval(update, 60000);
    window.addEventListener('tally-env-override', update);
    document.addEventListener('visibilitychange', update);

    let sub;
    if (Capacitor.isNativePlatform()) sub = CapApp.addListener('resume', update);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tally-env-override', update);
      document.removeEventListener('visibilitychange', update);
      if (sub) sub.then((h) => h.remove());
    };
  }, []);

  return state;
}
