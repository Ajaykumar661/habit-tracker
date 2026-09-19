import { useEffect, useState } from 'react';
import { getEnvironmentState } from '../lib/environment';

// Re-checks the clock once a minute and whenever the tab regains focus —
// no need for anything finer-grained than that for a lighting mood.
export function useEnvironmentState() {
  const [state, setState] = useState(getEnvironmentState);

  useEffect(() => {
    function update() { setState(getEnvironmentState()); }
    const interval = setInterval(update, 60000);
    window.addEventListener('tally-env-override', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(interval);
      window.removeEventListener('tally-env-override', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return state;
}
