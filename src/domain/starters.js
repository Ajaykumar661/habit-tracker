// First run: what the user wants to build, in one tap.
//
// A new install used to open on a routine called "MY ROUTINE" -- a wall with
// no reason to exist. These are the common first habits, set up the way the
// form would set them up, so the very first screen is already theirs.

import { SECONDS_PER_MINUTE } from './completion';

/** @type {Array<{ id: string, name: string, icon: string, options: object, hint: string }>} */
export const STARTERS = [
  { id: 'read', name: 'READ', icon: 'book', hint: '20 MIN A DAY',
    options: { type: 'duration', target: 20 * SECONDS_PER_MINUTE, unit: 'MINUTES' } },
  { id: 'water', name: 'DRINK WATER', icon: 'drop', hint: '8 GLASSES',
    options: { type: 'count', target: 8, unit: 'GLASSES' } },
  { id: 'walk', name: 'WALK', icon: 'boot', hint: '30 MIN A DAY',
    options: { type: 'duration', target: 30 * SECONDS_PER_MINUTE, unit: 'MINUTES' } },
  { id: 'exercise', name: 'EXERCISE', icon: 'sword', hint: 'MON WED FRI',
    options: { type: 'boolean', schedule: { frequency: 'weekly', weekdays: [1, 3, 5] } } },
  { id: 'meditate', name: 'MEDITATE', icon: 'moon', hint: 'EVERY DAY',
    options: { type: 'boolean' } },
  { id: 'journal', name: 'JOURNAL', icon: 'quill', hint: 'EVERY DAY',
    options: { type: 'boolean' } },
];

/**
 * Is this still the untouched first-run state? One routine, the default
 * name, nothing ever logged. Only then may a starter replace it -- anything
 * else would be throwing away the user's own work.
 */
export function isUntouchedStart(state) {
  const habits = state?.habits || [];
  if (habits.length !== 1) return false;
  const [h] = habits;
  if (h.name !== 'MY ROUTINE' || h.archivedAt) return false;
  const records = state.completions?.[h.id] || {};
  return Object.keys(records).length === 0 && Object.keys(state.notes || {}).length === 0;
}
