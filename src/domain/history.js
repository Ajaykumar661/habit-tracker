// Streak history: the runs that came before, and why they ended.
//
// The segments already exist in the streak engine; this turns them into
// something a person can read — dated runs, newest first, each knowing the
// day it broke. A reason is optional and entirely the user's: the app never
// guesses one, because "why" is not something completion records can know.

import { computeStats } from './streaks';
import { habitToday, addDays } from '../lib/dates';

/** Reasons offered for a broken run. `other` lets people say their own. */
export const BREAK_REASONS = [
  { id: 'busy', label: 'TOO BUSY' },
  { id: 'sick', label: 'UNWELL' },
  { id: 'travel', label: 'TRAVELLING' },
  { id: 'forgot', label: 'FORGOT' },
  { id: 'intentional', label: 'A CHOSEN REST' },
  { id: 'other', label: 'SOMETHING ELSE' },
];

export function reasonLabel(id) {
  return BREAK_REASONS.find((r) => r.id === id)?.label || null;
}

/**
 * Every run this habit has had, newest first.
 *
 * @returns {Array<{
 *   days:number, start:string, end:string,
 *   live:boolean, brokenOn:string|null, reason:string|null,
 * }>}
 */
export function getStreakHistory(routine, today = habitToday()) {
  if (!routine) return [];
  const stats = computeStats(routine, today);
  const reasons = routine.breakReasons || {};

  return stats.segments
    .map((seg) => {
      const start = seg.dates[0];
      const end = seg.dates[seg.dates.length - 1];
      const live = seg === stats.currentSegment;
      return {
        days: seg.dates.length,
        start,
        end,
        live,
        // The break is the day after the run's last mark. Only meaningful
        // for a run that actually ended.
        brokenOn: live ? null : addDays(end, 1),
        reason: live ? null : (reasons[end] || null),
      };
    })
    .reverse();
}

/** The runs that have ended, newest first. */
export function getPreviousStreaks(routine, today = habitToday()) {
  return getStreakHistory(routine, today).filter((s) => !s.live);
}
