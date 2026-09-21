import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { planReminders } from '../domain/reminders';
import { syncReminders } from '../lib/reminders';

/**
 * Keeps the phone's reminder queue in step with the record.
 *
 * Re-planned whenever anything that changes the answer changes: a tally,
 * a routine, the reminder settings -- and each time the app comes back to
 * the front, because "now" has moved on and the horizon moves with it.
 * Brief bursts (several taps in a row) settle into one reschedule.
 */
export function useReminders({ habits, completions, settings, words }) {
  const [resumed, setResumed] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const sub = CapApp.addListener('resume', () => setResumed((n) => n + 1));
    return () => { sub.then((s) => s.remove()); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const t = setTimeout(() => {
      const plan = planReminders({ habits, completions, settings, words });
      // A failed schedule must never take the app down with it.
      syncReminders(plan).catch((e) => console.warn('reminders:', e));
    }, 400);
    return () => clearTimeout(t);
  }, [habits, completions, settings, words, resumed]);
}
