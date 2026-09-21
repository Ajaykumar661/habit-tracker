// The room that grows.
//
// What the room holds is earned by the best streak ever reached, on any
// routine -- never the current one. A trophy that vanished the day a streak
// broke would be a punishment, and the rest of the app is careful never to
// shame a lapse. What you built stays built.
//
// Seasons come from the calendar alone: no location, nothing leaves the
// device.

import { calculateLongestStreak } from './streaks';
import { parseDateStr } from '../lib/dates';

/** The best run ever reached across every routine, archived ones included. */
export function bestStreakOf(routines, today) {
  let best = 0;
  for (const r of routines || []) {
    if (!r) continue;
    best = Math.max(best, calculateLongestStreak(r, r.completed || [], today));
  }
  return best;
}

/** The milestone objects earned at `best` days, in the order they were won. */
export function earnedMilestones(milestones, best) {
  return (milestones || []).filter((m) => best >= m.day).sort((a, b) => a.day - b.day);
}

/** The next object still to earn, or null once the room is complete. */
export function nextMilestone(milestones, best) {
  return (milestones || []).filter((m) => best < m.day).sort((a, b) => a.day - b.day)[0] || null;
}

/**
 * How the cat is kept: her own ledge, then a bed at 30 days, then her crown
 * at 100. Only a look the theme actually has is returned.
 * @returns {'crown' | 'bed' | null}
 */
export function catLookFor(cat, best) {
  if (cat?.crown && best >= cat.crown.day) return 'crown';
  if (cat?.bed && best >= cat.bed.day) return 'bed';
  return null;
}

/**
 * The season on a date, northern-hemisphere meteorological seasons: whole
 * months, so the room never changes mid-month.
 * @returns {'winter' | 'spring' | 'summer' | 'autumn'}
 */
export function seasonOf(dateStr) {
  const month = parseDateStr(dateStr).getMonth();    // 0 = January
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}
