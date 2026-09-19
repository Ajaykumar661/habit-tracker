// Derives the "world" lighting state from the visitor's local clock.
// Kept deliberately dependency-free (no timezone libs) — Date already
// reports in local time, which is exactly what we want here.

export const ENV_STATES = ['dawn', 'day', 'dusk', 'night'];

function stateForHour(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export const DEV = import.meta.env.DEV;

// Dev-only manual override so the four states can be exercised without
// waiting for the clock — never present in a production build. Vite/Rollup
// dead-code-eliminates these blocks when DEV is statically false.
let devOverrideHour = null;
let devOverrideState = null;

export function setDevEnvState(state) {
  devOverrideState = state;
  window.dispatchEvent(new Event('tally-env-override'));
}

export function getDevEnvState() {
  return DEV ? devOverrideState : null;
}

if (DEV && typeof window !== 'undefined') {
  window.__setEnvHour = (h) => {
    devOverrideHour = h === null || h === undefined ? null : Number(h);
    devOverrideState = null;
    window.dispatchEvent(new Event('tally-env-override'));
  };
  window.__setEnvState = setDevEnvState;
}

export function getEnvironmentState() {
  if (devOverrideState) return devOverrideState;
  const hour = DEV && devOverrideHour !== null ? devOverrideHour : new Date().getHours();
  return stateForHour(hour);
}
