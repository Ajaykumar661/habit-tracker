import { useEffect, useMemo } from 'react';
import { widgetSnapshot } from '../domain/widget';
import { pushWidget, widgetAvailable } from '../lib/widget';

/**
 * Keeps the home-screen widget showing what the wall shows. The snapshot is
 * compared as text, so only a real change reaches the phone.
 */
export function useWidget({ habits, completions, activeRoutine, streak, today, theme, cutoffHour, words }) {
  const json = useMemo(() => JSON.stringify(widgetSnapshot({
    habits, completions, activeRoutine, streak, today, theme, cutoffHour, words,
  })), [habits, completions, activeRoutine, streak, today, theme, cutoffHour, words]);

  useEffect(() => {
    if (!widgetAvailable()) return undefined;
    const t = setTimeout(() => {
      pushWidget(JSON.parse(json)).catch((e) => console.warn('widget:', e));
    }, 400);
    return () => clearTimeout(t);
  }, [json]);
}
